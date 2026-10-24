/**
 * Helpers do checkout Stripe (puros, cobertos por scripts/checkout.test.mjs).
 *
 * O backend responde `{ sessionId, url }`. `stripe.redirectToCheckout` está
 * deprecado: o caminho principal é `window.location.assign(url)`. O fallback por
 * `sessionId` existe só para respostas antigas sem `url`.
 */
export type CheckoutRedirect =
  | { mode: "url"; url: string }
  | { mode: "sessionId"; sessionId: string };

export type CheckoutResponse = { sessionId?: string | null; url?: string | null } | null | undefined;

/** Só redireciona para o domínio hospedado do Stripe (evita open redirect). */
export function isTrustedCheckoutUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && /(^|\.)stripe\.com$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function pickCheckoutRedirect(response: CheckoutResponse): CheckoutRedirect | null {
  if (response?.url && isTrustedCheckoutUrl(response.url)) {
    return { mode: "url", url: response.url };
  }
  if (response?.sessionId) {
    return { mode: "sessionId", sessionId: response.sessionId };
  }
  return null;
}

export type CheckoutReturn = "success" | "canceled" | null;

/** Lê `?checkout=success|canceled` configurado em SUCCESS_URL/CANCEL_URL. */
export function parseCheckoutReturn(search: string): CheckoutReturn {
  const value = new URLSearchParams(search).get("checkout");
  return value === "success" || value === "canceled" ? value : null;
}
