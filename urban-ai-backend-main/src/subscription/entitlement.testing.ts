/**
 * Dublê de EntitlementService para specs de serviços/crons que só precisam
 * "liberar todos" ou "bloquear todos" (sem jest, para não vazar tipos no build).
 */
export function entitlementDouble(opts: { entitled?: boolean | ((userId: string) => boolean) } = {}) {
  const decide = (userId: string): boolean =>
    typeof opts.entitled === 'function' ? opts.entitled(userId) : opts.entitled !== false;

  return {
    isEntitled: async (userId: string) => decide(userId),
    filterEntitledUserIds: async (ids: string[]) => new Set((ids ?? []).filter((id) => decide(id))),
    getEntitlement: async (userId: string) => ({
      entitled: decide(userId),
      reason: decide(userId) ? 'active' : 'no_subscription',
      source: decide(userId) ? 'subscription' : 'none',
      quota: decide(userId) ? 1 : 0,
      hasBillingHistory: decide(userId),
    }),
    invalidate: () => undefined,
  };
}
