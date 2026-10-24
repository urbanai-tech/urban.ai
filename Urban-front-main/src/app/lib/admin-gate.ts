/**
 * Decisão do gate de /admin (função pura, coberta por scripts/admin-gate.test.mjs).
 *
 * Mesma fonte de papel do SideBar: `GET /auth/me` -> `role` (case-insensitive).
 * O backend continua sendo a barreira real (RolesGuard); isto só evita montar
 * o shell administrativo para quem não é admin.
 */
export type AdminGateDecision =
  | { kind: "allow" }
  | { kind: "forbidden" }
  | { kind: "login" }
  | { kind: "retry" };

export function isAdminRole(role: unknown): boolean {
  return typeof role === "string" && role.trim().toLowerCase() === "admin";
}

export function decideAdminGate(
  input: { ok: true; role?: unknown } | { ok: false; status?: number | null },
): AdminGateDecision {
  if (input.ok) return isAdminRole(input.role) ? { kind: "allow" } : { kind: "forbidden" };
  if (input.status === 401) return { kind: "login" };
  if (input.status === 403) return { kind: "forbidden" };
  // Rede/5xx: não dá para afirmar que não é admin — pede nova tentativa.
  return { kind: "retry" };
}
