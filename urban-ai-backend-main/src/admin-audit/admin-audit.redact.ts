const SENSITIVE_KEY = /pass(word)?|senha|secret|token|authorization|cookie|api[-_]?key|credential|code|codigo|cvv|card|cpf|cnpj|signature/i;
const EMAIL_KEY = /^(e-?mail|to|cc|bcc|from|recipient|destinatario)$/i;
const FREE_TEXT_KEY = /^(html|body|content|conteudo|message|mensagem|text|texto)$/i;
const MAX_STRING = 200;
const MAX_ITEMS = 20;
const MAX_DEPTH = 4;

export function maskEmail(value: string): string {
  const [local, domain] = String(value).split('@');
  if (!domain) return '[email]';
  return `${local.slice(0, 1)}***@${domain}`;
}

/**
 * Remove segredos e minimiza dados pessoais antes de gravar no log de auditoria:
 * credenciais/tokens viram [REDACTED], e-mails são mascarados, corpos livres
 * (ex.: HTML de e-mail enviado por admin) guardam só o tamanho.
 */
export function redactForAudit(value: unknown, key = '', depth = 0): unknown {
  if (value == null) return value;
  if (SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (typeof value === 'string') {
    if (EMAIL_KEY.test(key)) return maskEmail(value);
    if (FREE_TEXT_KEY.test(key)) return `[omitted:${value.length} chars]`;
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}...[+${value.length - MAX_STRING}]` : value;
  }
  if (typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ITEMS).map((item) => redactForAudit(item, key, depth + 1));
    return value.length > MAX_ITEMS ? [...items, `[+${value.length - MAX_ITEMS} items]`] : items;
  }
  if (value instanceof Date) return value.toISOString();
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = redactForAudit(v, k, depth + 1);
  }
  return out;
}
