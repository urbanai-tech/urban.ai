/**
 * Regras puras (sem React) da tela /admin/outcomes: formatação honesta, sem inventar números.
 * `null` vira "sem dados" (nunca zero); percentuais sempre com sinal.
 */

export type OutcomeKind = "booked" | "not_booked" | "blocked" | "unknown";

const OUTCOME_LABEL: Record<OutcomeKind, string> = {
  booked: "Reservou",
  not_booked: "Não reservou",
  blocked: "Bloqueado",
  unknown: "Sem dado concreto",
};

export function outcomeLabel(outcome: string): string {
  return OUTCOME_LABEL[outcome as OutcomeKind] ?? "Sem dados";
}

export function outcomeBadgeKind(outcome: string): "success" | "warn" | "neutral" {
  if (outcome === "booked") return "success";
  if (outcome === "not_booked") return "warn";
  return "neutral";
}

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "sem dados";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatSignedPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "sem dados";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString("pt-BR")}%`;
}

export function formatPlainPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "sem dados";
  return `${value.toLocaleString("pt-BR")}%`;
}

export function closerLabel(closer: "v1" | "v2" | "tie" | null): string {
  if (closer === "v1") return "v1";
  if (closer === "v2") return "v2";
  if (closer === "tie") return "empate";
  return "sem v2";
}

export function formatDayKey(key: string | null | undefined): string {
  if (!key) return "sem dados";
  const [year, month, day] = key.split("-");
  if (!year || !month || !day) return "sem dados";
  return `${day}/${month}/${year.slice(2)}`;
}

/**
 * Faixa de amostra: o que a tela pode afirmar com este n. Abaixo do mínimo só mostra contagens.
 */
export function sampleBanner(
  nWithBoth: number,
  minSample: number,
): { tone: "warn" | "success"; text: string } {
  if (nWithBoth < minSample) {
    return {
      tone: "warn",
      text: `Amostra pequena (n = ${nWithBoth} com v1, v2 e resultado; mínimo ${minSample}). Sem conclusões: só contagens.`,
    };
  }
  return {
    tone: "success",
    text: `n = ${nWithBoth} com v1, v2 e resultado. Mede proximidade com o preço praticado, não receita; não é teste A/B.`,
  };
}
