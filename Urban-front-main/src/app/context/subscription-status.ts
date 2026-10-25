/**
 * Estado de assinatura/sessão para os guards (PaymentCheckGuard e AuthGuard).
 *
 * Regras:
 * - Só uma resposta DEFINITIVA da API vira veredito `active`/`inactive`.
 * - Falha de rede, timeout, 5xx, 429 etc. vira `unknown`: o guard NÃO mostra
 *   o paywall (cliente pagante não pode ver paywall por instabilidade nossa)
 *   e oferece "tentar de novo".
 * - Vereditos definitivos ficam em cache em memória por TTL curto para que a
 *   navegação entre páginas não refaça a chamada a cada troca de pathname.
 */
export type SubscriptionVerdict = "active" | "inactive" | "unknown";

export const SUBSCRIPTION_ACTIVE_TTL_MS = 60_000;
export const SUBSCRIPTION_INACTIVE_TTL_MS = 15_000;

const ACTIVE_STATUSES = ["active", "trialing"];

type SubscriptionLike = { status?: string } | null | undefined | "";

export function classifySubscription(subscription: SubscriptionLike): SubscriptionVerdict {
  const status = typeof subscription === "object" && subscription ? subscription.status : undefined;
  return status && ACTIVE_STATUSES.includes(status) ? "active" : "inactive";
}

export function classifySubscriptionError(error: unknown): SubscriptionVerdict {
  const status = (error as { response?: { status?: number } } | null | undefined)?.response?.status;
  // 404 = ainda sem customer/assinatura: resposta definitiva de "sem plano".
  if (status === 404) return "inactive";
  return "unknown";
}

type CacheEntry = { verdict: Exclude<SubscriptionVerdict, "unknown">; at: number };

let subscriptionCache: CacheEntry | null = null;

export function getCachedSubscriptionVerdict(
  now: number = Date.now(),
): Exclude<SubscriptionVerdict, "unknown"> | null {
  if (!subscriptionCache) return null;
  const ttl =
    subscriptionCache.verdict === "active" ? SUBSCRIPTION_ACTIVE_TTL_MS : SUBSCRIPTION_INACTIVE_TTL_MS;
  if (now - subscriptionCache.at > ttl) {
    subscriptionCache = null;
    return null;
  }
  return subscriptionCache.verdict;
}

export function setCachedSubscriptionVerdict(
  verdict: SubscriptionVerdict,
  now: number = Date.now(),
): void {
  if (verdict === "unknown") return; // nunca cacheia incerteza
  subscriptionCache = { verdict, at: now };
}

/**
 * Evento do window disparado pelo interceptor quando o backend responde 402
 * SUBSCRIPTION_REQUIRED. O PaymentCheckGuard escuta e abre o paywall.
 */
export const SUBSCRIPTION_REQUIRED_EVENT = "urbanai:subscription-required";

/** O backend disse (402) que não há assinatura: vale como veredito definitivo "inactive". */
export function markSubscriptionRequired(now: number = Date.now()): void {
  subscriptionCache = { verdict: "inactive", at: now };
}

/** Chamar após checkout/cancelamento/logout para forçar nova consulta. */
export function invalidateSubscriptionCache(): void {
  subscriptionCache = null;
}

// ── Sessão (AuthGuard) ─────────────────────────────────────────────────────
export const AUTH_OK_TTL_MS = 60_000;

let authOkAt: number | null = null;

export function isAuthRecentlyVerified(now: number = Date.now()): boolean {
  return authOkAt !== null && now - authOkAt <= AUTH_OK_TTL_MS;
}

export function markAuthVerified(now: number = Date.now()): void {
  authOkAt = now;
}

export function invalidateAuthCache(): void {
  authOkAt = null;
}

/** Só 401/403 definitivos derrubam para login; erro de rede/5xx não. */
export function isDefinitiveAuthFailure(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | null | undefined)?.response?.status;
  return status === 401 || status === 403;
}
