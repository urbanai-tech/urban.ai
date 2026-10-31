import {
  dateKeyAddDays,
  medianExact,
  medianRounded,
  percentileRank,
  percentiles,
  Percentiles,
} from './market-math';
import { MarketListingRecord, MarketObservation } from './market-data.types';

/**
 * Métricas de bairro calculadas sobre um comp set já filtrado, deduplicado e
 * com privacidade aplicada (ADR 0028). Só agregados saem daqui.
 */

export interface MarketMetricsInput {
  records: MarketListingRecord[];
  ownAdr: number;
  ownOccupancy: number | null;
  /** Diária observada do próprio imóvel por data (snapshots). */
  ownDaily: Map<string, number>;
  /** Datas da janela de análise, em ordem. */
  dates: string[];
  from: string;
  to: string;
  /** Datas com evento de alto impacto no bairro. */
  eventDays: Set<string>;
  /** Amostra mínima para um agregado diário/ocupação/tendência aparecer. */
  minSample: number;
}

export interface MarketSeasonalityPoint {
  month: number;
  /** Mediana do mês ÷ mediana de todo o período (1,00 = média). */
  index: number;
  sample: number;
}

export interface MarketTrend30d {
  available: boolean;
  /** Variação do percentil do imóvel (pontos) nos últimos 30 dias. */
  percentilePoints: number | null;
  /** Variação da diária mediana dos comparáveis (%). */
  medianAdrChangePct: number | null;
  currentMedianAdr: number | null;
  previousMedianAdr: number | null;
  /** Anúncios com histórico nas duas janelas. */
  pairedListings: number;
  /** `observed` = diária própria do período anterior; `current` = usamos a atual (só o mercado se moveu). */
  ownBasis: 'observed' | 'current' | null;
  reason?: string;
}

export interface MarketEventEffect {
  /** Alta da diária mediana do bairro em dias com evento vs. dias sem (%). */
  upliftPct: number;
  eventDays: number;
  baselineDays: number;
}

export interface MarketMetrics {
  comparablesCount: number;
  medianAdr: number;
  percentile: number;
  adrPercentiles: Percentiles | null;
  medianOccupancy: number | null;
  occupancyPercentiles: Percentiles | null;
  occupancySample: number;
  occupancyIsProxy: boolean;
  seasonality: MarketSeasonalityPoint[] | null;
  eventEffect: MarketEventEffect | null;
  trend30d: MarketTrend30d;
  daily: Array<{ date: string; yourAdr: number; medianAdr: number }>;
  /** Anúncios com série histórica (dá confiança a sazonalidade, evento e tendência). */
  listingsWithHistory: number;
}

function obsInRange(record: MarketListingRecord, from: string, to: string): MarketObservation[] {
  return (record.observations ?? []).filter((o) => o.date >= from && o.date <= to);
}

function windowAdr(record: MarketListingRecord, from: string, to: string): number | null {
  const med = medianExact(obsInRange(record, from, to).map((o) => o.adr));
  const value = med ?? record.adr;
  return value != null && value > 0 ? Math.round(value) : null;
}

function windowOccupancy(record: MarketListingRecord, from: string, to: string): number | null {
  const values = obsInRange(record, from, to)
    .map((o) => o.occupancy)
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (values.length) return values.reduce((sum, v) => sum + v, 0) / values.length;
  return record.occupancy;
}

export function computeSeasonality(records: MarketListingRecord[], minObsPerMonth = 10): MarketSeasonalityPoint[] | null {
  const all: number[] = [];
  const byMonth = new Map<number, number[]>();
  for (const record of records) {
    for (const obs of record.observations ?? []) {
      if (obs.adr == null || !(obs.adr > 0)) continue;
      const month = Number(obs.date.slice(5, 7));
      if (!month) continue;
      all.push(obs.adr);
      byMonth.set(month, [...(byMonth.get(month) ?? []), obs.adr]);
    }
  }
  const overall = medianExact(all);
  if (!overall) return null;
  const points = Array.from(byMonth.entries())
    .filter(([, values]) => values.length >= minObsPerMonth)
    .map(([month, values]) => ({
      month,
      index: Number(((medianExact(values) as number) / overall).toFixed(2)),
      sample: values.length,
    }))
    .sort((a, b) => a.month - b.month);
  return points.length >= 2 ? points : null;
}

/** Mediana diária dos comparáveis (só dias com amostra suficiente). */
export function dailyMedians(records: MarketListingRecord[], dates: string[], minSample: number): Map<string, number> {
  const byDate = new Map<string, number[]>();
  const wanted = new Set(dates);
  for (const record of records) {
    for (const obs of record.observations ?? []) {
      if (!wanted.has(obs.date) || obs.adr == null || !(obs.adr > 0)) continue;
      byDate.set(obs.date, [...(byDate.get(obs.date) ?? []), obs.adr]);
    }
  }
  const out = new Map<string, number>();
  for (const [date, values] of byDate) {
    if (values.length >= minSample) out.set(date, medianRounded(values));
  }
  return out;
}

export function computeEventEffect(medians: Map<string, number>, eventDays: Set<string>): MarketEventEffect | null {
  const onEvent: number[] = [];
  const baseline: number[] = [];
  for (const [date, value] of medians) (eventDays.has(date) ? onEvent : baseline).push(value);
  if (onEvent.length < 2 || baseline.length < 5) return null;
  const eventMedian = medianExact(onEvent) as number;
  const baseMedian = medianExact(baseline) as number;
  if (!(baseMedian > 0)) return null;
  return {
    upliftPct: Number(((eventMedian / baseMedian - 1) * 100).toFixed(1)),
    eventDays: onEvent.length,
    baselineDays: baseline.length,
  };
}

export function computeTrend30d(
  records: MarketListingRecord[],
  to: string,
  ownAdr: number,
  ownDaily: Map<string, number>,
  minSample: number,
): MarketTrend30d {
  const curFrom = dateKeyAddDays(to, -29);
  const prevTo = dateKeyAddDays(to, -30);
  const prevFrom = dateKeyAddDays(to, -59);
  const paired: Array<{ cur: number; prev: number }> = [];
  for (const record of records) {
    const curVals = obsInRange(record, curFrom, to).map((o) => o.adr);
    const prevVals = obsInRange(record, prevFrom, prevTo).map((o) => o.adr);
    const cur = medianExact(curVals);
    const prev = medianExact(prevVals);
    if (cur && prev) paired.push({ cur, prev });
  }
  if (paired.length < minSample) {
    return {
      available: false,
      percentilePoints: null,
      medianAdrChangePct: null,
      currentMedianAdr: null,
      previousMedianAdr: null,
      pairedListings: paired.length,
      ownBasis: null,
      reason: `Histórico insuficiente: só ${paired.length} anúncio(s) com preço nos dois períodos de 30 dias (mínimo ${minSample}).`,
    };
  }
  const ownPrevValues = Array.from(ownDaily.entries())
    .filter(([date]) => date >= prevFrom && date <= prevTo)
    .map(([, value]) => value);
  const ownPrev = ownPrevValues.length >= 3 ? medianExact(ownPrevValues) : null;
  const curMedian = medianExact(paired.map((p) => p.cur)) as number;
  const prevMedian = medianExact(paired.map((p) => p.prev)) as number;
  const curPercentile = percentileRank(ownAdr, paired.map((p) => p.cur));
  const prevPercentile = percentileRank(ownPrev ?? ownAdr, paired.map((p) => p.prev));
  return {
    available: true,
    percentilePoints: curPercentile - prevPercentile,
    medianAdrChangePct: Number(((curMedian / prevMedian - 1) * 100).toFixed(1)),
    currentMedianAdr: Math.round(curMedian),
    previousMedianAdr: Math.round(prevMedian),
    pairedListings: paired.length,
    ownBasis: ownPrev != null ? 'observed' : 'current',
  };
}

export function computeMarketMetrics(input: MarketMetricsInput): MarketMetrics {
  const { records, ownAdr, ownDaily, dates, from, to, eventDays, minSample } = input;
  const adrs = records.map((r) => windowAdr(r, from, to)).filter((v): v is number => v != null);
  const medianAdr = medianRounded(adrs);

  const occupancyRows = records
    .map((r) => ({ value: windowOccupancy(r, from, to), proxy: r.occupancyIsProxy && !(r.observations?.length) }))
    .filter((row): row is { value: number; proxy: boolean } => row.value != null && Number.isFinite(row.value));
  const occupancyEnough = occupancyRows.length >= minSample;
  const occupancyValues = occupancyEnough ? occupancyRows.map((row) => row.value) : [];

  const medians = dailyMedians(records, dates, minSample);
  const fallbackMedian = medianAdr;

  return {
    comparablesCount: records.length,
    medianAdr,
    percentile: percentileRank(ownAdr, adrs),
    adrPercentiles: percentiles(adrs),
    medianOccupancy: occupancyEnough ? Number((medianExact(occupancyValues) as number).toFixed(2)) : null,
    occupancyPercentiles: occupancyEnough ? percentiles(occupancyValues, 2) : null,
    occupancySample: occupancyRows.length,
    occupancyIsProxy: occupancyEnough && occupancyRows.filter((row) => row.proxy).length > occupancyRows.length / 2,
    seasonality: computeSeasonality(records),
    eventEffect: computeEventEffect(medians, eventDays),
    trend30d: computeTrend30d(records, to, ownAdr, ownDaily, minSample),
    daily: dates.map((date) => ({
      date,
      yourAdr: ownDaily.get(date) ?? ownAdr,
      medianAdr: medians.get(date) ?? fallbackMedian,
    })),
    listingsWithHistory: records.filter((r) => (r.observations?.length ?? 0) > 0).length,
  };
}
