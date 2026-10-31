import { AdminUsersService } from './admin-users.service';

/** QueryBuilder falso: registra as cláusulas para conferir filtros e paginação. */
function makeQb(result: [unknown[], number]) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['select', 'orderBy', 'addOrderBy', 'skip', 'take', 'andWhere', 'orWhere', 'where', 'getQuery']) {
    qb[m] = jest.fn().mockReturnValue(qb);
  }
  qb.getQuery.mockReturnValue('SELECT 1 FROM payment p');
  qb.getManyAndCount = jest.fn().mockResolvedValue(result);
  return qb;
}

function makeService(result: [unknown[], number] = [[{ id: 'u1' }], 1]) {
  const userQb = makeQb(result);
  const paymentQb = makeQb([[], 0]);
  const userRepo = { createQueryBuilder: jest.fn().mockReturnValue(userQb) };
  const paymentRepo = { createQueryBuilder: jest.fn().mockReturnValue(paymentQb) };
  const service = new AdminUsersService(userRepo as any, {} as any, paymentRepo as any, {} as any, {} as any);
  return { service, userQb, paymentQb };
}

const whereCalls = (qb: Record<string, jest.Mock>) => qb.andWhere.mock.calls.map((c) => c[0]);

describe('AdminUsersService.listUsers', () => {
  it('sem filtros mantém o contrato (paginação, ordem e formato da resposta)', async () => {
    const { service, userQb } = makeService([[{ id: 'u1' }], 41]);
    const res = await service.listUsers(2, 20);

    expect(res).toEqual({ data: [{ id: 'u1' }], total: 41, page: 2, limit: 20, totalPages: 3 });
    expect(userQb.skip).toHaveBeenCalledWith(20);
    expect(userQb.take).toHaveBeenCalledWith(20);
    expect(userQb.orderBy).toHaveBeenCalledWith('user.createdAt', 'DESC');
    expect(userQb.andWhere).not.toHaveBeenCalled();
    // password nunca entra no select
    expect(JSON.stringify(userQb.select.mock.calls)).not.toContain('password');
  });

  it('normaliza page/limit fora da faixa', async () => {
    const { service, userQb } = makeService([[], 0]);
    const res = await service.listUsers(-3, 9999);
    expect(res).toMatchObject({ page: 1, limit: 100, totalPages: 1 });
    expect(userQb.take).toHaveBeenCalledWith(100);
  });

  it('aplica papel, status e intervalo de datas (fim do dia inclusivo)', async () => {
    const { service, userQb } = makeService();
    await service.listUsers(1, 20, {
      role: 'support',
      ativo: false,
      createdFrom: '2026-10-01',
      createdTo: '2026-10-31',
    });

    expect(whereCalls(userQb)).toEqual([
      'user.role = :role',
      'user.ativo = :ativo',
      'user.createdAt >= :createdFrom',
      'user.createdAt <= :createdTo',
    ]);
    const params = userQb.andWhere.mock.calls.map((c) => c[1]);
    expect(params[1]).toEqual({ ativo: false });
    expect((params[2].createdFrom as Date).toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect((params[3].createdTo as Date).toISOString()).toBe('2026-10-31T23:59:59.999Z');
  });

  it('busca por substring escapando curingas e barras do termo', async () => {
    const { service, userQb } = makeService();
    await service.listUsers(1, 20, { q: '  50%_Off\\x ' });

    expect(userQb.andWhere).toHaveBeenCalledTimes(1);
    // O termo vai em parâmetro (nunca concatenado no SQL): Brackets recebe o callback.
    const brackets = userQb.andWhere.mock.calls[0][0] as { whereFactory: (qb: any) => void };
    const inner = makeQb([[], 0]);
    brackets.whereFactory(inner);
    expect(inner.where).toHaveBeenCalledWith('LOWER(user.email) LIKE :like', { like: '%50\\%\\_off\\\\x%' });
    expect(inner.orWhere).toHaveBeenCalledTimes(2);
  });

  it('filtra por plano com subconsulta EXISTS parametrizada', async () => {
    const { service, userQb, paymentQb } = makeService();
    await service.listUsers(1, 20, { plan: 'profissional' });

    expect(paymentQb.andWhere).toHaveBeenCalledWith('p.planName = :plan');
    const [sql, params] = userQb.andWhere.mock.calls[0];
    expect(sql).toBe('EXISTS (SELECT 1 FROM payment p)');
    expect(params).toEqual({ plan: 'profissional' });
  });

  it('ignora busca vazia (só espaços)', async () => {
    const { service, userQb } = makeService();
    await service.listUsers(1, 20, { q: '   ' });
    expect(userQb.andWhere).not.toHaveBeenCalled();
  });
});
