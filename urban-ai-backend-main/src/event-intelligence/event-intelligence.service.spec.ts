import { EventPricingIntelligenceService } from '../knn-engine/event-pricing-intelligence.service';
import { PricingCalculateService } from '../propriedades/pricing-calculate.service';
import { EventIntelligenceService } from './event-intelligence.service';

function makeQueryBuilder(result: any) {
  return {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(Array.isArray(result) ? result : []),
    getOne: jest.fn().mockResolvedValue(Array.isArray(result) ? result[0] ?? null : result ?? null),
    getRawMany: jest.fn().mockResolvedValue(Array.isArray(result) ? result : []),
  };
}

function makeService(input: {
  events?: any[];
  event?: any;
  snapshots?: any[];
  impacts?: any[];
  analyses?: any[];
  pricingDecisionSnapshots?: any[];
}) {
  let snapshotId = 0;
  let impactId = 0;
  let pricingDecisionSnapshotId = 0;
  const snapshots = [...(input.snapshots ?? [])];
  const impacts = [...(input.impacts ?? [])];
  const pricingDecisionSnapshots = [...(input.pricingDecisionSnapshots ?? [])];
  const eventRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder(input.events ?? [])),
    findOne: jest.fn().mockResolvedValue(input.event ?? input.events?.[0] ?? null),
    find: jest.fn().mockResolvedValue(input.events ?? []),
  };
  const snapshotRepo = {
    createQueryBuilder: jest.fn(() => makeQueryBuilder(snapshots)),
    findOne: jest.fn(async (options?: any) => {
      const eventId = options?.where?.event?.id;
      const jobRunId = options?.where?.jobRunId;
      return (
        snapshots.find(
          (snapshot) =>
            (!eventId || snapshot.event?.id === eventId) && (!jobRunId || snapshot.jobRunId === jobRunId),
        ) ?? null
      );
    }),
    create: jest.fn((entity) => entity),
    save: jest.fn(async (entity) => {
      const saved = { id: entity.id ?? `snapshot-${++snapshotId}`, ...entity };
      snapshots.push(saved);
      return saved;
    }),
  };
  const impactRepo = {
    createQueryBuilder: jest.fn(() => makeQueryBuilder(impacts)),
    findOne: jest.fn(async (options?: any) => {
      const eventId = options?.where?.event?.id;
      const propertyId = options?.where?.property?.id;
      const analysisId = options?.where?.analisePreco?.id;
      const jobRunId = options?.where?.jobRunId;
      return (
        impacts.find(
          (impact) =>
            (!eventId || impact.event?.id === eventId) &&
            (!propertyId || impact.property?.id === propertyId) &&
            (!analysisId || impact.analisePreco?.id === analysisId) &&
            (!jobRunId || impact.jobRunId === jobRunId),
        ) ?? null
      );
    }),
    create: jest.fn((entity) => entity),
    save: jest.fn(async (entity) => {
      const saved = { id: entity.id ?? `impact-${++impactId}`, ...entity };
      impacts.push(saved);
      return saved;
    }),
  };
  const pricingDecisionSnapshotRepo = {
    find: jest.fn(async () => pricingDecisionSnapshots),
    create: jest.fn((entity) => entity),
    save: jest.fn(async (entity) => {
      const saved = {
        id: entity.id ?? `pricing-decision-${++pricingDecisionSnapshotId}`,
        ...entity,
      };
      const existingIndex = pricingDecisionSnapshots.findIndex((snapshot) => snapshot.id === saved.id);
      if (existingIndex >= 0) {
        pricingDecisionSnapshots[existingIndex] = saved;
      } else {
        pricingDecisionSnapshots.push(saved);
      }
      return saved;
    }),
  };
  const addressRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder([])),
  };
  const analiseRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(makeQueryBuilder(input.analyses ?? [])),
  };

  const service = new EventIntelligenceService(
    eventRepo as any,
    snapshotRepo as any,
    impactRepo as any,
    pricingDecisionSnapshotRepo as any,
    addressRepo as any,
    analiseRepo as any,
    new EventPricingIntelligenceService(),
    new PricingCalculateService(),
  );

  return {
    service,
    repos: { eventRepo, snapshotRepo, impactRepo, pricingDecisionSnapshotRepo, addressRepo, analiseRepo },
  };
}

describe('EventIntelligenceService contracts', () => {
  const event = {
    id: 'event-1',
    nome: 'Festival Centro',
    descricao: 'Festival de musica',
    dataInicio: new Date('2026-06-10T20:00:00.000Z'),
    dataFim: new Date('2026-06-10T23:00:00.000Z'),
    cidade: 'Sao Paulo',
    estado: 'SP',
    enderecoCompleto: 'Av Paulista, 1000',
    latitude: -23.56,
    longitude: -46.65,
    categoria: 'show',
    imagem_url: 'https://example.com/event.jpg',
    linkSiteOficial: 'https://example.com/event',
    source: 'admin-manual',
    crawledUrl: null,
    relevancia: 82,
    raioImpactoKm: 8,
    expectedAttendance: 12000,
    capacidadeEstimada: null,
    venueCapacity: null,
    pendingGeocode: false,
    outOfScope: false,
    enrichmentAttempts: 1,
    dataCrawl: new Date('2026-05-22T10:00:00.000Z'),
  };

  it('returns catalog items with the shared v0 shape and explicit derived status', async () => {
    const { service } = makeService({ events: [event], snapshots: [] });

    const result = await service.hostCatalog('user-1', { city: 'Sao Paulo' });

    expect(result.contractVersion).toBe('event-radar-v0');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'event-1',
      name: 'Festival Centro',
      startsAt: '2026-06-10T20:00:00.000Z',
      city: 'Sao Paulo',
      state: 'SP',
      urbanScore: 82,
      confidence: 'high',
      officialUrl: 'https://example.com/event',
    });
    expect(result.items[0].demandScore).toEqual(expect.any(Number));
    expect(result.items[0].demandScore).toBeGreaterThanOrEqual(70);
    expect(result.items[0].badges).toEqual(
      expect.arrayContaining(['alto impacto', 'demanda aquecida', 'fonte oficial']),
    );
    expect(result.meta.dataStatus).toBe('derived_from_event_fields');
  });

  it('derives property impact from AnalisePreco and computes Nico absorption fields', async () => {
    const analysis = {
      id: 'analysis-1',
      evento: event,
      endereco: {
        id: 'property-1',
        list: { id: 'list-1', titulo: 'Studio Paulista' },
      },
      status: 'suggested',
      distanciaSuaPropriedade: 2.5,
      seuPrecoAtual: 300,
      precoSugerido: 600,
      criadoEm: new Date('2026-05-22T11:00:00.000Z'),
    };
    const { service } = makeService({ event, impacts: [], analyses: [analysis] });

    const result = await service.adminEventPropertyImpact('event-1');

    expect(result.meta).toMatchObject({
      count: 1,
      dataStatus: 'derived_from_analise_preco',
    });
    expect(result.items[0]).toMatchObject({
      propertyId: 'property-1',
      propertyName: 'Studio Paulista',
      currentPriceCents: 30000,
      minAbsorbablePriceCents: expect.any(Number),
      bookingProbability: expect.any(Number),
      expectedRevenueCents: expect.any(Number),
      dataStatus: 'derived_from_analise_preco',
    });
    expect(result.items[0].recommendedPriceCents).toBeGreaterThanOrEqual(30000);
    expect(result.items[0].recommendedMultiplier).toBeGreaterThan(1);
    expect(result.items[0].priceAbsorptionScenarios).toHaveLength(4);
    expect(result.stubs).toEqual([]);
  });

  it('persists event intelligence snapshot and property impacts on single recompute', async () => {
    const analysis = {
      id: 'analysis-1',
      evento: event,
      endereco: {
        id: 'property-1',
        list: { id: 'list-1', titulo: 'Studio Paulista' },
      },
      usuarioProprietario: { id: 'user-1' },
      status: 'suggested',
      distanciaSuaPropriedade: 2.5,
      seuPrecoAtual: 300,
      precoSugerido: 600,
      criadoEm: new Date('2026-05-22T11:00:00.000Z'),
    };
    const { service, repos } = makeService({ event, impacts: [], analyses: [analysis] });

    const result = await service.recomputeEventIntelligence('event-1', 'admin-1');

    expect(repos.snapshotRepo.save).toHaveBeenCalledTimes(1);
    expect(repos.impactRepo.save).toHaveBeenCalledTimes(1);
    expect(repos.pricingDecisionSnapshotRepo.save).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: 'ok',
      triggeredByUserId: 'admin-1',
      summary: {
        eventsProcessed: 1,
        analysesRead: 1,
        skippedAnalyses: 0,
      },
      writes: {
        eventIntelligenceSnapshot: true,
        eventIntelligenceSnapshotsCount: 1,
        eventPropertyImpact: true,
        eventPropertyImpactsCount: 1,
        pricingDecisionSnapshot: true,
        pricingDecisionSnapshotsCount: 1,
      },
    });
    expect(result.snapshots[0].eventDemandScore).toEqual(expect.any(Number));
    expect(result.propertyImpacts[0]).toMatchObject({
      propertyId: 'property-1',
      recommendedPriceCents: expect.any(Number),
      bookingProbability: expect.any(Number),
    });
    expect(result.pricingDecisionSnapshots[0]).toMatchObject({
      eventId: 'event-1',
      propertyId: 'property-1',
      analisePrecoId: 'analysis-1',
      selectedPriceCents: expect.any(Number),
      bookingProbability: expect.any(Number),
      status: 'suggested',
    });
    expect(repos.pricingDecisionSnapshotRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        event: event,
        eventIntelligenceSnapshot: expect.objectContaining({ id: 'snapshot-1' }),
        eventPropertyImpact: expect.objectContaining({ id: 'impact-1' }),
        analisePreco: analysis,
        jobRunId: expect.stringContaining('event-intelligence-event-'),
        inputSignals: expect.objectContaining({
          relationIds: expect.objectContaining({
            eventId: 'event-1',
            propertyId: 'property-1',
            eventIntelligenceSnapshotId: 'snapshot-1',
            eventPropertyImpactId: 'impact-1',
            analisePrecoId: 'analysis-1',
          }),
          pricing: expect.objectContaining({
            eventDemandScore: expect.any(Number),
            propertyCaptureScore: expect.any(Number),
          }),
          selectedScenario: expect.objectContaining({
            scenario: 'recommended',
          }),
          idempotencyVersion: 'pricing-decision-v0',
          idempotencyKey: expect.stringContaining(
            'pricing-decision-v0:event-1:property-1:list-1:analysis-1:2026-06-10:event_pricing:recommended:',
          ),
          signalsHash: expect.stringMatching(/^[a-f0-9]{32}$/),
        }),
      }),
    );
  });

  it('reuses pricing decision snapshot on retry when business signals are identical', async () => {
    const analysis = {
      id: 'analysis-1',
      evento: event,
      endereco: {
        id: 'property-1',
        list: { id: 'list-1', titulo: 'Studio Paulista' },
      },
      usuarioProprietario: { id: 'user-1' },
      status: 'suggested',
      distanciaSuaPropriedade: 2.5,
      seuPrecoAtual: 300,
      precoSugerido: 600,
      criadoEm: new Date('2026-05-22T11:00:00.000Z'),
    };
    const { service, repos } = makeService({ event, impacts: [], analyses: [analysis] });

    const first = await service.recomputeEventIntelligence('event-1', 'admin-1');
    const second = await service.recomputeEventIntelligence('event-1', 'admin-1');

    expect(repos.pricingDecisionSnapshotRepo.find).toHaveBeenCalledTimes(2);
    expect(repos.pricingDecisionSnapshotRepo.save).toHaveBeenCalledTimes(1);
    expect(second.pricingDecisionSnapshots[0]).toMatchObject({
      id: first.pricingDecisionSnapshots[0].id,
      eventId: 'event-1',
      propertyId: 'property-1',
      analisePrecoId: 'analysis-1',
      status: 'suggested',
    });
    expect(second.writes.pricingDecisionSnapshotsCount).toBe(1);
  });

  it('reuses the event snapshot when an internal retry resumes the same jobRunId', async () => {
    const analysis = {
      id: 'analysis-1',
      evento: event,
      endereco: {
        id: 'property-1',
        list: { id: 'list-1', titulo: 'Studio Paulista' },
      },
      usuarioProprietario: { id: 'user-1' },
      status: 'suggested',
      distanciaSuaPropriedade: 2.5,
      seuPrecoAtual: 300,
      precoSugerido: 600,
      criadoEm: new Date('2026-05-22T11:00:00.000Z'),
    };
    const { service, repos } = makeService({ event, impacts: [], analyses: [analysis] });
    const deadlock = Object.assign(new Error('Deadlock found when trying to get lock'), {
      code: 'ER_LOCK_DEADLOCK',
    });
    repos.impactRepo.save.mockImplementationOnce(async () => {
      throw deadlock;
    });

    const result = await service.recomputeEventIntelligence('event-1', 'admin-1');

    expect(repos.snapshotRepo.save).toHaveBeenCalledTimes(1);
    expect(repos.impactRepo.save).toHaveBeenCalledTimes(2);
    expect(result.runtime).toMatchObject({
      lockKey: 'event-intelligence:event:event-1',
      lockProvider: 'in_process',
      attempts: 2,
      retryDelaysMs: [50],
    });
    expect(result.writes.reused.eventIntelligenceSnapshots).toBe(1);
    expect(result.writes.created.eventPropertyImpacts).toBe(1);
    expect(result.writes.created.pricingDecisionSnapshots).toBe(1);
  });

  it('persists snapshots in batch even when no AnalisePreco can become impact', async () => {
    const { service, repos } = makeService({ events: [event], analyses: [] });

    const result = await service.recomputeIntelligenceBatch({ city: 'Sao Paulo', limit: 5 }, 'admin-1');

    expect(repos.snapshotRepo.save).toHaveBeenCalledTimes(1);
    expect(repos.impactRepo.save).not.toHaveBeenCalled();
    expect(repos.pricingDecisionSnapshotRepo.save).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'ok',
      summary: {
        eventsProcessed: 1,
        analysesRead: 0,
        skippedAnalyses: 0,
      },
      writes: {
        eventIntelligenceSnapshot: true,
        eventIntelligenceSnapshotsCount: 1,
        eventPropertyImpact: false,
        eventPropertyImpactsCount: 0,
        pricingDecisionSnapshot: false,
        pricingDecisionSnapshotsCount: 0,
      },
    });
  });
});
