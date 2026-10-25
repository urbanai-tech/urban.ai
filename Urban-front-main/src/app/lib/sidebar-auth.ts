/**
 * Decisão do SideBar ao carregar `GET /auth/me` (função pura, coberta por
 * scripts/sidebar-auth.test.mjs).
 *
 * Só um 401 significa "sessão inválida" e justifica mandar o usuário ao login.
 * Falha de rede (sem status), 5xx ou qualquer outro erro é transitório: a
 * pessoa continua na página e vê um estado de nova tentativa.
 */
export function shouldRedirectToLogin(status: number | null | undefined): boolean {
  return status === 401;
}
