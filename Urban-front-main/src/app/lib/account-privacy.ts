/**
 * Utilidades do autoatendimento LGPD (exportar dados / excluir conta).
 * Funções puras, cobertas por scripts/account-privacy.test.mjs.
 */

/**
 * Resumo de erro seguro para log: só status HTTP e mensagem. Nunca o objeto do
 * axios inteiro, cujo `config.data` carrega o corpo da requisição (senha em claro
 * nos fluxos de login, reset, troca de e-mail e exclusão de conta).
 */
export function safeErrorSummary(error: unknown): string {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  const message = error instanceof Error ? error.message : "erro desconhecido";
  return status ? `HTTP ${status}: ${message}` : message;
}

export function exportFileName(now: Date = new Date()): string {
  return `urbanai-meus-dados-${now.toISOString().slice(0, 10)}.json`;
}

export function serializeExport(bundle: unknown): string {
  return JSON.stringify(bundle, null, 2);
}

/** Mensagem amigável para erros do DELETE /auth/me (por `code` do backend). */
export function deleteAccountErrorMessage(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: { code?: string; message?: string } } } | null)
    ?.response;
  const code = response?.data?.code;
  if (code === "INVALID_PASSWORD") return "Senha incorreta. Confira e tente de novo.";
  if (code === "PASSWORD_REQUIRED") return "Informe sua senha atual para excluir a conta.";
  if (code === "INVALID_CONFIRMATION") return "Digite o e-mail da conta para confirmar a exclusão.";
  if (code === "SUBSCRIPTION_CANCEL_FAILED" || code === "SUBSCRIPTION_CHECK_FAILED") {
    return (
      response?.data?.message ||
      "Não conseguimos cancelar sua assinatura agora, então a conta não foi excluída. Tente novamente em instantes."
    );
  }
  return "Não conseguimos excluir sua conta agora. Tente novamente em instantes.";
}
