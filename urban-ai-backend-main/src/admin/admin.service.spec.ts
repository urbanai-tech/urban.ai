jest.mock('../knn-engine/strategies/adaptive-pricing.strategy', () => ({
  AdaptivePricingStrategy: class AdaptivePricingStrategy {},
}));
jest.mock('../knn-engine/dataset-collector.service', () => ({
  DatasetCollectorService: class DatasetCollectorService {},
}));
jest.mock('../maps/maps.service', () => ({
  MapsService: class MapsService {},
}));

import { AdminService } from './admin.service';

function makeEventRepo(rows: any[]) {
  const qb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  };

  return {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    qb,
  };
}

function makeService(eventRepo: any) {
  return new AdminService(
    {} as any,
    {} as any,
    {} as any,
    eventRepo as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
}

describe('AdminService collectorsHealth', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.SERPAPI_KEY;
    delete process.env.TAVILY_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('normalizes aliases, exposes missing envs and avoids duplicate known collectors', async () => {
    const now = new Date().toISOString();
    const eventRepo = makeEventRepo([
      {
        source: 'serpapi_events',
        total: '2',
        last7d: '2',
        last24h: '1',
        outOfScope: '1',
        pendingGeocode: '0',
        pendingEnrichment: '1',
        enriched: '1',
        withErrors: '1',
        lastSeen: now,
      },
    ]);
    const service = makeService(eventRepo);

    const result = await service.collectorsHealth();

    const serpapiRows = result.sources.filter((s: any) => s.source === 'serpapi-events');
    expect(serpapiRows).toHaveLength(1);
    expect(serpapiRows[0]).toMatchObject({
      source: 'serpapi-events',
      status: 'missing_key',
      critical: false,
      aliases: ['serpapi_events'],
      requiredEnv: ['SERPAPI_KEY'],
      missingEnv: ['SERPAPI_KEY'],
      total: 2,
      outOfScopePercent: 50,
      errorRate: 50,
      stale: false,
    });
  });

  it('marks stale collectors and missing known collectors with actionable status', async () => {
    process.env.SERPAPI_KEY = 'present';
    const staleLastSeen = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const eventRepo = makeEventRepo([
      {
        source: 'sp-cultura',
        total: '3',
        last7d: '0',
        last24h: '0',
        outOfScope: '0',
        pendingGeocode: '0',
        pendingEnrichment: '0',
        enriched: '3',
        withErrors: '0',
        lastSeen: staleLastSeen,
      },
    ]);
    const service = makeService(eventRepo);

    const result = await service.collectorsHealth();

    expect(result.sources.find((s: any) => s.source === 'sp-cultura')).toMatchObject({
      status: 'stale',
      stale: true,
      missingEnv: [],
    });
    expect(result.sources.find((s: any) => s.source === 'usp-eventos')).toMatchObject({
      status: 'no_events',
      missingEnv: [],
    });
    expect(result.sources.find((s: any) => s.source === 'tavily')).toMatchObject({
      status: 'missing_key',
      missingEnv: ['TAVILY_API_KEY', 'GEMINI_API_KEY'],
    });
  });
});
