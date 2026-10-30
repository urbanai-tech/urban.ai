/**
 * Content-Security-Policy com nonce por requisição.
 *
 * Gerada no middleware (`src/middleware.ts`) a cada request de página: o nonce
 * vai para o header da resposta e para o header de request `x-nonce`, que o
 * root layout lê para carimbar os <script> inline (tema, GA4, Meta Pixel,
 * JSON-LD). O próprio Next.js extrai o nonce do header CSP da request e o
 * aplica nos scripts de bootstrap/flight que ele injeta.
 *
 * Sem dependências de runtime: roda no Edge (middleware) e é importável pelos
 * testes de contrato via transpile (scripts/csp-contract.test.mjs).
 */

export const NONCE_HEADER = "x-nonce";
export const CSP_REPORT_PATH = "/api/csp-report";
export const CSP_REPORT_GROUP = "csp-endpoint";

export const CSP_ENFORCE_HEADER = "Content-Security-Policy";
export const CSP_REPORT_ONLY_HEADER = "Content-Security-Policy-Report-Only";

/**
 * Origens de script permitidas como fallback para navegadores sem
 * 'strict-dynamic' (CSP2). Em navegadores CSP3, 'strict-dynamic' faz a lista
 * de hosts ser ignorada: vale o nonce e o que scripts confiáveis carregarem.
 */
export const SCRIPT_ORIGINS = [
  "https://js.stripe.com",
  "https://www.googletagmanager.com",
  "https://connect.facebook.net",
  "https://challenges.cloudflare.com", // Cloudflare Turnstile (captcha da waitlist)
] as const;

export const FRAME_ORIGINS = [
  "https://js.stripe.com",
  "https://hooks.stripe.com",
  "https://www.google.com",
  "https://challenges.cloudflare.com", // widget do Turnstile roda em iframe
] as const;

export const FORM_ACTION_ORIGINS = ["https://*.stripe.com"] as const;

/** 128 bits aleatórios em base64 — formato aceito por 'nonce-<base64>'. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Origem http(s) de uma URL (ex.: NEXT_PUBLIC_API_URL) ou null. Em produção a
 * API já é coberta por `https:`; listar a origem explicitamente também cobre
 * dev/E2E local, onde a API mockada roda em http://127.0.0.1.
 */
export function originOf(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

/** Só `CSP_ENFORCE=true` (ou 1) liga o modo bloqueante; o padrão é report-only. */
export function isCspEnforced(value: string | undefined | null): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

export function cspHeaderName(enforce: boolean): string {
  return enforce ? CSP_ENFORCE_HEADER : CSP_REPORT_ONLY_HEADER;
}

export function buildContentSecurityPolicy({
  nonce,
  isDev = false,
  apiUrl,
}: {
  nonce: string;
  isDev?: boolean;
  apiUrl?: string | null;
}): string {
  if (!/^[A-Za-z0-9+/=_-]{16,}$/.test(nonce)) {
    throw new Error("CSP nonce inválido");
  }
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...SCRIPT_ORIGINS,
    // Fallback CSP1: ignorado por qualquer navegador que entenda nonce.
    "'unsafe-inline'",
    // React Refresh/HMR do `next dev` usa eval; nunca em build de produção.
    ...(isDev ? ["'unsafe-eval'"] : []),
  ];
  const apiOrigin = originOf(apiUrl);
  const connectSrc = ["'self'", ...(apiOrigin ? [apiOrigin] : []), "https:", "wss:"];

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    `form-action 'self' ${FORM_ACTION_ORIGINS.join(" ")}`,
    `script-src ${scriptSrc.join(" ")}`,
    // Estilos inline (framer-motion, style={}) continuam permitidos. Não pôr
    // nonce aqui: com nonce o navegador passa a ignorar 'unsafe-inline'.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // API (Railway), Sentry, GA4, Meta, Stripe, Turnstile, tiles de mapa:
    // todos HTTPS. Mantido amplo como na política report-only anterior.
    `connect-src ${connectSrc.join(" ")}`,
    `frame-src 'self' ${FRAME_ORIGINS.join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
    `report-uri ${CSP_REPORT_PATH}`,
    `report-to ${CSP_REPORT_GROUP}`,
  ].join("; ");
}

export function reportingEndpointsHeader(): string {
  return `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`;
}

/** Tudo que o middleware precisa para uma requisição. */
export function resolveCsp({
  nonce,
  enforce,
  isDev = false,
  apiUrl,
}: {
  nonce: string;
  enforce: string | undefined | null;
  isDev?: boolean;
  apiUrl?: string | null;
}): { headerName: string; value: string; reportingEndpoints: string } {
  return {
    headerName: cspHeaderName(isCspEnforced(enforce)),
    value: buildContentSecurityPolicy({ nonce, isDev, apiUrl }),
    reportingEndpoints: reportingEndpointsHeader(),
  };
}
