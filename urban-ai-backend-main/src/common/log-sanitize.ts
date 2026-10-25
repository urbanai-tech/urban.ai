/**
 * Neutraliza valores controlados pelo usuário antes de irem para o log:
 * remove CR/LF e demais caracteres de controle (evita forjar linhas de log)
 * e limita o tamanho.
 */
const LINE_SEPARATORS = new RegExp(`[${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, 'g');

export function sanitizeForLog(value: unknown, maxLength = 200): string {
  const text = typeof value === 'string' ? value : value === undefined ? 'undefined' : String(value);
  const cleaned = text
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f-\x9f]/g, ' ')
    .replace(LINE_SEPARATORS, ' ');
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}...` : cleaned;
}
