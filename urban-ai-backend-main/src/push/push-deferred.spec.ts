import { PushNotificationService } from './push-notification.service';
import { PushEndpointSecurity } from './push-endpoint-security';
import { PushDeferredDrainService } from './push-deferred-drain.service';
import { nextQuietEnd, DEFAULT_QUIET_HOURS, planDeferredDrain, buildEventAlertPayload } from './push-payload.builder';

type Row = Record<string, any>;

/** Repositório de entregas em memória, com UPDATE condicional atômico (como o MySQL). */
function makeFakeDeliveryRepo() {
  const rows: Row[] = [];
  let seq = 0;
  return {
    rows,
    create: (entity: Row) => ({
      deliveredAt: null, failedAt: null, pushedAt: null, deliverAfter: null, expiresAt: null, tag: null, ...entity,
    }),
    save: jest.fn(async (entity: Row) => {
      if (Array.isArray(entity)) return entity;
      if (!entity.id) {
        entity.id = `del-${(seq += 1)}`;
        entity.createdAt = new Date();
        rows.push(entity);
      }
      return entity;
    }),
    find: jest.fn(async () =>
      rows
        .filter((r) => r.deliverAfter && r.deliverAfter.getTime() <= Date.now() && !r.pushedAt && !r.deliveredAt && !r.failedAt)
        .sort((a, b) => a.createdAt - b.createdAt),
    ),
    update: jest.fn(async (criteria: Row, patch: Row) => {
      const row = rows.find((r) => r.id === criteria.id);
      if (!row || row.deliverAfter === null) return { affected: 0 };
      Object.assign(row, patch);
      return { affected: 1 };
    }),
    count: jest.fn(async (options: { where: Row[] }) => {
      const since = Date.now() - 24 * 60 * 60 * 1000;
      const userId = options.where[0].userId;
      return rows.filter(
        (r) =>
          r.userId === userId &&
          r.deliverAfter === null &&
          ((r.pushedAt && r.pushedAt.getTime() > since) ||
            (!r.pushedAt && !r.failedAt && r.createdAt.getTime() > since)),
      ).length;
    }),
  };
}

const iso = (value: string) => new Date(value);

describe('push adiado pelo horário de silêncio', () => {
  const setup = () => {
    process.env.WEB_PUSH_PUBLIC_KEY = 'public-key';
    process.env.WEB_PUSH_PRIVATE_KEY = 'private-key';
    const deliveryRepo = makeFakeDeliveryRepo();
    const subscription = { id: 'sub-1', userId: 'user-1', deviceId: 'dev-1', active: true, endpoint: 'https://push.example.test/d' };
    const subscriptionRepo = {
      find: jest.fn().mockResolvedValue([subscription]),
      findOne: jest.fn().mockResolvedValue(subscription),
      save: jest.fn(async (s: Row) => s),
    };
    const preferencesRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const communicationLog = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new PushNotificationService(
      subscriptionRepo as any,
      deliveryRepo as any,
      { findOne: jest.fn() } as any,
      communicationLog as any,
      { assertSafe: jest.fn(async (e: string) => new URL(e)) } as unknown as PushEndpointSecurity,
      preferencesRepo as any,
    );
    const wake = jest.spyOn(service as any, 'sendWakePush').mockResolvedValue(undefined);
    return { service, deliveryRepo, preferencesRepo, communicationLog, wake };
  };
  const at = (value: string) => jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout'] }).setSystemTime(iso(value));
  const digest = (tag = 'pricing-digest-2026-10-26', extra: Row = {}) => ({
    title: 'Preço',
    tag,
    data: { type: 'pricing_recommendation_digest' },
    ...extra,
  });

  afterEach(() => {
    delete process.env.WEB_PUSH_PUBLIC_KEY;
    delete process.env.WEB_PUSH_PRIVATE_KEY;
    delete process.env.PUSH_MAX_PER_DAY;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('nextQuietEnd: 07:59 BRT -> hoje 08:00; 08:00 BRT e 23:00 BRT -> próximo 08:00 (10:59Z/11:00Z)', () => {
    expect(nextQuietEnd(iso('2026-10-26T10:59:00Z'), DEFAULT_QUIET_HOURS).toISOString()).toBe('2026-10-26T11:00:00.000Z');
    expect(nextQuietEnd(iso('2026-10-26T11:00:00Z'), DEFAULT_QUIET_HOURS).toISOString()).toBe('2026-10-27T11:00:00.000Z');
    expect(nextQuietEnd(iso('2026-10-27T02:00:00Z'), DEFAULT_QUIET_HOURS).toISOString()).toBe('2026-10-27T11:00:00.000Z');
  });

  it('adia em vez de descartar: grava a entrega com deliverAfter 08:00 BRT e não envia nada', async () => {
    at('2026-10-27T02:00:00Z'); // 23:00 BRT de 26/10
    const { service, deliveryRepo, wake, communicationLog } = setup();
    const result = await service.sendToUser('user-1', digest());
    expect(result).toMatchObject({ attempted: 0, sent: 0, skippedReason: 'quiet_hours', deferred: 1 });
    expect(wake).not.toHaveBeenCalled();
    expect(deliveryRepo.rows).toHaveLength(1);
    expect(deliveryRepo.rows[0].deliverAfter.toISOString()).toBe('2026-10-27T11:00:00.000Z');
    expect(deliveryRepo.rows[0].tag).toBe('pricing-digest-2026-10-26');
    expect(deliveryRepo.rows[0].expiresAt.getTime()).toBe(Date.now() + 24 * 60 * 60 * 1000);
    expect(communicationLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped', failureReason: 'quiet_hours_deferred' }),
    );
  });

  it('o push de teste do usuário continua passando direto no silêncio', async () => {
    at('2026-10-27T02:00:00Z');
    const { service, deliveryRepo, wake } = setup();
    const result = await service.sendToUser('user-1', { title: 'Teste', data: { type: 'test' } });
    expect(result).toMatchObject({ sent: 1 });
    expect(wake).toHaveBeenCalledTimes(1);
    expect(deliveryRepo.rows[0].deliverAfter).toBeNull();
  });

  it('entrega às 08:00 BRT: 07:59 não envia, 08:00 envia e a entrega vira pendente para o service worker', async () => {
    at('2026-10-27T02:00:00Z');
    const { service, deliveryRepo, wake } = setup();
    await service.sendToUser('user-1', digest());

    jest.setSystemTime(iso('2026-10-27T10:59:00Z'));
    expect(await service.drainDeferred()).toMatchObject({ due: 0, sent: 0 });
    expect(wake).not.toHaveBeenCalled();

    jest.setSystemTime(iso('2026-10-27T11:00:00Z'));
    expect(await service.drainDeferred()).toMatchObject({ due: 1, sent: 1, failed: 0 });
    expect(wake).toHaveBeenCalledTimes(1);
    expect(deliveryRepo.rows[0].deliverAfter).toBeNull();
    expect(deliveryRepo.rows[0].pushedAt).toBeInstanceOf(Date);

    expect(await service.drainDeferred()).toMatchObject({ due: 0, sent: 0 });
    expect(wake).toHaveBeenCalledTimes(1);
  });

  it('colapsa por tag no mesmo dispositivo: envia só o mais recente', async () => {
    at('2026-10-27T01:00:00Z');
    const { service, deliveryRepo, wake } = setup();
    await service.sendToUser('user-1', digest('pricing-digest-2026-10-26', { body: 'antigo' }));
    jest.setSystemTime(iso('2026-10-27T05:00:00Z'));
    await service.sendToUser('user-1', digest('pricing-digest-2026-10-26', { body: 'novo' }));
    await service.sendToUser('user-1', digest('outra-tag'));
    jest.setSystemTime(iso('2026-10-27T11:00:00Z'));

    const result = await service.drainDeferred();
    expect(result).toMatchObject({ due: 3, sent: 2, superseded: 1 });
    expect(wake).toHaveBeenCalledTimes(2);
    expect(deliveryRepo.rows[0]).toMatchObject({ failureReason: 'deferred_superseded' });
    expect(JSON.parse(deliveryRepo.rows[1].payloadJson).body).toBe('novo');
    expect(deliveryRepo.rows[1].pushedAt).toBeInstanceOf(Date);
  });

  it('descarta vencidos: evento que já começou e itens com mais de 24h', async () => {
    at('2026-10-27T02:00:00Z');
    const { service, deliveryRepo, wake } = setup();
    // Evento no dia 27/10 (00:00 BRT = 03:00Z): já começou às 08:00.
    await service.sendToUser('user-1', buildEventAlertPayload({ eventName: 'Show', startsOn: '2026-10-27', propertyId: 'p1' }));
    // Evento em 28/10: ainda vale.
    await service.sendToUser('user-1', buildEventAlertPayload({ eventName: 'Feira', startsOn: '2026-10-28', propertyId: 'p1' }));
    jest.setSystemTime(iso('2026-10-27T11:00:00Z'));
    expect(await service.drainDeferred()).toMatchObject({ due: 2, sent: 1, expired: 1 });
    expect(deliveryRepo.rows[0].failureReason).toBe('deferred_expired');
    expect(wake).toHaveBeenCalledTimes(1);

    // Mais de 24h (ex.: job ficou parado): vence mesmo sem expiresAt próprio.
    const old = setup();
    at('2026-10-27T02:00:00Z');
    await old.service.sendToUser('user-1', digest('velho'));
    jest.setSystemTime(iso('2026-10-28T12:00:00Z'));
    expect(await old.service.drainDeferred()).toMatchObject({ due: 1, sent: 0, expired: 1 });
  });

  it('preferência desligada depois do adiamento: não envia', async () => {
    at('2026-10-27T02:00:00Z');
    const { service, deliveryRepo, preferencesRepo, wake } = setup();
    await service.sendToUser('user-1', digest());
    preferencesRepo.findOne.mockResolvedValue({ userId: 'user-1', pushPricing: false });
    jest.setSystemTime(iso('2026-10-27T11:00:00Z'));
    expect(await service.drainDeferred()).toMatchObject({ due: 1, sent: 0, dropped: 1 });
    expect(wake).not.toHaveBeenCalled();
    expect(deliveryRepo.rows[0].failureReason).toBe('deferred_category_disabled');
  });

  it('teto diário contado no dia do envio: envios já feitos hoje bloqueiam o adiado', async () => {
    at('2026-10-27T02:00:00Z');
    process.env.PUSH_MAX_PER_DAY = '2';
    const { service, deliveryRepo, wake } = setup();
    await service.sendToUser('user-1', digest('a'));
    await service.sendToUser('user-1', digest('b'));
    await service.sendToUser('user-1', digest('c'));
    jest.setSystemTime(iso('2026-10-27T11:00:00Z'));
    const result = await service.drainDeferred();
    expect(result).toMatchObject({ due: 3, sent: 2, dropped: 1 });
    expect(wake).toHaveBeenCalledTimes(2);
    expect(deliveryRepo.rows[2].failureReason).toBe('deferred_rate_limited');
  });

  it('idempotência: duas execuções concorrentes enviam cada push uma única vez', async () => {
    at('2026-10-27T02:00:00Z');
    const { service, wake } = setup();
    await service.sendToUser('user-1', digest('a'));
    await service.sendToUser('user-1', digest('b'));
    jest.setSystemTime(iso('2026-10-27T11:00:00Z'));
    const [first, second] = await Promise.all([service.drainDeferred(), service.drainDeferred()]);
    expect(first.sent + second.sent).toBe(2);
    expect(wake).toHaveBeenCalledTimes(2);
    expect(first.skippedClaim + second.skippedClaim).toBe(2);
  });

  it('planDeferredDrain: sem tag nunca colapsa; dispositivos diferentes não se misturam', () => {
    const now = iso('2026-10-27T11:00:00Z');
    const mk = (id: string, subscriptionId: string, tag: string | null, hour: number) => ({
      id, subscriptionId, tag, createdAt: new Date(`2026-10-27T0${hour}:00:00Z`),
    });
    const plan = planDeferredDrain(
      [mk('1', 's1', 't', 1), mk('2', 's1', 't', 2), mk('3', 's2', 't', 3), mk('4', 's1', null, 4), mk('5', 's1', null, 5)],
      now,
    );
    expect(plan.send.map((r) => r.id)).toEqual(['2', '3', '4', '5']);
    expect(plan.superseded.map((r) => r.id)).toEqual(['1']);
    expect(plan.expired).toEqual([]);
  });

  it('cron: roda pelo ScheduledJobRunnerService (lock Redis) e devolve o resultado do drain', async () => {
    const drainResult = { due: 1, sent: 1, failed: 0, expired: 0, superseded: 0, dropped: 0, skippedClaim: 0 };
    const push = { drainDeferred: jest.fn().mockResolvedValue(drainResult) };
    const runner = { run: jest.fn(async (_name: string, handler: () => Promise<unknown>) => handler()) };
    const job = new PushDeferredDrainService(push as any, runner as any);
    await expect(job.drain()).resolves.toEqual(drainResult);
    expect(runner.run).toHaveBeenCalledWith('push-deferred-drain', expect.any(Function));
    expect(push.drainDeferred).toHaveBeenCalledTimes(1);
  });
});
