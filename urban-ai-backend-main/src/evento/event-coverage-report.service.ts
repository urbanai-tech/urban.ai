import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../entities/events.entity';
import { EventDedupCandidate } from '../entities/event-dedup-candidate.entity';
import { CoverageRegion } from '../entities/coverage-region.entity';
import {
  addDaysToDateKey,
  saoPauloDayBounds,
  saoPauloDaySql,
  todaySaoPauloDateKey,
} from '../common/sp-date';
import {
  CollectorZeroYieldService,
  SourceActivity,
  ZeroYieldConfig,
  evaluateZeroYield,
  isIgnoredSource,
  normalizeSourceName,
  readZeroYieldConfig,
} from './collector-zero-yield.service';

/**
 * D6 — cobertura de eventos "vendável": quantos eventos canônicos, ativos e
 * futuros (em dias de São Paulo) temos na região de cobertura, de quais fontes,
 * e se essas fontes estão saudáveis. Somente leitura; reutiliza o detector de
 * zero-yield (`CollectorZeroYieldService`) e a flag `outOfScope`, calculada pelo
 * `CoverageService` a partir de `coverage_regions`.
 *
 * Config (env, opcionais):
 *   EVENT_COVERAGE_TARGET_30D        default 100 (gate do beta; runbook eventos-fallback-manual.md)
 *   EVENT_COVERAGE_MIN_GEOCODED_PCT  default 80  (qualidade mínima: lat/lng presentes)
 */

export const EVENT_COVERAGE_HISTOGRAM_DAYS = 30;
const DEFAULT_TARGET_30D = 100;
const DEFAULT_MIN_GEOCODED_PCT = 80;

export type EventCoverageStatus = 'ok' | 'at_risk' | 'insufficient';
export type EventCoverageSourceHealth = 'healthy' | 'stale' | 'zero_yield' | 'unmonitored';

export interface EventCoverageConfig {
  target30d: number;
  minGeocodedPct: number;
}

export interface EventCoverageSource {
  source: string;
  events30d: number;
  lastIngestAt: string | null;
  hoursSinceLastIngest: number | null;
  windowHours: number;
  health: EventCoverageSourceHealth;
}

export interface EventCoverageReason {
  code:
    | 'below_target'
    | 'unhealthy_sources'
    | 'low_geocoding'
    | 'low_category'
    | 'dedup_pending'
    | 'source_stale'
    | 'source_zero_yield'
    | 'no_sources';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  source?: string;
}

export interface EventCoverageReport {
  generatedAt: string;
  timezone: 'America/Sao_Paulo';
  today: string;
  scope: {
    description: string;
    regions: Array<{ name: string; status: string }>;
  };
  target: { events30d: number; minGeocodedPct: number };
  status: EventCoverageStatus;
  reasons: EventCoverageReason[];
  counts: { next7d: number; next30d: number; next90d: number; next30dFromHealthySources: number };
  quality: {
    geocodedPct: number | null;
    withCategoryPct: number | null;
    missingGeocode30d: number;
    missingCategory30d: number;
  };
  duplicatesPendingReview: { total: number; high: number };
  histogram: Array<{ date: string; count: number }>;
  sources: EventCoverageSource[];
}

function positiveNumber(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readEventCoverageConfig(env: NodeJS.ProcessEnv = process.env): EventCoverageConfig {
  return {
    target30d: Math.round(positiveNumber(env.EVENT_COVERAGE_TARGET_30D, DEFAULT_TARGET_30D)),
    minGeocodedPct: Math.min(100, positiveNumber(env.EVENT_COVERAGE_MIN_GEOCODED_PCT, DEFAULT_MIN_GEOCODED_PCT)),
  };
}

/** Janelas em dias de calendário de São Paulo: de `now` até o fim do dia (hoje + N - 1). */
export function coverageWindows(now: Date): {
  today: string;
  start: Date;
  ends: Record<7 | 30 | 90, Date>;
  histogramDays: string[];
} {
  const today = todaySaoPauloDateKey(now);
  const endOf = (days: number) => saoPauloDayBounds(addDaysToDateKey(today, days - 1)).end;
  return {
    today,
    start: now,
    ends: { 7: endOf(7), 30: endOf(30), 90: endOf(90) },
    histogramDays: Array.from({ length: EVENT_COVERAGE_HISTOGRAM_DAYS }, (_, i) => addDaysToDateKey(today, i)),
  };
}

const pct = (part: number, total: number): number | null =>
  total > 0 ? Math.round((part / total) * 1000) / 10 : null;

export interface SourceEventRow {
  source: string | null;
  events30d: number | string;
}

/** Saúde por fonte (lógica pura): combina eventos dos próximos 30d com atividade de ingestão. */
export function buildSourceReport(
  eventRows: SourceEventRow[],
  activity: SourceActivity[],
  zeroYieldConfig: ZeroYieldConfig,
  now: Date,
): EventCoverageSource[] {
  const findings = new Set(evaluateZeroYield(activity, zeroYieldConfig, now).map((f) => f.source));
  const bySource = new Map<string, { events30d: number; lastSeenAt: Date | null }>();
  const slot = (name: string) => {
    const current = bySource.get(name) ?? { events30d: 0, lastSeenAt: null };
    bySource.set(name, current);
    return current;
  };

  for (const row of eventRows) {
    const name = normalizeSourceName(row.source ?? '') || '(sem source)';
    slot(name).events30d += Number(row.events30d ?? 0);
  }
  for (const a of activity) {
    const name = normalizeSourceName(a.source);
    if (!name) continue;
    const current = slot(name);
    if (a.lastSeenAt && (!current.lastSeenAt || a.lastSeenAt > current.lastSeenAt)) current.lastSeenAt = a.lastSeenAt;
  }

  const out: EventCoverageSource[] = [];
  for (const [source, v] of bySource) {
    const windowHours = zeroYieldConfig.sourceWindowHours[source] ?? zeroYieldConfig.windowHours;
    const hours = v.lastSeenAt ? (now.getTime() - v.lastSeenAt.getTime()) / 3_600_000 : null;
    let health: EventCoverageSourceHealth;
    if (isIgnoredSource(source, zeroYieldConfig.ignoreSources)) health = 'unmonitored';
    else if (findings.has(source)) health = 'zero_yield';
    else if (hours === null || hours > windowHours) health = 'stale';
    else health = 'healthy';
    out.push({
      source,
      events30d: v.events30d,
      lastIngestAt: v.lastSeenAt ? v.lastSeenAt.toISOString() : null,
      hoursSinceLastIngest: hours === null ? null : Math.round(hours * 10) / 10,
      windowHours,
      health,
    });
  }
  return out.sort((a, b) => b.events30d - a.events30d || a.source.localeCompare(b.source));
}

export interface CoverageInputs {
  counts: { next7d: number; next30d: number; next90d: number };
  geocoded30d: number;
  withCategory30d: number;
  dedupPending: { total: number; high: number };
  sources: EventCoverageSource[];
}

/**
 * Status contra a meta (lógica pura):
 *  - insufficient: menos eventos que a meta nos próximos 30 dias;
 *  - at_risk: a meta é atingida, mas depende de fontes paradas (fontes saudáveis somam menos que a meta)
 *    ou o geocoding está abaixo do mínimo;
 *  - ok: meta atingida com fontes saudáveis e geocoding suficiente.
 * `unmonitored` (curadoria manual, eventos pontuais) conta como saudável: não tem coletor para parar.
 */
export function evaluateCoverage(
  input: CoverageInputs,
  config: EventCoverageConfig,
): {
  status: EventCoverageStatus;
  reasons: EventCoverageReason[];
  next30dFromHealthySources: number;
  geocodedPct: number | null;
  withCategoryPct: number | null;
} {
  const total = input.counts.next30d;
  const healthy = input.sources
    .filter((s) => s.health === 'healthy' || s.health === 'unmonitored')
    .reduce((sum, s) => sum + s.events30d, 0);
  const geocodedPct = pct(input.geocoded30d, total);
  const withCategoryPct = pct(input.withCategory30d, total);
  const reasons: EventCoverageReason[] = [];

  if (total < config.target30d) {
    reasons.push({
      code: 'below_target',
      severity: 'critical',
      message: `${total} de ${config.target30d} eventos nos próximos 30 dias.`,
    });
  } else if (healthy < config.target30d) {
    reasons.push({
      code: 'unhealthy_sources',
      severity: 'warning',
      message: `Só ${healthy} dos ${total} eventos vêm de fontes saudáveis (meta ${config.target30d}).`,
    });
  }
  if (geocodedPct !== null && geocodedPct < config.minGeocodedPct) {
    reasons.push({
      code: 'low_geocoding',
      severity: 'warning',
      message: `${geocodedPct}% com coordenadas (mínimo ${config.minGeocodedPct}%).`,
    });
  }
  if (withCategoryPct !== null && withCategoryPct < 50) {
    reasons.push({ code: 'low_category', severity: 'info', message: `${withCategoryPct}% com categoria.` });
  }
  if (input.dedupPending.total > 0) {
    reasons.push({
      code: 'dedup_pending',
      severity: 'info',
      message: `${input.dedupPending.total} candidatos a duplicata aguardando revisão.`,
    });
  }
  if (input.sources.length === 0) {
    reasons.push({ code: 'no_sources', severity: 'critical', message: 'Nenhuma fonte de eventos encontrada.' });
  }
  for (const s of input.sources) {
    if (s.health === 'zero_yield') {
      reasons.push({
        code: 'source_zero_yield',
        severity: 'warning',
        source: s.source,
        message: `${s.source}: normalmente ativa, sem itens há ${s.hoursSinceLastIngest ?? '?'}h.`,
      });
    } else if (s.health === 'stale') {
      reasons.push({
        code: 'source_stale',
        severity: 'warning',
        source: s.source,
        message:
          s.hoursSinceLastIngest === null
            ? `${s.source}: sem ingestão registrada.`
            : `${s.source}: último ingest há ${Math.round(s.hoursSinceLastIngest)}h (janela ${s.windowHours}h).`,
      });
    }
  }

  let status: EventCoverageStatus = 'ok';
  if (total < config.target30d) status = 'insufficient';
  else if (healthy < config.target30d || (geocodedPct !== null && geocodedPct < config.minGeocodedPct)) status = 'at_risk';

  return { status, reasons, next30dFromHealthySources: healthy, geocodedPct, withCategoryPct };
}

@Injectable()
export class EventCoverageReportService {
  constructor(
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(EventDedupCandidate) private readonly dedupRepo: Repository<EventDedupCandidate>,
    @InjectRepository(CoverageRegion) private readonly regionRepo: Repository<CoverageRegion>,
    private readonly zeroYield: CollectorZeroYieldService,
  ) {}

  /** Base: canônico, ativo, na cobertura (flag outOfScope do CoverageService) e em SP. */
  private baseQuery(start: Date, end: Date) {
    return this.eventRepo
      .createQueryBuilder('e')
      .where('e.dataInicio >= :start AND e.dataInicio <= :end', { start, end })
      .andWhere('e.outOfScope = :out', { out: false })
      .andWhere('e.ativo = :ativo', { ativo: true })
      .andWhere('e.estado = :uf', { uf: 'SP' })
      .andWhere('e.duplicateOfEventId IS NULL')
      .andWhere("(e.dedupStatus IS NULL OR e.dedupStatus = 'canonical')");
  }

  async report(now: Date = new Date()): Promise<EventCoverageReport> {
    const config = readEventCoverageConfig();
    const zeroYieldConfig = readZeroYieldConfig();
    const w = coverageWindows(now);

    // Consultas independentes, todas agregadas no banco (sem N+1).
    const [countsRow, histogramRows, sourceRows, activity, dedupRows, regions] = await Promise.all([
      this.baseQuery(w.start, w.ends[90])
        .select('SUM(CASE WHEN e.dataInicio <= :e7 THEN 1 ELSE 0 END)', 'next7d')
        .addSelect('SUM(CASE WHEN e.dataInicio <= :e30 THEN 1 ELSE 0 END)', 'next30d')
        .addSelect('COUNT(*)', 'next90d')
        .addSelect(
          'SUM(CASE WHEN e.dataInicio <= :e30 AND e.latitude IS NOT NULL AND e.longitude IS NOT NULL THEN 1 ELSE 0 END)',
          'geocoded30d',
        )
        .addSelect(
          "SUM(CASE WHEN e.dataInicio <= :e30 AND e.categoria IS NOT NULL AND e.categoria <> '' THEN 1 ELSE 0 END)",
          'withCategory30d',
        )
        .setParameters({ e7: w.ends[7], e30: w.ends[30] })
        .getRawOne(),
      this.baseQuery(w.start, w.ends[30])
        .select(saoPauloDaySql('e.dataInicio'), 'day')
        .addSelect('COUNT(*)', 'count')
        .groupBy('day')
        .getRawMany(),
      this.baseQuery(w.start, w.ends[30])
        .select('e.source', 'source')
        .addSelect('COUNT(*)', 'events30d')
        .groupBy('e.source')
        .getRawMany(),
      this.zeroYield.loadActivity(now, zeroYieldConfig),
      this.dedupRepo
        .createQueryBuilder('c')
        .select('c.confidenceBand', 'band')
        .addSelect('COUNT(*)', 'count')
        .where('c.status = :status', { status: 'pending' })
        .groupBy('c.confidenceBand')
        .getRawMany(),
      this.regionRepo.find({ where: [{ status: 'active' }, { status: 'bootstrap' }], order: { name: 'ASC' } }),
    ]);

    const n = (v: unknown) => Number(v ?? 0) || 0;
    const counts = {
      next7d: n(countsRow?.next7d),
      next30d: n(countsRow?.next30d),
      next90d: n(countsRow?.next90d),
    };
    const dayCounts = new Map<string, number>();
    for (const r of histogramRows as Array<{ day: string; count: unknown }>) {
      dayCounts.set(String(r.day), (dayCounts.get(String(r.day)) ?? 0) + n(r.count));
    }
    const dedupBands = dedupRows as Array<{ band: string; count: unknown }>;
    const dedupPending = {
      total: dedupBands.reduce((s, r) => s + n(r.count), 0),
      high: dedupBands.filter((r) => r.band === 'high').reduce((s, r) => s + n(r.count), 0),
    };

    const sources = buildSourceReport(sourceRows as SourceEventRow[], activity, zeroYieldConfig, now);
    const geocoded30d = n(countsRow?.geocoded30d);
    const withCategory30d = n(countsRow?.withCategory30d);
    const verdict = evaluateCoverage({ counts, geocoded30d, withCategory30d, dedupPending, sources }, config);

    return {
      generatedAt: now.toISOString(),
      timezone: 'America/Sao_Paulo',
      today: w.today,
      scope: {
        description:
          'Eventos canônicos e ativos, estado SP, dentro da cobertura (outOfScope=false, calculado a partir de coverage_regions), contados do instante atual até o fim do dia de São Paulo (hoje + N - 1).',
        regions: regions.map((r) => ({ name: r.name, status: r.status })),
      },
      target: { events30d: config.target30d, minGeocodedPct: config.minGeocodedPct },
      status: verdict.status,
      reasons: verdict.reasons,
      counts: { ...counts, next30dFromHealthySources: verdict.next30dFromHealthySources },
      quality: {
        geocodedPct: verdict.geocodedPct,
        withCategoryPct: verdict.withCategoryPct,
        missingGeocode30d: Math.max(0, counts.next30d - geocoded30d),
        missingCategory30d: Math.max(0, counts.next30d - withCategory30d),
      },
      duplicatesPendingReview: dedupPending,
      histogram: w.histogramDays.map((date) => ({ date, count: dayCounts.get(date) ?? 0 })),
      sources,
    };
  }
}
