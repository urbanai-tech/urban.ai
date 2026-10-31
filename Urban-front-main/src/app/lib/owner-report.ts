/**
 * Tipos e regras de apresentação do relatório mensal do proprietário (ADR 0027).
 *
 * Regra do produto: nunca fabricar número. Um campo `null` significa "sem dado" e a tela diz
 * isso com todas as letras; zero só aparece quando o dado registrado é zero. Este módulo é
 * puro (sem React, sem fetch) para ser testado isolado (scripts/owner-report.test.mjs).
 */

export type OwnerReportDelta = {
  current: number;
  previous: number;
  delta: number;
  deltaPct: number | null;
};

export type OwnerReportMetricSource = "calendar" | "recorded_outcomes";
export type OwnerReportOccupancySource = "stays" | "manual" | "mixed";
export type OwnerReportOutcomeStatus =
  | "booked"
  | "not_booked"
  | "blocked"
  | "recorded"
  | "pending"
  | "awaiting_event";

export type OwnerReportAppliedItem = {
  eventName: string;
  dateLabel: string;
  suggestedPrice: number | null;
  startingPrice: number | null;
  appliedPrice: number | null;
  outcome: {
    status: OwnerReportOutcomeStatus;
    revenue: number | null;
    nights: number | null;
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
  ref: number;
  title: string;
  location: string | null;
  occupancy: {
    pct: number | null;
    occupiedNights: number | null;
    knownDays: number;
    source: OwnerReportOccupancySource | null;
    note: string | null;
  };
  revenue: number | null;
  revenueSource: OwnerReportMetricSource | null;
  averageDailyRate: number | null;
  adrSource: OwnerReportMetricSource | null;
  recommendations: { generated: number; accepted: number; applied: number };
  events: { total: number; items: OwnerReportEventItem[] };
  applied: { total: number; items: OwnerReportAppliedItem[] };
  pendingOutcomes: number;
  comparison: {
    revenue: OwnerReportDelta | null;
    averageDailyRate: OwnerReportDelta | null;
    occupancyPct: OwnerReportDelta | null;
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
    dataStatus: "complete" | "partial" | "none";
    headline: string;
    comparison: {
      comparableProperties: number;
      revenue: OwnerReportDelta | null;
      occupancyPct: OwnerReportDelta | null;
    };
  };
  properties: OwnerReportProperty[];
  notes: string[];
};

export type PublicOwnerReportResponse = {
  report: OwnerReportPayload;
  meta: { period: string; generatedAt: string; expiresAt: string; notice: string };
};

/** Texto de "sem dado" único em toda a tela. */
export const NO_DATA_TEXT = "Sem dado";

const OUTCOME_LABELS: Record<OwnerReportOutcomeStatus, string> = {
  booked: "Reservou",
  not_booked: "Não reservou",
  blocked: "Bloqueado",
  recorded: "Resultado registrado",
  pending: "Resultado ainda não registrado",
  awaiting_event: "Aguardando o evento",
};

export function outcomeLabel(status: OwnerReportOutcomeStatus): string {
  return OUTCOME_LABELS[status] ?? NO_DATA_TEXT;
}

export function metricSourceLabel(source: OwnerReportMetricSource | null): string | null {
  if (source === "calendar") return "calendário sincronizado ou registrado";
  if (source === "recorded_outcomes") return "resultados registrados pelo anfitrião";
  return null;
}

export function occupancySourceLabel(source: OwnerReportOccupancySource | null): string | null {
  if (source === "stays") return "Stays";
  if (source === "manual") return "calendário registrado manualmente";
  if (source === "mixed") return "Stays e calendário manual";
  return null;
}

/**
 * Variação em texto, só quando existe nos dois meses. `unit` formata o valor atual/anterior.
 * Sem comparação devolve a explicação, nunca "0%".
 */
export function describeDelta(
  delta: OwnerReportDelta | null,
  format: (value: number) => string,
  previousLabel: string,
): string {
  if (!delta) return `Sem comparação: falta dado em ${previousLabel} ou no mês atual.`;
  const signed = delta.delta > 0 ? "+" : delta.delta < 0 ? "−" : "";
  const abs = format(Math.abs(delta.delta));
  const pct =
    delta.deltaPct === null
      ? ""
      : ` (${delta.deltaPct > 0 ? "+" : delta.deltaPct < 0 ? "−" : ""}${Math.abs(delta.deltaPct).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)`;
  const base = `${format(delta.previous)} em ${previousLabel}`;
  return delta.delta === 0 ? `Estável: ${base}.` : `${signed}${abs}${pct} sobre ${base}.`;
}

/** "2026-09" -> "setembro de 2026" (para o seletor de mês do anfitrião). */
export function periodKeyLabel(key: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(key);
  if (!match) return key;
  const months = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  return `${months[Number(match[2]) - 1]} de ${match[1]}`;
}

/** Dia de hoje (YYYY-MM-DD) no calendário de São Paulo, nunca o dia UTC. */
export function todayKeySP(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Últimos `count` meses (do mais recente, o corrente, para trás) como chaves YYYY-MM. */
export function recentPeriodKeys(todayKey: string, count = 6): string[] {
  const match = /^(\d{4})-(\d{2})/.exec(todayKey);
  if (!match) return [];
  let index = Number(match[1]) * 12 + (Number(match[2]) - 1);
  const keys: string[] = [];
  for (let i = 0; i < count; i += 1, index -= 1) {
    keys.push(`${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`);
  }
  return keys;
}

/** Mensagem de erro da rota pública: distingue vencido/revogado do inválido. */
export function publicReportErrorMessage(status: number | null, code?: string | null): { title: string; body: string } {
  if (status === 410 && code === "LINK_REVOKED") {
    return { title: "Link revogado", body: "Quem enviou este relatório desativou o link. Peça um novo ao responsável pelo seu imóvel." };
  }
  if (status === 410) {
    return { title: "Link expirado", body: "Este link já passou da validade. Peça um novo ao responsável pelo seu imóvel." };
  }
  if (status === 429) {
    return { title: "Muitas tentativas", body: "Aguarde um instante e abra o link de novo." };
  }
  if (status === null || status >= 500) {
    return { title: "Não foi possível abrir agora", body: "O relatório está temporariamente indisponível. Tente de novo em alguns minutos." };
  }
  return { title: "Link inválido", body: "Este link não é válido. Confira se ele foi copiado por inteiro ou peça um novo ao responsável pelo seu imóvel." };
}
