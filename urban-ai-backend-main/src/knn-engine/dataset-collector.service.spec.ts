import { DatasetCollectorService } from './dataset-collector.service';

function makeRepo(options: {
  count?: number;
  trainingReady?: number;
  distinctListings?: number;
  distinctDays?: number;
  latest?: string | null;
  byOrigin?: Array<{ origin: string; count: string | number }>;
  findResult?: any[];
  findOneResult?: any;
} = {}) {
  const state = {
    select: '',
  };

  const builder = {
    select: jest.fn((value: string) => {
      state.select = value;
      return builder;
    }),
    addSelect: jest.fn(() => builder),
    setParameter: jest.fn(() => builder),
    groupBy: jest.fn(() => builder),
    getRawMany: jest.fn(async () => options.byOrigin ?? []),
    getRawOne: jest.fn(async () => {
      if (state.select.includes('DISTINCT') && state.select.includes('externalListingId')) {
        return { c: String(options.distinctListings ?? 0) };
      }
      if (state.select.includes('DISTINCT') && state.select.includes('snapshotDate')) {
        return { c: String(options.distinctDays ?? 0) };
      }
      if (state.select.includes('MAX(')) {
        return { latest: options.latest ?? null };
      }
      return { c: '0' };
    }),
  };

  return {
    count: jest.fn(async (args?: any) =>
      args?.where?.trainingReady === true ? (options.trainingReady ?? 0) : (options.count ?? 0),
    ),
    find: jest.fn(async () => options.findResult ?? []),
    findOne: jest.fn(async () => options.findOneResult ?? null),
    create: jest.fn((entity) => entity),
    save: jest.fn(async (entity) => entity),
    createQueryBuilder: jest.fn(() => builder),
    builder,
  };
}

function buildService(repos: {
  snapshot?: any;
  occupancy?: any;
  eventFeature?: any;
  address?: any;
  list?: any;
} = {}) {
  const snapshot = repos.snapshot ?? makeRepo();
  const occupancy = repos.occupancy ?? makeRepo();
  const eventFeature = repos.eventFeature ?? makeRepo();
  const address = repos.address ?? makeRepo();
  const list = repos.list ?? makeRepo();

  return {
    service: new DatasetCollectorService(
      snapshot as any,
      occupancy as any,
      eventFeature as any,
      address as any,
      list as any,
    ),
    snapshot,
    occupancy,
    eventFeature,
    address,
    list,
  };
}

describe('DatasetCollectorService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.AIRROI_API_KEY;
    delete process.env.STAYS_API_BASE_URL;
    delete process.env.STAYS_TOKEN_ENCRYPTION_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.NODE_ENV;
    delete process.env.APP_ENV;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('reports owned listing snapshot as blocked when no price resolver is wired', async () => {
    const list = makeRepo({ findResult: [{ id: 'list-1' }, { id: 'list-2' }] });
    const { service, snapshot } = buildService({ list });

    const result = await service.recordOwnedListingsSnapshot();

    expect(result.status).toBe('blocked_missing_price_source');
    expect(result.totalLists).toBe(2);
    expect(result.captured).toBe(0);
    expect(result.skippedMissingPrice).toBe(2);
    expect(result.externalDataAvailable).toBe(false);
    expect(snapshot.save).not.toHaveBeenCalled();
  });

  it('captures owned listing snapshots using a stable internal key when external id is absent', async () => {
    const list = makeRepo({ findResult: [{ id: 'list-1', quartos: 2, banheiros: 1 }] });
    const address = makeRepo({
      findOneResult: { bairro: 'Pinheiros', latitude: -23.56, longitude: -46.68 },
    });
    const snapshot = makeRepo();
    const { service } = buildService({ list, address, snapshot });

    const result = await service.recordOwnedListingsSnapshot(async () => 32100);

    expect(result.status).toBe('ok');
    expect(result.captured).toBe(1);
    expect(snapshot.findOne).toHaveBeenCalledWith({
      where: {
        snapshotDate: expect.any(String),
        externalListingId: 'urban-list:list-1',
      },
    });
    expect(snapshot.save).toHaveBeenCalledWith(
      expect.objectContaining({
        externalListingId: 'urban-list:list-1',
        priceCents: 32100,
        origin: 'self_cron',
        trainingReady: true,
      }),
    );
  });

  it('makes empty dataset, missing ground truth, and missing external dependencies explicit', async () => {
    process.env.NODE_ENV = 'production';
    const { service } = buildService();

    const diagnostics = await service.datasetDiagnostics();

    expect(diagnostics.health).toBe('red');
    expect(diagnostics.readiness).toBe('empty');
    expect(diagnostics.tables.priceSnapshots.total).toBe(0);
    expect(diagnostics.externalDependencies.AIRROI_API_KEY.status).toBe('missing');
    expect(diagnostics.externalDependencies.STAYS_TOKEN_ENCRYPTION_KEY.status).toBe('missing');
    expect(diagnostics.blockers.map((b) => b.code)).toEqual(
      expect.arrayContaining([
        'price_snapshots_empty',
        'occupancy_history_empty',
        'event_proximity_features_empty',
        'airroi_api_key_missing',
        'stays_token_encryption_key_missing',
      ]),
    );
  });

  it('marks diagnostics green when snapshots, event features, and ground truth are ready', async () => {
    process.env.AIRROI_API_KEY = 'test-airroi';
    process.env.STAYS_API_BASE_URL = 'https://stays.test';
    process.env.STAYS_TOKEN_ENCRYPTION_KEY = 'test-key';
    process.env.GOOGLE_MAPS_API_KEY = 'test-maps';

    const snapshot = makeRepo({
      count: 100,
      trainingReady: 80,
      distinctListings: 10,
      distinctDays: 12,
      latest: '2026-05-14',
      byOrigin: [{ origin: 'comp_extraction', count: '100' }],
    });
    const occupancy = makeRepo({ count: 40, trainingReady: 25, latest: '2026-05-13' });
    const eventFeature = makeRepo({ count: 30, latest: '2026-05-14' });
    const { service } = buildService({ snapshot, occupancy, eventFeature });

    const diagnostics = await service.datasetDiagnostics();

    expect(diagnostics.health).toBe('green');
    expect(diagnostics.readiness).toBe('ground_truth_ready');
    expect(diagnostics.blockers).toEqual([]);
    expect(diagnostics.tables.priceSnapshots.byOrigin).toEqual([
      { origin: 'comp_extraction', count: 100 },
    ]);
  });
});
