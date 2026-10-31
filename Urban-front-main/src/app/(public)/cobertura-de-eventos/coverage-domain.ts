// Domínio puro da página pública /cobertura-de-eventos (sem React) — testado em
// scripts/event-reference-domain.test.mjs. Só agregados: sem nome de evento, sem dado pessoal.

export type PublicCoverage = {
  status: "measuring" | "measured";
  measuredAt: string | null;
  measuringSince: string | null;
  daysMeasured: number;
  minWeeks: number;
  recallLargeEventsPct: number | null;
  largeEventsSample: number;
  eventsTracked: number;
  venuesCovered: number;
  message: string;
};

const MIN_DAYS_FALLBACK = 28;

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

function dayKey(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/**
 * Valida a resposta do endpoint público. Qualquer coisa fora do formato vira `null` (a página
 * mostra o estado "em medição"); o recall só é aceito quando o status é "measured".
 */
export function parsePublicCoverage(payload: unknown): PublicCoverage | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (p.status !== "measuring" && p.status !== "measured") return null;
  const daysMeasured = count(p.daysMeasured);
  const eventsTracked = count(p.eventsTracked);
  const venuesCovered = count(p.venuesCovered);
  const largeEventsSample = count(p.largeEventsSample);
  const minWeeks = count(p.minWeeks);
  if (daysMeasured === null || eventsTracked === null || venuesCovered === null || largeEventsSample === null) {
    return null;
  }
  const rawRecall = typeof p.recallLargeEventsPct === "number" && Number.isFinite(p.recallLargeEventsPct) ? p.recallLargeEventsPct : null;
  const recall = p.status === "measured" && rawRecall !== null ? Math.max(0, Math.min(100, rawRecall)) : null;
  return {
    status: recall === null ? "measuring" : "measured",
    measuredAt: dayKey(p.measuredAt),
    measuringSince: dayKey(p.measuringSince),
    daysMeasured,
    minWeeks: minWeeks && minWeeks > 0 ? minWeeks : 4,
    recallLargeEventsPct: recall,
    largeEventsSample,
    eventsTracked,
    venuesCovered,
    message: typeof p.message === "string" ? p.message.slice(0, 400) : "",
  };
}

function formatDay(key: string | null): string {
  if (!key) return "ainda sem medição";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : key;
}

export function formatRecall(value: number): string {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export interface CoverageView {
  headline: string;
  recallLabel: string;
  note: string;
  dateLabel: string;
  /** 0–100: andamento das 4 semanas de medição (100 quando já medido). */
  progressPct: number;
  eventsLabel: string;
  venuesLabel: string;
}

/** Textos da página a partir do resumo; `null` (sem resposta) cai no estado honesto de medição. */
export function describeCoverage(data: PublicCoverage | null): CoverageView {
  const weeks = data?.minWeeks ?? 4;
  const minDays = weeks * 7 || MIN_DAYS_FALLBACK;
  if (data && data.status === "measured" && data.recallLargeEventsPct !== null) {
    const recall = formatRecall(data.recallLargeEventsPct);
    return {
      headline: `${recall} dos grandes eventos de São Paulo`,
      recallLabel: recall,
      note: `Medido sobre ${data.largeEventsSample.toLocaleString("pt-BR")} grandes eventos da nossa lista de referência que já aconteceram nos últimos 30 dias, depois de ${weeks} semanas seguidas de acompanhamento.`,
      dateLabel: formatDay(data.measuredAt),
      progressPct: 100,
      eventsLabel: data.eventsTracked.toLocaleString("pt-BR"),
      venuesLabel: data.venuesCovered.toLocaleString("pt-BR"),
    };
  }
  const days = data?.daysMeasured ?? 0;
  return {
    headline: "Medição em andamento",
    recallLabel: "Em medição",
    note: `Só publicamos o percentual depois de ${weeks} semanas seguidas de medição e de uma amostra mínima de grandes eventos. Antes disso, qualquer número seria chute.`,
    dateLabel: formatDay(data?.measuredAt ?? null),
    progressPct: Math.max(0, Math.min(100, Math.round((days / minDays) * 100))),
    eventsLabel: (data?.eventsTracked ?? 0).toLocaleString("pt-BR"),
    venuesLabel: (data?.venuesCovered ?? 0).toLocaleString("pt-BR"),
  };
}
