import { dayDiff } from './event-reference-normalize';

/**
 * Resumo PÚBLICO da cobertura de eventos (ADR 0026): só agregados, sem nome de evento, sem
 * dado pessoal. O número de recall só aparece depois de 4 semanas de medição e de uma amostra
 * mínima de grandes eventos; antes disso a resposta diz, com franqueza, que ainda está medindo.
 */

export const PUBLIC_MIN_WEEKS = 4;

export interface PublicSnapshotRow {
  snapshotDate: string;
  scope: 'past30' | 'next90';
  dimension: 'total' | 'category' | 'venue' | 'size';
  dimensionValue: string;
  referenceTotal: number;
  referenceMatched: number;
  recallPct: number | null;
}

export interface PublicCoverageSummary {
  status: 'measuring' | 'measured';
  /** Dia (São Paulo) da última medição. */
  measuredAt: string | null;
  /** Primeiro dia com medição. */
  measuringSince: string | null;
  daysMeasured: number;
  minWeeks: number;
  /** Recall dos grandes eventos de SP nos últimos 30 dias; null enquanto não houver 4 semanas. */
  recallLargeEventsPct: number | null;
  largeEventsSample: number;
  eventsTracked: number;
  venuesCovered: number;
  message: string;
}

export function emptyPublicCoverage(): PublicCoverageSummary {
  return {
    status: 'measuring',
    measuredAt: null,
    measuringSince: null,
    daysMeasured: 0,
    minWeeks: PUBLIC_MIN_WEEKS,
    recallLargeEventsPct: null,
    largeEventsSample: 0,
    eventsTracked: 0,
    venuesCovered: 0,
    message:
      'Ainda não há medição publicada. Assim que a lista de referência dos grandes eventos de São Paulo tiver 4 semanas de acompanhamento, o resultado aparece aqui.',
  };
}

export function buildPublicCoverage(input: {
  /** Linhas do snapshot MAIS RECENTE. */
  latestRows: PublicSnapshotRow[];
  /** Primeiro dia com snapshot. */
  firstDate: string | null;
  minSample: number;
}): PublicCoverageSummary {
  const { latestRows, firstDate, minSample } = input;
  if (latestRows.length === 0 || !firstDate) return emptyPublicCoverage();

  const measuredAt = latestRows[0].snapshotDate;
  const daysMeasured = Math.max(1, dayDiff(measuredAt, firstDate) + 1);
  const totalOf = (scope: PublicSnapshotRow['scope']) =>
    latestRows.find((r) => r.scope === scope && r.dimension === 'total')?.referenceTotal ?? 0;
  const eventsTracked = totalOf('past30') + totalOf('next90');
  const venuesCovered = new Set(
    latestRows.filter((r) => r.dimension === 'venue' && r.referenceTotal > 0).map((r) => r.dimensionValue),
  ).size;

  const large = latestRows.find((r) => r.scope === 'past30' && r.dimension === 'size' && r.dimensionValue === 'grande');
  const largeEventsSample = large?.referenceTotal ?? 0;
  const enoughTime = daysMeasured >= PUBLIC_MIN_WEEKS * 7;
  const enoughSample = largeEventsSample >= minSample && large?.recallPct != null;

  const base = {
    measuredAt,
    measuringSince: firstDate,
    daysMeasured,
    minWeeks: PUBLIC_MIN_WEEKS,
    largeEventsSample,
    eventsTracked,
    venuesCovered,
  };

  if (enoughTime && enoughSample) {
    const recall = Math.round((large!.recallPct as number) * 10) / 10;
    return {
      ...base,
      status: 'measured',
      recallLargeEventsPct: recall,
      message: `Nos últimos 30 dias, o My Urban já acompanhava ${recall.toLocaleString('pt-BR')}% dos grandes eventos de São Paulo da nossa lista de referência.`,
    };
  }

  const reason = !enoughTime
    ? `A medição começou há ${daysMeasured} ${daysMeasured === 1 ? 'dia' : 'dias'} e só publicamos o resultado depois de ${PUBLIC_MIN_WEEKS} semanas seguidas.`
    : `Ainda não há grandes eventos suficientes já realizados na lista de referência (${largeEventsSample} de ${minSample} necessários) para um número confiável.`;
  return {
    ...base,
    status: 'measuring',
    recallLargeEventsPct: null,
    message: `Estamos medindo. ${reason}`,
  };
}
