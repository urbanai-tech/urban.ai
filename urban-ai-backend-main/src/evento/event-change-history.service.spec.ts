import { EventChangeHistory } from '../entities/event-change-history.entity';
import { Event } from '../entities/events.entity';
import { EventIdentityService } from './event-identity.service';
import {
  EventChangeHistoryService,
  buildChangeSeries,
  summarizeChangeCounts,
} from './event-change-history.service';

jest.mock('../mailer/mailer.service', () => ({ MailerService: class MailerService {} }));

const NOW = new Date('2026-10-31T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
const daysAhead = (d: number) => new Date(NOW.getTime() + d * 86_400_000);

/** Repositório de histórico em memória, suficiente para os caminhos testados. */
function makeHistoryRepo() {
  const rows: Array<Partial<EventChangeHistory>> = [];
  const matches = (row: any, where: any) =>
    Object.entries(where).every(([key, expected]: [string, any]) => {
      if (expected && Array.isArray(expected.value)) return expected.value.includes(row[key]);
      return row[key] === expected;
    });
  return {
    rows,
    create: jest.fn((v: any) => ({ ...v })),
    save: jest.fn(async (v: any) => {
      rows.push(v);
      return v;
    }),
    findOne: jest.fn(async ({ where, order }: any) => {
      const found = rows.filter((r) => matches(r, where));
      if (order?.detectedAt === 'DESC') found.sort((a, b) => +(b.detectedAt as Date) - +(a.detectedAt as Date));
      return found[0] ?? null;
    }),
  };
}

function makeService(historyRepo = makeHistoryRepo(), eventRepo: any = {}) {
  const service = new EventChangeHistoryService(historyRepo as any, eventRepo, new EventIdentityService());
  return { service, historyRepo };
}

const baseEvent = (over: Partial<Event> = {}): Event =>
  ({
    id: 'evt-1',
    nome: 'Show X',
    source: 'sympla-api',
    dataInicio: new Date('2026-11-20T22:00:00Z'),
    dataFim: new Date('2026-11-21T01:00:00Z'),
    enderecoCompleto: 'Allianz Parque, Av. Francisco Matarazzo, 1705',
    linkSiteOficial: 'https://sympla.com.br/evento/show-x',
    crawledUrl: null,
    lastSeenAt: daysAgo(1),
    dataCrawl: daysAgo(1),
    ...over,
  }) as Event;

const input = (over: Record<string, unknown> = {}) => ({
  source: 'sympla-api',
  dataInicio: new Date('2026-11-20T22:00:00Z'),
  enderecoCompleto: 'Allianz Parque, Av. Francisco Matarazzo, 1705',
  linkSiteOficial: 'https://sympla.com.br/evento/show-x',
  ...over,
});

describe('EventChangeHistoryService.recordFirstSeen', () => {
  const original = process.env;
  beforeEach(() => {
    process.env = { ...original };
  });
  afterAll(() => {
    process.env = original;
  });

  it('grava uma linha first_seen com a fonte do evento', async () => {
    const { service, historyRepo } = makeService();
    await service.recordFirstSeen({ id: 'evt-1', source: 'sympla-api' }, NOW);
    expect(historyRepo.rows).toHaveLength(1);
    expect(historyRepo.rows[0]).toMatchObject({
      eventId: 'evt-1',
      changeType: 'first_seen',
      source: 'sympla-api',
      detectedAt: NOW,
    });
  });

  it('desligado por env não grava; falha do banco não propaga', async () => {
    process.env.EVENT_HISTORY_ENABLED = 'false';
    const { service, historyRepo } = makeService();
    await service.recordFirstSeen({ id: 'evt-1', source: 'x' });
    expect(historyRepo.rows).toHaveLength(0);

    process.env.EVENT_HISTORY_ENABLED = 'true';
    historyRepo.save.mockRejectedValueOnce(new Error('db down'));
    await expect(service.recordFirstSeen({ id: 'evt-1', source: 'x' })).resolves.toBeUndefined();
  });
});

describe('EventChangeHistoryService.observe', () => {
  const original = process.env;
  beforeEach(() => {
    process.env = { ...original };
    delete process.env.EVENT_HISTORY_ENABLED;
    delete process.env.EVENT_HISTORY_APPLY_RESCHEDULE;
  });
  afterAll(() => {
    process.env = original;
  });

  it('reenvio idêntico não registra nada', async () => {
    const { service, historyRepo } = makeService();
    const result = await service.observe(baseEvent(), input(), { matchReason: 'source_identity_exact' }, NOW);
    expect(result.changes).toEqual([]);
    expect(historyRepo.rows).toHaveLength(0);
  });

  it('remarcação: registra no histórico sem aplicar a data por padrão (e sem duplicar o evento)', async () => {
    const { service, historyRepo } = makeService();
    const result = await service.observe(
      baseEvent(),
      input({ dataInicio: new Date('2026-12-05T22:00:00Z') }),
      { matchReason: 'source_identity_exact' },
      NOW,
    );
    expect(result.changes.map((c) => c.type)).toEqual(['rescheduled']);
    expect(result.patch).toEqual({});
    expect(historyRepo.rows[0]).toMatchObject({
      eventId: 'evt-1',
      changeType: 'rescheduled',
      oldValue: '2026-11-20T22:00:00.000Z',
      newValue: '2026-12-05T22:00:00.000Z',
      source: 'sympla-api',
    });
  });

  it('com EVENT_HISTORY_APPLY_RESCHEDULE=true devolve o patch da nova data', async () => {
    process.env.EVENT_HISTORY_APPLY_RESCHEDULE = 'true';
    const { service } = makeService();
    const result = await service.observe(
      baseEvent(),
      input({ dataInicio: new Date('2026-12-05T22:00:00Z'), dataFim: new Date('2026-12-06T01:00:00Z') }),
      { matchReason: 'source_identity_exact' },
      NOW,
    );
    expect(result.patch.dataInicio).toEqual(new Date('2026-12-05T22:00:00Z'));
    expect(result.patch.dataFim).toEqual(new Date('2026-12-06T01:00:00Z'));
  });

  it('a mesma divergência reenviada a cada ciclo é registrada uma vez só', async () => {
    const { service, historyRepo } = makeService();
    const moved = input({ dataInicio: new Date('2026-12-05T22:00:00Z') });
    await service.observe(baseEvent(), moved, { matchReason: 'source_identity_exact' }, NOW);
    const second = await service.observe(baseEvent(), moved, { matchReason: 'source_identity_exact' }, NOW);
    expect(second.changes).toEqual([]);
    expect(historyRepo.rows.filter((r) => r.changeType === 'rescheduled')).toHaveLength(1);
  });

  it('cancelamento declarado pela fonte é registrado', async () => {
    const { service, historyRepo } = makeService();
    const result = await service.observe(baseEvent(), input({ status: 'Cancelado' }), { matchReason: 'canonical_url_exact' }, NOW);
    expect(result.changes.map((c) => c.type)).toEqual(['cancelled']);
    expect(historyRepo.rows[0]).toMatchObject({ changeType: 'cancelled', field: 'status', newValue: 'cancelled' });
  });

  it('fonte diferente (casamento fuzzy) com horário e endereço diferentes não gera mudança', async () => {
    const { service, historyRepo } = makeService();
    const result = await service.observe(
      baseEvent(),
      input({
        source: 'eventbrite-api',
        dataInicio: new Date('2026-11-20T23:30:00Z'),
        enderecoCompleto: 'Estádio Palestra Itália',
        linkSiteOficial: 'https://eventbrite.com/e/123',
      }),
      { matchReason: 'fuzzy' },
      NOW,
    );
    expect(result.changes).toEqual([]);
    expect(historyRepo.rows).toHaveLength(0);
  });

  it('troca de URL e de venue da mesma fonte', async () => {
    const { service } = makeService();
    const result = await service.observe(
      baseEvent(),
      input({ enderecoCompleto: 'Neo Química Arena, Av. Miguel Ignácio Curi, 111', linkSiteOficial: 'https://sympla.com.br/evento/show-x-novo' }),
      { matchReason: 'source_identity_exact' },
      NOW,
    );
    expect(result.changes.map((c) => c.type).sort()).toEqual(['url_changed', 'venue_changed']);
  });

  it('evento marcado como possivelmente cancelado que volta a aparecer vira "reappeared"', async () => {
    const { service, historyRepo } = makeService();
    historyRepo.rows.push({ eventId: 'evt-1', changeType: 'possibly_cancelled', detectedAt: daysAgo(2) });
    const result = await service.observe(
      baseEvent({ lastSeenAt: daysAgo(12) }),
      input(),
      { matchReason: 'source_identity_exact' },
      NOW,
    );
    expect(result.changes.map((c) => c.type)).toEqual(['reappeared']);
    // depois de reaparecer, um novo reenvio não repete
    historyRepo.rows[historyRepo.rows.length - 1].detectedAt = NOW;
    const again = await service.observe(
      baseEvent({ lastSeenAt: daysAgo(12) }),
      input(),
      { matchReason: 'source_identity_exact' },
      new Date(NOW.getTime() + 60_000),
    );
    expect(again.changes).toEqual([]);
  });

  it('visto recentemente nunca consulta nem gera reappeared', async () => {
    const { service, historyRepo } = makeService();
    historyRepo.rows.push({ eventId: 'evt-1', changeType: 'possibly_cancelled', detectedAt: daysAgo(2) });
    const result = await service.observe(baseEvent({ lastSeenAt: daysAgo(1) }), input(), { matchReason: 'source_identity_exact' }, NOW);
    expect(result.changes).toEqual([]);
  });

  it('desligado ou com erro do banco devolve vazio (ingestão nunca quebra)', async () => {
    process.env.EVENT_HISTORY_ENABLED = 'false';
    const off = makeService();
    expect((await off.service.observe(baseEvent(), input({ status: 'cancelado' }), { matchReason: 'x' }, NOW)).changes).toEqual([]);

    process.env.EVENT_HISTORY_ENABLED = 'true';
    const broken = makeService();
    broken.historyRepo.findOne.mockRejectedValue(new Error('db down'));
    const result = await broken.service.observe(baseEvent(), input({ status: 'cancelado' }), { matchReason: 'x' }, NOW);
    expect(result).toEqual({ changes: [], patch: {} });
  });
});

describe('EventChangeHistoryService.flagOnce (sumiço da fonte)', () => {
  const qb = (rows: unknown[]) => {
    const builder: any = {};
    for (const m of ['select', 'addSelect', 'where', 'andWhere', 'orderBy', 'limit', 'groupBy']) {
      builder[m] = jest.fn().mockReturnValue(builder);
    }
    builder.getRawMany = jest.fn().mockResolvedValue(rows);
    return builder;
  };

  it('marca evento futuro sumido numa fonte ativa e nunca apaga o evento', async () => {
    const candidates = [
      { id: 'e1', source: 'sympla-api', dataInicio: daysAhead(15), lastSeenAt: daysAgo(10) },
      { id: 'e2', source: 'admin-manual', dataInicio: daysAhead(15), lastSeenAt: daysAgo(10) }, // curadoria: ignorado
      { id: 'e3', source: 'allianz-parque', dataInicio: daysAhead(15), lastSeenAt: daysAgo(10) }, // fonte inteira parada
    ];
    const sourceRows = [
      { source: 'sympla-api', lastSeenAt: daysAgo(0.2) },
      { source: 'admin-manual', lastSeenAt: daysAgo(0.2) },
      { source: 'allianz-parque', lastSeenAt: daysAgo(10) },
    ];
    const queue = [qb(candidates), qb(sourceRows)];
    const eventRepo: any = { createQueryBuilder: jest.fn(() => queue.shift()), delete: jest.fn(), remove: jest.fn() };
    const { service, historyRepo } = makeService(makeHistoryRepo(), eventRepo);

    const result = await service.flagOnce(NOW);

    expect(result).toEqual({ checked: 3, flagged: 1 });
    expect(historyRepo.rows).toHaveLength(1);
    expect(historyRepo.rows[0]).toMatchObject({
      eventId: 'e1',
      changeType: 'possibly_cancelled',
      source: 'sympla-api',
      detectedAt: NOW,
    });
    expect(eventRepo.delete).not.toHaveBeenCalled();
    expect(eventRepo.remove).not.toHaveBeenCalled();
  });

  it('sem candidatos não consulta as fontes; erro do banco não propaga', async () => {
    const eventRepo: any = { createQueryBuilder: jest.fn(() => qb([])) };
    const { service } = makeService(makeHistoryRepo(), eventRepo);
    expect(await service.flagOnce(NOW)).toEqual({ checked: 0, flagged: 0 });
    expect(eventRepo.createQueryBuilder).toHaveBeenCalledTimes(1);

    const broken: any = {
      createQueryBuilder: jest.fn(() => {
        throw new Error('db down');
      }),
    };
    expect(await makeService(makeHistoryRepo(), broken).service.flagOnce(NOW)).toEqual({ checked: 0, flagged: 0 });
  });
});

describe('agregações do histórico (lógica pura)', () => {
  it('summarizeChangeCounts soma por tipo e zera o que não veio', () => {
    expect(
      summarizeChangeCounts(30, [
        { type: 'first_seen', count: 40 },
        { type: 'rescheduled', count: 3 },
        { type: 'cancelled', count: 1 },
        { type: 'possibly_cancelled', count: 2 },
      ]),
    ).toEqual({
      windowDays: 30,
      firstSeen: 40,
      rescheduled: 3,
      venueChanged: 0,
      urlChanged: 0,
      cancelled: 1,
      postponed: 0,
      possiblyCancelled: 2,
      reappeared: 0,
    });
  });

  it('buildChangeSeries é contínua (dias vazios valem 0) e junta adiado em remarcado', () => {
    const days = ['2026-10-29', '2026-10-30', '2026-10-31'];
    const series = buildChangeSeries(days, [
      { day: '2026-10-29', type: 'first_seen', count: 5 },
      { day: '2026-10-31', type: 'rescheduled', count: 1 },
      { day: '2026-10-31', type: 'postponed', count: 2 },
      { day: '2026-10-31', type: 'cancelled', count: 1 },
      { day: '2026-10-31', type: 'possibly_cancelled', count: 4 },
      { day: '2026-09-01', type: 'cancelled', count: 9 }, // fora da janela
    ]);
    expect(series).toEqual([
      { date: '2026-10-29', firstSeen: 5, rescheduled: 0, cancelled: 0, possiblyCancelled: 0 },
      { date: '2026-10-30', firstSeen: 0, rescheduled: 0, cancelled: 0, possiblyCancelled: 0 },
      { date: '2026-10-31', firstSeen: 0, rescheduled: 3, cancelled: 1, possiblyCancelled: 4 },
    ]);
  });
});
