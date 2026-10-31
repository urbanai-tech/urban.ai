import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import * as Sentry from '@sentry/nestjs';
import { Between, IsNull, Not, Repository } from 'typeorm';
import { Event } from '../entities/events.entity';
import { EventReference } from '../entities/event-reference.entity';
import { EventReferenceVote } from '../entities/event-reference-vote.entity';
import {
  EventCoverageSnapshot,
  type EventCoverageDimension,
  type EventCoverageScope,
} from '../entities/event-coverage-snapshot.entity';
import { EventIdentityService } from '../evento/event-identity.service';
import { MailerService } from '../mailer/mailer.service';
import { ScheduledJobRunnerService, runScheduledJob } from '../admin-job-runs/scheduled-job-runner.service';
import { addDaysToDateKey, saoPauloDayBounds, todaySaoPauloDateKey } from '../common/sp-date';
import {
  loadReferenceVenues,
  readEventReferenceConfig,
  type EventReferenceConfig,
} from './event-reference.config';
import { matchReferenceToEvents, type MatchableEvent } from './event-reference-match';
import {
  buildVenueResolver,
  classifyEvent,
  computePrecisionRows,
  computeRecallRows,
  deterministicSample,
  mergeSnapshotRows,
  type MetricsReference,
  type PrecisionReference,
} from './event-coverage-metrics';

export interface MatchAndMetricsResult {
  snapshotDate: string;
  referencesChecked: number;
  matched: number;
  unmatched: number;
  newlyMatched: number;
  lostMatch: number;
  snapshotRows: number;
  recallPast30Pct: number | null;
  recallPast30Total: number;
  recallNext90Pct: number | null;
  precisionPct: number | null;
  precisionSample: number;
  alerted: boolean;
}

/** Dias à frente do casamento além do horizonte da curadoria (referências de CSV podem ir além). */
const MATCH_LOOKBACK_DAYS = 35;

@Injectable()
export class EventCoverageService {
  private readonly logger = new Logger(EventCoverageService.name);
  private lastAlertDay: string | null = null;

  constructor(
    @InjectRepository(EventReference) private readonly refRepo: Repository<EventReference>,
    @InjectRepository(EventReferenceVote) private readonly voteRepo: Repository<EventReferenceVote>,
    @InjectRepository(EventCoverageSnapshot) private readonly snapshotRepo: Repository<EventCoverageSnapshot>,
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    private readonly identity: EventIdentityService,
    @Optional() private readonly mailer?: MailerService,
    @Optional() private readonly scheduledJobRunner?: ScheduledJobRunnerService,
  ) {}

  @Cron('30 5 * * *', {
    name: 'event-coverage-match-metrics',
    timeZone: 'America/Sao_Paulo',
    waitForCompletion: true,
  })
  async handleDailyMatchAndMetrics(): Promise<MatchAndMetricsResult | { skipped: true; reason: string }> {
    return runScheduledJob(this.scheduledJobRunner, 'event-coverage-match-metrics', async () => {
      if (!readEventReferenceConfig().metricsEnabled) {
        return { skipped: true as const, reason: 'métricas de cobertura desligadas (EVENT_COVERAGE_METRICS_ENABLED=false)' };
      }
      return this.runMatchAndMetrics();
    });
  }

  /** Casa as referências aprovadas com `events`, grava o snapshot do dia e avisa se o recall cair. */
  async runMatchAndMetrics(now: Date = new Date()): Promise<MatchAndMetricsResult> {
    const config = readEventReferenceConfig();
    const today = todaySaoPauloDateKey(now);
    const from = addDaysToDateKey(today, -MATCH_LOOKBACK_DAYS);
    const to = addDaysToDateKey(today, config.horizonDays);

    const refs = await this.refRepo.find({
      where: { status: 'aprovado', dateKey: Between(from, to) },
    });

    const events = await this.loadEvents(addDaysToDateKey(from, -1), addDaysToDateKey(to, 1));
    const byDate = new Map<string, MatchableEvent[]>();
    for (const event of events) {
      const key = this.identity.eventDateKey(event.dataInicio);
      if (!key) continue;
      byDate.set(key, [...(byDate.get(key) ?? []), event]);
    }

    const { venues } = loadReferenceVenues();
    const venueByKey = new Map(venues.map((v) => [v.key, v]));

    let newlyMatched = 0;
    let lostMatch = 0;
    for (const ref of refs) {
      const venue = ref.venueKey ? venueByKey.get(ref.venueKey) : undefined;
      const candidates = [-1, 0, 1].flatMap((d) => byDate.get(addDaysToDateKey(ref.dateKey, d)) ?? []);
      const match = matchReferenceToEvents(
        { name: ref.name, dateKey: ref.dateKey, normalizedVenue: ref.normalizedVenue, lat: venue?.lat, lng: venue?.lng },
        candidates,
        this.identity,
      );
      const patch: Partial<EventReference> = { lastMatchCheckAt: now };
      if (match) {
        if (ref.matchedEventId !== match.eventId) {
          patch.matchedEventId = match.eventId;
          patch.matchedAt = ref.matchedEventId ? ref.matchedAt : now;
          if (!ref.matchedEventId) newlyMatched += 1;
        }
        patch.matchScore = match.score;
      } else if (ref.matchedEventId) {
        patch.matchedEventId = null;
        patch.matchedAt = null;
        patch.matchScore = null;
        lostMatch += 1;
      }
      await this.refRepo.update(ref.id, patch);
      ref.matchedEventId = patch.matchedEventId !== undefined ? patch.matchedEventId : ref.matchedEventId;
    }

    const metricsRefs: MetricsReference[] = refs.map((ref) => ({
      status: ref.status,
      dateKey: ref.dateKey,
      category: ref.category,
      size: ref.size,
      venueKey: ref.venueKey,
      venueName: ref.venueName,
      matched: Boolean(ref.matchedEventId),
    }));
    const recallPast = computeRecallRows(metricsRefs, 'past30', {
      fromDateKey: addDaysToDateKey(today, -30),
      toDateKey: addDaysToDateKey(today, -1),
    });
    const recallNext = computeRecallRows(metricsRefs, 'next90', { fromDateKey: today, toDateKey: to });

    const precision = await this.computePrecision(today, to, venues, config);
    const rows = mergeSnapshotRows(recallPast, recallNext, precision.rows);

    await this.snapshotRepo.delete({ snapshotDate: today });
    if (rows.length > 0) {
      await this.snapshotRepo.insert(rows.map((row) => ({ ...row, snapshotDate: today })));
    }

    const totalPast = recallPast.find((r) => r.dimension === 'total');
    const totalNext = recallNext.find((r) => r.dimension === 'total');
    const precisionTotal = precision.rows.find((r) => r.dimension === 'total');

    const alerted = await this.maybeAlert(today, totalPast?.recallPct ?? null, totalPast?.referenceTotal ?? 0, config);

    const matched = refs.filter((r) => r.matchedEventId).length;
    const result: MatchAndMetricsResult = {
      snapshotDate: today,
      referencesChecked: refs.length,
      matched,
      unmatched: refs.length - matched,
      newlyMatched,
      lostMatch,
      snapshotRows: rows.length,
      recallPast30Pct: totalPast?.recallPct ?? null,
      recallPast30Total: totalPast?.referenceTotal ?? 0,
      recallNext90Pct: totalNext?.recallPct ?? null,
      precisionPct: precisionTotal?.precisionPct ?? null,
      precisionSample: precisionTotal?.sample ?? 0,
      alerted,
    };
    this.logger.log(
      `Cobertura ${today}: ${refs.length} referências, recall(30d)=${result.recallPast30Pct ?? 'n/d'}%, precisão=${result.precisionPct ?? 'n/d'}%.`,
    );
    return result;
  }

  private async loadEvents(fromKey: string, toKey: string): Promise<Event[]> {
    return this.eventRepo.find({
      where: {
        dataInicio: Between(saoPauloDayBounds(fromKey).start, saoPauloDayBounds(toKey).end),
        outOfScope: false,
        dedupStatus: Not('duplicate'),
      },
      take: 20_000,
      order: { dataInicio: 'ASC' },
    });
  }

  private async computePrecision(
    today: string,
    to: string,
    venues: ReturnType<typeof loadReferenceVenues>['venues'],
    config: EventReferenceConfig,
  ) {
    const resolver = buildVenueResolver(venues, this.identity);
    const events = await this.loadEvents(today, to);
    const inVenues = events
      .map((event) => ({ event, venue: resolver(event) }))
      .filter((x): x is { event: Event; venue: NonNullable<typeof x.venue> } => x.venue !== null);
    const sample = deterministicSample(
      inVenues.map((x) => ({ id: x.event.id, ...x })),
      config.precisionSample,
    );
    if (sample.length === 0) return { rows: [] as ReturnType<typeof computePrecisionRows> };

    const refs = await this.refRepo.find({
      where: { dateKey: Between(addDaysToDateKey(today, -1), addDaysToDateKey(to, 1)) },
    });
    const refIds = refs.map((r) => r.id);
    const supportRows = refIds.length
      ? await this.voteRepo
          .createQueryBuilder('v')
          .select('v.referenceId', 'referenceId')
          .addSelect('COUNT(*)', 'total')
          .where('v.referenceId IN (:...ids)', { ids: refIds })
          .andWhere("v.verdict = 'support'")
          .andWhere("v.validatorKind <> 'events_db'")
          .groupBy('v.referenceId')
          .getRawMany()
      : [];
    const external = new Map<string, number>(supportRows.map((r: any) => [String(r.referenceId), Number(r.total)]));
    const venueByKey = new Map(venues.map((v) => [v.key, v]));
    const precisionRefs: PrecisionReference[] = refs.map((ref) => {
      const venue = ref.venueKey ? venueByKey.get(ref.venueKey) : undefined;
      return {
        name: ref.name,
        dateKey: ref.dateKey,
        normalizedVenue: ref.normalizedVenue,
        lat: venue?.lat,
        lng: venue?.lng,
        status: ref.status,
        externalSupport: external.get(ref.id) ?? 0,
      };
    });

    const classified = sample.map((x) => ({
      event: x.event,
      venue: x.venue,
      cls: classifyEvent(x.event, precisionRefs, this.identity),
    }));
    return { rows: computePrecisionRows(classified) };
  }

  /** Alerta (Sentry + e-mail do zero-yield) quando o recall dos últimos 30 dias cai abaixo do piso. */
  private async maybeAlert(
    today: string,
    recallPct: number | null,
    total: number,
    config: EventReferenceConfig,
  ): Promise<boolean> {
    if (!config.recallFloorPct || recallPct === null || total < config.alertMinSample) return false;
    if (recallPct >= config.recallFloorPct) return false;
    if (this.lastAlertDay === today) return false;
    this.lastAlertDay = today;

    this.logger.error(
      `Recall de eventos ${recallPct}% abaixo do piso de ${config.recallFloorPct}% (${total} referências, últimos 30 dias).`,
    );
    Sentry.captureMessage('Recall de cobertura de eventos abaixo do piso', {
      level: 'error',
      tags: { component: 'event-coverage-recall' },
      extra: { recallPct, floorPct: config.recallFloorPct, referenceTotal: total, day: today },
    });
    const to = process.env.ADMIN_ALERT_EMAIL?.trim() || process.env.OPS_ALERT_EMAIL?.trim();
    if (!to || !this.mailer) {
      this.logger.warn('ADMIN_ALERT_EMAIL/OPS_ALERT_EMAIL não configurado — alerta de recall só no Sentry/log.');
      return true;
    }
    try {
      await this.mailer.sendTextEmailCron(
        { email: to, name: 'My Urban Admin' },
        `My Urban — recall de eventos em ${recallPct}% (piso ${config.recallFloorPct}%)`,
        [
          `O recall da lista de referência nos últimos 30 dias caiu para ${recallPct}% (${total} eventos de referência aprovados).`,
          `O piso configurado é ${config.recallFloorPct}% (EVENT_COVERAGE_RECALL_FLOOR_PCT).`,
          '',
          'Veja /admin/event-coverage/reference para os eventos de referência que o radar não encontrou.',
        ].join('\n'),
      );
    } catch (error: any) {
      this.logger.warn(`Falha ao enviar e-mail de recall: ${error?.message}`);
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Leitura (admin e público)
  // ---------------------------------------------------------------------------

  async latestSnapshotDate(): Promise<string | null> {
    const row = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('MAX(s.snapshotDate)', 'max')
      .getRawOne<{ max: string | null }>();
    return row?.max ?? null;
  }

  async firstSnapshotDate(): Promise<string | null> {
    const row = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('MIN(s.snapshotDate)', 'min')
      .getRawOne<{ min: string | null }>();
    return row?.min ?? null;
  }

  async snapshotRowsFor(date: string): Promise<EventCoverageSnapshot[]> {
    return this.snapshotRepo.find({ where: { snapshotDate: date }, order: { scope: 'ASC', dimension: 'ASC', dimensionValue: 'ASC' } });
  }

  /** Último snapshot por dimensão e a série diária do total (recall 30d/90d e precisão). */
  async adminMetrics(days = 60) {
    const latest = await this.latestSnapshotDate();
    const limit = Math.max(1, Math.min(365, Math.floor(days) || 60));
    const since = addDaysToDateKey(todaySaoPauloDateKey(), -limit);
    const series = await this.snapshotRepo.find({
      where: { dimension: 'total' as EventCoverageDimension, snapshotDate: Between(since, '9999-12-31') },
      order: { snapshotDate: 'ASC' },
    });
    const byDate = new Map<
      string,
      { date: string; recallPast30Pct: number | null; recallNext90Pct: number | null; precisionPct: number | null; referencePast30: number }
    >();
    for (const row of series) {
      const entry = byDate.get(row.snapshotDate) ?? {
        date: row.snapshotDate,
        recallPast30Pct: null,
        recallNext90Pct: null,
        precisionPct: null,
        referencePast30: 0,
      };
      const scope: EventCoverageScope = row.scope;
      if (scope === 'past30') {
        entry.recallPast30Pct = row.recallPct === null ? null : Number(row.recallPct);
        entry.referencePast30 = row.referenceTotal;
      } else {
        entry.recallNext90Pct = row.recallPct === null ? null : Number(row.recallPct);
        entry.precisionPct = row.precisionPct === null ? null : Number(row.precisionPct);
      }
      byDate.set(row.snapshotDate, entry);
    }
    const rows = latest ? await this.snapshotRowsFor(latest) : [];
    const config = readEventReferenceConfig();
    return {
      latestDate: latest,
      floorPct: config.recallFloorPct,
      rows: rows.map((r) => ({
        scope: r.scope,
        dimension: r.dimension,
        dimensionValue: r.dimensionValue,
        referenceTotal: r.referenceTotal,
        referenceMatched: r.referenceMatched,
        recallPct: r.recallPct === null ? null : Number(r.recallPct),
        precisionSample: r.precisionSample,
        precisionConfirmed: r.precisionConfirmed,
        precisionRefuted: r.precisionRefuted,
        precisionPct: r.precisionPct === null ? null : Number(r.precisionPct),
      })),
      series: [...byDate.values()],
    };
  }

  /** Lista as referências aprovadas que o radar ainda não achou (ação para a operação). */
  async missingReferences(limit = 50): Promise<EventReference[]> {
    const today = todaySaoPauloDateKey();
    return this.refRepo.find({
      where: {
        status: 'aprovado',
        matchedEventId: IsNull(),
        dateKey: Between(addDaysToDateKey(today, -MATCH_LOOKBACK_DAYS), addDaysToDateKey(today, 90)),
      },
      order: { dateKey: 'ASC' },
      take: Math.max(1, Math.min(200, limit)),
    });
  }

  async countByStatus(): Promise<Record<string, number>> {
    const rows = await this.refRepo
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'total')
      .groupBy('r.status')
      .getRawMany<{ status: string; total: string }>();
    return Object.fromEntries(rows.map((r) => [r.status, Number(r.total)]));
  }
}
