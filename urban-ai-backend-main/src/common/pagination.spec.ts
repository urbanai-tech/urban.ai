import { clampPagination, MAX_PAGE_LIMIT } from './pagination';

describe('clampPagination', () => {
  it('mantém valores válidos', () => {
    expect(clampPagination(2, 50)).toEqual({ page: 2, limit: 50 });
    expect(clampPagination('3', '20')).toEqual({ page: 3, limit: 20 });
  });

  it('limita o limit ao máximo (200 por padrão)', () => {
    expect(clampPagination(1, 1_000_000).limit).toBe(MAX_PAGE_LIMIT);
    expect(clampPagination(1, 500, { maxLimit: 100 }).limit).toBe(100);
  });

  it('normaliza NaN, zero e negativos', () => {
    expect(clampPagination('abc', 'xyz')).toEqual({ page: 1, limit: 10 });
    expect(clampPagination(0, 0)).toEqual({ page: 1, limit: 10 });
    expect(clampPagination(-5, -1)).toEqual({ page: 1, limit: 10 });
    expect(clampPagination(undefined, undefined, { defaultLimit: 25 })).toEqual({ page: 1, limit: 25 });
  });
});
