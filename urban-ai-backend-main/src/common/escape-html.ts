/**
 * Escapa um valor para interpolação segura em HTML (conteúdo de elemento ou
 * valor de atributo entre aspas). Use em TODO valor controlado pelo usuário
 * (nome, título, URL, etc.) que entre em HTML de e-mail.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
