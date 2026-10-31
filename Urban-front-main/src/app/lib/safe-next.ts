/**
 * Destino pós-login (`?next=`) só quando for caminho interno seguro.
 *
 * Aceita apenas caminhos que começam com "/" e não com "//" (protocol-relative),
 * sem barra invertida nem caractere de controle (os navegadores tratam "/\" como
 * "//"). Rotas de autenticação são recusadas para não gerar laço de redirecionamento.
 * Função pura, coberta por scripts/safe-next.test.mjs.
 */

const AUTH_ONLY_PATHS = ["/", "/login", "/post-login"];

export function safeNextPath(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null;
  const pathOnly = value.split(/[?#]/)[0];
  if (AUTH_ONLY_PATHS.includes(pathOnly.replace(/\/+$/, "") || "/")) return null;
  return value;
}

/** Lê `next` de uma query string (`?next=%2Fplans`) e valida. */
export function nextFromSearch(search: string | null | undefined): string | null {
  if (!search) return null;
  return safeNextPath(new URLSearchParams(search).get("next"));
}
