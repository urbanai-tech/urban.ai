import type { AppBadgeKind } from "../AppBadge";
import type { HostEventConfidence } from "@/app/service/api";
import { brlCompact, brlWhole, multiple } from "../../../lib/format";

export function formatCurrencyFromCents(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return brlWhole(value / 100);
}

export function formatCompactCurrencyFromCents(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return brlCompact(value / 100);
}

export function formatPercent(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
}

export function formatMultiplier(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return multiple(value);
}

export function formatShortDate(value?: string | null): string {
  if (!value) return "-";
  try {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
    }).format(date);
  } catch {
    return value;
  }
}

export function formatDateRange(startsAt: string | null, endsAt: string | null): string {
  const start = formatShortDate(startsAt);
  const end = endsAt ? formatShortDate(endsAt) : null;
  if (!end || end === start) return start;
  return `${start} - ${end}`;
}

export function formatTime(value?: string | null): string {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export function confidenceLabel(confidence?: HostEventConfidence): string {
  if (confidence === "high") return "Alta confiança";
  if (confidence === "low") return "Baixa confiança";
  return "Média confiança";
}

export function confidenceBadgeKind(confidence?: HostEventConfidence): AppBadgeKind {
  if (confidence === "high") return "success";
  if (confidence === "low") return "warn";
  return "neutral";
}

export function riskLabel(risk?: "low" | "medium" | "high"): string {
  if (risk === "low") return "Risco baixo";
  if (risk === "high") return "Risco alto";
  return "Risco médio";
}

export function riskBadgeKind(risk?: "low" | "medium" | "high"): AppBadgeKind {
  if (risk === "low") return "success";
  if (risk === "high") return "error";
  return "warn";
}

/**
 * "Por que este preço": motivos em linguagem do anfitrião, só com dados que a API
 * já devolve (evento, distância, demanda, faixa). Não recalcula nada.
 */
export function explainImpactReasons(input: {
  eventName?: string | null;
  demandScore?: number | null;
  distanceKm?: number | null;
  minAbsorbablePriceCents?: number | null;
  maxAbsorbablePriceCents?: number | null;
  recommendedPriceCents?: number | null;
  bookingProbability?: number | null;
  mainDrivers?: string[];
}): string[] {
  const reasons: string[] = [];
  const event = input.eventName ? `"${input.eventName}"` : "O evento";
  if (typeof input.demandScore === "number" && Number.isFinite(input.demandScore)) {
    reasons.push(`${event} tem demanda esperada ${demandLevelLabel(input.demandScore)} (${Math.round(input.demandScore)} de 100).`);
  }
  if (typeof input.distanceKm === "number" && Number.isFinite(input.distanceKm)) {
    const km = input.distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    reasons.push(`Seu imóvel fica a ${km} km do evento; quanto mais perto, mais hóspedes ele atrai.`);
  }
  const min = input.minAbsorbablePriceCents;
  const max = input.maxAbsorbablePriceCents;
  if (typeof min === "number" && typeof max === "number") {
    reasons.push(`Pelo histórico de reservas na região, diárias entre ${brlWhole(min / 100)} e ${brlWhole(max / 100)} costumam fechar.`);
  }
  if (typeof input.bookingProbability === "number" && typeof input.recommendedPriceCents === "number") {
    reasons.push(`No preço sugerido de ${brlWhole(input.recommendedPriceCents / 100)}, a chance de reserva estimada é de ${formatPercent(input.bookingProbability)}.`);
  }
  for (const driver of input.mainDrivers ?? []) {
    if (driver && !looksTechnical(driver)) reasons.push(driver);
  }
  return reasons.slice(0, 5);
}

export function demandLevelLabel(score: number): string {
  if (score >= 84) return "muito alta";
  if (score >= 74) return "alta";
  if (score >= 50) return "moderada";
  return "baixa";
}

/** Códigos internos (h3, geohash, ids, snake_case) não devem chegar ao anfitrião. */
function looksTechnical(text: string): boolean {
  return /(h3|geohash|jobRunId|mock|snapshot)|[a-z]+_[a-z_]+|[a-f0-9]{8,}/i.test(text);
}
