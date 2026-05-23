import { StaysAutoApplyService } from './stays-auto-apply.service';

describe('StaysAutoApplyService', () => {
  let service: StaysAutoApplyService;
  let listingRepo: { find: jest.Mock };
  let analiseRepo: { createQueryBuilder: jest.Mock };
  let pricingDecisionRepo: { find: jest.Mock };
  let staysService: { pushPrice: jest.Mock };
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.STAYS_AUTO_APPLY_ENABLED;
    delete process.env.STAYS_AUTO_APPLY_DRY_RUN;
    delete process.env.STAYS_AUTO_APPLY_ALLOWED_USER_IDS;
    delete process.env.STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS;
    delete process.env.STAYS_AUTO_APPLY_USER_ALLOWLIST;
    delete process.env.STAYS_AUTO_APPLY_LISTING_ALLOWLIST;
    delete process.env.STAYS_AUTO_APPLY_COHORT;
    delete process.env.STAYS_AUTO_APPLY_REQUIRE_PRICING_DECISION;
    delete process.env.STAYS_AUTO_APPLY_REQUIRE_LIVE_ALLOWLISTS;
    delete process.env.STAYS_AUTO_APPLY_MIN_CONFIDENCE;
    delete process.env.STAYS_AUTO_APPLY_MIN_BOOKING_PROBABILITY;
    delete process.env.STAYS_AUTO_APPLY_MIN_RECOMMENDED_MULTIPLIER;
    delete process.env.STAYS_AUTO_APPLY_MAX_RECOMMENDED_MULTIPLIER;
    delete process.env.STAYS_AUTO_APPLY_BLOCKED_RISK_FLAGS;

    listingRepo = { find: jest.fn() };
    analiseRepo = { createQueryBuilder: jest.fn() };
    pricingDecisionRepo = { find: jest.fn() };
    staysService = { pushPrice: jest.fn().mockResolvedValue({ id: 'pu-1' }) };

    service = new StaysAutoApplyService(
      listingRepo as any,
      analiseRepo as any,
      staysService as any,
      pricingDecisionRepo as any,
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  function autoListing(overrides: Record<string, unknown> = {}) {
    return {
      id: 'listing-1',
      staysListingId: 'stays-listing-1',
      operationMode: 'auto',
      active: true,
      basePriceCents: 10000,
      propriedade: { id: 'list-1' },
      account: {
        id: 'account-1',
        status: 'active',
        consentAcceptedAt: new Date('2026-05-01T00:00:00.000Z'),
        consentVersion: 'stays-connect-v1',
        user: { id: 'user-1', operationMode: 'notifications' },
      },
      ...overrides,
    };
  }

  function mockPendingAnalise(overrides: Record<string, unknown> = {}) {
    const analise = {
      id: 'analise-1',
      seuPrecoAtual: 100,
      precoSugerido: 115,
      evento: { dataInicio: new Date('2026-06-01T12:00:00.000Z') },
      ...overrides,
    };
    const builder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(analise),
    };
    analiseRepo.createQueryBuilder.mockReturnValue(builder);
    return { analise, builder };
  }

  function mockEligibleDecision(overrides: Record<string, unknown> = {}) {
    const decision = {
      id: 'decision-1',
      status: 'accepted',
      confidence: 'high',
      bookingProbability: 0.62,
      recommendedMultiplier: 1.15,
      selectedPriceCents: 11500,
      recommendedPriceCents: 11500,
      appliedPriceCents: null,
      riskFlags: [],
      guardrails: {
        minMultiplier: 1,
        maxMultiplier: 1.25,
        cappedRecommendedPrice: false,
      },
      inputSignals: {
        idempotencyKey: 'pricing-decision-v0:event:list:analysis',
        selectedScenario: {
          scenario: 'recommended',
          priceCents: 11500,
          multiplier: 1.15,
          bookingProbability: 0.62,
        },
      },
      eventPropertyImpact: {
        riskFlags: [],
      },
      ...overrides,
    };
    pricingDecisionRepo.find.mockResolvedValue([decision]);
    return decision;
  }

  it('does not process or push when STAYS_AUTO_APPLY_ENABLED is absent', async () => {
    const result = await service.processBatch();

    expect(result).toEqual({ processed: 0, eligible: 0, applied: 0, dryRun: 0, blocked: 0, errors: 0 });
    expect(listingRepo.find).not.toHaveBeenCalled();
    expect(analiseRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(staysService.pushPrice).not.toHaveBeenCalled();
  });

  it('does not call pushPrice in dry-run mode', async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = 'true';
    process.env.STAYS_AUTO_APPLY_DRY_RUN = 'true';
    listingRepo.find.mockResolvedValue([autoListing()]);
    mockPendingAnalise();
    mockEligibleDecision();

    const result = await service.processBatch();

    expect(result).toEqual({ processed: 1, eligible: 1, applied: 0, dryRun: 1, blocked: 0, errors: 0 });
    expect(analiseRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(staysService.pushPrice).not.toHaveBeenCalled();
  });

  it('blocks users outside STAYS_AUTO_APPLY_ALLOWED_USER_IDS', async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = 'true';
    process.env.STAYS_AUTO_APPLY_ALLOWED_USER_IDS = 'another-user';
    listingRepo.find.mockResolvedValue([autoListing()]);
    mockPendingAnalise();

    const result = await service.processBatch();

    expect(result).toEqual({ processed: 1, eligible: 0, applied: 0, dryRun: 0, blocked: 1, errors: 0 });
    expect(analiseRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(staysService.pushPrice).not.toHaveBeenCalled();
  });

  it('blocks listings outside STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS', async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = 'true';
    process.env.STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS = 'another-listing';
    listingRepo.find.mockResolvedValue([autoListing()]);
    mockPendingAnalise();

    const result = await service.processBatch();

    expect(result).toEqual({ processed: 1, eligible: 0, applied: 0, dryRun: 0, blocked: 1, errors: 0 });
    expect(analiseRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(staysService.pushPrice).not.toHaveBeenCalled();
  });

  it('accepts canonical USER_ALLOWLIST and LISTING_ALLOWLIST aliases', async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = 'true';
    process.env.STAYS_AUTO_APPLY_USER_ALLOWLIST = 'user-1';
    process.env.STAYS_AUTO_APPLY_LISTING_ALLOWLIST = 'listing-1';
    listingRepo.find.mockResolvedValue([autoListing()]);
    mockPendingAnalise();
    mockEligibleDecision();

    const result = await service.processBatch();

    expect(result).toEqual({ processed: 1, eligible: 1, applied: 1, dryRun: 0, blocked: 0, errors: 0 });
    expect(staysService.pushPrice).toHaveBeenCalledTimes(1);
    expect(staysService.pushPrice).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        origin: 'ai_auto',
        analisePrecoId: 'analise-1',
        userAgent: expect.stringContaining('cohort=event-safe-beta'),
      }),
    );
  });

  it('blocks live pushes without explicit user and listing allowlists', async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = 'true';
    listingRepo.find.mockResolvedValue([autoListing()]);
    mockPendingAnalise();
    mockEligibleDecision();

    const result = await service.processBatch();

    expect(result).toEqual({ processed: 1, eligible: 0, applied: 0, dryRun: 0, blocked: 1, errors: 0 });
    expect(staysService.pushPrice).not.toHaveBeenCalled();
  });

  it('blocks auto-apply when the event pricing decision is missing', async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = 'true';
    process.env.STAYS_AUTO_APPLY_ALLOWED_USER_IDS = 'user-1';
    process.env.STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS = 'listing-1';
    listingRepo.find.mockResolvedValue([autoListing()]);
    mockPendingAnalise();
    pricingDecisionRepo.find.mockResolvedValue([]);

    const result = await service.processBatch();

    expect(result).toEqual({ processed: 1, eligible: 0, applied: 0, dryRun: 0, blocked: 1, errors: 0 });
    expect(staysService.pushPrice).not.toHaveBeenCalled();
  });

  it('blocks low-confidence event recommendations before calling Stays', async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = 'true';
    process.env.STAYS_AUTO_APPLY_ALLOWED_USER_IDS = 'user-1';
    process.env.STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS = 'listing-1';
    listingRepo.find.mockResolvedValue([autoListing()]);
    mockPendingAnalise();
    mockEligibleDecision({ confidence: 'low' });

    const result = await service.processBatch();

    expect(result).toEqual({ processed: 1, eligible: 0, applied: 0, dryRun: 0, blocked: 1, errors: 0 });
    expect(staysService.pushPrice).not.toHaveBeenCalled();
  });

  it('blocks multipliers above the safe cohort ceiling', async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = 'true';
    process.env.STAYS_AUTO_APPLY_ALLOWED_USER_IDS = 'user-1';
    process.env.STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS = 'listing-1';
    listingRepo.find.mockResolvedValue([autoListing()]);
    mockPendingAnalise({ precoSugerido: 140 });
    mockEligibleDecision({
      recommendedMultiplier: 1.4,
      selectedPriceCents: 14000,
      recommendedPriceCents: 14000,
      inputSignals: {
        idempotencyKey: 'pricing-decision-v0:event:list:analysis',
        selectedScenario: {
          scenario: 'recommended',
          priceCents: 14000,
          multiplier: 1.4,
          bookingProbability: 0.62,
        },
      },
    });

    const result = await service.processBatch();

    expect(result).toEqual({ processed: 1, eligible: 0, applied: 0, dryRun: 0, blocked: 1, errors: 0 });
    expect(staysService.pushPrice).not.toHaveBeenCalled();
  });

  it('blocks critical risk flags and keeps the recommendation for manual review', async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = 'true';
    process.env.STAYS_AUTO_APPLY_ALLOWED_USER_IDS = 'user-1';
    process.env.STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS = 'listing-1';
    listingRepo.find.mockResolvedValue([autoListing()]);
    mockPendingAnalise();
    mockEligibleDecision({ riskFlags: ['property_unavailable_for_event_window'] });

    const result = await service.processBatch();

    expect(result).toEqual({ processed: 1, eligible: 0, applied: 0, dryRun: 0, blocked: 1, errors: 0 });
    expect(staysService.pushPrice).not.toHaveBeenCalled();
  });

  it('blocks auto-apply without consent metadata on the Stays account', async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = 'true';
    process.env.STAYS_AUTO_APPLY_ALLOWED_USER_IDS = 'user-1';
    process.env.STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS = 'listing-1';
    listingRepo.find.mockResolvedValue([
      autoListing({
        account: {
          id: 'account-1',
          status: 'active',
          user: { id: 'user-1', operationMode: 'notifications' },
        },
      }),
    ]);
    mockPendingAnalise();
    mockEligibleDecision();

    const result = await service.processBatch();

    expect(result).toEqual({ processed: 1, eligible: 0, applied: 0, dryRun: 0, blocked: 1, errors: 0 });
    expect(staysService.pushPrice).not.toHaveBeenCalled();
  });
});
