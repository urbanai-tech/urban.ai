/**
 * Recebe relatórios de violação de CSP (report-uri e Reporting API) e registra
 * uma linha compacta no log do servidor. Nada é persistido.
 *
 * Privacidade: URLs são reduzidas a origem + caminho (sem query string nem
 * fragmento, onde moram tokens de reset/confirmação), e caminhos com token são
 * redigidos pelo mesmo scrub usado no Analytics/Sentry. `script-sample`,
 * user-agent e IP nunca são registrados.
 *
 * Sem dependências: testável via transpile em scripts/csp-contract.test.mjs.
 */

/** Relatórios reais têm ~1 KB; o lote da Reporting API raramente passa de 8 KB. */
export const CSP_REPORT_MAX_BYTES = 16 * 1024;
/** No máximo N relatórios registrados por janela, por processo (anti-flood barato). */
export const CSP_REPORT_LOG_LIMIT = 60;
export const CSP_REPORT_WINDOW_MS = 60_000;
const MAX_ENTRIES_PER_REQUEST = 10;

const ACCEPTED_TYPES = ["application/csp-report", "application/reports+json", "application/json"];

export type CspReportEntry = {
  directive: string;
  blocked: string;
  document: string;
  source?: string;
  line?: number;
  disposition?: string;
};

const SENSITIVE_PATH = /^\/(reset-password|confirm-email)\/.+/;

/** Origem + caminho, sem query/fragmento; `inline`, `eval` etc. passam como estão. */
export function stripUrl(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "";
  const raw = value.slice(0, 2048);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // Palavras-chave do CSP ("inline", "eval", "wasm-eval", "trusted-types-sink").
    return /^[a-z-]{1,32}$/i.test(raw) ? raw : "[invalid]";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return url.protocol;
  const path = SENSITIVE_PATH.test(url.pathname)
    ? url.pathname.replace(SENSITIVE_PATH, "/$1/[redacted]")
    : url.pathname;
  return `${url.origin}${path}`.slice(0, 300);
}

function str(value: unknown, max = 120): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function toEntry(body: Record<string, unknown>): CspReportEntry | null {
  // Formato report-uri usa kebab-case; Reporting API usa camelCase.
  const directive = str(body["effective-directive"] ?? body.effectiveDirective ?? body["violated-directive"]);
  if (!directive) return null;
  const entry: CspReportEntry = {
    directive,
    blocked: stripUrl(body["blocked-uri"] ?? body.blockedURL),
    document: stripUrl(body["document-uri"] ?? body.documentURL),
  };
  const source = stripUrl(body["source-file"] ?? body.sourceFile);
  if (source) entry.source = source;
  const line = body["line-number"] ?? body.lineNumber;
  if (typeof line === "number" && Number.isFinite(line)) entry.line = line;
  const disposition = str(body.disposition, 16);
  if (disposition) entry.disposition = disposition;
  return entry;
}

/** Normaliza os dois formatos de payload; descarta o resto. */
export function parseCspReports(payload: unknown): CspReportEntry[] {
  const entries: CspReportEntry[] = [];
  if (Array.isArray(payload)) {
    for (const item of payload.slice(0, MAX_ENTRIES_PER_REQUEST)) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      if (record.type !== "csp-violation" || !record.body || typeof record.body !== "object") continue;
      const entry = toEntry(record.body as Record<string, unknown>);
      if (entry) entries.push(entry);
    }
    return entries;
  }
  if (payload && typeof payload === "object") {
    const body = (payload as Record<string, unknown>)["csp-report"];
    if (body && typeof body === "object") {
      const entry = toEntry(body as Record<string, unknown>);
      if (entry) entries.push(entry);
    }
  }
  return entries;
}

type Limiter = { windowStart: number; count: number };
const limiter: Limiter = { windowStart: 0, count: 0 };

function allowLog(now: number): boolean {
  if (now - limiter.windowStart >= CSP_REPORT_WINDOW_MS) {
    limiter.windowStart = now;
    limiter.count = 0;
  }
  limiter.count += 1;
  return limiter.count <= CSP_REPORT_LOG_LIMIT;
}

/** Só para testes. */
export function resetCspReportLimiter(): void {
  limiter.windowStart = 0;
  limiter.count = 0;
}

const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

export async function handleCspReport(
  request: Request,
  log: (line: string) => void = (line) => console.warn(line),
  now: () => number = Date.now,
): Promise<Response> {
  const contentType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!ACCEPTED_TYPES.includes(contentType)) {
    return new Response(null, { status: 415 });
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > CSP_REPORT_MAX_BYTES) {
    return new Response(null, { status: 413 });
  }

  // Lê com teto mesmo sem content-length (chunked): para no limite.
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > CSP_REPORT_MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        return new Response(null, { status: 413 });
      }
      chunks.push(value);
    }
  }

  let payload: unknown;
  try {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return new Response(null, { status: 400 });
  }

  const entries = parseCspReports(payload);
  for (const entry of entries) {
    if (!allowLog(now())) break;
    log(`[csp-report] ${JSON.stringify(entry)}`);
  }
  return noContent();
}
