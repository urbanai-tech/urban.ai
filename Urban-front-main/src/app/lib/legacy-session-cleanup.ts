/**
 * Fase 2 da migração de sessão: o JWT vive só em cookies httpOnly.
 *
 * Navegadores que logaram antes da migração ainda carregam o token antigo no
 * localStorage (legível por qualquer script, inclusive XSS). Remove essas chaves
 * uma vez por carga; o cookie httpOnly continua valendo, então a pessoa segue logada.
 */
export const LEGACY_AUTH_STORAGE_KEYS = ["accessToken", "refreshToken", "lastRegisterEmail"] as const;

type StorageLike = Pick<Storage, "removeItem">;

export function purgeLegacyAuthStorage(
  storage: StorageLike | null | undefined = typeof window !== "undefined" ? window.localStorage : null,
): void {
  if (!storage) return;
  for (const key of LEGACY_AUTH_STORAGE_KEYS) {
    try {
      storage.removeItem(key);
    } catch {
      /* storage indisponível (modo privado/bloqueado): nada a limpar */
    }
  }
}
