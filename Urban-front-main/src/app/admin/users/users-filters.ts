/**
 * Regras puras (sem React) do formulário de busca/filtros de /admin/users:
 * estado do formulário (strings) → parâmetros enviados ao GET /admin/users.
 */

export interface UserFiltersForm {
  q: string;
  role: "" | "host" | "admin" | "support";
  ativo: "" | "true" | "false";
  plan: string;
  createdFrom: string;
  createdTo: string;
}

export interface UserFiltersQuery {
  q?: string;
  role?: "host" | "admin" | "support";
  ativo?: boolean;
  plan?: string;
  createdFrom?: string;
  createdTo?: string;
}

export const EMPTY_USER_FILTERS: UserFiltersForm = {
  q: "",
  role: "",
  ativo: "",
  plan: "",
  createdFrom: "",
  createdTo: "",
};

/** Converte o formulário em query: omite vazios, apara espaços, "true"/"false" → boolean. */
export function filtersToQuery(form: UserFiltersForm): UserFiltersQuery {
  const query: UserFiltersQuery = {};
  const q = form.q.trim();
  if (q) query.q = q;
  if (form.role) query.role = form.role;
  if (form.ativo) query.ativo = form.ativo === "true";
  const plan = form.plan.trim();
  if (plan) query.plan = plan;
  if (form.createdFrom) query.createdFrom = form.createdFrom;
  if (form.createdTo) query.createdTo = form.createdTo;
  return query;
}

export function hasActiveFilters(query: UserFiltersQuery): boolean {
  return Object.keys(query).length > 0;
}
