export const MAX_PAGE_LIMIT = 200;

/**
 * Normaliza page/limit vindos de query string (strings, NaN, negativos, absurdos).
 * `limit` fica entre 1 e `maxLimit` (default 200); `page` >= 1.
 */
export function clampPagination(
  page: unknown,
  limit: unknown,
  options: { defaultLimit?: number; maxLimit?: number } = {},
): { page: number; limit: number } {
  const defaultLimit = options.defaultLimit ?? 10;
  const maxLimit = options.maxLimit ?? MAX_PAGE_LIMIT;

  const rawPage = Math.floor(Number(page));
  const rawLimit = Math.floor(Number(limit));

  return {
    page: Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1,
    limit: Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, maxLimit) : defaultLimit,
  };
}
