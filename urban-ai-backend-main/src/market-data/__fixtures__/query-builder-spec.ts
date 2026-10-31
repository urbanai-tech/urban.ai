/** Query builder falso e encadeável para os testes dos adaptadores (sem banco). */
export function mockQueryBuilder(rows: any[] = [], raw: any[] = []) {
  const qb: any = {};
  for (const method of [
    'innerJoinAndSelect',
    'leftJoinAndSelect',
    'innerJoin',
    'leftJoin',
    'where',
    'andWhere',
    'take',
    'select',
    'addSelect',
    'groupBy',
    'addGroupBy',
    'orderBy',
    'insert',
    'into',
    'values',
    'orUpdate',
  ]) {
    qb[method] = jest.fn().mockReturnValue(qb);
  }
  qb.getMany = jest.fn().mockResolvedValue(rows);
  qb.getRawMany = jest.fn().mockResolvedValue(raw);
  qb.execute = jest.fn().mockResolvedValue({});
  return qb;
}

export function whereClauses(qb: any): string {
  return [...qb.where.mock.calls, ...qb.andWhere.mock.calls].map((call: any[]) => call[0]).join(' | ');
}
