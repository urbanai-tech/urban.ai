/**
 * No logout, cancela o Web Push do dispositivo ANTES de encerrar a sessão
 * (o DELETE /push/subscriptions é autenticado). Em aparelho compartilhado, a
 * assinatura do usuário anterior continuaria recebendo os pushes dele.
 *
 * Melhor esforço: erro ou lentidão nunca impedem o logout (limite de tempo).
 */
export const LOGOUT_PUSH_CLEANUP_TIMEOUT_MS = 3_000;

export async function cancelPushOnLogout(
  unsubscribe: () => Promise<unknown>,
  timeoutMs: number = LOGOUT_PUSH_CLEANUP_TIMEOUT_MS,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("push cleanup timeout")), timeoutMs);
    });
    await Promise.race([unsubscribe(), timeout]);
    return true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
