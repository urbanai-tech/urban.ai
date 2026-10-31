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
