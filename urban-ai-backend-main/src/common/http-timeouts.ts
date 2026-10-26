/**
 * Timeouts padrão para chamadas HTTP de saída (TD3 — nenhuma chamada externa
 * pode pendurar uma request ou um cron). Use estas constantes em vez de
 * números mágicos; `axios` e SDKs aceitam `timeout` em ms e `fetch` não tem
 * timeout nativo, então use `fetchWithTimeout`.
 */
export const HTTP_TIMEOUT_MS = {
  /** Lookups simples e baratos (OAuth tokeninfo, Web Push, Routes API, Nominatim, CEP). */
  fast: 10_000,
  /** Padrão para APIs de terceiros (RapidAPI/Airbnb, Brevo, Google Geocoding, Stays). */
  default: 15_000,
  /** APIs conhecidamente lentas (scraping/metadata de anúncio). */
  slow: 20_000,
  /** Inferência de IA (Gemini) e consultas pesadas (Wikidata SPARQL). */
  heavy: 45_000,
  /** Firecrawl e extrações que renderizam páginas. */
  scrape: 60_000,
  /** Stripe (o default do SDK é 80s). */
  stripe: 20_000,
} as const;

export class HttpTimeoutError extends Error {
  constructor(
    readonly url: string,
    readonly timeoutMs: number,
  ) {
    super(`HTTP request timed out after ${timeoutMs}ms`);
    this.name = 'HttpTimeoutError';
  }
}

/** `fetch` com timeout (AbortController). Respeita um `signal` já informado em `init`. */
export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs: number = HTTP_TIMEOUT_MS.default,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const upstream = init.signal;
  const onUpstreamAbort = () => controller.abort();
  if (upstream) {
    if (upstream.aborted) controller.abort();
    else upstream.addEventListener('abort', onUpstreamAbort, { once: true });
  }
  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } catch (error) {
    // Não inclui query string na mensagem: pode carregar token/chave.
    if (timedOut) throw new HttpTimeoutError(String(input).split('?')[0], timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
    upstream?.removeEventListener('abort', onUpstreamAbort);
  }
}
