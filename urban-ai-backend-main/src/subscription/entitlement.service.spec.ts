import { EntitlementService } from './entitlement.service';

jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return { ...actual, In: (ids: string[]) => ({ __in: ids }) };
});

const NOW = new Date('2026-10-25T12:00:00.000Z');
const day = (offset: number) => new Date(NOW.getTime() + offset * 24 * 60 * 60 * 1000);

describe('EntitlementService', () => {
  const originalEnv = process.env;

  function build(opts: { users?: any[]; payments?: any[] } = {}) {
    const users = opts.users ?? [{ id: 'u1', email: 'host@example.com', role: 'host', ativo: true }];
    const payments = opts.payments ?? [];
    const userRepo = {
      findOne: jest.fn(async ({ where }: any) => users.find((u) => u.id === where.id) ?? null),
      find: jest.fn(async ({ where }: any) => users.filter((u) => where.id.__in.includes(u.id))),
    };
    const paymentRepo = {
      find: jest.fn(async ({ where }: any) => {
        const ids: string[] = where.user.id.__in ?? [where.user.id];
        return payments.filter((p) => ids.includes(p.user.id));
      }),
    };
    return { service: new EntitlementService(userRepo as any, paymentRepo as any), userRepo, paymentRepo };
  }

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ALPHA_USER_QUOTAS;
    delete process.env.SUBSCRIPTION_GRACE_DAYS;
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it('usuário com assinatura ativa é elegível e a decisão positiva é cacheada', async () => {
    const { service, userRepo } = build({
      payments: [{ user: { id: 'u1' }, status: 'active', expireDate: day(10), listingsContratados: 4 }],
    });

    const first = await service.getEntitlement('u1', { now: NOW });
    const second = await service.getEntitlement('u1', { now: NOW });

    expect(first).toMatchObject({ entitled: true, quota: 4 });
    expect(second).toBe(first);
    expect(userRepo.findOne).toHaveBeenCalledTimes(1);
  });

  it('decisão negativa NUNCA é cacheada: quem acabou de pagar libera na próxima chamada', async () => {
    const payments: any[] = [];
    const { service, userRepo } = build({ payments });

    expect((await service.getEntitlement('u1', { now: NOW })).entitled).toBe(false);
    payments.push({ user: { id: 'u1' }, status: 'active', expireDate: day(30), listingsContratados: 1 });

    expect((await service.getEntitlement('u1', { now: NOW })).entitled).toBe(true);
    expect(userRepo.findOne).toHaveBeenCalledTimes(2);
  });

  it('fresh ignora o cache e invalidate o descarta', async () => {
    const { service, userRepo } = build({
      payments: [{ user: { id: 'u1' }, status: 'active', expireDate: day(10) }],
    });
    await service.getEntitlement('u1', { now: NOW });
    await service.getEntitlement('u1', { now: NOW, fresh: true });
    expect(userRepo.findOne).toHaveBeenCalledTimes(2);

    service.invalidate('u1');
    await service.getEntitlement('u1', { now: NOW });
    expect(userRepo.findOne).toHaveBeenCalledTimes(3);
  });

  it('o cache positivo expira (30s)', async () => {
    const { service, userRepo } = build({
      payments: [{ user: { id: 'u1' }, status: 'active', expireDate: day(10) }],
    });
    await service.getEntitlement('u1', { now: NOW });
    await service.getEntitlement('u1', { now: new Date(NOW.getTime() + 31_000) });
    expect(userRepo.findOne).toHaveBeenCalledTimes(2);
  });

  it('ALPHA_USER_QUOTAS libera por e-mail e SUBSCRIPTION_GRACE_DAYS controla a carência', async () => {
    process.env.ALPHA_USER_QUOTAS = 'host@example.com:3';
    const alpha = build({ payments: [] });
    expect(await alpha.service.getEntitlement('u1', { now: NOW })).toMatchObject({
      entitled: true,
      source: 'alpha_env',
      quota: 3,
    });

    delete process.env.ALPHA_USER_QUOTAS;
    process.env.SUBSCRIPTION_GRACE_DAYS = '1';
    const pastDue = build({ payments: [{ user: { id: 'u1' }, status: 'past_due', expireDate: day(-2) }] });
    expect((await pastDue.service.getEntitlement('u1', { now: NOW })).entitled).toBe(false);

    process.env.SUBSCRIPTION_GRACE_DAYS = '5';
    const pastDueLong = build({ payments: [{ user: { id: 'u1' }, status: 'past_due', expireDate: day(-2) }] });
    expect((await pastDueLong.service.getEntitlement('u1', { now: NOW })).entitled).toBe(true);
  });

  it('usuário inexistente ou desativado não tem direito', async () => {
    const { service } = build({ users: [{ id: 'u2', role: 'admin', ativo: false }] });
    expect((await service.getEntitlement('nao-existe', { now: NOW })).entitled).toBe(false);
    expect((await service.getEntitlement('u2', { now: NOW })).reason).toBe('user_inactive');
    expect(await service.isEntitled('', { now: NOW })).toBe(false);
  });

  it('filterEntitledUserIds resolve em lote (2 queries) e filtra', async () => {
    const { service, userRepo, paymentRepo } = build({
      users: [
        { id: 'pago', role: 'host', ativo: true },
        { id: 'gratis', role: 'host', ativo: true },
        { id: 'cancelado', role: 'host', ativo: true },
        { id: 'adm', role: 'admin', ativo: true },
      ],
      payments: [
        { user: { id: 'pago' }, status: 'active', expireDate: day(5) },
        { user: { id: 'cancelado' }, status: 'canceled', expireDate: day(5) },
      ],
    });

    const entitled = await service.filterEntitledUserIds(['pago', 'gratis', 'cancelado', 'adm', 'fantasma', 'pago'], {
      now: NOW,
    });

    expect([...entitled].sort()).toEqual(['adm', 'pago']);
    expect(userRepo.find).toHaveBeenCalledTimes(1);
    expect(paymentRepo.find).toHaveBeenCalledTimes(1);
    expect((await service.filterEntitledUserIds([], { now: NOW })).size).toBe(0);
  });
});
