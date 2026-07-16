import { StaysAutoApplyService } from "./stays-auto-apply.service";

describe("StaysAutoApplyService", () => {
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
    staysService = { pushPrice: jest.fn().mockResolvedValue({ id: "pu-1" }) };

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
      id: "listing-1",
      staysListingId: "stays-listing-1",
      operationMode: "auto",
      active: true,
      basePriceCents: 10000,
      propriedade: { id: "list-1" },
      account: {
        id: "account-1",
        status: "active",
        consentAcceptedAt: new Date("2026-05-01T00:00:00.000Z"),
        consentVersion: "stays-connect-v1",
        user: { id: "user-1", operationMode: "notifications" },
      },
      ...overrides,
    };
  }

  function mockPendingAnalise(overrides: Record<string, unknown> = {}) {
    const analise = {
      id: "analise-1",
      seuPrecoAtual: 100,
      precoSugerido: 115,
      evento: { dataInicio: new Date("2026-06-01T12:00:00.000Z") },
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
      id: "decision-1",
      status: "accepted",
      confidence: "high",
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
        idempotencyKey: "pricing-decision-v0:event:list:analysis",
        selectedScenario: {
          scenario: "recommended",
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

  it("does not process or push when STAYS_AUTO_APPLY_ENABLED is absent", async () => {
    const result = await service.processBatch();

    expect(result).toEqual({
      processed: 0,
      eligible: 0,
      applied: 0,
      dryRun: 0,
      blocked: 0,
      errors: 0,
    });
    expect(listingRepo.find).not.toHaveBeenCalled();
    expect(analiseRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(staysService.pushPrice).not.toHaveBeenCalled();
  });

  it("does not call pushPrice in dry-run mode", async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = "true";
    process.env.STAYS_AUTO_APPLY_DRY_RUN = "true";
    listingRepo.find.mockResolvedValue([autoListing()]);
    mockPendingAnalise();
    mockEligibleDecision();

    const result = await service.processBatch();

    expect(result).toEqual({
      processed: 1,
      eligible: 1,
      applied: 0,
      dryRun: 1,
      blocked: 0,
      errors: 0,
    });
    expect(analiseRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(staysService.pushPrice).not.toHaveBeenCalled();
  });

  it("blocks users outside STAYS_AUTO_APPLY_ALLOWED_USER_IDS", async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = "true";
    process.env.STAYS_AUTO_APPLY_ALLOWED_USER_IDS = "another-user";
    listingRepo.find.mockResolvedValue([autoListing()]);
    mockPendingAnalise();

    const result = await service.processBatch();

    expect(result).toEqual({
      processed: 1,
      eligible: 0,
      applied: 0,
      dryRun: 0,
      blocked: 1,
      errors: 0,
    });
    expect(analiseRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(staysService.pushPrice).not.toHaveBeenCalled();
  });

  it("blocks listings outside STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS", async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = "true";
    process.env.STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS = "another-listing";
    listingRepo.find.mockResolvedValue([autoListing()]);
    mockPendingAnalise();

    const result = await service.processBatch();

    expect(result).toEqual({
      processed: 1,
      eligible: 0,
      applied: 0,
      dryRun: 0,
      blocked: 1,
      errors: 0,
    });
    expect(analiseRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(staysService.pushPrice).not.toHaveBeenCalled();
  });

  it("accepts canonical USER_ALLOWLIST and LISTING_ALLOWLIST aliases", async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = "true";
    process.env.STAYS_AUTO_APPLY_USER_ALLOWLIST = "user-1";
    process.env.STAYS_AUTO_APPLY_LISTING_ALLOWLIST = "listing-1";
    listingRepo.find.mockResolvedValue([autoListing()]);
    mockPendingAnalise();
    mockEligibleDecision();

    const result = await service.processBatch();

    expect(result).toEqual({
      processed: 1,
      eligible: 1,
      applied: 1,
      dryRun: 0,
      blocked: 0,
      errors: 0,
    });
    expect(staysService.pushPrice).toHaveBeenCalledTimes(1);
    expect(staysService.pushPrice).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        origin: "ai_auto",
        analisePrecoId: "analise-1",
        userAgent: expect.stringContaining("cohort=event-safe-beta"),
      }),
    );
  });

  it("blocks live pushes without explicit user and listing allowlists", async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = "true";
    listingRepo.find.mockResolvedValue([autoListing()]);
    mockPendingAnalise();
    mockEligibleDecision();

    const result = await service.processBatch();

    expect(result).toEqual({
      processed: 1,
      eligible: 0,
      applied: 0,
      dryRun: 0,
      blocked: 1,
      errors: 0,
    });
    expect(staysService.pushPrice).not.toHaveBeenCalled();
  });

  it("blocks auto-apply when the event pricing decision is missing", async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = "true";
    process.env.STAYS_AUTO_APPLY_ALLOWED_USER_IDS = "user-1";
    process.env.STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS = "listing-1";
    listingRepo.find.mockResolvedValue([autoListing()]);
    mockPendingAnalise();
    pricingDecisionRepo.find.mockResolvedValue([]);

    const result = await service.processBatch();

    expect(result).toEqual({
      processed: 1,
      eligible: 0,
      applied: 0,
      dryRun: 0,
      blocked: 1,
      errors: 0,
    });
    expect(staysService.pushPrice).not.toHaveBeenCalled();
  });

  it("blocks low-confidence event recommendations before calling Stays", async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = "true";
    process.env.STAYS_AUTO_APPLY_ALLOWED_USER_IDS = "user-1";
    process.env.STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS = "listing-1";
    listingRepo.find.mockResolvedValue([autoListing()]);
    mockPendingAnalise();
    mockEligibleDecision({ confidence: "low" });

    const result = await service.processBatch();

    expect(result).toEqual({
      processed: 1,
      eligible: 0,
      applied: 0,
      dryRun: 0,
      blocked: 1,
      errors: 0,
    });
    expect(staysService.pushPrice).not.toHaveBeenCalled();
  });

  it("blocks multipliers above the safe cohort ceiling", async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = "true";
    process.env.STAYS_AUTO_APPLY_ALLOWED_USER_IDS = "user-1";
    process.env.STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS = "listing-1";
    listingRepo.find.mockResolvedValue([autoListing()]);
    mockPendingAnalise({ precoSugerido: 140 });
    mockEligibleDecision({
      recommendedMultiplier: 1.4,
      selectedPriceCents: 14000,
      recommendedPriceCents: 14000,
      inputSignals: {
        idempotencyKey: "pricing-decision-v0:event:list:analysis",
        selectedScenario: {
          scenario: "recommended",
          priceCents: 14000,
          multiplier: 1.4,
          bookingProbability: 0.62,
        },
      },
    });

    const result = await service.processBatch();

    expect(result).toEqual({
      processed: 1,
      eligible: 0,
      applied: 0,
      dryRun: 0,
      blocked: 1,
      errors: 0,
    });
    expect(staysService.pushPrice).not.toHaveBeenCalled();
  });

  it("blocks critical risk flags and keeps the recommendation for manual review", async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = "true";
    process.env.STAYS_AUTO_APPLY_ALLOWED_USER_IDS = "user-1";
    process.env.STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS = "listing-1";
    listingRepo.find.mockResolvedValue([autoListing()]);
    mockPendingAnalise();
    mockEligibleDecision({
      riskFlags: ["property_unavailable_for_event_window"],
    });

    const result = await service.processBatch();

    expect(result).toEqual({
      processed: 1,
      eligible: 0,
      applied: 0,
      dryRun: 0,
      blocked: 1,
      errors: 0,
    });
    expect(staysService.pushPrice).not.toHaveBeenCalled();
  });

  it("blocks auto-apply without consent metadata on the Stays account", async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = "true";
    process.env.STAYS_AUTO_APPLY_ALLOWED_USER_IDS = "user-1";
    process.env.STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS = "listing-1";
    listingRepo.find.mockResolvedValue([
      autoListing({
        account: {
          id: "account-1",
          status: "active",
          user: { id: "user-1", operationMode: "notifications" },
        },
      }),
    ]);
    mockPendingAnalise();
    mockEligibleDecision();

    const result = await service.processBatch();

    expect(result).toEqual({
      processed: 1,
      eligible: 0,
      applied: 0,
      dryRun: 0,
      blocked: 1,
      errors: 0,
    });
    expect(staysService.pushPrice).not.toHaveBeenCalled();
  });

  it("re-checks the kill switch before every external push in an active batch", async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = "true";
    process.env.STAYS_AUTO_APPLY_ALLOWED_USER_IDS = "user-1";
    process.env.STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS = "listing-1,listing-2";
    listingRepo.find.mockResolvedValue([
      autoListing(),
      autoListing({
        id: "listing-2",
        staysListingId: "stays-listing-2",
        propriedade: { id: "list-2" },
      }),
    ]);
    mockPendingAnalise();
    mockEligibleDecision();
    staysService.pushPrice.mockImplementationOnce(async () => {
      delete process.env.STAYS_AUTO_APPLY_ENABLED;
      return { id: "pu-1" };
    });

    const result = await service.processBatch();

    expect(result).toEqual({
      processed: 2,
      eligible: 2,
      applied: 1,
      dryRun: 0,
      blocked: 1,
      errors: 0,
    });
    expect(staysService.pushPrice).toHaveBeenCalledTimes(1);
  });

  it("selects only active effective-auto listings", async () => {
    listingRepo.find.mockResolvedValue([
      autoListing(),
      autoListing({
        id: "inherit-auto",
        operationMode: "inherit",
        account: {
          id: "a2",
          status: "active",
          user: { id: "u2", operationMode: "auto" },
        },
      }),
      autoListing({ id: "inherit-manual", operationMode: "inherit" }),
      autoListing({ id: "manual", operationMode: "manual" }),
      autoListing({
        id: "inactive-account",
        account: {
          id: "a3",
          status: "error",
          user: { id: "u3", operationMode: "auto" },
        },
      }),
    ]);

    await expect((service as any).findAutoModeListings()).resolves.toEqual([
      expect.objectContaining({ id: "listing-1" }),
      expect.objectContaining({ id: "inherit-auto" }),
    ]);
    expect(listingRepo.find).toHaveBeenCalledWith({
      where: { active: true },
      relations: ["account", "account.user", "propriedade"],
    });
  });

  it("skips listings with no pending analysis, no property or no owner", async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = "true";
    process.env.STAYS_AUTO_APPLY_DRY_RUN = "true";
    listingRepo.find.mockResolvedValue([
      autoListing({ id: "no-property", propriedade: null }),
      autoListing({ id: "no-analysis", staysListingId: "no-analysis" }),
      autoListing({
        id: "no-owner",
        staysListingId: "no-owner",
        account: {
          id: "a3",
          status: "active",
          consentAcceptedAt: new Date(),
          consentVersion: "v1",
          user: null,
        },
      }),
    ]);
    const { analise: pending, builder } = mockPendingAnalise();
    builder.getOne.mockResolvedValueOnce(null).mockResolvedValueOnce(pending);

    const result = await service.processBatch();
    expect(result).toEqual({
      processed: 3,
      eligible: 0,
      applied: 0,
      dryRun: 0,
      blocked: 0,
      errors: 0,
    });
    expect(staysService.pushPrice).not.toHaveBeenCalled();
  });

  it("blocks invalid prices and counts provider failures without aborting the batch", async () => {
    process.env.STAYS_AUTO_APPLY_ENABLED = "true";
    process.env.STAYS_AUTO_APPLY_ALLOWED_USER_IDS = "user-1";
    process.env.STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS = "listing-1,listing-2";
    listingRepo.find.mockResolvedValue([
      autoListing(),
      autoListing({
        id: "listing-2",
        staysListingId: "remote-2",
        propriedade: { id: "list-2" },
      }),
    ]);
    const { analise: valid, builder } = mockPendingAnalise();
    builder.getOne
      .mockResolvedValueOnce({
        ...valid,
        id: "invalid",
        seuPrecoAtual: null,
        precoSugerido: null,
      })
      .mockResolvedValueOnce(valid);
    mockEligibleDecision();
    staysService.pushPrice.mockRejectedValue(new Error("provider unavailable"));

    const result = await service.processBatch();
    expect(result).toEqual({
      processed: 2,
      eligible: 1,
      applied: 0,
      dryRun: 0,
      blocked: 1,
      errors: 1,
    });
  });

  it("covers cron overlap, normal completion and top-level error recovery", async () => {
    const process = jest.spyOn(service, "processBatch").mockResolvedValue({
      processed: 0,
      eligible: 0,
      applied: 0,
      dryRun: 0,
      blocked: 0,
      errors: 0,
    });
    (service as any).isProcessing = true;
    await service.handleCron();
    expect(process).not.toHaveBeenCalled();

    (service as any).isProcessing = false;
    await service.handleCron();
    expect(process).toHaveBeenCalledTimes(1);
    expect((service as any).isProcessing).toBe(false);

    process.mockRejectedValueOnce(new Error("batch failed"));
    await expect(service.handleCron()).resolves.toBeUndefined();
    expect((service as any).isProcessing).toBe(false);
  });

  it("parses defensive environment variants, bounds and fallbacks", () => {
    const subject = service as any;
    process.env.BOOL = " YES ";
    expect(subject.parseBooleanEnv("BOOL")).toBe(true);
    process.env.BOOL = "off";
    expect(subject.parseBooleanEnv("BOOL")).toBe(false);
    expect(subject.parseBooleanEnvDefault("MISSING", true)).toBe(true);
    process.env.BOOL = "1";
    expect(subject.parseBooleanEnvDefault("BOOL", false)).toBe(true);
    process.env.BOOL = "0";
    expect(subject.parseBooleanEnvDefault("BOOL", true)).toBe(false);
    process.env.BOOL = "unexpected";
    expect(subject.parseBooleanEnvDefault("BOOL", true)).toBe(true);

    process.env.CONFIDENCE = "HIGH";
    expect(subject.parseConfidenceEnv("CONFIDENCE", "low")).toBe("high");
    process.env.CONFIDENCE = "unknown";
    expect(subject.parseConfidenceEnv("CONFIDENCE", "medium")).toBe("medium");
    process.env.NUMBER = "99";
    expect(subject.parseNumberEnv("NUMBER", 1, 0, 3)).toBe(3);
    process.env.NUMBER = "-5";
    expect(subject.parseNumberEnv("NUMBER", 1, 0, 3)).toBe(0);
    process.env.NUMBER = "NaN";
    expect(subject.parseNumberEnv("NUMBER", 1, 0, 3)).toBe(1);
    process.env.LIST_A = "a, b; c";
    process.env.LIST_B = "b d";
    expect([...subject.parseListEnv("LIST_A", "LIST_B")]).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("evaluates all audit blockers and warnings for an unsafe decision", async () => {
    process.env.STAYS_AUTO_APPLY_DRY_RUN = "false";
    process.env.STAYS_AUTO_APPLY_REQUIRE_LIVE_ALLOWLISTS = "false";
    process.env.STAYS_AUTO_APPLY_MIN_CONFIDENCE = "high";
    process.env.STAYS_AUTO_APPLY_MIN_BOOKING_PROBABILITY = "0.8";
    process.env.STAYS_AUTO_APPLY_MIN_RECOMMENDED_MULTIPLIER = "1.1";
    process.env.STAYS_AUTO_APPLY_MAX_RECOMMENDED_MULTIPLIER = "1.2";
    process.env.STAYS_AUTO_APPLY_BLOCKED_RISK_FLAGS = "custom-risk";
    const decision = mockEligibleDecision({
      status: "expired",
      confidence: "medium",
      bookingProbability: 0.2,
      recommendedMultiplier: 0.9,
      selectedPriceCents: 9000,
      recommendedPriceCents: null,
      appliedPriceCents: 9000,
      riskFlags: ["custom-risk", "custom-risk"],
      guardrails: { cappedRecommendedPrice: true },
      inputSignals: { selectedScenario: null },
      eventPropertyImpact: { riskFlags: ["custom-risk", "", 2] },
    });
    pricingDecisionRepo.find.mockResolvedValue([decision]);
    const config = (service as any).getConfig();

    const result = await (service as any).evaluateEligibility({
      listing: autoListing(),
      analise: { id: "analysis-1" },
      targetDate: "invalid",
      previousPriceCents: 0,
      newPriceCents: 10_000,
      config,
    });

    expect(result.eligible).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        "missing_rollback_baseline",
        "invalid_target_date",
        "unsafe_pricing_decision_status:expired",
        "pricing_decision_already_has_applied_price",
        "confidence_below_high",
        "booking_probability_below_floor",
        "recommended_multiplier_below_floor",
        "new_price_above_audited_decision_price",
        "blocked_risk_flag:custom-risk",
      ]),
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "missing_pricing_decision_idempotency_key",
        "recommendation_capped_by_guardrail",
      ]),
    );
  });

  it("handles missing decision signals when pricing snapshots are optional", async () => {
    process.env.STAYS_AUTO_APPLY_DRY_RUN = "true";
    process.env.STAYS_AUTO_APPLY_REQUIRE_PRICING_DECISION = "false";
    pricingDecisionRepo.find.mockResolvedValue([]);
    const result = await (service as any).evaluateEligibility({
      listing: autoListing(),
      analise: { id: "analysis-1" },
      targetDate: "2026-08-01",
      previousPriceCents: 10000,
      newPriceCents: 11500,
      config: (service as any).getConfig(),
    });
    expect(result.eligible).toBe(true);
    expect(result.audit.recommendedMultiplier).toBe(1.15);
  });

  it("handles missing probability, multiplier and audited price signals", async () => {
    process.env.STAYS_AUTO_APPLY_DRY_RUN = "true";
    const decision = mockEligibleDecision({
      bookingProbability: null,
      recommendedMultiplier: null,
      selectedPriceCents: null,
      recommendedPriceCents: null,
      inputSignals: { idempotencyKey: "key", selectedScenario: null },
    });
    pricingDecisionRepo.find.mockResolvedValue([decision]);
    const result = await (service as any).evaluateEligibility({
      listing: autoListing(),
      analise: { id: "analysis-1" },
      targetDate: "2026-08-01",
      previousPriceCents: 0,
      newPriceCents: 0,
      config: (service as any).getConfig(),
    });
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        "missing_rollback_baseline",
        "missing_booking_probability",
        "missing_recommended_multiplier",
      ]),
    );
    expect(result.warnings).toContain("missing_decision_price_for_audit");
  });

  it("returns null after pricing-decision repository failures", async () => {
    pricingDecisionRepo.find.mockRejectedValue(new Error("db timeout"));
    await expect(
      (service as any).findLatestPricingDecisionSnapshot({ id: "analysis-1" }),
    ).resolves.toBeNull();
  });

  it("covers conversion, date, confidence and multiplier boundaries", () => {
    const subject = service as any;
    expect(subject.moneyToCents(null)).toBeNull();
    expect(subject.moneyToCents(undefined)).toBeNull();
    expect(subject.moneyToCents("")).toBeNull();
    expect(subject.moneyToCents("12.34")).toBe(1234);
    expect(subject.moneyToCents(1.235)).toBe(124);
    expect(subject.moneyToCents("invalid")).toBeNull();
    expect(subject.toIntegerCents(null)).toBeNull();
    expect(subject.toIntegerCents("")).toBeNull();
    expect(subject.toIntegerCents("10.6")).toBe(11);
    expect(subject.toIntegerCents("invalid")).toBeNull();
    expect(subject.toDecimal(undefined)).toBeNull();
    expect(subject.toDecimal("")).toBeNull();
    expect(subject.toDecimal("0.62")).toBe(0.62);
    expect(subject.toDecimal("invalid")).toBeNull();
    expect(subject.multiplierFromPrices(0, 100)).toBeNull();
    expect(subject.multiplierFromPrices(100, 0)).toBeNull();
    expect(subject.multiplierFromPrices(115, 100)).toBe(1.15);
    expect(subject.toDateStr("2026-08-01T10:00:00.000Z")).toBe("2026-08-01");
    expect(subject.toDateStr(new Date("2026-08-02T10:00:00.000Z"))).toBe(
      "2026-08-02",
    );
    expect(subject.isValidTargetDate("bad")).toBe(false);
    expect(subject.isValidTargetDate("2026-02-30")).toBe(false);
    expect(subject.isValidTargetDate("2026-02-28")).toBe(true);
    expect(subject.confidenceRank("high")).toBe(3);
    expect(subject.confidenceRank("medium")).toBe(2);
    expect(subject.confidenceRank("low")).toBe(1);
    expect(subject.confidenceRank(null)).toBe(0);
    expect(subject.isSafeDecisionStatus("suggested")).toBe(true);
    expect(subject.isSafeDecisionStatus("accepted")).toBe(true);
    expect(subject.isSafeDecisionStatus("expired")).toBe(false);
  });

  it("covers allowlist aliases, remote IDs and missing owner branches", () => {
    const subject = service as any;
    const config = {
      allowedUserIds: new Set(["user-1"]),
      allowedListingIds: new Set(["stays-listing-1"]),
    };
    expect(subject.allowlistDecision(autoListing(), config)).toEqual({
      blockers: [],
      warnings: [],
    });
    expect(
      subject.allowlistDecision(
        autoListing({ account: { id: "a", status: "active", user: null } }),
        config,
      ).blockers,
    ).toContain("user_not_allowlisted");
    expect(
      subject.allowlistDecision(autoListing(), {
        allowedUserIds: new Set(),
        allowedListingIds: new Set(),
      }),
    ).toEqual({ blockers: [], warnings: [] });
  });

  it("deduplicates risk flags and renders blocked audit variants safely", () => {
    const subject = service as any;
    const decision = {
      riskFlags: ["a", "", "a", 1],
      eventPropertyImpact: { riskFlags: ["b", "a"] },
    };
    expect(subject.riskFlagsFromDecision(decision)).toEqual(["a", "b"]);
    expect(subject.riskFlagsFromDecision(null)).toEqual([]);
    expect(subject.asStringArray("not-an-array")).toEqual([]);
    expect(subject.unique(["a", "", "a", "b"])).toEqual(["a", "b"]);

    const warn = jest.spyOn((service as any).logger, "warn");
    subject.logBlockedAutoApply(
      autoListing({ account: null }),
      null,
      ["blocked", "blocked"],
      ["review"],
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("user=unknown"));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("warnings=review"),
    );
  });
});
