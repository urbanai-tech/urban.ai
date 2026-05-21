import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { PushDelivery } from 'src/entities/push-delivery.entity';
import { PushSubscription } from 'src/entities/push-subscription.entity';
import { User } from 'src/entities/user.entity';
import { IsNull, Repository } from 'typeorm';
import { RemovePushSubscriptionDto, UpsertPushSubscriptionDto } from './push.dto';

export type PwaPushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  requireInteraction?: boolean;
  data?: Record<string, unknown>;
  actions?: { action: string; title: string }[];
};

export type PushSendResult = {
  enabled: boolean;
  attempted: number;
  sent: number;
  failed: number;
  skippedReason?: string;
};

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly vapidSubject = process.env.WEB_PUSH_SUBJECT || 'mailto:contato@myurbanai.com';
  private readonly vapidPublicKey = process.env.WEB_PUSH_PUBLIC_KEY || '';
  private readonly vapidPrivateKey = process.env.WEB_PUSH_PRIVATE_KEY || '';

  constructor(
    @InjectRepository(PushSubscription)
    private readonly subscriptionRepo: Repository<PushSubscription>,
    @InjectRepository(PushDelivery)
    private readonly deliveryRepo: Repository<PushDelivery>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) { }

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
      throw new BadRequestException('Web Push nao configurado no backend');
    }

    this.assertValidSubscriptionInput(input);

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario nao encontrado');
    if (user.ativo === false) throw new BadRequestException('Usuario inativo nao pode ativar push');

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
      return { enabled: false, attempted: 0, sent: 0, failed: 0, skippedReason: 'missing_vapid_keys' };
    }

    const subscriptions = await this.subscriptionRepo.find({
      where: { userId, active: true, user: { ativo: true } },
      relations: ['user'],
    });
    if (!subscriptions.length) {
      return { enabled: true, attempted: 0, sent: 0, failed: 0, skippedReason: 'no_active_subscriptions' };
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

      try {
        subscription.lastPushAttemptAt = new Date();
        await this.sendWakePush(subscription);
        subscription.failedAttempts = 0;
        subscription.lastPushSuccessAt = new Date();
        subscription.lastPushFailureAt = null;
        subscription.failureReason = null;
        delivery.pushedAt = new Date();
        sent += 1;
      } catch (error) {
        failed += 1;
        const reason = error instanceof Error ? error.message : String(error);
        subscription.failedAttempts = Number(subscription.failedAttempts || 0) + 1;
        subscription.lastPushFailureAt = new Date();
        subscription.failureReason = reason.slice(0, 255);
        delivery.failedAt = new Date();
        delivery.failureReason = reason.slice(0, 255);
        if (this.isGonePushError(reason)) subscription.active = false;
        this.logger.warn(`Falha ao enviar wake push subscription=${subscription.id}: ${reason}`);
      }

      await Promise.all([
        this.subscriptionRepo.save(subscription),
        this.deliveryRepo.save(delivery),
      ]);
    }

    return { enabled: true, attempted: subscriptions.length, sent, failed };
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
    if (!subscription) throw new UnauthorizedException('Device push invalido');

    const deliveries = await this.deliveryRepo.find({
      where: {
        subscriptionId: subscription.id,
        deliveredAt: IsNull(),
        failedAt: IsNull(),
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

  private isConfigured(): boolean {
    return Boolean(this.vapidPublicKey && this.vapidPrivateKey);
  }

  private assertValidSubscriptionInput(input: UpsertPushSubscriptionDto): void {
    if (!input.endpoint || !/^https:\/\//i.test(input.endpoint)) {
      throw new BadRequestException('endpoint push invalido');
    }
    if (!input.keys?.p256dh || !input.keys?.auth) {
      throw new BadRequestException('chaves push ausentes');
    }
  }

  private normalizePayload(payload: PwaPushPayload): PwaPushPayload {
    return {
      title: String(payload.title || 'Urban AI').slice(0, 120),
      body: payload.body ? String(payload.body).slice(0, 240) : undefined,
      url: this.normalizeUrl(payload.url),
      tag: payload.tag ? String(payload.tag).slice(0, 120) : undefined,
      icon: payload.icon || '/pwa-icon-192.png',
      badge: payload.badge || '/maskable-icon-512.png',
      requireInteraction: Boolean(payload.requireInteraction),
      data: payload.data || {},
      actions: (payload.actions || [{ action: 'open', title: 'Ver' }]).slice(0, 2),
    };
  }

  private normalizeUrl(url?: string): string {
    if (!url) return '/notificacao';
    if (url.startsWith('/')) return url;
    try {
      const parsed = new URL(url);
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/notificacao';
    } catch {
      return '/notificacao';
    }
  }

  private parsePayload(payloadJson: string): PwaPushPayload {
    try {
      return this.normalizePayload(JSON.parse(payloadJson));
    } catch {
      return this.normalizePayload({ title: 'Urban AI', body: 'Voce tem uma nova notificacao.', url: '/notificacao' });
    }
  }

  private async sendWakePush(subscription: PushSubscription): Promise<void> {
    const endpointUrl = new URL(subscription.endpoint);
    const token = this.createVapidJwt(endpointUrl.origin);
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        TTL: '2419200',
        Urgency: 'normal',
        Authorization: `vapid t=${token}, k=${this.vapidPublicKey}`,
      },
    });

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
