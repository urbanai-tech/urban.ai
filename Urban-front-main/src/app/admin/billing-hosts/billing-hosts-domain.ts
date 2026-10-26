/**
 * Regras puras (sem React) da tela /admin/billing-hosts: rótulos, cores e textos.
 * O backend já decide o estado (mesma regra do guard 402); aqui só apresentação.
 */

export type BadgeKind = "success" | "warn" | "error" | "neutral" | "accent";

export const BILLING_FILTERS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "attention", label: "Precisam de atenção" },
  { value: "trialing", label: "Em trial" },
  { value: "active", label: "Ativos" },
  { value: "past_due", label: "Pagamento falhou" },
  { value: "canceled", label: "Cancelados" },
  { value: "none", label: "Sem assinatura" },
];

const STATUS_BADGE: Record<string, BadgeKind> = {
  alpha: "accent",
  trialing: "accent",
  trial_expired: "warn",
  active: "success",
  past_due: "error",
  canceled: "neutral",
  incomplete: "warn",
  expired: "warn",
  none: "neutral",
  inactive: "neutral",
};

export function statusBadgeKind(status: string): BadgeKind {
  return STATUS_BADGE[status] ?? "neutral";
}

/** "termina em 3 dias" / "termina hoje" / "" (não é trial). */
export function trialText(status: string, daysLeft: number | null): string {
  if (status !== "trialing" || daysLeft === null) return "";
  if (daysLeft <= 0) return "termina hoje";
  return `termina em ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`;
}

const CYCLE_LABELS: Record<string, string> = {
  monthly: "mensal",
  quarterly: "trimestral",
  semestral: "semestral",
  annual: "anual",
};

/** "Profissional · 2 imóveis · mensal"; "sem dados" quando não há nenhum campo. */
export function planSummary(host: {
  planName: string | null;
  listingsContratados: number | null;
  billingCycle: string | null;
}): string {
  const parts: string[] = [];
  if (host.planName) parts.push(host.planName.charAt(0).toUpperCase() + host.planName.slice(1));
  if (host.listingsContratados) {
    parts.push(`${host.listingsContratados} ${host.listingsContratados === 1 ? "imóvel" : "imóveis"}`);
  }
  if (host.billingCycle) parts.push(CYCLE_LABELS[host.billingCycle] ?? host.billingCycle);
  return parts.length ? parts.join(" · ") : "sem dados";
}

/** Data/hora no calendário de São Paulo; "sem dados" para vazio/inválido. */
export function formatSaoPauloDateTime(value: string | null | undefined): string {
  if (!value) return "sem dados";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sem dados";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatSaoPauloDate(value: string | null | undefined): string {
  if (!value) return "sem dados";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sem dados";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}

export function sendLinkLabel(suggested: "portal" | "checkout", status: string): string {
  if (suggested === "portal") return "Enviar link do portal";
  return status === "none" || status === "incomplete" ? "Enviar link de checkout" : "Enviar link para reativar";
}

/** Texto de confirmação antes do envio (o admin vê exatamente o que vai acontecer). */
export function sendLinkConfirmation(host: { email: string; name: string }, suggested: "portal" | "checkout"): string {
  const target = host.name ? `${host.name} (${host.email})` : host.email;
  return suggested === "portal"
    ? `Enviar por e-mail para ${target} o link do portal de cobrança do Stripe (cartão, faturas, plano)?`
    : `Enviar por e-mail para ${target} o link para concluir a assinatura no Stripe?`;
}
