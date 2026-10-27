import { BadRequestException, Injectable, Logger, NotFoundException, Optional, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { CommunicationLogService } from 'src/communications/communication-log.service';
import { PushDelivery } from 'src/entities/push-delivery.entity';
import { PushSubscription } from 'src/entities/push-subscription.entity';
import { User } from 'src/entities/user.entity';
import { UserCommunicationPreferences } from 'src/entities/user-communication-preferences.entity';
import { IsNull, LessThanOrEqual, MoreThan, Not, Repository } from 'typeorm';
import { RemovePushSubscriptionDto, UpsertPushSubscriptionDto } from './push.dto';
import { PushEndpointSecurity } from './push-endpoint-security';
import { HTTP_TIMEOUT_MS, fetchWithTimeout } from '../common/http-timeouts';
import {
  decidePushPolicy,
  deferralExpiry,
  isWithinQuietHours,
  nextQuietEnd,
  normalizePushPayload,
  parseQuietHours,
  planDeferredDrain,
  pushCategoryFromType,
  type PwaPushPayload,
} from './push-payload.builder';

export type { PwaPushPayload } from './push-payload.builder';

/** Teto de avisos por usuário em 24h (por dispositivo ativo). `PUSH_MAX_PER_DAY` sobrescreve. */
const DEFAULT_MAX_PUSH_PER_DAY = 6;

export type PushSendResult = {
  enabled: boolean;
  attempted: number;
  sent: number;
  failed: number;
  skippedReason?: string;
  /** Quantos envios ficaram adiados (horário de silêncio) para as 08:00 de São Paulo. */
  deferred?: number;
};

export type DeferredDrainResult = {
  due: number;
  sent: number;
  failed: number;
  expired: number;
  superseded: number;
  dropped: number;
  skippedClaim: number;
};

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly vapidSubject = process.env.WEB_PUSH_SUBJECT || 'mailto:contato@myurbanai.com';
  private readonly vapidPublicKey = process.env.WEB_PUSH_PUBLIC_KEY || '';
  private readonly vapidPrivateKey = process.env.WEB_PUSH_PRIVATE_KEY || '';
  private readonly endpointSecurity: PushEndpointSecurity;

  constructor(
    @InjectRepository(PushSubscription)
    private readonly subscriptionRepo: Repository<PushSubscription>,
    @InjectRepository(PushDelivery)
    private readonly deliveryRepo: Repository<PushDelivery>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly communicationLog: CommunicationLogService,
    @Optional() endpointSecurity?: PushEndpointSecurity,
    @Optional()
    @InjectRepository(UserCommunicationPreferences)
    private readonly preferencesRepo?: Repository<UserCommunicationPreferences>,
  ) {
    this.endpointSecurity = endpointSecurity ?? new PushEndpointSecurity();
  }

  getPublicConfig() {
    return {
      enabled: this.isConfigured(),
      publicKey: this.vapidPublicKey || null,
    };
  }

  async upsertSubscription(
    userId: string,
    input: UpsertPushSubscriptionDto,
    userAgent?: string,
  ): Promise<{ ok: true; deviceId: string; secret: string; enabled: boolean }> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Web Push não configurado no backend');
    }

    await this.assertValidSubscriptionInput(input);

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    if (user.ativo === false) throw new BadRequestException('Usuário inativo não pode ativar push');

    const endpointHash = this.sha256(input.endpoint);
    const existingByEndpoint = await this.subscriptionRepo.findOne({ where: { endpointHash } });
    const existingByDevice = input.deviceId
      ? await this.subscriptionRepo.findOne({ where: { deviceId: input.deviceId } })
      : null;
    const existing = existingByEndpoint || existingByDevice;
    const secret = this.newSecret();

    const subscription = this.subscriptionRepo.create({
      ...(existing ? { id: existing.id } : {}),
      userId,
      deviceId: existing?.deviceId || input.deviceId || crypto.randomUUID(),
      deviceSecretHash: this.sha256(secret),
      endpointHash,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: userAgent || existing?.userAgent || null,
      platform: input.platform || existing?.platform || null,
      active: true,
      failedAttempts: 0,
      lastPushFailureAt: null,
      failureReason: null,
      lastPushSuccessAt: existing?.lastPushSuccessAt || null,
    });

    const saved = await this.subscriptionRepo.save(subscription);
    return { ok: true, deviceId: saved.deviceId, secret, enabled: true };
  }

  async deactivateSubscription(userId: string, input: RemovePushSubscriptionDto): Promise<{ ok: true; deactivated: number }> {
    if (!input.endpoint && !input.deviceId) {
      throw new BadRequestException('endpoint ou deviceId e obrigatorio');
    }

    const where = input.endpoint
      ? { userId, endpointHash: this.sha256(input.endpoint) }
      : { userId, deviceId: input.deviceId };
    const subscription = await this.subscriptionRepo.findOne({ where });
    if (!subscription) return { ok: true, deactivated: 0 };

    subscription.active = false;
    await this.subscriptionRepo.save(subscription);
    return { ok: true, deactivated: 1 };
  }

  async sendToUser(userId: string, payload: PwaPushPayload): Promise<PushSendResult> {
    if (!this.isConfigured()) {
      await this.communicationLog.record({
        userId,
        channel: 'push',
        status: 'skipped',
        kind: this.pushKind(payload),
        title: payload.title,
        failureReason: 'missing_vapid_keys',
      });
      return { enabled: false, attempted: 0, sent: 0, failed: 0, skippedReason: 'missing_vapid_keys' };
    }

    const subscriptions = await this.subscriptionRepo.find({
      where: { userId, active: true, user: { ativo: true } },
      relations: ['user'],
    });
    if (!subscriptions.length) {
      await this.communicationLog.record({
        userId,
        channel: 'push',
        status: 'skipped',
        kind: this.pushKind(payload),
        title: payload.title,
        failureReason: 'no_active_subscriptions',
      });
      return { enabled: true, attempted: 0, sent: 0, failed: 0, skippedReason: 'no_active_subscriptions' };
    }

    const skippedByPolicy = await this.evaluatePolicy(userId, payload, subscriptions.length);
    if (skippedByPolicy === 'quiet_hours') {
      const deferred = await this.deferDeliveries(userId, payload, subscriptions);
      await this.communicationLog.record({
        userId,
        channel: 'push',
        status: 'skipped',
        kind: this.pushKind(payload),
        title: payload.title,
        failureReason: 'quiet_hours_deferred',
        metadata: { tag: payload.tag, deferred },
      });
      return { enabled: true, attempted: 0, sent: 0, failed: 0, skippedReason: 'quiet_hours', deferred };
    }
    if (skippedByPolicy) {
      await this.communicationLog.record({
        userId,
        channel: 'push',
        status: 'skipped',
        kind: this.pushKind(payload),
        title: payload.title,
        failureReason: skippedByPolicy,
      });
      return { enabled: true, attempted: 0, sent: 0, failed: 0, skippedReason: skippedByPolicy };
    }

    let sent = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
      const delivery = await this.deliveryRepo.save(
        this.deliveryRepo.create({
          subscriptionId: subscription.id,
          userId,
          payloadJson: JSON.stringify(this.normalizePayload(payload)),
        }),
      );

      const outcome = await this.dispatchWake(subscription, delivery, userId, payload);
      if (outcome === 'sent') sent += 1;
      else failed += 1;
    }

    return { enabled: true, attempted: subscriptions.length, sent, failed };
  }

  /** Envia o wake push de uma entrega já gravada e atualiza assinatura, entrega e log. */
  private async dispatchWake(
    subscription: PushSubscription,
    delivery: PushDelivery,
    userId: string,
    payload: PwaPushPayload,
  ): Promise<'sent' | 'failed'> {
    let outcome: 'sent' | 'failed' = 'sent';
    try {
      subscription.lastPushAttemptAt = new Date();
      await this.sendWakePush(subscription);
      subscription.failedAttempts = 0;
      subscription.lastPushSuccessAt = new Date();
      subscription.lastPushFailureAt = null;
      subscription.failureReason = null;
      delivery.pushedAt = new Date();
      await this.communicationLog.record({
        userId,
        channel: 'push',
        status: 'sent',
        kind: this.pushKind(payload),
        recipientDeviceId: subscription.deviceId,
        title: payload.title,
        provider: 'web_push',
        providerMessageId: delivery.id,
        metadata: {
          tag: payload.tag,
          url: payload.url,
        },
      });
    } catch (error) {
      outcome = 'failed';
      const reason = error instanceof Error ? error.message : String(error);
      subscription.failedAttempts = Number(subscription.failedAttempts || 0) + 1;
      subscription.lastPushFailureAt = new Date();
      subscription.failureReason = reason.slice(0, 255);
      delivery.failedAt = new Date();
      delivery.failureReason = reason.slice(0, 255);
      if (this.isGonePushError(reason)) subscription.active = false;
      this.logger.warn(`Falha ao enviar wake push subscription=${subscription.id}: ${reason}`);
      await this.communicationLog.record({
        userId,
        channel: 'push',
        status: 'failed',
        kind: this.pushKind(payload),
        recipientDeviceId: subscription.deviceId,
        title: payload.title,
        provider: 'web_push',
        providerMessageId: delivery.id,
        failureReason: reason,
        metadata: {
          tag: payload.tag,
          url: payload.url,
        },
      });
    }

    await Promise.all([this.subscriptionRepo.save(subscription), this.deliveryRepo.save(delivery)]);
    return outcome;
  }

  /** Grava uma entrega por dispositivo com `deliverAfter` = próximo fim do silêncio. Não envia nada. */
  private async deferDeliveries(
    userId: string,
    payload: PwaPushPayload,
    subscriptions: PushSubscription[],
  ): Promise<number> {
    const now = new Date();
    const normalized = this.normalizePayload(payload);
    const deliverAfter = nextQuietEnd(now, parseQuietHours(process.env.PUSH_QUIET_HOURS));
    const expiresAt = deferralExpiry(now, normalized.expiresAt);
    for (const subscription of subscriptions) {
      await this.deliveryRepo.save(
        this.deliveryRepo.create({
          subscriptionId: subscription.id,
          userId,
          payloadJson: JSON.stringify(normalized),
          tag: normalized.tag ?? null,
          deliverAfter,
          expiresAt,
        }),
      );
    }
    return subscriptions.length;
  }

  /**
   * Envia os pushes adiados que já venceram o silêncio. Seguro para rodar várias vezes e em
   * várias réplicas: cada entrega é "reivindicada" por um UPDATE condicional (deliverAfter vira
   * nulo), então só uma execução envia. Antes de enviar: colapsa por tag/dispositivo (fica o mais
   * recente), descarta vencidos e repassa pela mesma política (preferência da categoria relida
   * agora e teto diário do dia do envio).
   */
  async drainDeferred(now: Date = new Date()): Promise<DeferredDrainResult> {
    const result: DeferredDrainResult = {
      due: 0, sent: 0, failed: 0, expired: 0, superseded: 0, dropped: 0, skippedClaim: 0,
    };
    if (!this.isConfigured()) return result;
    // Ainda dentro do silêncio: nada a enviar (o cron das 08:00 BRT e os seguintes cuidam disso).
    if (isWithinQuietHours(now, parseQuietHours(process.env.PUSH_QUIET_HOURS))) return result;

    const rows = await this.deliveryRepo.find({
      where: {
        deliverAfter: LessThanOrEqual(now),
        pushedAt: IsNull(),
        deliveredAt: IsNull(),
        failedAt: IsNull(),
      },
      order: { createdAt: 'ASC' },
      take: 1000,
    });
    const due = rows.filter((row) => row.deliverAfter !== null);
    result.due = due.length;
    if (!due.length) return result;

    const plan = planDeferredDrain(due, now);
    const byId = new Map(due.map((row) => [row.id, row]));
    for (const row of plan.expired) {
      if (await this.discardDeferred(byId.get(row.id) as PushDelivery, 'deferred_expired', now)) result.expired += 1;
    }
    for (const row of plan.superseded) {
      if (await this.discardDeferred(byId.get(row.id) as PushDelivery, 'deferred_superseded', now)) result.superseded += 1;
    }

    const sentToday = new Map<string, number>();
    const prefsByUser = new Map<string, Partial<UserCommunicationPreferences> | null>();
    for (const planned of plan.send) {
      const row = byId.get(planned.id) as PushDelivery;
      const payload = this.parsePayload(row.payloadJson);
      const category = pushCategoryFromType(payload.data?.type);

      if (!prefsByUser.has(row.userId)) {
        prefsByUser.set(row.userId, (await this.preferencesRepo?.findOne({ where: { userId: row.userId } }).catch(() => null)) ?? null);
      }
      if (!sentToday.has(row.userId)) sentToday.set(row.userId, await this.countSentSince(row.userId, now));
      const subscription = await this.subscriptionRepo.findOne({
        where: { id: row.subscriptionId, active: true, user: { ativo: true } },
        relations: ['user'],
      });
      if (!subscription) {
        if (await this.discardDeferred(row, 'deferred_subscription_inactive', now)) result.dropped += 1;
        continue;
      }

      const decision = decidePushPolicy({
        category,
        payload,
        preferences: prefsByUser.get(row.userId) ?? null,
        now,
        // Já passou o silêncio; o que resta é preferência atual e teto do dia.
        quietHours: null,
        deliveriesLast24h: sentToday.get(row.userId) ?? 0,
        maxPerDay: this.maxPushPerDay(),
      });
      if (decision.allowed === false) {
        if (await this.discardDeferred(row, `deferred_${decision.reason}`, now)) result.dropped += 1;
        continue;
      }

      const claimed = await this.claimDeferred(row.id);
      if (!claimed) {
        result.skippedClaim += 1;
        continue;
      }
      row.deliverAfter = null;
      sentToday.set(row.userId, (sentToday.get(row.userId) ?? 0) + 1);
      const outcome = await this.dispatchWake(subscription, row, row.userId, payload);
      if (outcome === 'sent') result.sent += 1;
      else result.failed += 1;
    }
    return result;
  }

  /** UPDATE condicional: só uma execução consegue tirar a entrega do estado "adiada". */
  private async claimDeferred(id: string): Promise<boolean> {
    const res = await this.deliveryRepo.update({ id, deliverAfter: Not(IsNull()) }, { deliverAfter: null });
    return Number(res?.affected ?? 0) === 1;
  }

  private async discardDeferred(row: PushDelivery, reason: string, now: Date): Promise<boolean> {
    const res = await this.deliveryRepo.update(
      { id: row.id, deliverAfter: Not(IsNull()) },
      { deliverAfter: null, failedAt: now, failureReason: reason.slice(0, 255) },
    );
    if (Number(res?.affected ?? 0) !== 1) return false;
    await this.communicationLog.record({
      userId: row.userId,
      channel: 'push',
      status: 'skipped',
      kind: this.pushKind(this.parsePayload(row.payloadJson)),
      failureReason: reason,
      providerMessageId: row.id,
    });
    return true;
  }

  /** Envios do usuário nas últimas 24h contados a partir do instante do envio (não da criação do adiado). */
  private async countSentSince(userId: string, now: Date): Promise<number> {
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return this.deliveryRepo
      .count({ where: [
        { userId, deliverAfter: IsNull(), pushedAt: MoreThan(since) },
        { userId, deliverAfter: IsNull(), pushedAt: IsNull(), failedAt: IsNull(), createdAt: MoreThan(since) },
      ] })
      .catch(() => 0);
  }

  async getPendingDeliveries(
    deviceId: string,
    secret: string | undefined,
  ): Promise<{ notifications: (PwaPushPayload & { deliveryId: string })[] }> {
    if (!deviceId || !secret) throw new UnauthorizedException('Credenciais do device ausentes');

    const subscription = await this.subscriptionRepo.findOne({
      where: {
        deviceId,
        deviceSecretHash: this.sha256(secret),
        active: true,
      },
    });
    if (!subscription) throw new UnauthorizedException('Device push inválido');

    const deliveries = await this.deliveryRepo.find({
      where: {
        subscriptionId: subscription.id,
        deliveredAt: IsNull(),
        failedAt: IsNull(),
        deliverAfter: IsNull(),
      },
      order: { createdAt: 'ASC' },
      take: 5,
    });

    const now = new Date();
    const notifications = deliveries.map((delivery) => {
      delivery.deliveredAt = now;
      return {
        ...this.parsePayload(delivery.payloadJson),
        deliveryId: delivery.id,
      };
    });

    if (deliveries.length) await this.deliveryRepo.save(deliveries);
    return { notifications };
  }

  /**
   * Opt-out por categoria, horário de silêncio (São Paulo) e teto diário. Devolve o motivo do
   * bloqueio ou null. Falha ao ler preferências/contagem não bloqueia (fail-open só para a
   * leitura; o opt-out explícito `false` sempre vale).
   */
  private async evaluatePolicy(userId: string, payload: PwaPushPayload, deviceCount: number): Promise<string | null> {
    const category = pushCategoryFromType(payload.data?.type);
    const preferences = await this.preferencesRepo?.findOne({ where: { userId } }).catch(() => null);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const deliveriesLast24h = category === 'test'
      ? 0
      : await this.deliveryRepo
          .count({ where: [
            { userId, deliverAfter: IsNull(), pushedAt: MoreThan(since) },
            { userId, deliverAfter: IsNull(), pushedAt: IsNull(), failedAt: IsNull(), createdAt: MoreThan(since) },
          ] })
          .catch(() => 0);
    const decision = decidePushPolicy({
      category,
      payload,
      preferences: preferences ?? null,
      now: new Date(),
      quietHours: parseQuietHours(process.env.PUSH_QUIET_HOURS),
      deliveriesLast24h,
      maxPerDay: this.maxPushPerDay() * Math.max(1, deviceCount),
    });
    return decision.allowed === false ? decision.reason : null;
  }

  private maxPushPerDay(): number {
    const configured = Number(process.env.PUSH_MAX_PER_DAY);
    return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : DEFAULT_MAX_PUSH_PER_DAY;
  }

  private isConfigured(): boolean {
    return Boolean(this.vapidPublicKey && this.vapidPrivateKey);
  }

  private pushKind(payload: PwaPushPayload): string {
    const type = payload.data?.type;
    return typeof type === 'string' && type.trim() ? type.trim() : 'pwa_push';
  }

  private async assertValidSubscriptionInput(input: UpsertPushSubscriptionDto): Promise<void> {
    if (!input.endpoint || !/^https:\/\//i.test(input.endpoint)) {
      throw new BadRequestException('endpoint push inválido');
    }
    if (!input.keys?.p256dh || !input.keys?.auth) {
      throw new BadRequestException('chaves push ausentes');
    }
    try {
      await this.endpointSecurity.assertSafe(input.endpoint);
    } catch {
      throw new BadRequestException('endpoint push invÃ¡lido');
    }
  }

  private normalizePayload(payload: PwaPushPayload): PwaPushPayload {
    return normalizePushPayload(payload);
  }

  private parsePayload(payloadJson: string): PwaPushPayload {
    try {
      return this.normalizePayload(JSON.parse(payloadJson));
    } catch {
      return this.normalizePayload({ title: 'Urban AI', body: 'Você tem uma nova notificação.', url: '/notificacao' });
    }
  }

  private async sendWakePush(subscription: PushSubscription): Promise<void> {
    // Re-resolve immediately before I/O so persisted subscriptions cannot use
    // DNS changes after registration to reach an internal address.
    const endpointUrl = await this.endpointSecurity.assertSafe(subscription.endpoint);
    const token = this.createVapidJwt(endpointUrl.origin);
    const response = await fetchWithTimeout(
      endpointUrl.toString(),
      {
        method: 'POST',
        redirect: 'manual',
        headers: {
          TTL: '2419200',
          Urgency: 'normal',
          Authorization: `vapid t=${token}, k=${this.vapidPublicKey}`,
        },
      },
      HTTP_TIMEOUT_MS.fast,
    );

    if (response.status >= 300 && response.status < 400) {
      throw new Error('push_redirect_blocked');
    }
    if (response.ok || [201, 202].includes(response.status)) return;

    const text = await response.text().catch(() => '');
    throw new Error(`push_http_${response.status}${text ? `:${text.slice(0, 120)}` : ''}`);
  }

  private createVapidJwt(audience: string): string {
    const header = this.base64UrlJson({ typ: 'JWT', alg: 'ES256' });
    const payload = this.base64UrlJson({
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
      sub: this.vapidSubject,
    });
    const signingInput = `${header}.${payload}`;
    const privateKey = this.createPrivateKeyFromVapid();
    const signer = crypto.createSign('SHA256');
    signer.update(signingInput);
    signer.end();
    const signatureDer = signer.sign(privateKey);
    return `${signingInput}.${this.base64Url(this.derToJose(signatureDer))}`;
  }

  private createPrivateKeyFromVapid(): crypto.KeyObject {
    const publicKeyBytes = this.base64UrlToBuffer(this.vapidPublicKey);
    const privateKeyBytes = this.base64UrlToBuffer(this.vapidPrivateKey);
    if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 4 || privateKeyBytes.length !== 32) {
      throw new Error('vapid_keys_invalid');
    }

    const x = this.base64Url(publicKeyBytes.subarray(1, 33));
    const y = this.base64Url(publicKeyBytes.subarray(33, 65));
    const d = this.base64Url(privateKeyBytes);
    return crypto.createPrivateKey({
      key: { kty: 'EC', crv: 'P-256', x, y, d },
      format: 'jwk',
    } as any);
  }

  private derToJose(signature: Buffer): Buffer {
    let offset = 0;
    if (signature[offset++] !== 0x30) throw new Error('invalid_ecdsa_signature');
    const sequence = this.readDerLength(signature, offset);
    offset = sequence.offset;
    if (sequence.length <= 0 || signature[offset++] !== 0x02) throw new Error('invalid_ecdsa_signature');
    const rLength = this.readDerLength(signature, offset);
    offset = rLength.offset;
    const r = signature.subarray(offset, offset + rLength.length);
    offset += rLength.length;
    if (signature[offset++] !== 0x02) throw new Error('invalid_ecdsa_signature');
    const sLength = this.readDerLength(signature, offset);
    offset = sLength.offset;
    const s = signature.subarray(offset, offset + sLength.length);
    return Buffer.concat([this.leftPad32(r), this.leftPad32(s)]);
  }

  private readDerLength(buffer: Buffer, offset: number): { length: number; offset: number } {
    let length = buffer[offset++];
    if ((length & 0x80) === 0) return { length, offset };
    const bytes = length & 0x7f;
    length = 0;
    for (let index = 0; index < bytes; index += 1) {
      length = (length << 8) + buffer[offset++];
    }
    return { length, offset };
  }

  private leftPad32(value: Buffer): Buffer {
    let normalized = value;
    while (normalized.length > 32 && normalized[0] === 0) normalized = normalized.subarray(1);
    if (normalized.length > 32) return normalized.subarray(normalized.length - 32);
    if (normalized.length === 32) return normalized;
    return Buffer.concat([Buffer.alloc(32 - normalized.length), normalized]);
  }

  private base64UrlJson(value: unknown): string {
    return this.base64Url(Buffer.from(JSON.stringify(value)));
  }

  private base64Url(value: Buffer): string {
    return value.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  private base64UrlToBuffer(value: string): Buffer {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='), 'base64');
  }

  private sha256(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private newSecret(): string {
    return this.base64Url(crypto.randomBytes(32));
  }

  private isGonePushError(reason: string): boolean {
    return reason.includes('push_http_404') || reason.includes('push_http_410');
  }
}
