/**
 * Regras puras da tela de integração Stays (sem React/HTTP) — testadas em
 * scripts/stays-integration-domain.test.mjs.
 */

/** Slug da conta Stays: só o subdomínio de <conta>.stays.net (nunca uma URL). */
export const STAYS_ACCOUNT_SLUG_PATTERN = /^[a-z0-9-]{1,63}$/;

export const STAYS_WRITES_DISABLED_MESSAGE = "Escrita desligada neste ambiente";

/**
 * Normaliza o que o anfitrião digitou para o slug da conta. Aceita
 * "minhaconta", "minhaconta.stays.net" ou "https://minhaconta.stays.net/..."
 * e devolve "minhaconta". Qualquer outro domínio, porta ou caractere vira null.
 */
export function normalizeStaysAccountSlug(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return null;
  const withoutScheme = value.replace(/^https:\/\//, "");
  if (/^[a-z]+:\/\//.test(withoutScheme)) return null;
  const host = withoutScheme.split(/[/?#]/)[0];
  const slug = host.endsWith(".stays.net") ? host.slice(0, -".stays.net".length) : host;
  if (!STAYS_ACCOUNT_SLUG_PATTERN.test(slug) || slug.startsWith("-") || slug.endsWith("-")) return null;
  return slug;
}

export type PriceUpdateLike = {
  id: string;
  origin: "ai_auto" | "user_accepted" | "user_manual" | "rollback";
  status: "pending" | "success" | "rejected" | "error";
  rollbackOfId?: string | null;
};

const STATUS_LABELS: Record<PriceUpdateLike["status"], string> = {
  pending: "Em andamento",
  success: "Aplicado",
  rejected: "Recusado pela Stays",
  error: "Falhou (pode tentar de novo)",
};

const ORIGIN_LABELS: Record<PriceUpdateLike["origin"], string> = {
  ai_auto: "Automático",
  user_accepted: "Aplicado por você",
  user_manual: "Manual",
  rollback: "Reversão",
};

export function priceUpdateStatusLabel(status: PriceUpdateLike["status"]): string {
  return STATUS_LABELS[status] ?? status;
}

export function priceUpdateOriginLabel(origin: PriceUpdateLike["origin"]): string {
  return ORIGIN_LABELS[origin] ?? origin;
}

export function priceUpdateBadgeKind(status: PriceUpdateLike["status"]): "success" | "warn" | "error" | "neutral" {
  if (status === "success") return "success";
  if (status === "pending") return "neutral";
  if (status === "rejected") return "warn";
  return "error";
}

/**
 * "Reverter" só aparece para um push aplicado (não para uma reversão) que
 * ainda não tem reversão aplicada. Reversão que falhou deixa tentar de novo.
 */
export function canRollback(update: PriceUpdateLike, history: PriceUpdateLike[]): boolean {
  if (update.status !== "success" || update.origin === "rollback") return false;
  return !history.some(
    (other) =>
      other.rollbackOfId === update.id && (other.status === "success" || other.status === "pending"),
  );
}

/** Centavos -> valor do input em reais ("" quando não há preço). */
export function centsToReaisInput(cents: number | null | undefined): string {
  if (typeof cents !== "number" || !Number.isFinite(cents) || cents <= 0) return "";
  return (cents / 100).toFixed(2);
}

/** Gera um requestId UUID v4 (decisão nova a cada clique em "Aplicar"). */
export function newStaysRequestId(): string {
  const cryptoRef = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();
  const bytes = new Uint8Array(16);
  if (cryptoRef?.getRandomValues) cryptoRef.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
