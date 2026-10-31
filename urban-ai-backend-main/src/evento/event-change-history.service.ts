import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { In, Repository } from 'typeorm';
import { Event } from '../entities/events.entity';
import { EventChangeHistory, EventChangeType } from '../entities/event-change-history.entity';
import { ScheduledJobRunnerService, runScheduledJob } from '../admin-job-runs/scheduled-job-runner.service';
import { addDaysToDateKey, saoPauloDaySql, saoPauloDayBounds, todaySaoPauloDateKey } from '../common/sp-date';
import { EventIdentityService } from './event-identity.service';
import {
  DetectedChange,
  DisappearanceCandidate,
  detectEventChanges,
  normalizeSourceStatus,
  readEventHistoryConfig,
  selectPossiblyCancelled,
} from './event-change-detector';
import { LeadTimeReport, LeadTimeRow, buildLeadTimeReport } from './event-lead-time';
import { isIgnoredSource, readZeroYieldConfig } from './collector-zero-yield.service';

/**
 * Histórico de mudanças de evento: registra `first_seen` na criação, compara cada reenvio da MESMA
 * fonte com o que já temos (remarcação, venue, URL, cancelamento declarado), marca como
 * "possivelmente cancelado" evento futuro que sumiu da fonte e expõe lead time e série diária.
 *
 * Princípios: só acrescenta linhas (nunca apaga nem duplica o evento); qualquer falha aqui é
 * engolida com log, porque a ingestão não pode quebrar por causa do histórico.
 */

/** Campos do que a fonte enviou que importam para o histórico (subconjunto de IngestEventInput). */
export interface ObservedEventInput {
  source: string;
  dataInicio: Date | string;
  dataFim?: Date | string | null;
  enderecoCompleto?: string | null;
  linkSiteOficial?: string | null;
  crawledUrl?: string | null;
  status?: string | null;
}

export interface ObserveContext {
  /** Como o evento foi casado (source_identity_exact, canonical_url_exact, dedup_hash_exact, ...). */
  matchReason: string;
}

export interface ObserveResult {
  changes: DetectedChange[];
  /** Campos do evento a atualizar (só preenchido com EVENT_HISTORY_APPLY_RESCHEDULE=true). */
  patch: Partial<Pick<Event, 'dataInicio' | 'dataFim'>>;
}

export interface EventChangeRow {
  id: string;
  eventId: string;
  eventName: string | null;
  eventDate: string | null;
  changeType: EventChangeType;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  source: string | null;
  detectedAt: string;
}

export interface EventChangesSummary {
  windowDays: number;
  firstSeen: number;
  rescheduled: number;
  venueChanged: number;
  urlChanged: number;
  cancelled: number;
  postponed: number;
  possiblyCancelled: number;
  reappeared: number;
}

export interface EventChangesSeriesPoint {
  date: string;
  firstSeen: number;
  rescheduled: number;
  cancelled: number;
  possiblyCancelled: number;
}

export interface EventChangesReport {
  generatedAt: string;
  timezone: 'America/Sao_Paulo';
  config: { possiblyCancelledDays: number; applyReschedule: boolean; enabled: boolean };
  summary: EventChangesSummary;
  series: EventChangesSeriesPoint[];
  recent: EventChangeRow[];
}

export interface EventLeadTimeResponse extends LeadTimeReport {
  generatedAt: string;
  windowDays: number;
  /** Eventos considerados (com first_seen) antes de separar os já iniciados ao entrar. */
  sample: number;
  /** Meta de produto (proposta fase 2): mediana >= 21 dias. */
  targetMedianDays: number;
}

export const CHANGES_DEFAULT_DAYS = 30;
export const CHANGES_MAX_DAYS = 180;
const LEAD_TIME_TARGET_MEDIAN_DAYS = 21;
const LEAD_TIME_MAX_ROWS = 50_000;
const DISAPPEARANCE_BATCH = 500;
const ALL_TYPES: EventChangeType[] = [
  'first_seen',
  'rescheduled',
  'venue_changed',
  'url_changed',
  'cancelled',
  'postponed',
  'possibly_cancelled',
  'reappeared',
];

const clampDays = (days: number | undefined, fallback = CHANGES_DEFAULT_DAYS) =>
  Math.max(1, Math.min(CHANGES_MAX_DAYS, Math.round(Number(days) || fallback)));

const n = (v: unknown) => Number(v ?? 0) || 0;

@Injectable()
export class EventChangeHistoryService {
  private readonly logger = new Logger(EventChangeHistoryService.name);

  constructor(
    @InjectRepository(EventChangeHistory) private readonly historyRepo: Repository<EventChangeHistory>,
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    private readonly identity: EventIdentityService,
    @Optional() private readonly scheduledJobRunner?: ScheduledJobRunnerService,
  ) {}

  // ---------------------------------------------------------------------------------------------
  // Ingestão
  // ---------------------------------------------------------------------------------------------

  /** Primeira vez que o evento entrou. Chamado uma vez, na criação. */
  async recordFirstSeen(event: Pick<Event, 'id' | 'source'>, now: Date = new Date()): Promise<void> {
    if (!readEventHistoryConfig().enabled) return;
    try {
      await this.historyRepo.save(
        this.historyRepo.create({
          eventId: event.id,
          changeType: 'first_seen',
          field: null,
          oldValue: null,
          newValue: null,
          source: event.source ?? null,
          detectedAt: now,
          meta: null,
        }),
      );
    } catch (error: any) {
      this.logger.warn(`Histórico: falha ao registrar first_seen (${event.id}): ${error?.message}`);
    }
  }

  /**
   * Compara o reenvio da fonte com o evento existente e registra o que mudou. Deve ser chamado ANTES
   * de atualizar o evento (precisa do estado anterior, inclusive `lastSeenAt`). Nunca lança.
   */
  async observe(
    existing: Event,
    input: ObservedEventInput,
    context: ObserveContext,
    now: Date = new Date(),
  ): Promise<ObserveResult> {
    const empty: ObserveResult = { changes: [], patch: {} };
    const config = readEventHistoryConfig();
    if (!config.enabled) return empty;

    try {
      const changes: DetectedChange[] = [];
      const sameSource =
        context.matchReason === 'source_identity_exact' ||
        (!!existing.source && existing.source === input.source);

      const incomingStart = input.dataInicio instanceof Date ? input.dataInicio : new Date(input.dataInicio);
      changes.push(
        ...detectEventChanges(
          {
            dataInicio: existing.dataInicio ? new Date(existing.dataInicio) : null,
            venue: this.venueOf(existing.enderecoCompleto ?? existing.normalizedVenue),
            url: this.identity.canonicalizeUrl(existing.linkSiteOficial ?? existing.crawledUrl ?? null),
            status: null,
          },
          {
            dataInicio: Number.isNaN(incomingStart.getTime()) ? null : incomingStart,
            venue: this.venueOf(input.enderecoCompleto),
            url: this.identity.canonicalizeUrl(input.linkSiteOficial ?? input.crawledUrl ?? null),
            status: normalizeSourceStatus(input.status),
          },
          { sameSource, rescheduleToleranceMinutes: config.rescheduleToleranceMinutes },
        ),
      );

      // Reapareceu depois de "possivelmente cancelado" (só vale checar se ficou sumido por algum tempo).
      const lastSeen = existing.lastSeenAt ?? existing.dataCrawl ?? null;
      if (lastSeen && now.getTime() - new Date(lastSeen).getTime() >= config.possiblyCancelledDays * 86_400_000) {
        const flagged = await this.latestOf(existing.id, ['possibly_cancelled', 'reappeared']);
        if (flagged?.changeType === 'possibly_cancelled') {
          changes.push({ type: 'reappeared', field: 'lastSeenAt', oldValue: null, newValue: now.toISOString() });
        }
      }

      const recorded: DetectedChange[] = [];
      for (const change of changes) {
        if (await this.alreadyRecorded(existing.id, change)) continue;
        await this.historyRepo.save(
          this.historyRepo.create({
            eventId: existing.id,
            changeType: change.type,
            field: change.field,
            oldValue: change.oldValue,
            newValue: change.newValue,
            source: input.source ?? null,
            detectedAt: now,
            meta: { matchReason: context.matchReason },
          }),
        );
        recorded.push(change);
      }

      const patch: ObserveResult['patch'] = {};
      const resched = recorded.find((c) => c.type === 'rescheduled');
      if (config.applyReschedule && resched && resched.newValue) {
        const newStart = new Date(resched.newValue);
        patch.dataInicio = newStart;
        const incomingEnd = input.dataFim ? new Date(input.dataFim) : null;
        if (incomingEnd && !Number.isNaN(incomingEnd.getTime()) && incomingEnd >= newStart) patch.dataFim = incomingEnd;
      }
      return { changes: recorded, patch };
    } catch (error: any) {
      this.logger.warn(`Histórico: falha ao observar evento ${existing?.id}: ${error?.message}`);
      return empty;
    }
  }

  private venueOf(value: string | null | undefined): string | null {
    const normalized = this.identity.normalizeVenue(value ?? '');
    return normalized || null;
  }

  private async latestOf(eventId: string, types: EventChangeType[]): Promise<EventChangeHistory | null> {
    return this.historyRepo.findOne({
      where: { eventId, changeType: In(types) },
      order: { detectedAt: 'DESC' },
    });
  }

  /** Evita repetir a mesma mudança quando a fonte reenvia o mesmo valor divergente a cada ciclo. */
  private async alreadyRecorded(eventId: string, change: DetectedChange): Promise<boolean> {
    if (change.type === 'reappeared') return false; // já protegido pelo estado "possibly_cancelled" mais recente
    const found = await this.historyRepo.findOne({
      where: { eventId, changeType: change.type, newValue: change.newValue as string },
      select: ['id'],
    });
    return Boolean(found);
  }

  // ---------------------------------------------------------------------------------------------
  // Sumiço da fonte -> "possivelmente cancelado"
  // ---------------------------------------------------------------------------------------------

  @Cron('15 6 * * *', {
    name: 'event-possibly-cancelled',
    timeZone: 'America/Sao_Paulo',
    waitForCompletion: true,
  })
  async flagDisappearedEvents(): Promise<{ checked: number; flagged: number }> {
    return runScheduledJob(this.scheduledJobRunner, 'event-possibly-cancelled', () => this.flagOnce());
  }

  async flagOnce(now: Date = new Date()): Promise<{ checked: number; flagged: number }> {
    const config = readEventHistoryConfig();
    if (!config.enabled) return { checked: 0, flagged: 0 };

    try {
      const cutoff = new Date(now.getTime() - config.possiblyCancelledDays * 86_400_000);
      const rows = await this.eventRepo
        .createQueryBuilder('e')
        .select('e.id', 'id')
        .addSelect('e.source', 'source')
        .addSelect('e.dataInicio', 'dataInicio')
        .addSelect('COALESCE(e.lastSeenAt, e.dataCrawl)', 'lastSeenAt')
        .where('e.dataInicio > :now', { now })
        .andWhere('e.ativo = :ativo', { ativo: true })
        .andWhere('e.outOfScope = :out', { out: false })
        .andWhere('e.duplicateOfEventId IS NULL')
        .andWhere('e.source IS NOT NULL')
        .andWhere('COALESCE(e.lastSeenAt, e.dataCrawl) < :cutoff', { cutoff })
        // Ainda não marcado depois da última vez em que a fonte o viu.
        .andWhere(
          `NOT EXISTS (
             SELECT 1 FROM event_change_history h
             WHERE h.eventId = e.id AND h.changeType IN ('possibly_cancelled', 'cancelled')
               AND h.detectedAt >= COALESCE(e.lastSeenAt, e.dataCrawl)
           )`,
        )
        .orderBy('e.dataInicio', 'ASC')
        .limit(DISAPPEARANCE_BATCH * 4)
        .getRawMany();

      const toDate = (v: unknown) => (v ? new Date(v as string | Date) : null);
      const candidates: DisappearanceCandidate[] = rows.map((r: any) => ({
        eventId: String(r.id),
        source: r.source ? String(r.source) : null,
        dataInicio: toDate(r.dataInicio) as Date,
        lastSeenAt: toDate(r.lastSeenAt),
      }));
      if (candidates.length === 0) return { checked: 0, flagged: 0 };

      const sources = [...new Set(candidates.map((c) => c.source as string))];
      const sourceRows = await this.eventRepo
        .createQueryBuilder('e')
        .select('e.source', 'source')
        .addSelect('MAX(COALESCE(e.lastSeenAt, e.dataCrawl))', 'lastSeenAt')
        .where('e.source IN (:...sources)', { sources })
        .groupBy('e.source')
        .getRawMany();
      const sourceLastSeen = new Map<string, Date>();
      for (const r of sourceRows as Array<{ source: string; lastSeenAt: string | Date | null }>) {
        if (r.lastSeenAt) sourceLastSeen.set(String(r.source), new Date(r.lastSeenAt));
      }

      const ignore = readZeroYieldConfig().ignoreSources;
      const due = selectPossiblyCancelled(
        candidates,
        sourceLastSeen,
        now,
        config.possiblyCancelledDays,
        (source) => isIgnoredSource(source, ignore),
      ).slice(0, DISAPPEARANCE_BATCH);

      for (const c of due) {
        await this.historyRepo.save(
          this.historyRepo.create({
            eventId: c.eventId,
            changeType: 'possibly_cancelled',
            field: 'lastSeenAt',
            oldValue: c.lastSeenAt ? c.lastSeenAt.toISOString() : null,
            newValue: null,
            source: c.source,
            detectedAt: now,
            meta: { days: config.possiblyCancelledDays },
          }),
        );
      }
      if (due.length > 0) {
        this.logger.warn(`${due.length} evento(s) futuro(s) sumiram da fonte há ${config.possiblyCancelledDays}+ dias (possivelmente cancelados).`);
      }
      return { checked: candidates.length, flagged: due.length };
    } catch (error: any) {
      this.logger.warn(`Histórico: verificação de eventos sumidos falhou: ${error?.message}`);
      return { checked: 0, flagged: 0 };
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Leitura (admin)
  // ---------------------------------------------------------------------------------------------

  /** Mudanças recentes, resumo por tipo e série diária (dias de São Paulo). */
  async changesReport(
    options: { days?: number; types?: EventChangeType[]; limit?: number } = {},
    now: Date = new Date(),
  ): Promise<EventChangesReport> {
    const config = readEventHistoryConfig();
    const days = clampDays(options.days);
    const limit = Math.max(1, Math.min(200, Math.round(options.limit ?? 100)));
    const today = todaySaoPauloDateKey(now);
    const firstDay = addDaysToDateKey(today, -(days - 1));
    const since = saoPauloDayBounds(firstDay).start;
    const types = (options.types?.length ? options.types : ALL_TYPES.filter((t) => t !== 'first_seen')).filter((t) =>
      ALL_TYPES.includes(t),
    );

    const [typeRows, dayRows, recentRows] = await Promise.all([
      this.historyRepo
        .createQueryBuilder('h')
        .select('h.changeType', 'type')
        .addSelect('COUNT(*)', 'count')
        .where('h.detectedAt >= :since', { since })
        .groupBy('h.changeType')
        .getRawMany(),
      this.historyRepo
        .createQueryBuilder('h')
        .select(saoPauloDaySql('h.detectedAt'), 'day')
        .addSelect('h.changeType', 'type')
        .addSelect('COUNT(*)', 'count')
        .where('h.detectedAt >= :since', { since })
        .groupBy('day')
        .addGroupBy('h.changeType')
        .getRawMany(),
      this.historyRepo
        .createQueryBuilder('h')
        .leftJoin(Event, 'e', 'e.id = h.eventId')
        .select([
          'h.id AS id',
          'h.eventId AS eventId',
          'h.changeType AS changeType',
          'h.field AS field',
          'h.oldValue AS oldValue',
          'h.newValue AS newValue',
          'h.source AS source',
          'h.detectedAt AS detectedAt',
          'e.nome AS eventName',
          'e.dataInicio AS eventDate',
        ])
        .where('h.detectedAt >= :since', { since })
        .andWhere('h.changeType IN (:...types)', { types })
        .orderBy('h.detectedAt', 'DESC')
        .limit(limit)
        .getRawMany(),
    ]);

    const summary = summarizeChangeCounts(
      days,
      (typeRows as Array<{ type: string; count: unknown }>).map((r) => ({ type: r.type, count: n(r.count) })),
    );
    const series = buildChangeSeries(
      Array.from({ length: days }, (_, i) => addDaysToDateKey(firstDay, i)),
      (dayRows as Array<{ day: string; type: string; count: unknown }>).map((r) => ({
        day: String(r.day),
        type: r.type,
        count: n(r.count),
      })),
    );

    const iso = (v: unknown) => (v ? new Date(v as string | Date).toISOString() : null);
    return {
      generatedAt: now.toISOString(),
      timezone: 'America/Sao_Paulo',
      config: {
        enabled: config.enabled,
        possiblyCancelledDays: config.possiblyCancelledDays,
        applyReschedule: config.applyReschedule,
      },
      summary,
      series,
      recent: (recentRows as any[]).map((r) => ({
        id: String(r.id),
        eventId: String(r.eventId),
        eventName: r.eventName ?? null,
        eventDate: iso(r.eventDate),
        changeType: r.changeType as EventChangeType,
        field: r.field ?? null,
        oldValue: r.oldValue ?? null,
        newValue: r.newValue ?? null,
        source: r.source ?? null,
        detectedAt: iso(r.detectedAt) as string,
      })),
    };
  }

  /** Lead time (first_seen -> data do evento) de eventos canônicos dentro da cobertura. */
  async leadTimeReport(windowDays = 90, now: Date = new Date()): Promise<EventLeadTimeResponse> {
    const days = clampDays(windowDays, 90);
    const from = new Date(now.getTime() - days * 86_400_000);
    const to = new Date(now.getTime() + days * 2 * 86_400_000);

    const raw = await this.historyRepo
      .createQueryBuilder('h')
      .innerJoin(Event, 'e', 'e.id = h.eventId')
      .select([
        'h.detectedAt AS firstSeenAt',
        'e.dataInicio AS dataInicio',
        'e.source AS source',
        'e.categoria AS categoria',
        'e.venueCapacity AS venueCapacity',
        'e.expectedAttendance AS expectedAttendance',
      ])
      .where("h.changeType = 'first_seen'")
      .andWhere('e.dataInicio >= :from AND e.dataInicio <= :to', { from, to })
      .andWhere('e.outOfScope = :out', { out: false })
      .andWhere('e.duplicateOfEventId IS NULL')
      .andWhere("(e.dedupStatus IS NULL OR e.dedupStatus = 'canonical')")
      .limit(LEAD_TIME_MAX_ROWS)
      .getRawMany();

    const rows: LeadTimeRow[] = (raw as any[]).map((r) => ({
      firstSeenAt: new Date(r.firstSeenAt),
      dataInicio: new Date(r.dataInicio),
      source: r.source ?? null,
      categoria: r.categoria ?? null,
      venueCapacity: r.venueCapacity === null || r.venueCapacity === undefined ? null : Number(r.venueCapacity),
      expectedAttendance:
        r.expectedAttendance === null || r.expectedAttendance === undefined ? null : Number(r.expectedAttendance),
    }));

    return {
      generatedAt: now.toISOString(),
      windowDays: days,
      sample: rows.length,
      targetMedianDays: LEAD_TIME_TARGET_MEDIAN_DAYS,
      ...buildLeadTimeReport(rows),
    };
  }
}

/** Contagem por tipo -> resumo (lógica pura). */
export function summarizeChangeCounts(
  windowDays: number,
  rows: Array<{ type: string; count: number }>,
): EventChangesSummary {
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.type, (by.get(r.type) ?? 0) + r.count);
  return {
    windowDays,
    firstSeen: by.get('first_seen') ?? 0,
    rescheduled: by.get('rescheduled') ?? 0,
    venueChanged: by.get('venue_changed') ?? 0,
    urlChanged: by.get('url_changed') ?? 0,
    cancelled: by.get('cancelled') ?? 0,
    postponed: by.get('postponed') ?? 0,
    possiblyCancelled: by.get('possibly_cancelled') ?? 0,
    reappeared: by.get('reappeared') ?? 0,
  };
}

/** Série diária contínua (dias sem registro valem 0), de `dayKeys` já ordenados (lógica pura). */
export function buildChangeSeries(
  dayKeys: string[],
  rows: Array<{ day: string; type: string; count: number }>,
): EventChangesSeriesPoint[] {
  const points = new Map<string, EventChangesSeriesPoint>(
    dayKeys.map((date) => [date, { date, firstSeen: 0, rescheduled: 0, cancelled: 0, possiblyCancelled: 0 }]),
  );
  for (const r of rows) {
    const point = points.get(r.day);
    if (!point) continue;
    if (r.type === 'first_seen') point.firstSeen += r.count;
    else if (r.type === 'rescheduled' || r.type === 'postponed') point.rescheduled += r.count;
    else if (r.type === 'cancelled') point.cancelled += r.count;
    else if (r.type === 'possibly_cancelled') point.possiblyCancelled += r.count;
  }
  return dayKeys.map((d) => points.get(d) as EventChangesSeriesPoint);
}
