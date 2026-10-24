const SENSITIVE_KEY = /pass(word)?|senha|secret|token|authorization|cookie|api[-_]?key|credential|code|codigo|cvv|card|cpf|cnpj|signature/i;
const EMAIL_KEY = /^(e-?mail|to|cc|bcc|from|recipient|destinatario)$/i;
const FREE_TEXT_KEY = /^(html|body|content|conteudo|message|mensagem|text|texto)$/i;
const MAX_STRING = 200;
const MAX_ITEMS = 20;
const MAX_DEPTH = 4;
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

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
  // Chaves vêm do corpo da requisição: descarta as que alteram protótipo e monta o
  // resultado com Object.fromEntries (define propriedades próprias, sem acionar o
  // setter de __proto__), evitando injeção de propriedade/poluição de protótipo.
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([k]) => !UNSAFE_KEYS.has(k))
      .map(([k, v]) => [k, redactForAudit(v, k, depth + 1)]),
  );
}
