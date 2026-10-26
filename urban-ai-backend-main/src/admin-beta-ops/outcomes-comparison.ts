/**
 * Comparação v1 x v2 (sombra) x preço aplicado x resultado, para recomendações cujo
 * anfitrião REGISTROU o resultado. PURA (sem I/O).
 *
 * Honestidade:
 *  - não é teste A/B: quem decide o preço é o anfitrião; o v2 nunca foi mostrado a ele;
 *  - `conclusions` só fica `available` com n >= `minSample`; abaixo disso devolve apenas as
 *    contagens e um texto dizendo que a amostra é pequena;
 *  - distâncias (|aplicado - sugerido| / aplicado) dizem "qual motor chegou mais perto do que
 *    o anfitrião realmente praticou", não "qual motor rende mais".
 */
import { hasRecordedOutcome } from '../email/weekly-host-report';

export const DEFAULT_MIN_SAMPLE = 30;

export type OutcomeRow = {
  id: string;
  endereco?: { id?: string | null; list?: { titulo?: string | null } | null } | null;
  evento?: { nome?: string | null; dataInicio?: Date | string | null } | null;
  usuarioProprietario?: { email?: string | null } | null;
  criadoEm?: Date | string | null;
  aplicadoEm?: Date | string | null;
  precoSugerido?: unknown;
  shadowV2Preco?: unknown;
  shadowV2Versao?: string | null;
  precoAplicado?: unknown;
  reservaStatus?: string | null;
  receitaReal?: unknown;
  noitesReservadas?: unknown;
  resultadoRegistradoEm?: Date | string | null;
};

export type ComparisonRow = {
  analysisId: string;
  property: string;
  host: string;
  eventName: string;
  eventDate: string | null;
  v1Price: number | null;
  v2Price: number | null;
  v2Version: string | null;
  appliedPrice: number;
  /** (v2 - v1) / v1 * 100; null sem v2. */
  v2VsV1Percent: number | null;
  /** (aplicado - v1) / v1 * 100. */
  appliedVsV1Percent: number | null;
  /** Qual sugestão ficou mais perto do preço aplicado: 'v1' | 'v2' | 'tie' | null (sem v2). */
  closer: 'v1' | 'v2' | 'tie' | null;
  outcome: 'booked' | 'not_booked' | 'blocked' | 'unknown';
  revenue: number | null;
  nights: number | null;
};

export type OutcomesSummary = {
  /** Linhas com preço aplicado + resultado registrado. */
  n: number;
  /** Dessas, as que têm sugestão v2 guardada. */
  nWithV2: number;
  booked: number;
  notBooked: number;
  blocked: number;
  unknown: number;
  /** Reservas com receita registrada (> 0) e a soma. */
  nWithRevenue: number;
  recordedRevenue: number | null;
  /** Distância média |aplicado - sugerido| / aplicado, em %, só nas linhas com v1 e v2. */
  meanDistanceV1Percent: number | null;
  meanDistanceV2Percent: number | null;
  closerToV1: number;
  closerToV2: number;
  ties: number;
};

export type OutcomesConclusions =
  | { available: false; reason: string }
  | { available: true; text: string };

export type OutcomesComparison = {
  minSample: number;
  summary: OutcomesSummary;
  conclusions: OutcomesConclusions;
  rows: ComparisonRow[];
};

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

const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;

function dayKey(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

/** Distância relativa ao preço aplicado, em %. */
export function distancePercent(applied: number, suggested: number): number {
  return (Math.abs(applied - suggested) / applied) * 100;
}

export function buildOutcomesComparison(rows: OutcomeRow[], minSample = DEFAULT_MIN_SAMPLE): OutcomesComparison {
  const comparable: ComparisonRow[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    const applied = positive(row.precoAplicado);
    if (applied === null || !hasRecordedOutcome(row)) continue;

    const v1 = positive(row.precoSugerido);
    const v2 = positive(row.shadowV2Preco);
    const reserva = String(row.reservaStatus ?? '');
    const outcome: ComparisonRow['outcome'] =
      reserva === 'booked' || reserva === 'not_booked' || reserva === 'blocked' ? reserva : 'unknown';

    let closer: ComparisonRow['closer'] = null;
    if (v1 !== null && v2 !== null) {
      const d1 = Math.abs(applied - v1);
      const d2 = Math.abs(applied - v2);
      closer = Math.abs(d1 - d2) < 0.005 ? 'tie' : d1 < d2 ? 'v1' : 'v2';
    }

    comparable.push({
      analysisId: row.id,
      property: row.endereco?.list?.titulo || 'Imóvel',
      host: row.usuarioProprietario?.email || '',
      eventName: row.evento?.nome || 'Evento',
      eventDate: dayKey(row.evento?.dataInicio),
      v1Price: v1,
      v2Price: v2,
      v2Version: v2 !== null ? row.shadowV2Versao ?? null : null,
      appliedPrice: applied,
      v2VsV1Percent: v1 !== null && v2 !== null ? round1(((v2 - v1) / v1) * 100) : null,
      appliedVsV1Percent: v1 !== null ? round1(((applied - v1) / v1) * 100) : null,
      closer,
      outcome,
      revenue: positive(row.receitaReal),
      nights: nonNegative(row.noitesReservadas),
    });
  }

  const withBoth = comparable.filter((row) => row.v1Price !== null && row.v2Price !== null);
  const mean = (values: number[]) => (values.length ? round1(values.reduce((sum, v) => sum + v, 0) / values.length) : null);
  const revenues = comparable.map((row) => row.revenue).filter((v): v is number => v !== null);

  const summary: OutcomesSummary = {
    n: comparable.length,
    nWithV2: comparable.filter((row) => row.v2Price !== null).length,
    booked: comparable.filter((row) => row.outcome === 'booked').length,
    notBooked: comparable.filter((row) => row.outcome === 'not_booked').length,
    blocked: comparable.filter((row) => row.outcome === 'blocked').length,
    unknown: comparable.filter((row) => row.outcome === 'unknown').length,
    nWithRevenue: revenues.length,
    recordedRevenue: revenues.length ? round2(revenues.reduce((sum, v) => sum + v, 0)) : null,
    meanDistanceV1Percent: mean(withBoth.map((row) => distancePercent(row.appliedPrice, row.v1Price as number))),
    meanDistanceV2Percent: mean(withBoth.map((row) => distancePercent(row.appliedPrice, row.v2Price as number))),
    closerToV1: withBoth.filter((row) => row.closer === 'v1').length,
    closerToV2: withBoth.filter((row) => row.closer === 'v2').length,
    ties: withBoth.filter((row) => row.closer === 'tie').length,
  };

  let conclusions: OutcomesConclusions;
  if (withBoth.length < minSample) {
    conclusions = {
      available: false,
      reason:
        `Amostra pequena: n = ${withBoth.length} recomendações com v1, v2 e resultado registrado ` +
        `(mínimo ${minSample}). Sem conclusões; os números abaixo são só contagens.`,
    };
  } else {
    const better =
      summary.meanDistanceV1Percent === summary.meanDistanceV2Percent
        ? 'v1 e v2 ficaram igualmente perto'
        : (summary.meanDistanceV2Percent as number) < (summary.meanDistanceV1Percent as number)
          ? 'o v2 ficou, em média, mais perto do preço que o anfitrião aplicou'
          : 'o v1 ficou, em média, mais perto do preço que o anfitrião aplicou';
    conclusions = {
      available: true,
      text:
        `Com n = ${withBoth.length}, ${better} (distância média v1 ${summary.meanDistanceV1Percent}% x v2 ${summary.meanDistanceV2Percent}%). ` +
        'Isto mede proximidade com o preço praticado, não receita: o anfitrião é quem decide o preço e não houve teste A/B.',
    };
  }

  return { minSample, summary, conclusions, rows: comparable };
}
