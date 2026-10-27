import { EventAlertPushService } from './event-alert-push.service';
import { PushEndpointSecurity } from './push-endpoint-security';
import { PushNotificationService } from './push-notification.service';

type Row = Record<string, any>;

const iso = (value: string) => new Date(value);

/** Tabela event_alert_dispatches em memória com a chave única (user_id, event_id). */
function makeDispatchRepo() {
  const rows: Row[] = [];
  let seq = 0;
  return {
    rows,
    create: (entity: Row) => ({ ...entity }),
    save: jest.fn(async (entity: Row) => {
      if (rows.some((r) => r.userId === entity.userId && r.eventId === entity.eventId)) {
        throw Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY', errno: 1062 });
      }
      const saved = { ...entity, id: `disp-${(seq += 1)}` };
      rows.push(saved);
      Object.assign(entity, saved);
      return entity;
    }),
    find: jest.fn(async (options: { where: Row }) => {
      const { userId, eventId, sentOn } = options.where;
      const users: string[] | undefined = userId?.value;
      const events: string[] | undefined = eventId?.value;
      return rows.filter(
        (r) => (!users || users.includes(r.userId)) && (!events || events.includes(r.eventId)) && (!sentOn || r.sentOn === sentOn),
      );
    }),
    delete: jest.fn(async (criteria: Row) => {
      const index = rows.findIndex((r) => r.userId === criteria.userId && r.eventId === criteria.eventId);
      if (index >= 0) rows.splice(index, 1);
      return { affected: index >= 0 ? 1 : 0 };
    }),
  };
}

function analysis(overrides: Row = {}) {
  const { evento: eventOverrides, ...rest } = overrides;
  return {
    id: `an-${Math.random()}`,
    distanciaSuaPropriedade: 1.2,
    usuarioProprietario: { id: 'host-1' },
    endereco: { id: 'prop-1', bairro: 'Pinheiros', list: { titulo: 'Studio Pinheiros' } },
    evento: {
      id: 'ev-1',
      nome: 'Festival Urban',
      relevancia: 85,
      dataInicio: iso('2026-10-30T22:00:00Z'),
      imagem_url: null,
      ...eventOverrides,
    },
    ...rest,
  };
}

describe('EventAlertPushService', () => {
  const NOW = '2026-10-27T15:00:00Z'; // 12:00 BRT (fora do silêncio)

  const setup = (opts: { analyses?: Row[]; entitled?: string[]; prefs?: Row[]; devices?: string[]; pushResult?: Row } = {}) => {
    const dispatchRepo = makeDispatchRepo();
    const analiseRepo = { find: jest.fn().mockResolvedValue(opts.analyses ?? [analysis()]) };
    const subscriptionRepo = {
      find: jest.fn(async () => (opts.devices ?? ['host-1']).map((userId) => ({ userId, active: true }))),
    };
    const preferencesRepo = { find: jest.fn().mockResolvedValue(opts.prefs ?? []) };
    const pushService = {
      sendToUser: jest.fn().mockResolvedValue(opts.pushResult ?? { enabled: true, attempted: 1, sent: 1, failed: 0 }),
    };
    const entitlement = {
      filterEntitledUserIds: jest.fn(async (ids: string[]) => new Set(opts.entitled ?? ids)),
    };
    const communicationLog = { record: jest.fn().mockResolvedValue(undefined) };
    const runner = { run: jest.fn(async (_name: string, handler: () => Promise<unknown>) => handler()) };
    const service = new EventAlertPushService(
      analiseRepo as any,
      dispatchRepo as any,
      subscriptionRepo as any,
      preferencesRepo as any,
      pushService as any,
      entitlement as any,
      communicationLog as any,
      runner as any,
    );
    return { service, dispatchRepo, analiseRepo, pushService, entitlement, communicationLog, preferencesRepo, runner };
  };

  // Os helpers `In(...)` do TypeORM expõem a lista em `value`; o repositório fake lê direto.
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout'] }).setSystemTime(iso(NOW));
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    delete process.env.PUSH_EVENT_ALERT_MIN_RELEVANCE;
    delete process.env.PUSH_EVENT_ALERT_ENABLED;
    delete process.env.WEB_PUSH_PUBLIC_KEY;
    delete process.env.WEB_PUSH_PRIVATE_KEY;
  });

  it('avisa o anfitrião com o payload do evento (expira no início) e registra a reserva', async () => {
    const { service, pushService, dispatchRepo } = setup();
    const summary = await service.processEventAlerts(iso(NOW));

    expect(summary).toMatchObject({ scanned: 1, candidates: 1, sent: 1, deferred: 0, failed: 0, released: 0 });
    expect(pushService.sendToUser).toHaveBeenCalledTimes(1);
    const [userId, payload] = pushService.sendToUser.mock.calls[0];
    expect(userId).toBe('host-1');
    expect(payload).toMatchObject({
      data: { type: 'event_alert', propertyId: 'prop-1', startsOn: '2026-10-30' },
      expiresAt: '2026-10-30T22:00:00.000Z',
    });
    expect(payload.title).toContain('Festival Urban em Pinheiros');
    expect(dispatchRepo.rows).toEqual([
      expect.objectContaining({ userId: 'host-1', eventId: 'ev-1', propertyId: 'prop-1', sentOn: '2026-10-27' }),
    ]);
  });

  it('idempotência: segunda execução (ou réplica concorrente) não reenvia o mesmo evento ao mesmo anfitrião', async () => {
    const { service, pushService } = setup();
    await service.processEventAlerts(iso(NOW));
    const again = await service.processEventAlerts(iso(NOW));
    expect(again.sent).toBe(0);
    expect(again.skipped.already_alerted).toBe(1);

    const { service: replicaA, pushService: pushA } = setup();
    const results = await Promise.all([replicaA.processEventAlerts(iso(NOW)), replicaA.processEventAlerts(iso(NOW))]);
    expect(results[0].sent + results[1].sent).toBe(1);
    expect(pushA.sendToUser).toHaveBeenCalledTimes(1);
    expect(pushService.sendToUser).toHaveBeenCalledTimes(1);
  });

  it('só avisa plano pago/trial: usuário sem direito de uso é descartado sem reservar nada', async () => {
    const { service, pushService, dispatchRepo } = setup({ entitled: [] });
    const summary = await service.processEventAlerts(iso(NOW));
    expect(summary.skipped.not_entitled).toBe(1);
    expect(summary.sent).toBe(0);
    expect(pushService.sendToUser).not.toHaveBeenCalled();
    expect(dispatchRepo.rows).toEqual([]);
  });

  it('preferência pushEvents desligada: não envia, não reserva e registra o motivo no log de comunicação', async () => {
    const { service, pushService, dispatchRepo, communicationLog } = setup({ prefs: [{ userId: 'host-1', pushEvents: false }] });
    const summary = await service.processEventAlerts(iso(NOW));
    expect(summary.skipped.push_events_disabled).toBe(1);
    expect(pushService.sendToUser).not.toHaveBeenCalled();
    expect(dispatchRepo.rows).toEqual([]);
    expect(communicationLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'host-1', channel: 'push', status: 'skipped', kind: 'event_alert', failureReason: 'event_alert_push_events_disabled' }),
    );
  });

  it('preferência ausente conta como ligada', async () => {
    const { service } = setup({ prefs: [] });
    expect((await service.processEventAlerts(iso(NOW))).sent).toBe(1);
  });

  it('sem dispositivo com push ativo: não envia nem reserva', async () => {
    const { service, pushService, dispatchRepo } = setup({ devices: [] });
    const summary = await service.processEventAlerts(iso(NOW));
    expect(summary.skipped.no_active_subscription).toBe(1);
    expect(pushService.sendToUser).not.toHaveBeenCalled();
    expect(dispatchRepo.rows).toEqual([]);
  });

  it('relevância abaixo do limite e janela de 14 dias (a consulta já filtra; a seleção reconfere)', async () => {
    process.env.PUSH_EVENT_ALERT_MIN_RELEVANCE = '90';
    const { service, pushService } = setup({
      analyses: [
        analysis({ evento: { id: 'ev-low', relevancia: 85 } }),
        analysis({ evento: { id: 'ev-far', relevancia: 95, dataInicio: iso('2026-11-20T22:00:00Z') } }),
        analysis({ evento: { id: 'ev-ok', relevancia: 95 }, endereco: { id: 'prop-2', bairro: 'Moema', list: { titulo: 'Moema' } } }),
      ],
    });
    const summary = await service.processEventAlerts(iso(NOW));
    expect(summary).toMatchObject({ sent: 1, skipped: { low_relevance: 1, outside_window: 1 } });
    expect(pushService.sendToUser).toHaveBeenCalledTimes(1);
  });

  it('limites: 1 por imóvel/dia e 3 por anfitrião/dia, contando o que já saiu hoje; registra o motivo no log', async () => {
    const analyses = ['a', 'b', 'c', 'd', 'e'].map((id, i) =>
      analysis({
        evento: { id: `ev-${id}`, relevancia: 95 - i },
        endereco: { id: `prop-${id}`, bairro: 'Centro', list: { titulo: id } },
      }),
    );
    const { service, pushService, dispatchRepo, communicationLog } = setup({ analyses });
    dispatchRepo.rows.push({ id: 'old', userId: 'host-1', eventId: 'ev-ontem', propertyId: 'prop-z', sentOn: '2026-10-27' });
    const summary = await service.processEventAlerts(iso(NOW));
    expect(summary.sent).toBe(2); // 1 já enviado hoje + 2 = teto de 3
    expect(summary.skipped.host_daily_limit).toBe(3);
    expect(pushService.sendToUser).toHaveBeenCalledTimes(2);
    expect(communicationLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'host-1', kind: 'event_alert', failureReason: 'event_alert_host_daily_limit', metadata: { events: 3 } }),
    );

    // Outro dia: os limites reiniciam e os que ficaram de fora saem.
    pushService.sendToUser.mockClear();
    const tomorrow = await service.processEventAlerts(iso('2026-10-28T15:00:00Z'));
    expect(tomorrow.sent).toBe(3);
  });

  it('limite por imóvel: dois eventos no mesmo imóvel no mesmo dia, só o mais relevante', async () => {
    const { service, pushService, communicationLog } = setup({
      analyses: [
        analysis({ evento: { id: 'ev-1', relevancia: 70 } }),
        analysis({ evento: { id: 'ev-2', relevancia: 92 } }),
      ],
    });
    const summary = await service.processEventAlerts(iso(NOW));
    expect(summary).toMatchObject({ sent: 1, skipped: { property_daily_limit: 1 } });
    expect(pushService.sendToUser.mock.calls[0][1].title).toContain('Festival Urban');
    expect(communicationLog.record).toHaveBeenCalledWith(expect.objectContaining({ failureReason: 'event_alert_property_daily_limit' }));
  });

  it('push que não saiu (teto global, falha) devolve a reserva e tenta de novo no próximo tick', async () => {
    const { service, pushService, dispatchRepo } = setup({
      pushResult: { enabled: true, attempted: 0, sent: 0, failed: 0, skippedReason: 'rate_limited' },
    });
    expect((await service.processEventAlerts(iso(NOW))).released).toBe(1);
    expect(dispatchRepo.rows).toEqual([]);

    pushService.sendToUser.mockResolvedValue({ enabled: true, attempted: 1, sent: 1, failed: 0 });
    expect((await service.processEventAlerts(iso(NOW))).sent).toBe(1);
    expect(dispatchRepo.rows).toHaveLength(1);
  });

  it('exceção no envio: devolve a reserva e conta como falha sem derrubar o job', async () => {
    const { service, pushService, dispatchRepo } = setup();
    pushService.sendToUser.mockRejectedValue(new Error('boom'));
    const summary = await service.processEventAlerts(iso(NOW));
    expect(summary.failed).toBe(1);
    expect(dispatchRepo.rows).toEqual([]);
  });

  it('adiado pelo silêncio conta como entregue: a reserva fica', async () => {
    const { service, dispatchRepo } = setup({
      pushResult: { enabled: true, attempted: 0, sent: 0, failed: 0, skippedReason: 'quiet_hours', deferred: 1 },
    });
    const summary = await service.processEventAlerts(iso('2026-10-28T01:00:00Z'));
    expect(summary.deferred).toBe(1);
    expect(dispatchRepo.rows).toHaveLength(1);
  });

  it('tick: roda pelo runner (lock Redis) e respeita PUSH_EVENT_ALERT_ENABLED=false', async () => {
    const { service, runner, analiseRepo } = setup();
    await service.tick();
    expect(runner.run).toHaveBeenCalledWith('push-event-alert', expect.any(Function));
    expect(analiseRepo.find).toHaveBeenCalledTimes(1);

    process.env.PUSH_EVENT_ALERT_ENABLED = 'false';
    await expect(service.tick()).resolves.toBeUndefined();
    expect(runner.run).toHaveBeenCalledTimes(1);
  });

  it('consulta apenas eventos canônicos, ativos, geocodificados, no escopo, na janela e com relevância mínima', async () => {
    const { service, analiseRepo } = setup({ analyses: [] });
    await service.processEventAlerts(iso(NOW));
    const where = analiseRepo.find.mock.calls[0][0].where as Row[];
    expect(where).toHaveLength(2); // análise nova OU evento atualizado/enriquecido
    for (const clause of where) {
      expect(clause.evento).toMatchObject({ ativo: true, pendingGeocode: false, outOfScope: false, dedupStatus: 'canonical' });
      expect(clause.endereco).toEqual({ ativo: true });
      expect(clause.usuarioProprietario).toEqual({ ativo: true });
    }
    expect(where[0].criadoEm).toBeDefined();
    expect(where[1].evento.updatedAt).toBeDefined();
  });

  describe('com o PushNotificationService real (silêncio 22h-8h)', () => {
    function realPushService() {
      process.env.WEB_PUSH_PUBLIC_KEY = 'public-key';
      process.env.WEB_PUSH_PRIVATE_KEY = 'private-key';
      const deliveries: Row[] = [];
      const deliveryRepo = {
        create: (entity: Row) => ({ deliveredAt: null, failedAt: null, pushedAt: null, deliverAfter: null, expiresAt: null, tag: null, ...entity }),
        save: jest.fn(async (entity: Row) => {
          if (!entity.id) {
            entity.id = `del-${deliveries.length + 1}`;
            entity.createdAt = new Date();
            deliveries.push(entity);
          }
          return entity;
        }),
        count: jest.fn().mockResolvedValue(0),
      };
      const subscription = { id: 'sub-1', userId: 'host-1', deviceId: 'dev-1', active: true, endpoint: 'https://push.example.test/d' };
      const communicationLog = { record: jest.fn().mockResolvedValue(undefined) };
      const push = new PushNotificationService(
        { find: jest.fn().mockResolvedValue([subscription]), findOne: jest.fn(), save: jest.fn(async (s: Row) => s) } as any,
        deliveryRepo as any,
        { findOne: jest.fn() } as any,
        communicationLog as any,
        { assertSafe: jest.fn(async (e: string) => new URL(e)) } as unknown as PushEndpointSecurity,
        { findOne: jest.fn().mockResolvedValue(null) } as any,
      );
      const wake = jest.spyOn(push as any, 'sendWakePush').mockResolvedValue(undefined);
      return { push, deliveries, wake };
    }

    const build = (push: PushNotificationService) => {
      const base = setup();
      return new EventAlertPushService(
        base.analiseRepo as any,
        base.dispatchRepo as any,
        { find: jest.fn().mockResolvedValue([{ userId: 'host-1', active: true }]) } as any,
        base.preferencesRepo as any,
        push,
        base.entitlement as any,
        base.communicationLog as any,
      );
    };

    it('às 23:00 BRT: adia para 08:00 BRT e o aviso expira no início do evento', async () => {
      jest.setSystemTime(iso('2026-10-28T02:00:00Z')); // 23:00 BRT de 27/10
      const { push, deliveries, wake } = realPushService();
      const summary = await build(push).processEventAlerts(new Date());
      expect(summary).toMatchObject({ sent: 0, deferred: 1 });
      expect(wake).not.toHaveBeenCalled();
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0].deliverAfter.toISOString()).toBe('2026-10-28T11:00:00.000Z');
      // dataInicio do evento (22:00Z de 30/10) é anterior ao teto de 24h do adiado? Não: 24h vence antes.
      expect(deliveries[0].expiresAt.getTime()).toBe(Math.min(Date.now() + 24 * 3600 * 1000, iso('2026-10-30T22:00:00Z').getTime()));
      expect(deliveries[0].tag).toMatch(/^event-prop-1-2026-10-30-festival-urban$/);
    });

    it('evento que começa antes do fim do silêncio + 24h: expira exatamente no dataInicio', async () => {
      jest.setSystemTime(iso('2026-10-28T02:00:00Z')); // 23:00 BRT
      const { push, deliveries } = realPushService();
      const service = build(push);
      (service as any).analiseRepo.find.mockResolvedValue([
        analysis({ evento: { id: 'ev-hoje', dataInicio: iso('2026-10-28T09:00:00Z') } }), // 06:00 BRT, antes das 08:00
      ]);
      const summary = await service.processEventAlerts(new Date());
      expect(summary.deferred).toBe(1);
      expect(deliveries[0].expiresAt.toISOString()).toBe('2026-10-28T09:00:00.000Z');
      // às 08:00 BRT o evento já começou: planDeferredDrain descarta (ver push-deferred.spec).
      expect(deliveries[0].expiresAt.getTime()).toBeLessThan(deliveries[0].deliverAfter.getTime());
    });
  });
});
