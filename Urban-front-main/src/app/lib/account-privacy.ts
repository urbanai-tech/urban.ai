/**
 * Utilidades do autoatendimento LGPD (exportar dados / excluir conta).
 * Funções puras, cobertas por scripts/account-privacy.test.mjs.
 */

export async function sha256Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
