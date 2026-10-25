import { Logger } from '@nestjs/common';
import { evaluateEntitlement } from './entitlement';
import { SubscriptionQuotaService } from './subscription-quota.service';

jest.mock('typeorm', () => {
  const actual = jest.requireActual('typeorm');
  return { ...actual, In: (ids: string[]) => ({ __in: ids }) };
});

type FakeAddress = {
  id: string;
  ativo: boolean;
  quotaPausedAt: Date | null;
  created_at: Date;
  analisado?: string;
  list?: { id: string; manualDailyPrice?: number; pricingInputSource?: string };
};

const NOW = new Date();
const at = (n: number) => new Date(2026, 0, 1 + n);

function address(id: string, createdDay: number, extra: Partial<FakeAddress> = {}): FakeAddress {
  return { id, ativo: true, quotaPausedAt: null, created_at: at(createdDay), ...extra };
}

function setup(opts: {
  payments: Parameters<typeof evaluateEntitlement>[0]['payments'];
  addresses: FakeAddress[];
  role?: string;
  alphaQuota?: number | null;
  queue?: { getJob: jest.Mock; add: jest.Mock };
}) {
  const addresses = opts.addresses;
  const addressRepo = {
    find: jest.fn(async (query: any) => {
      if (query?.where?.analisado) {
        return addresses.filter((a) => a.ativo && a.analisado === query.where.analisado);
      }
      return [...addresses].sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
    }),
    update: jest.fn(async (criteria: any, patch: Partial<FakeAddress>) => {
      const ids: string[] = criteria.id.__in;
      for (const row of addresses) if (ids.includes(row.id)) Object.assign(row, patch);
    }),
  };
  const entitlement = {
    invalidate: jest.fn(),
    getEntitlement: jest.fn(async () =>
      evaluateEntitlement({
        role: opts.role ?? 'host',
        ativo: true,
        alphaQuota: opts.alphaQuota ?? null,
        payments: opts.payments,
        now: NOW,
        graceDays: 3,
      }),
    ),
  };
  const notificationRepo = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };
  const userRepo = { findOne: jest.fn().mockResolvedValue({ id: 'u1', email: 'host@example.com', username: 'Host' }) };
  const mailer = { sendHtmlEmail: jest.fn().mockResolvedValue({ enviado: true, status: 202 }) };
  const paymentRepo = {} as any;

  const service = new SubscriptionQuotaService(
    entitlement as any,
    addressRepo as any,
    paymentRepo,
    userRepo as any,
    notificationRepo as any,
    mailer as any,
    undefined,
    opts.queue as any,
  );
  return { service, addresses, addressRepo, entitlement, notificationRepo, mailer };
}

describe('SubscriptionQuotaService.reconcileUser', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  const fiveActive = () => [
    address('a1', 1),
    address('a2', 2),
    address('a3', 3),
    address('a4', 4),
    address('a5', 5),
  ];

  it('downgrade (5 -> 3): pausa os 2 imóveis adicionados por último, sem apagar nada, e notifica', async () => {
    const { service, addresses, notificationRepo, mailer, addressRepo } = setup({
      payments: [{ status: 'active', expireDate: new Date(NOW.getTime() + 864e5), listingsContratados: 3 }],
      addresses: fiveActive(),
    });

    const result = await service.reconcileUser('u1');

    expect(result.paused.sort()).toEqual(['a4', 'a5']);
    expect(result.reactivated).toEqual([]);
    expect(addresses.filter((a) => a.ativo).map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
    const paused = addresses.filter((a) => !a.ativo);
    expect(paused.map((a) => a.id).sort()).toEqual(['a4', 'a5']);
    expect(paused.every((a) => a.quotaPausedAt instanceof Date)).toBe(true);
    expect(addresses).toHaveLength(5); // nada é apagado
    expect((addressRepo as any).delete).toBeUndefined();

    expect(notificationRepo.save).toHaveBeenCalledTimes(1);
    expect(notificationRepo.save.mock.calls[0][0]).toMatchObject({
      title: 'Imóveis pausados pelo seu plano',
      redirectTo: '/plans?upsell=quota',
      user: { id: 'u1' },
    });
    expect(mailer.sendHtmlEmail).toHaveBeenCalledTimes(1);
  });

  it('é idempotente: rodar de novo sem mudança de cota não pausa nem notifica de novo', async () => {
    const { service, notificationRepo } = setup({
      payments: [{ status: 'active', listingsContratados: 3 }],
      addresses: fiveActive(),
    });
    await service.reconcileUser('u1');
    notificationRepo.save.mockClear();

    const second = await service.reconcileUser('u1');

    expect(second.paused).toEqual([]);
    expect(second.reactivated).toEqual([]);
    expect(notificationRepo.save).not.toHaveBeenCalled();
  });

  it('upgrade (3 -> 4): reativa o pausado mais antigo primeiro, só até caber na cota', async () => {
    const rows = fiveActive();
    const { service, addresses, notificationRepo } = setup({
      payments: [{ status: 'active', listingsContratados: 4 }],
      addresses: rows,
    });
    rows[3].ativo = false; // a4 pausado por cota
    rows[3].quotaPausedAt = at(30);
    rows[4].ativo = false; // a5 pausado por cota
    rows[4].quotaPausedAt = at(30);

    const result = await service.reconcileUser('u1');

    expect(result.reactivated).toEqual(['a4']);
    expect(addresses.find((a) => a.id === 'a4')).toMatchObject({ ativo: true, quotaPausedAt: null });
    expect(addresses.find((a) => a.id === 'a5')).toMatchObject({ ativo: false });
    expect(notificationRepo.save.mock.calls[0][0]).toMatchObject({ title: 'Imóveis reativados' });
  });

  it('cota >= total: reativa todos os pausados por cota', async () => {
    const rows = fiveActive();
    rows[3].ativo = false;
    rows[3].quotaPausedAt = at(30);
    rows[4].ativo = false;
    rows[4].quotaPausedAt = at(30);
    const { service, addresses } = setup({
      payments: [{ status: 'active', listingsContratados: 10 }],
      addresses: rows,
    });

    await service.reconcileUser('u1');

    expect(addresses.every((a) => a.ativo && a.quotaPausedAt === null)).toBe(true);
  });

  it('respeita imóvel desativado pelo usuário (ativo=false sem quotaPausedAt): não reativa', async () => {
    const rows = [address('a1', 1), address('a2', 2, { ativo: false })];
    const { service, addresses } = setup({
      payments: [{ status: 'active', listingsContratados: 5 }],
      addresses: rows,
    });

    const result = await service.reconcileUser('u1');

    expect(result.reactivated).toEqual([]);
    expect(addresses.find((a) => a.id === 'a2')?.ativo).toBe(false);
  });

  it('assinatura cancelada (sem direito): pausa todos, mas não apaga', async () => {
    const { service, addresses, notificationRepo } = setup({
      payments: [{ status: 'canceled', listingsContratados: 5 }],
      addresses: fiveActive(),
    });

    const result = await service.reconcileUser('u1');

    expect(result.paused).toHaveLength(5);
    expect(addresses.every((a) => !a.ativo && a.quotaPausedAt)).toBe(true);
    expect(notificationRepo.save.mock.calls[0][0].title).toBe('Seus imóveis foram pausados');
  });

  it('past_due dentro da carência não pausa nada', async () => {
    const { service, addresses } = setup({
      payments: [{ status: 'past_due', expireDate: new Date(NOW.getTime() - 864e5), listingsContratados: 5 }],
      addresses: fiveActive(),
    });

    const result = await service.reconcileUser('u1');

    expect(result.paused).toEqual([]);
    expect(addresses.every((a) => a.ativo)).toBe(true);
  });

  it('quem nunca teve cobrança (ainda no onboarding) não é tocado', async () => {
    const { service, addresses } = setup({ payments: [], addresses: fiveActive() });

    const result = await service.reconcileUser('u1');

    expect(result.skipped).toBe('no_billing_history');
    expect(addresses.every((a) => a.ativo)).toBe(true);
  });

  it('admin e alpha por env são tratados: admin sem limite, alpha pela cota do env', async () => {
    const admin = setup({ payments: [], role: 'admin', addresses: fiveActive() });
    expect((await admin.service.reconcileUser('u1')).paused).toEqual([]);

    const alpha = setup({ payments: [], alphaQuota: 2, addresses: fiveActive() });
    const result = await alpha.service.reconcileUser('u1');
    expect(result.paused.sort()).toEqual(['a3', 'a4', 'a5']);
  });

  it('invalida o cache de entitlement antes de decidir', async () => {
    const { service, entitlement } = setup({
      payments: [{ status: 'active', listingsContratados: 5 }],
      addresses: fiveActive(),
    });
    await service.reconcileUser('u1');
    expect(entitlement.invalidate).toHaveBeenCalledWith('u1');
    expect(entitlement.getEntitlement).toHaveBeenCalledWith('u1', { fresh: true });
  });

  describe('retomada das análises pendentes ao ativar o plano', () => {
    const pricedList = (id: string) => ({ id, manualDailyPrice: 300, pricingInputSource: 'manual' });

    it('enfileira imóveis pendentes com diária base válida (mesmo jobId do POST /processos)', async () => {
      const queue = { getJob: jest.fn().mockResolvedValue(null), add: jest.fn().mockResolvedValue({}) };
      const { service } = setup({
        payments: [{ status: 'active', listingsContratados: 5 }],
        addresses: [
          address('a1', 1, { analisado: 'pending', list: pricedList('l1') }),
          address('a2', 2, { analisado: 'pending', list: { id: 'l2' } }), // sem diária base
          address('a3', 3, { analisado: 'completed', list: pricedList('l3') }),
        ],
        queue,
      });

      await service.reconcileUser('u1', { kickoffPendingAnalyses: true });

      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(queue.add).toHaveBeenCalledWith(
        { userId: 'u1', propertyAdressId: 'l1' },
        expect.objectContaining({ jobId: 'processo-u1-l1' }),
      );
    });

    it('não duplica quando já há job na fila e não faz nada sem o flag nem sem direito', async () => {
      const queue = {
        getJob: jest.fn().mockResolvedValue({ getState: async () => 'waiting', remove: jest.fn() }),
        add: jest.fn(),
      };
      const entitled = setup({
        payments: [{ status: 'active', listingsContratados: 5 }],
        addresses: [address('a1', 1, { analisado: 'pending', list: pricedList('l1') })],
        queue,
      });
      await entitled.service.reconcileUser('u1', { kickoffPendingAnalyses: true });
      expect(queue.add).not.toHaveBeenCalled();

      const noFlag = setup({
        payments: [{ status: 'active', listingsContratados: 5 }],
        addresses: [address('a1', 1, { analisado: 'pending', list: pricedList('l1') })],
        queue: { getJob: jest.fn().mockResolvedValue(null), add: jest.fn() },
      });
      await noFlag.service.reconcileUser('u1');
      expect((noFlag as any).service.processQueue.add).not.toHaveBeenCalled();

      const canceled = setup({
        payments: [{ status: 'canceled' }],
        addresses: [address('a1', 1, { analisado: 'pending', list: pricedList('l1') })],
        queue: { getJob: jest.fn().mockResolvedValue(null), add: jest.fn() },
      });
      await canceled.service.reconcileUser('u1', { kickoffPendingAnalyses: true });
      expect((canceled as any).service.processQueue.add).not.toHaveBeenCalled();
    });
  });
});
