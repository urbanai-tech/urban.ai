/**
 * Agregação PURA (sem I/O) do relatório mensal do proprietário (ADR 0027).
 *
 * Regras de honestidade do produto (as mesmas do resumo semanal, `weekly-host-report.ts`):
 *  - nunca fabricar número: receita, diária média e ocupação só existem quando foram
 *    REGISTRADAS pelo anfitrião ou sincronizadas (Stays/calendário); caso contrário o
 *    campo vem `null` e o texto diz "sem dado" — jamais zero, estimativa ou projeção;
 *  - o "efeito" de uma recomendação aplicada só é confirmado com reserva/receita registrada
 *    (mesma regra do `confirmedIncremental` do ROI); sem resultado, o relatório diz isso;
 *  - comparação com o mês anterior só quando AMBOS os meses têm dado do mesmo imóvel;
 *  - o payload não carrega IDs internos: imóveis são identificados só pela posição (`ref`).
 */
import { toSaoPauloDateKey, tryToSaoPauloDateKey } from 'src/common/sp-date';
import { hasRecordedOutcome, isOutcomePending, WeeklyAnalysisRow } from 'src/email/weekly-host-report';
import { periodBounds, ReportPeriod, shiftPeriodKey } from './report-period';

export const OWNER_REPORT_PAYLOAD_VERSION = 1;
/** Fração mínima dos dias do mês com status conhecido para publicar ocupação. */
export const MIN_CALENDAR_COVERAGE = 0.8;
const MAX_EVENTS_PER_PROPERTY = 6;
const MAX_APPLIED_PER_PROPERTY = 10;
/** Origens de calendário aceitas como dado real (nunca `inferred` nem scraping de calendário público). */
const REAL_OCCUPANCY_ORIGINS = new Set(['manual', 'stays_sync']);

export type OwnerReportAnalysisRow = WeeklyAnalysisRow & {
  seuPrecoAtual?: unknown;
  diferencaPercentual?: unknown;
  evento?: {
    id?: string | null;
    nome?: string | null;
    dataInicio?: Date | string | null;
    relevancia?: unknown;
  } | null;
};

export type OwnerReportOccupancyRow = {
  /** `YYYY-MM-DD`. */
  date: string;
  status: string;
  revenueCents?: number | null;
  origin?: string | null;
};

export type OwnerReportPropertyInput = {
  title: string;
  location: string | null;
  analyses: OwnerReportAnalysisRow[];
  occupancy: OwnerReportOccupancyRow[];
};

export type OwnerReportInput = {
  ownerName: string;
  preparedBy: string | null;
  periodKey: string;
  now: Date;
  properties: OwnerReportPropertyInput[];
};

export type Delta = {
  current: number;
  previous: number;
  delta: number;
  /** null quando o mês anterior foi 0 (variação percentual indefinida). */
  deltaPct: number | null;
};

export type MetricSource = 'calendar' | 'recorded_outcomes';
export type OccupancySource = 'stays' | 'manual' | 'mixed';

export type AppliedOutcomeStatus = 'booked' | 'not_booked' | 'blocked' | 'recorded' | 'pending' | 'awaiting_event';

export type OwnerReportAppliedItem = {
  eventName: string;
  dateLabel: string;
  suggestedPrice: number | null;
  startingPrice: number | null;
  appliedPrice: number | null;
  outcome: {
    status: AppliedOutcomeStatus;
    revenue: number | null;
    nights: number | null;
    /** Efeito confirmado em R$ (só com reserva/receita registrada e preço aplicado acima do de partida). */
    confirmedExtra: number | null;
  };
};

export type OwnerReportEventItem = {
  name: string;
  dateLabel: string;
  relevance: number | null;
  suggestedPrice: number | null;
  liftPercent: number | null;
};

export type OwnerReportProperty = {
  /** Posição no relatório (1, 2, 3...). Não é um ID. */
  ref: number;
  title: string;
  location: string | null;
  occupancy: {
    pct: number | null;
    occupiedNights: number | null;
    knownDays: number;
    source: OccupancySource | null;
    /** Por que não há ocupação, quando não há. */
    note: string | null;
  };
  revenue: number | null;
  revenueSource: MetricSource | null;
  averageDailyRate: number | null;
  adrSource: MetricSource | null;
  recommendations: { generated: number; accepted: number; applied: number };
  events: { total: number; items: OwnerReportEventItem[] };
  applied: { total: number; items: OwnerReportAppliedItem[] };
  pendingOutcomes: number;
  comparison: {
    revenue: Delta | null;
    averageDailyRate: Delta | null;
    occupancyPct: Delta | null;
  };
  hasData: boolean;
  dataMessage: string | null;
};

export type OwnerReportPayload = {
  version: number;
  period: { key: string; label: string; startKey: string; endKeyExclusive: string; isPartial: boolean };
  previousPeriod: { key: string; label: string };
  generatedAt: string;
  owner: { name: string };
  preparedBy: string | null;
  summary: {
    propertyCount: number;
    propertiesWithRevenue: number;
    propertiesWithOccupancy: number;
    totalRevenue: number | null;
    averageDailyRate: number | null;
    occupancyPct: number | null;
    recommendationsApplied: number;
    confirmedExtra: number | null;
    pendingOutcomes: number;
    dataStatus: 'complete' | 'partial' | 'none';
    headline: string;
    comparison: {
      /** Quantos imóveis entram na comparação (têm dado nos dois meses). */
      comparableProperties: number;
      revenue: Delta | null;
      occupancyPct: Delta | null;
    };
  };
  properties: OwnerReportProperty[];
  notes: string[];
};

type MonthMetrics = {
  occupancyPct: number | null;
  occupiedNights: number | null;
  /** Soma de booked + available usada como denominador (para ponderar no portfólio). */
  rentableNights: number;
  knownDays: number;
  occupancySource: OccupancySource | null;
  occupancyNote: string | null;
  revenue: number | null;
  revenueSource: MetricSource | null;
  averageDailyRate: number | null;
  adrSource: MetricSource | null;
  /** Receita e noites que sustentam a diária média (para ponderar no portfólio). */
  adrRevenue: number;
  adrNights: number;
};

function toTime(value: unknown): number | null {
  if (!value) return null;
  const time = (value instanceof Date ? value : new Date(value as string)).getTime();
  return Number.isNaN(time) ? null : time;
}

function positive(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function nonNegative(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function finiteOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function inPeriod(value: unknown, period: ReportPeriod): boolean {
  const time = toTime(value);
  return time !== null && time >= period.start.getTime() && time < period.endExclusive.getTime();
}

function dayKeyInPeriod(dayKey: string | null, period: ReportPeriod): boolean {
  return dayKey !== null && dayKey >= period.startKey && dayKey < period.endKeyExclusive;
}

function eventDayKey(row: OwnerReportAnalysisRow): string | null {
  return tryToSaoPauloDateKey(row.evento?.dataInicio ?? null);
}

function formatDayMonth(key: string | null): string {
  if (!key) return 'data a confirmar';
  const [, month, day] = key.split('-');
  return `${day}/${month}`;
}

function eventKey(row: OwnerReportAnalysisRow): string {
  const day = eventDayKey(row) ?? 'sem-data';
  return row.evento?.id ? `id:${row.evento.id}` : `nome:${String(row.evento?.nome ?? '').trim().toLowerCase()}|${day}`;
}

/** Último registro por evento: re-análises do mesmo evento não podem contar receita duas vezes. */
function latestPerEvent(rows: OwnerReportAnalysisRow[], timeOf: (row: OwnerReportAnalysisRow) => number): OwnerReportAnalysisRow[] {
  const byEvent = new Map<string, OwnerReportAnalysisRow>();
  for (const row of rows) {
    const key = eventKey(row);
    const current = byEvent.get(key);
    if (!current || timeOf(row) > timeOf(current)) byEvent.set(key, row);
  }
  return Array.from(byEvent.values());
}

function computeMonthMetrics(
  property: OwnerReportPropertyInput,
  period: ReportPeriod,
  effectiveDays: number,
): MonthMetrics {
  // ---- calendário (Stays / registro manual) ----
  const byDate = new Map<string, OwnerReportOccupancyRow>();
  for (const row of property.occupancy) {
    if (!row?.date || row.date < period.startKey || row.date >= period.endKeyExclusive) continue;
    if (!REAL_OCCUPANCY_ORIGINS.has(String(row.origin ?? ''))) continue;
    byDate.set(row.date, row);
  }
  let booked = 0;
  let available = 0;
  let blocked = 0;
  let revenueCents = 0;
  let revenueNights = 0;
  const origins = new Set<string>();
  for (const row of byDate.values()) {
    const status = String(row.status);
    if (status === 'booked') {
      booked += 1;
      const cents = positive(row.revenueCents);
      if (cents !== null) {
        revenueCents += cents;
        revenueNights += 1;
      }
      origins.add(String(row.origin));
    } else if (status === 'available') {
      available += 1;
      origins.add(String(row.origin));
    } else if (status === 'blocked') {
      blocked += 1;
      origins.add(String(row.origin));
    }
  }
  const knownDays = booked + available + blocked;
  const rentableNights = booked + available;
  const coverage = effectiveDays > 0 ? knownDays / effectiveDays : 0;
  let occupancyPct: number | null = null;
  let occupiedNights: number | null = null;
  let occupancyNote: string | null = null;
  let occupancySource: OccupancySource | null = null;
  if (knownDays === 0) {
    occupancyNote = 'Sem calendário registrado ou sincronizado neste mês.';
  } else if (coverage < MIN_CALENDAR_COVERAGE || rentableNights === 0) {
    occupancyNote = `Calendário incompleto: ${knownDays} de ${effectiveDays} dias com status conhecido (mínimo para publicar: ${Math.ceil(
      MIN_CALENDAR_COVERAGE * effectiveDays,
    )}).`;
  } else {
    occupancyPct = round2((booked / rentableNights) * 100);
    occupiedNights = booked;
    occupancySource = origins.size > 1 ? 'mixed' : origins.has('stays_sync') ? 'stays' : 'manual';
  }

  // ---- resultados registrados pelo anfitrião (por dia do evento) ----
  const recorded = latestPerEvent(
    property.analyses.filter((row) => hasRecordedOutcome(row) && dayKeyInPeriod(eventDayKey(row), period)),
    (row) => toTime(row.resultadoRegistradoEm) ?? 0,
  );
  const outcomeRevenues = recorded.map((row) => positive(row.receitaReal)).filter((v): v is number => v !== null);
  const outcomeRevenue = outcomeRevenues.length ? outcomeRevenues.reduce((sum, v) => sum + v, 0) : null;
  const pairs = recorded
    .map((row) => ({ revenue: positive(row.receitaReal), nights: positive(row.noitesReservadas) }))
    .filter((p): p is { revenue: number; nights: number } => p.revenue !== null && p.nights !== null);
  const pairRevenue = pairs.reduce((sum, p) => sum + p.revenue, 0);
  const pairNights = pairs.reduce((sum, p) => sum + p.nights, 0);

  // ---- receita e diária média: calendário primeiro, resultados registrados depois ----
  let revenue: number | null = null;
  let revenueSource: MetricSource | null = null;
  let averageDailyRate: number | null = null;
  let adrSource: MetricSource | null = null;
  let adrRevenue = 0;
  let adrNights = 0;
  if (revenueNights > 0) {
    revenue = round2(revenueCents / 100);
    revenueSource = 'calendar';
    averageDailyRate = round2(revenueCents / 100 / revenueNights);
    adrSource = 'calendar';
    adrRevenue = revenueCents / 100;
    adrNights = revenueNights;
  } else {
    if (outcomeRevenue !== null) {
      revenue = round2(outcomeRevenue);
      revenueSource = 'recorded_outcomes';
    }
    if (pairNights > 0) {
      averageDailyRate = round2(pairRevenue / pairNights);
      adrSource = 'recorded_outcomes';
      adrRevenue = pairRevenue;
      adrNights = pairNights;
    }
  }

  return {
    occupancyPct,
    occupiedNights,
    rentableNights: occupancyPct !== null ? rentableNights : 0,
    knownDays,
    occupancySource,
    occupancyNote,
    revenue,
    revenueSource,
    averageDailyRate,
    adrSource,
    adrRevenue,
    adrNights,
  };
}

function makeDelta(current: number | null, previous: number | null): Delta | null {
  if (current === null || previous === null) return null;
  const delta = round2(current - previous);
  return {
    current: round2(current),
    previous: round2(previous),
    delta,
    deltaPct: previous > 0 ? round2((delta / previous) * 100) : null,
  };
}

function appliedItemFor(row: OwnerReportAnalysisRow, todayKey: string): OwnerReportAppliedItem {
  const startingPrice = positive(row.seuPrecoAtual);
  const appliedPrice = positive(row.precoAplicado);
  let status: AppliedOutcomeStatus;
  let revenue: number | null = null;
  let nights: number | null = null;
  let confirmedExtra: number | null = null;
  if (hasRecordedOutcome(row)) {
    const reserva = String(row.reservaStatus ?? '');
    status = reserva === 'booked' || reserva === 'not_booked' || reserva === 'blocked' ? reserva : 'recorded';
    revenue = positive(row.receitaReal);
    nights = nonNegative(row.noitesReservadas);
    const isBooked = reserva === 'booked' || revenue !== null;
    if (isBooked && appliedPrice !== null && startingPrice !== null && appliedPrice > startingPrice) {
      confirmedExtra = round2((appliedPrice - startingPrice) * Math.max(1, nights ?? 1));
    }
  } else {
    status = isOutcomePending(row, todayKey) ? 'pending' : 'awaiting_event';
  }
  return {
    eventName: row.evento?.nome || 'Evento',
    dateLabel: formatDayMonth(eventDayKey(row)),
    suggestedPrice: positive(row.precoSugerido),
    startingPrice,
    appliedPrice,
    outcome: { status, revenue, nights, confirmedExtra },
  };
}

function propertyMessage(m: MonthMetrics, pending: number): string | null {
  if (m.revenue !== null || m.occupancyPct !== null || m.averageDailyRate !== null) return null;
  return pending > 0
    ? `Sem resultado registrado neste mês. Há ${pending} ${pending === 1 ? 'aplicação' : 'aplicações'} aguardando o registro do resultado pelo anfitrião.`
    : 'Sem resultado registrado nem calendário sincronizado neste mês: não há número para mostrar.';
}

export function buildOwnerReport(input: OwnerReportInput): OwnerReportPayload {
  const period = periodBounds(input.periodKey);
  const previous = periodBounds(shiftPeriodKey(input.periodKey, -1));
  const todayKey = toSaoPauloDateKey(input.now);
  const isPartial = todayKey < period.endKeyExclusive;
  const effectiveDays = isPartial && todayKey >= period.startKey ? Number(todayKey.slice(8, 10)) : period.daysInMonth;

  const currentMetrics = input.properties.map((property) => computeMonthMetrics(property, period, effectiveDays));
  const priorMetrics = input.properties.map((property) => computeMonthMetrics(property, previous, previous.daysInMonth));

  const properties: OwnerReportProperty[] = input.properties.map((property, index) => {
    const current = currentMetrics[index];
    const prior = priorMetrics[index];

    const monthRows = (pick: (row: OwnerReportAnalysisRow) => unknown) =>
      property.analyses.filter((row) => inPeriod(pick(row), period));
    const appliedRows = monthRows((row) => row.aplicadoEm)
      .filter((row) => positive(row.precoAplicado) !== null)
      .sort((a, b) => (toTime(a.aplicadoEm) ?? 0) - (toTime(b.aplicadoEm) ?? 0));
    const eventRows = latestPerEvent(
      property.analyses.filter((row) => dayKeyInPeriod(eventDayKey(row), period)),
      (row) => toTime(row.criadoEm) ?? 0,
    ).sort((a, b) => {
      const relevance = Number(b.evento?.relevancia ?? 0) - Number(a.evento?.relevancia ?? 0);
      if (relevance !== 0) return relevance;
      return (eventDayKey(a) ?? '').localeCompare(eventDayKey(b) ?? '');
    });
    const pendingOutcomes = property.analyses.filter(
      (row) => isOutcomePending(row, todayKey) && dayKeyInPeriod(eventDayKey(row), period),
    ).length;

    const hasData = current.revenue !== null || current.occupancyPct !== null || current.averageDailyRate !== null;
    return {
      ref: index + 1,
      title: property.title || 'Imóvel',
      location: property.location,
      occupancy: {
        pct: current.occupancyPct,
        occupiedNights: current.occupiedNights,
        knownDays: current.knownDays,
        source: current.occupancySource,
        note: current.occupancyNote,
      },
      revenue: current.revenue,
      revenueSource: current.revenueSource,
      averageDailyRate: current.averageDailyRate,
      adrSource: current.adrSource,
      recommendations: {
        generated: monthRows((row) => row.criadoEm).length,
        accepted: monthRows((row) => row.aceitoEm).length,
        applied: appliedRows.length,
      },
      events: {
        total: eventRows.length,
        items: eventRows.slice(0, MAX_EVENTS_PER_PROPERTY).map((row) => ({
          name: row.evento?.nome || 'Evento',
          dateLabel: formatDayMonth(eventDayKey(row)),
          relevance: nonNegative(row.evento?.relevancia),
          suggestedPrice: positive(row.precoSugerido),
          liftPercent: finiteOrNull(row.diferencaPercentual),
        })),
      },
      applied: {
        total: appliedRows.length,
        items: appliedRows.slice(0, MAX_APPLIED_PER_PROPERTY).map((row) => appliedItemFor(row, todayKey)),
      },
      pendingOutcomes,
      comparison: {
        revenue: makeDelta(current.revenue, prior.revenue),
        averageDailyRate: makeDelta(current.averageDailyRate, prior.averageDailyRate),
        occupancyPct: makeDelta(current.occupancyPct, prior.occupancyPct),
      },
      hasData,
      dataMessage: propertyMessage(current, pendingOutcomes),
    };
  });

  // ---- portfólio do proprietário: soma só o que existe, nunca completa com zero ----
  const withRevenue = properties.filter((p) => p.revenue !== null);
  const withOccupancy = properties.filter((p) => p.occupancy.pct !== null);
  const totalRevenue = withRevenue.length ? round2(withRevenue.reduce((sum, p) => sum + (p.revenue as number), 0)) : null;

  // Diária média do portfólio ponderada por noites (receita das noites com receita / essas noites).
  const adrNightsSum = currentMetrics.reduce((sum, m) => sum + m.adrNights, 0);
  const portfolioAdr =
    adrNightsSum > 0 ? round2(currentMetrics.reduce((sum, m) => sum + m.adrRevenue, 0) / adrNightsSum) : null;

  const weighted = currentMetrics.filter((m) => m.occupancyPct !== null);
  const bookedSum = weighted.reduce((sum, m) => sum + (m.occupiedNights ?? 0), 0);
  const rentableSum = weighted.reduce((sum, m) => sum + m.rentableNights, 0);
  const portfolioOccupancy = rentableSum > 0 ? round2((bookedSum / rentableSum) * 100) : null;

  const confirmedExtras = properties.flatMap((p) => p.applied.items.map((i) => i.outcome.confirmedExtra)).filter((v): v is number => v !== null);
  const confirmedExtra = confirmedExtras.length ? round2(confirmedExtras.reduce((s, v) => s + v, 0)) : null;
  const pendingOutcomes = properties.reduce((sum, p) => sum + p.pendingOutcomes, 0);

  // Comparação do portfólio: só imóveis com receita (ou ocupação) nos DOIS meses.
  const comparableRevenue = properties.filter((p) => p.comparison.revenue !== null);
  const revenueComparison = comparableRevenue.length
    ? makeDelta(
        round2(comparableRevenue.reduce((s, p) => s + (p.comparison.revenue as Delta).current, 0)),
        round2(comparableRevenue.reduce((s, p) => s + (p.comparison.revenue as Delta).previous, 0)),
      )
    : null;
  const comparableOccupancy = properties.filter((p) => p.comparison.occupancyPct !== null);
  const occupancyComparison = comparableOccupancy.length
    ? makeDelta(
        round2(comparableOccupancy.reduce((s, p) => s + (p.comparison.occupancyPct as Delta).current, 0) / comparableOccupancy.length),
        round2(comparableOccupancy.reduce((s, p) => s + (p.comparison.occupancyPct as Delta).previous, 0) / comparableOccupancy.length),
      )
    : null;

  const anyData = properties.some((p) => p.hasData);
  const allRevenue = properties.length > 0 && withRevenue.length === properties.length;
  const dataStatus: 'complete' | 'partial' | 'none' = !anyData ? 'none' : allRevenue ? 'complete' : 'partial';
  const headline =
    dataStatus === 'none'
      ? `Em ${period.label} ainda não há resultado registrado nem calendário sincronizado para estes imóveis. O relatório mostra apenas o que consta no My Urban e não estima receita.`
      : dataStatus === 'partial'
        ? `Em ${period.label}, ${withRevenue.length} de ${properties.length} ${properties.length === 1 ? 'imóvel tem' : 'imóveis têm'} receita registrada. Os demais aparecem como "sem dado".`
        : `Em ${period.label}, todos os imóveis têm receita registrada.`;

  return {
    version: OWNER_REPORT_PAYLOAD_VERSION,
    period: {
      key: period.key,
      label: period.label,
      startKey: period.startKey,
      endKeyExclusive: period.endKeyExclusive,
      isPartial,
    },
    previousPeriod: { key: previous.key, label: previous.label },
    generatedAt: input.now.toISOString(),
    owner: { name: input.ownerName },
    preparedBy: input.preparedBy,
    summary: {
      propertyCount: properties.length,
      propertiesWithRevenue: withRevenue.length,
      propertiesWithOccupancy: withOccupancy.length,
      totalRevenue,
      averageDailyRate: portfolioAdr,
      occupancyPct: portfolioOccupancy,
      recommendationsApplied: properties.reduce((sum, p) => sum + p.recommendations.applied, 0),
      confirmedExtra,
      pendingOutcomes,
      dataStatus,
      headline,
      comparison: {
        comparableProperties: Math.max(comparableRevenue.length, comparableOccupancy.length),
        revenue: revenueComparison,
        occupancyPct: occupancyComparison,
      },
    },
    properties,
    notes: [
      'Receita, diária média e ocupação só aparecem quando foram registradas pelo anfitrião ou sincronizadas (Stays ou calendário manual). Nada é estimado ou projetado.',
      'Resultados registrados contam no mês da data do evento. Onde não há registro, o relatório informa "sem dado".',
      'Efeito confirmado = (diária aplicada − diária de partida) × noites reservadas, somente em recomendações aplicadas com reserva ou receita registrada.',
      'A comparação com o mês anterior considera apenas imóveis com dado nos dois meses.',
    ],
  };
}

/** Resumo de uma linha para o corpo do e-mail (sem inventar número). */
export function summarizeForEmail(payload: OwnerReportPayload): string[] {
  const money = (value: number) => `R$ ${Math.round(value).toLocaleString('pt-BR')}`;
  const lines = [`${payload.summary.propertyCount} ${payload.summary.propertyCount === 1 ? 'imóvel' : 'imóveis'} no relatório.`];
  lines.push(
    payload.summary.totalRevenue !== null
      ? `Receita registrada: ${money(payload.summary.totalRevenue)} (${payload.summary.propertiesWithRevenue} de ${payload.summary.propertyCount} imóveis com dado).`
      : 'Receita registrada: sem dado neste mês.',
  );
  lines.push(
    payload.summary.occupancyPct !== null
      ? `Ocupação: ${payload.summary.occupancyPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%.`
      : 'Ocupação: sem dado de calendário suficiente.',
  );
  return lines;
}
