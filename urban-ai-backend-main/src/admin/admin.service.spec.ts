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

function makeService(
  eventRepo: any,
  overrides: {
    addressRepo?: any;
    priceUpdateRepo?: any;
    staysAccountRepo?: any;
    staysListingRepo?: any;
    jobRunRepo?: any;
    contactSubmissionRepo?: any;
  } = {},
) {
  return new AdminService(
    {} as any,
    overrides.addressRepo ?? ({} as any),
    {} as any,
    eventRepo as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    overrides.priceUpdateRepo ?? ({} as any),
    overrides.staysAccountRepo ?? ({} as any),
    overrides.staysListingRepo ?? ({} as any),
    {} as any,
    {} as any,
    overrides.jobRunRepo ?? ({} as any),
    overrides.contactSubmissionRepo ?? ({} as any),
    {} as any,
    {} as any,
    {} as any,
  );
}

describe('AdminService occupancyProperties', () => {
  it('returns active listings ordered with admin-safe fields', async () => {
    const addressRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'address-2',
          bairro: 'Ipanema',
          city: 'Rio de Janeiro',
          state: 'RJ',
          user: { id: 'user-2', email: 'zeta@example.com' },
          list: {
            id: 'list-2',
            titulo: 'Zeta Loft',
            id_do_anuncio: '222',
            manualDailyPrice: 250,
            dailyPrice: 200,
            averageMonthlyRevenue: 6000,
          },
        },
        {
          id: 'address-1',
          bairro: 'Copacabana',
          city: 'Rio de Janeiro',
          state: 'RJ',
          user: { id: 'user-1', email: 'alpha@example.com' },
          list: {
            id: 'list-1',
            titulo: 'Alpha Studio',
            id_do_anuncio: '111',
            manualDailyPrice: 150,
            dailyPrice: 120,
            averageMonthlyRevenue: 4500,
          },
        },
        { id: 'address-without-list', list: null },
      ]),
    };
    const service = makeService(makeEventRepo([]), { addressRepo });

    const result = await service.occupancyProperties();

    expect(addressRepo.find).toHaveBeenCalledWith({
      where: { ativo: true },
      relations: ['list', 'user'],
      take: 5000,
    });
    expect(result).toEqual([
      expect.objectContaining({
        addressId: 'address-1',
        listId: 'list-1',
        title: 'Alpha Studio',
        airbnbListingId: '111',
        userEmail: 'alpha@example.com',
        manualDailyPrice: 150,
        averageMonthlyRevenue: 4500,
      }),
      expect.objectContaining({
        addressId: 'address-2',
        listId: 'list-2',
        userEmail: 'zeta@example.com',
      }),
    ]);
  });
});

describe('AdminService runTrackedJob', () => {
  function makeJobRunRepo() {
    let seq = 0;
    return {
      create: jest.fn((input) => ({ id: `job-${++seq}`, ...input })),
      save: jest.fn(async (input) => ({ ...input })),
    };
  }

  it('marks a job as error when every attempted item fails', async () => {
    const jobRunRepo = makeJobRunRepo();
    const service = makeService(makeEventRepo([]), { jobRunRepo });

    const result = await service.runTrackedJob('geocoder', 'admin-user', async () => ({
      attempted: 100,
      succeeded: 0,
      failed: 100,
      failures: [{ id: 'event-1', reason: 'Request failed with status code 403' }],
    }));

    expect(result.status).toBe('error');
    expect(result.errorMessage).toBe('Job failed all attempted items (100/100)');
    expect(jobRunRepo.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'error',
        errorMessage: 'Job failed all attempted items (100/100)',
      }),
    );
  });

  it('keeps a partial job successful when at least one item succeeds', async () => {
    const jobRunRepo = makeJobRunRepo();
    const service = makeService(makeEventRepo([]), { jobRunRepo });

    const result = await service.runTrackedJob('geocoder', 'admin-user', async () => ({
      attempted: 10,
      succeeded: 7,
      failed: 3,
      failures: [],
    }));

    expect(result.status).toBe('success');
    expect(result.errorMessage).toBeNull();
  });

  it('marks blocked result statuses as error', async () => {
    const jobRunRepo = makeJobRunRepo();
    const service = makeService(makeEventRepo([]), { jobRunRepo });

    const result = await service.runTrackedJob('dataset-snapshot', 'admin-user', async () => ({
      status: 'blocked_missing_price_source',
      captured: 0,
      skippedMissingPrice: 41,
    }));

    expect(result.status).toBe('error');
    expect(result.errorMessage).toBe('blocked_missing_price_source');
  });
});

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

describe('AdminService staysHealth', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.STAYS_API_BASE_URL;
    delete process.env.STAYS_TOKEN_ENCRYPTION_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function rawQuery(rows: any[]) {
    return {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    };
  }

  it('exposes Stays readiness and missing envs for the admin page', async () => {
    const accountQb = rawQuery([{ status: 'active', count: '1' }]);
    const pushQb = rawQuery([{ status: 'success', count: '2' }]);
    const service = makeService(makeEventRepo([]), {
      staysAccountRepo: { createQueryBuilder: jest.fn().mockReturnValue(accountQb) },
      staysListingRepo: {
        count: jest
          .fn()
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(1),
      },
      priceUpdateRepo: {
        createQueryBuilder: jest.fn().mockReturnValue(pushQb),
        find: jest.fn().mockResolvedValue([]),
      },
    });

    const result = await service.staysHealth();

    expect(result.readiness).toEqual({
      apiBaseConfigured: false,
      tokenEncryptionConfigured: false,
      betaPrivate: true,
      missingEnv: ['STAYS_API_BASE_URL', 'STAYS_TOKEN_ENCRYPTION_KEY'],
    });
    expect(result.accountsByStatus).toEqual([{ status: 'active', count: 1 }]);
    expect(result.listings).toEqual({ total: 3, active: 2, forcedAuto: 1 });
    expect(result.pushLast30d).toEqual([{ status: 'success', count: 2 }]);
  });
});

describe('AdminService Track 3 readiness', () => {
  it('lists blockers for missing credentials and support gaps', () => {
    const service = makeService(makeEventRepo([])) as any;

    const result = service.buildTrack3Readiness({
      stripeSecretMode: 'missing',
      stripePublishableMode: 'missing',
      stripeSecretConfigured: false,
      stripeWebhookConfigured: false,
      stripePublishableConfigured: false,
      stripeModeMismatch: false,
      mailerSendApiKeyConfigured: false,
      emailSenderConfigured: false,
      senderUsesUrbanDomain: false,
      frontUrlConfigured: false,
      staysApiBaseConfigured: false,
      staysTokenEncryptionConfigured: false,
      supportP0Open: 1,
      supportOverdue: 2,
      supportLgpdOpen: 1,
      supportEmailConfigured: false,
      privacyEmailConfigured: false,
      supportEmailDomainOk: true,
      privacyEmailDomainOk: true,
      supportOwnerConfigured: false,
      privacyOwnerConfigured: false,
      supportOwnerDomainOk: true,
      privacyOwnerDomainOk: true,
    });

    expect(result.stripe).toMatchObject({
      status: 'blocked',
      blockers: expect.arrayContaining([
        'STRIPE_SECRET_KEY ausente',
        'STRIPE_WEBHOOK_SECRET ausente',
      ]),
    });
    expect(result.stripe.blockers).not.toContain('Publishable key Stripe ausente');
    expect(result.email.blockers).toContain('MAILERSEND_API_KEY ausente');
    expect(result.email.blockers).not.toContain('FRONT_URL ausente');
    expect(result.stays.blockers).toEqual([
      'STAYS_API_BASE_URL ausente',
      'STAYS_TOKEN_ENCRYPTION_KEY ausente',
    ]);
    expect(result.support.blockers).toEqual(
      expect.arrayContaining([
        '1 ticket(s) P0 abertos',
        '2 ticket(s) com SLA vencido',
        'SUPPORT_OWNER_EMAIL ausente',
        'PRIVACY_OWNER_EMAIL ausente',
        '1 pedido(s) LGPD exigem acompanhamento',
      ]),
    );
  });

  it('marks integrations ready when no blockers remain', () => {
    const service = makeService(makeEventRepo([])) as any;

    const result = service.buildTrack3Readiness({
      stripeSecretMode: 'test',
      stripePublishableMode: 'test',
      stripeSecretConfigured: true,
      stripeWebhookConfigured: true,
      stripePublishableConfigured: true,
      stripeModeMismatch: false,
      mailerSendApiKeyConfigured: true,
      emailSenderConfigured: true,
      senderUsesUrbanDomain: true,
      frontUrlConfigured: true,
      staysApiBaseConfigured: true,
      staysTokenEncryptionConfigured: true,
      supportP0Open: 0,
      supportOverdue: 0,
      supportLgpdOpen: 0,
      supportEmailConfigured: true,
      privacyEmailConfigured: true,
      supportEmailDomainOk: true,
      privacyEmailDomainOk: true,
      supportOwnerConfigured: true,
      privacyOwnerConfigured: true,
      supportOwnerDomainOk: true,
      privacyOwnerDomainOk: true,
    });

    expect(Object.values(result).every((item: any) => item.status === 'ready')).toBe(true);
  });

  it('allows operational owners outside the public support domain', () => {
    const service = makeService(makeEventRepo([])) as any;

    const result = service.buildTrack3Readiness({
      stripeSecretMode: 'test',
      stripePublishableMode: 'test',
      stripeSecretConfigured: true,
      stripeWebhookConfigured: true,
      stripePublishableConfigured: true,
      stripeModeMismatch: false,
      mailerSendApiKeyConfigured: true,
      emailSenderConfigured: true,
      senderUsesUrbanDomain: true,
      frontUrlConfigured: true,
      staysApiBaseConfigured: true,
      staysTokenEncryptionConfigured: true,
      supportP0Open: 0,
      supportOverdue: 0,
      supportLgpdOpen: 0,
      supportEmailConfigured: true,
      privacyEmailConfigured: true,
      supportEmailDomainOk: true,
      privacyEmailDomainOk: true,
      supportOwnerConfigured: true,
      privacyOwnerConfigured: true,
      supportOwnerDomainOk: false,
      privacyOwnerDomainOk: false,
    });

    expect(result.support).toMatchObject({ status: 'ready', blockers: [] });
  });

  it('does not block admin readiness when frontend-only Stripe key and FRONT_URL are not visible to backend', () => {
    const service = makeService(makeEventRepo([])) as any;

    const result = service.buildTrack3Readiness({
      stripeSecretMode: 'test',
      stripePublishableMode: 'missing',
      stripeSecretConfigured: true,
      stripeWebhookConfigured: true,
      stripePublishableConfigured: false,
      stripeModeMismatch: false,
      mailerSendApiKeyConfigured: true,
      emailSenderConfigured: true,
      senderUsesUrbanDomain: true,
      frontUrlConfigured: false,
      staysApiBaseConfigured: true,
      staysTokenEncryptionConfigured: true,
      supportP0Open: 0,
      supportOverdue: 0,
      supportLgpdOpen: 0,
      supportEmailConfigured: false,
      privacyEmailConfigured: false,
      supportEmailDomainOk: true,
      privacyEmailDomainOk: true,
      supportOwnerConfigured: true,
      privacyOwnerConfigured: true,
      supportOwnerDomainOk: true,
      privacyOwnerDomainOk: true,
    });

    expect(result.stripe).toMatchObject({ status: 'ready', blockers: [] });
    expect(result.email).toMatchObject({ status: 'ready', blockers: [] });
  });
});
