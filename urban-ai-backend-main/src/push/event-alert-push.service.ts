import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Between, Not, Repository } from 'typeorm';
import { ScheduledJobRunnerService, runScheduledJob } from '../admin-job-runs/scheduled-job-runner.service';
import { CommunicationLogService } from '../communications/communication-log.service';
import { toSaoPauloDateKey } from '../common/sp-date';
import { AnalisePreco } from '../entities/AnalisePreco';
import { EventAlertDispatch } from '../entities/event-alert-dispatch.entity';
import { PushSubscription } from '../entities/push-subscription.entity';
import { UserCommunicationPreferences } from '../entities/user-communication-preferences.entity';
import { EntitlementService } from '../subscription/entitlement.service';
import {
  EventAlertCandidate,
  EventAlertSkipReason,
  eventAlertDay,
  eventAlertKey,
  resolveEventAlertConfig,
  selectEventAlerts,
} from './event-alert-selection';
import { PushNotificationService } from './push-notification.service';
import { buildEventAlertPayload } from './push-payload.builder';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const SCAN_LIMIT = 2000;
const EVENT_ALERT_KIND = 'event_alert';

export type EventAlertRunSummary = {
  enabled: boolean;
  scanned: number;
  candidates: number;
  sent: number;
  deferred: number;
  /** Candidatos descartados antes do envio, por motivo (inclui limites diários e idempotência). */
  skipped: Partial<Record<EventAlertSkipReason | 'not_entitled' | 'push_events_disabled' | 'no_active_subscription', number>>;
  /** Envios que não saíram (teto global, sem Web Push, falha): a reserva é liberada e tenta de novo no próximo tick. */
  released: number;
  failed: number;
};

function emptySummary(enabled: boolean): EventAlertRunSummary {
  return { enabled, scanned: 0, candidates: 0, sent: 0, deferred: 0, skipped: {}, released: 0, failed: 0 };
}

function isDuplicateKeyError(error: unknown): boolean {
  const e = error as { code?: string; errno?: number; message?: string } | undefined;
  return (
    e?.code === 'ER_DUP_ENTRY' ||
    e?.code === 'SQLITE_CONSTRAINT' ||
    e?.errno === 1062 ||
    /duplicate entry|unique constraint/i.test(String(e?.message ?? ''))
  );
}

/**
 * Push de "evento relevante perto do seu imóvel" (categoria `pushEvents`).
 *
 * Gatilho: job de hora em hora (`push-event-alert`), e não um hook no ingest. O ingest é
 * assíncrono em duas etapas (coleta + geocodificação, depois enriquecimento por IA que é quem define
 * `relevancia`) e o vínculo imóvel x evento só existe depois que o pipeline cria a `analise_preco`.
 * Um hook teria de cobrir os três pontos e perderia eventos se uma réplica caísse; o job varre o que
 * é novo (análise criada, ou evento atualizado/enriquecido, nas últimas `PUSH_EVENT_ALERT_LOOKBACK_HOURS`)
 * e a unicidade (user_id, event_id) em `event_alert_dispatches` garante um único aviso por anfitrião
 * e evento mesmo com réplicas concorrentes ou reprocessamento. O lock Redis do runner evita
 * execuções sobrepostas.
 */
@Injectable()
export class EventAlertPushService {
  private readonly logger = new Logger(EventAlertPushService.name);

  constructor(
    @InjectRepository(AnalisePreco) private readonly analiseRepo: Repository<AnalisePreco>,
    @InjectRepository(EventAlertDispatch) private readonly dispatchRepo: Repository<EventAlertDispatch>,
    @InjectRepository(PushSubscription) private readonly subscriptionRepo: Repository<PushSubscription>,
    @InjectRepository(UserCommunicationPreferences)
    private readonly preferencesRepo: Repository<UserCommunicationPreferences>,
    private readonly pushService: PushNotificationService,
    private readonly entitlement: EntitlementService,
    private readonly communicationLog: CommunicationLogService,
    @Optional() private readonly scheduledJobRunner?: ScheduledJobRunnerService,
  ) {}

  @Cron('20 * * * *', {
    name: 'push-event-alert',
    timeZone: 'America/Sao_Paulo',
    waitForCompletion: true,
  })
  async tick(): Promise<EventAlertRunSummary | undefined> {
    if (process.env.PUSH_EVENT_ALERT_ENABLED === 'false') return undefined;
    return runScheduledJob(this.scheduledJobRunner, 'push-event-alert', async () => {
      const summary = await this.processEventAlerts(new Date());
      if (summary.candidates > 0 || summary.sent > 0) {
        this.logger.log(`[push-event-alert] ${JSON.stringify(summary)}`);
      }
      return summary;
    });
  }

  async processEventAlerts(now: Date = new Date()): Promise<EventAlertRunSummary> {
    const summary = emptySummary(true);
    const config = resolveEventAlertConfig();
    const lookbackHours = Number(process.env.PUSH_EVENT_ALERT_LOOKBACK_HOURS);
    const lookback = (Number.isFinite(lookbackHours) && lookbackHours >= 1 ? Math.min(lookbackHours, 168) : 36) * HOUR_MS;
    const since = new Date(now.getTime() - lookback);
    const windowEnd = new Date(now.getTime() + config.windowDays * DAY_MS);

    const eventFilter = {
      dataInicio: Between(now, windowEnd),
      ativo: true,
      pendingGeocode: false,
      outOfScope: false,
      dedupStatus: 'canonical' as const,
      relevancia: MoreThanOrEqual(config.minRelevance),
    };
    const base = {
      status: Not(In(['rejected', 'expired'])) as any,
      endereco: { ativo: true },
      usuarioProprietario: { ativo: true },
    };
    // "Novo": a análise imóvel x evento foi criada agora há pouco, OU o evento foi atualizado
    // (ex.: enriquecimento por IA que acabou de definir a relevância).
    const analyses = await this.analiseRepo.find({
      where: [
        { ...base, criadoEm: MoreThanOrEqual(since), evento: eventFilter },
        { ...base, evento: { ...eventFilter, updatedAt: MoreThanOrEqual(since) } },
      ],
      relations: ['endereco', 'endereco.list', 'evento', 'usuarioProprietario'],
      order: { criadoEm: 'DESC' },
      take: SCAN_LIMIT,
    });
    summary.scanned = analyses.length;

    let candidates = analyses
      .map((analysis) => this.toCandidate(analysis))
      .filter((candidate): candidate is EventAlertCandidate => candidate !== null);
    if (!candidates.length) return summary;

    const bump = (key: keyof EventAlertRunSummary['skipped'], count = 1) => {
      summary.skipped[key] = (summary.skipped[key] ?? 0) + count;
    };
    const dropUsers = (users: Set<string>, reason: keyof EventAlertRunSummary['skipped']) => {
      if (!users.size) return;
      const kept = candidates.filter((candidate) => !users.has(candidate.userId));
      bump(reason, candidates.length - kept.length);
      candidates = kept;
    };

    // Só o plano pago/trial recebe (mesma regra do resumo semanal e do digest de preços).
    const userIds = [...new Set(candidates.map((candidate) => candidate.userId))];
    const entitled = await this.entitlement.filterEntitledUserIds(userIds);
    dropUsers(new Set(userIds.filter((id) => !entitled.has(id))), 'not_entitled');
    if (!candidates.length) return summary;

    // Preferência `pushEvents`: ausente = ligado; só `false` explícito bloqueia. Antes de reservar
    // nada e antes de contar limites, para o opt-out não gastar vaga nem ficar marcado como avisado.
    const remainingUsers = [...new Set(candidates.map((candidate) => candidate.userId))];
    const preferences = await this.preferencesRepo.find({ where: { userId: In(remainingUsers) } });
    const optedOut = new Set(preferences.filter((pref) => pref.pushEvents === false).map((pref) => pref.userId));
    for (const userId of optedOut) {
      await this.logSkip(userId, 'event_alert_push_events_disabled', { candidates: candidates.filter((c) => c.userId === userId).length });
    }
    dropUsers(optedOut, 'push_events_disabled');

    // Sem dispositivo com push ativo não há o que avisar (e não gastamos a reserva).
    const withUsers = [...new Set(candidates.map((candidate) => candidate.userId))];
    const subscriptions = withUsers.length
      ? await this.subscriptionRepo.find({ where: { userId: In(withUsers), active: true } })
      : [];
    const withDevice = new Set(subscriptions.map((subscription) => subscription.userId));
    dropUsers(new Set(withUsers.filter((id) => !withDevice.has(id))), 'no_active_subscription');
    if (!candidates.length) return summary;

    summary.candidates = candidates.length;
    const today = eventAlertDay(now);
    const finalUsers = [...new Set(candidates.map((candidate) => candidate.userId))];
    const finalEvents = [...new Set(candidates.map((candidate) => candidate.eventId))];
    const [known, usedToday] = await Promise.all([
      this.dispatchRepo.find({ where: { userId: In(finalUsers), eventId: In(finalEvents) } }),
      this.dispatchRepo.find({ where: { userId: In(finalUsers), sentOn: today } }),
    ]);
    const usedByProperty = new Map<string, number>();
    const usedByHost = new Map<string, number>();
    for (const row of usedToday) {
      usedByProperty.set(row.propertyId, (usedByProperty.get(row.propertyId) ?? 0) + 1);
      usedByHost.set(row.userId, (usedByHost.get(row.userId) ?? 0) + 1);
    }

    const { selected, skipped } = selectEventAlerts({
      candidates,
      now,
      alreadyAlerted: new Set(known.map((row) => eventAlertKey(row.userId, row.eventId))),
      usedTodayByProperty: usedByProperty,
      usedTodayByHost: usedByHost,
      config,
    });
    const limitHits = new Map<string, { reason: EventAlertSkipReason; events: Set<string> }>();
    for (const { candidate, reason } of skipped) {
      bump(reason);
      if (reason === 'host_daily_limit' || reason === 'property_daily_limit') {
        const key = `${candidate.userId}|${reason}`;
        const entry = limitHits.get(key) ?? { reason, events: new Set<string>() };
        entry.events.add(candidate.eventId);
        limitHits.set(key, entry);
      }
    }
    // Um registro por anfitrião e motivo por execução (não um por evento), para não encher o log.
    for (const [key, entry] of limitHits) {
      await this.logSkip(key.split('|')[0], `event_alert_${entry.reason}`, { events: entry.events.size });
    }

    for (const candidate of selected) {
      await this.dispatch(candidate, today, now, summary);
    }
    return summary;
  }

  private async dispatch(
    candidate: EventAlertCandidate,
    today: string,
    now: Date,
    summary: EventAlertRunSummary,
  ): Promise<void> {
    let claim: EventAlertDispatch;
    try {
      claim = await this.dispatchRepo.save(
        this.dispatchRepo.create({
          userId: candidate.userId,
          eventId: candidate.eventId,
          propertyId: candidate.propertyId,
          sentOn: today,
        }),
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        summary.skipped.already_alerted = (summary.skipped.already_alerted ?? 0) + 1;
        return;
      }
      summary.failed += 1;
      this.logger.warn(`[push-event-alert] reserva falhou user=${candidate.userId}: ${(error as Error)?.message}`);
      return;
    }

    try {
      const result = await this.pushService.sendToUser(
        candidate.userId,
        buildEventAlertPayload({
          eventName: candidate.eventName,
          neighborhood: candidate.neighborhood,
          startsOn: toSaoPauloDateKey(candidate.startsAt),
          startsAt: candidate.startsAt,
          propertyId: candidate.propertyId,
          propertyName: candidate.propertyName,
          imageUrl: candidate.imageUrl,
        }),
      );
      if (result.sent > 0) {
        summary.sent += 1;
        return;
      }
      if ((result.deferred ?? 0) > 0) {
        summary.deferred += 1;
        return;
      }
      // Teto global, sem Web Push configurado, falha em todos os dispositivos: nada saiu, então a
      // reserva é devolvida e o próximo tick tenta de novo (o evento segue dentro da janela).
      await this.release(claim);
      if (result.failed > 0) summary.failed += 1;
      else summary.released += 1;
    } catch (error) {
      await this.release(claim);
      summary.failed += 1;
      this.logger.warn(`[push-event-alert] envio falhou user=${candidate.userId}: ${(error as Error)?.message}`);
    }
  }

  private async release(claim: EventAlertDispatch): Promise<void> {
    await this.dispatchRepo.delete({ userId: claim.userId, eventId: claim.eventId }).catch(() => undefined);
  }

  private async logSkip(userId: string, reason: string, metadata: Record<string, unknown>): Promise<void> {
    await this.communicationLog.record({
      userId,
      channel: 'push',
      status: 'skipped',
      kind: EVENT_ALERT_KIND,
      failureReason: reason,
      metadata,
    });
  }

  private toCandidate(analysis: AnalisePreco): EventAlertCandidate | null {
    const event = analysis.evento;
    const address = analysis.endereco;
    const userId = analysis.usuarioProprietario?.id;
    if (!event?.id || !address?.id || !userId) return null;
    const startsAt = new Date(event.dataInicio);
    const relevance = event.relevancia === null || event.relevancia === undefined ? null : Number(event.relevancia);
    const distance = Number(analysis.distanciaSuaPropriedade);
    return {
      userId,
      propertyId: address.id,
      propertyName: address.list?.titulo || address.list?.internalNickname || null,
      neighborhood: address.bairro || null,
      eventId: event.id,
      eventName: event.nome || 'Evento',
      relevance: relevance !== null && Number.isFinite(relevance) ? relevance : null,
      startsAt,
      imageUrl: event.imagem_url || null,
      distanceKm: Number.isFinite(distance) ? distance : null,
    };
  }
}
