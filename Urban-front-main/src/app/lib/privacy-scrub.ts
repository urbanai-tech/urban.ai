/**
 * Scrub de URLs/eventos antes de sair para terceiros (GA4, Meta Pixel, Sentry).
 *
 * Arquivo PURO (sem imports) para poder ser usado no client, no server e no edge,
 * e testado com node:test. Espelha a ideia de `redactObservabilityData` do backend.
 *
 * Contexto: o link de reset de senha carrega o token no path
 * (`/reset-password/<token>`) e `/confirm-email/<email>` carrega o e-mail no path.
 */

export const REDACTED = "[redacted]";

/** Segmentos de rota cujo(s) filho(s) são sempre sensíveis (token/e-mail no path). */
const SENSITIVE_PARENT_SEGMENTS = new Set([
  "reset-password",
  "confirm-email",
  "aceitar",
  "invite",
  "convite",
  "verify",
]);

/** Query params sempre removidos (nome casa com este padrão). */
const SENSITIVE_QUERY_KEY =
  /(?:token|code|e-?mail|password|passwd|senha|secret|key|auth|session|otp|invite|signature|^sig$|hash|jwt|cpf|phone|telefone)/i;

/** Query params de marketing que NÃO são sensíveis (mesmo se casarem o padrão acima). */
const SAFE_QUERY_KEYS = new Set([
  "ref",
  "referral",
  "gclid",
  "fbclid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
]);

const EMAIL_RE = /[A-Za-z0-9._%+-]+(?:@|%40)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const JWT_RE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const BEARER_RE = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi;
const KV_SECRET_RE =
  /\b((?:api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|auth[_-]?token|token|password|senha|secret|code)=)[^\s&"']+/gi;
const OPAQUE_SEGMENT_RE = /^[A-Za-z0-9_.~%-]{24,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function looksSensitiveSegment(segment: string): boolean {
  if (!segment) return false;
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // mantém o segmento bruto
  }
  if (decoded.includes("@")) return true;
  if (JWT_RE.test(decoded)) {
    JWT_RE.lastIndex = 0;
    return true;
  }
  JWT_RE.lastIndex = 0;
  if (UUID_RE.test(decoded)) return true;
  // Token opaco: longo e com mistura de letras e dígitos.
  return OPAQUE_SEGMENT_RE.test(segment) && /[A-Za-z]/.test(segment) && /\d/.test(segment);
}

/** Remove tokens/e-mails de um path (`/reset-password/abc` -> `/reset-password/[redacted]`). */
export function scrubPath(path: string): string {
  if (!path) return path;
  const segments = path.split("/");
  let afterSensitiveParent = false;
  const scrubbed = segments.map((segment) => {
    if (!segment) return segment;
    const lower = segment.toLowerCase();
    if (afterSensitiveParent || looksSensitiveSegment(segment)) return REDACTED;
    if (SENSITIVE_PARENT_SEGMENTS.has(lower)) afterSensitiveParent = true;
    return segment;
  });
  return scrubbed.join("/");
}

/** Remove valores de query params sensíveis (mantém chaves de marketing). */
export function scrubQuery(search: string): string {
  if (!search) return "";
  const raw = search.startsWith("?") ? search.slice(1) : search;
  if (!raw) return "";
  const params = new URLSearchParams(raw);
  const out = new URLSearchParams();
  params.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    const sensitiveKey = !SAFE_QUERY_KEYS.has(lowerKey) && SENSITIVE_QUERY_KEY.test(lowerKey);
    const sensitiveValue = EMAIL_RE.test(value) || looksLikeJwt(value);
    EMAIL_RE.lastIndex = 0;
    out.append(key, sensitiveKey || sensitiveValue ? REDACTED : value);
  });
  const text = out.toString();
  return text ? `?${text}` : "";
}

function looksLikeJwt(value: string): boolean {
  const result = JWT_RE.test(value);
  JWT_RE.lastIndex = 0;
  return result;
}

/**
 * Scrub de uma URL (absoluta ou relativa): path + query. O fragmento (#...) é
 * sempre removido (pode carregar access_token em fluxos OAuth).
 */
export function scrubUrl(url: string): string {
  if (!url) return url;
  const noHash = url.split("#")[0];
  const queryIndex = noHash.indexOf("?");
  const beforeQuery = queryIndex >= 0 ? noHash.slice(0, queryIndex) : noHash;
  const query = queryIndex >= 0 ? noHash.slice(queryIndex) : "";

  const origin = /^[a-z][a-z0-9+.-]*:\/\/[^/]*/i.exec(beforeQuery)?.[0] ?? "";
  const path = beforeQuery.slice(origin.length);
  return `${origin}${scrubPath(path)}${scrubQuery(query)}`;
}

/** Scrub de texto livre (mensagens de erro, breadcrumbs). */
export function scrubString(value: string): string {
  return value
    .replace(BEARER_RE, "$1 [redacted]")
    .replace(JWT_RE, REDACTED)
    .replace(EMAIL_RE, REDACTED)
    .replace(KV_SECRET_RE, `$1${REDACTED}`)
    .replace(/https?:\/\/[^\s"'<>)]+/gi, (match) => scrubUrl(match));
}

const SENSITIVE_KEY =
  /(?:password|passwd|senha|secret|token|authorization|cookie|dsn|api[_-]?key|cpf)/i;
const PII_KEY = /^(?:email|e-mail|phone|telephone|username)$/i;
const URL_KEYS = new Set([
  "url",
  "to",
  "from",
  "page_location",
  "referrer",
  "referer",
  "origin",
  "location",
  "href",
  "request_url",
  "http.url",
]);

/** Scrub recursivo de um objeto (evento/breadcrumb do Sentry). Não muta o original. */
export function scrubDeep<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (typeof value === "string") return scrubString(value) as unknown as T;
  if (Array.isArray(value)) return value.map((item) => scrubDeep(item, seen)) as unknown as T;
  if (!value || typeof value !== "object") return value;
  if (seen.has(value as object)) return "[circular]" as unknown as T;
  seen.add(value as object);

  const result: Record<string, unknown> = {};
  for (const [key, candidate] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key) || PII_KEY.test(key)) {
      result[key] = REDACTED;
    } else if (typeof candidate === "string" && URL_KEYS.has(key.toLowerCase())) {
      result[key] = scrubUrl(scrubString(candidate));
    } else if (key === "query_string" && typeof candidate === "string") {
      result[key] = scrubQuery(candidate).replace(/^\?/, "");
    } else {
      result[key] = scrubDeep(candidate, seen);
    }
  }
  seen.delete(value as object);
  return result as T;
}

/** `beforeSend` / `beforeSendTransaction` do Sentry: remove token/PII de URL, headers e breadcrumbs. */
export function scrubSentryEvent<T extends object>(event: T): T {
  const scrubbed = scrubDeep(event) as T & {
    transaction?: string;
    request?: { headers?: Record<string, unknown>; cookies?: unknown; data?: unknown };
    user?: Record<string, unknown>;
  };
  if (typeof scrubbed.transaction === "string") {
    scrubbed.transaction = scrubUrl(scrubbed.transaction);
  }
  if (scrubbed.request) {
    delete scrubbed.request.cookies;
    delete scrubbed.request.data;
  }
  if (scrubbed.user) {
    delete scrubbed.user.email;
    delete scrubbed.user.ip_address;
    delete scrubbed.user.username;
  }
  return scrubbed;
}

/** `beforeBreadcrumb` do Sentry. */
export function scrubBreadcrumb<T extends object>(breadcrumb: T): T {
  return scrubDeep(breadcrumb);
}

/**
 * Rotas do site público (marketing). GA4/Meta Pixel só rodam aqui — nunca em
 * rotas de auth/app, onde o path pode conter token ou e-mail.
 * Mantida em paridade com `PUBLIC_ONLY_PATHS` de `src/middleware.ts` (há teste).
 */
export const ANALYTICS_PUBLIC_PATHS: readonly string[] = [
  "/",
  "/landing",
  "/sobre",
  "/termos",
  "/privacidade",
  "/contato",
  "/precos",
  "/lancamento",
  "/precificacao-dinamica-airbnb",
  "/como-precificar-airbnb-em-dias-de-eventos",
  "/precificacao-por-eventos-sao-paulo",
  "/integracao-stays-precificacao-automatica",
  "/urban-ai-vs-planilha-de-precificacao",
  "/seguranca-lgpd-ia-precificacao",
];

/**
 * Rotas de conversão fora do site público onde GA4/Pixel também medem
 * (`sign_up`/`CompleteRegistration`). O path não carrega token nem e-mail, e a
 * query passa pelo `scrubUrl` antes de sair.
 */
export const ANALYTICS_CONVERSION_PATHS: readonly string[] = ["/create"];

export function isAnalyticsAllowedPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const normalized = (pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname).toLowerCase();
  return ANALYTICS_PUBLIC_PATHS.includes(normalized) || ANALYTICS_CONVERSION_PATHS.includes(normalized);
}
