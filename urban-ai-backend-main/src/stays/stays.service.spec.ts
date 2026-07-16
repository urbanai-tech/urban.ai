import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { StaysService } from "./stays.service";
import { StaysConnector } from "./stays-connector";
import {
  StaysAccount,
  staysTokenTransformer,
} from "../entities/stays-account.entity";
import { StaysListing } from "../entities/stays-listing.entity";
import { PriceUpdate } from "../entities/price-update.entity";
import { User } from "../entities/user.entity";
import { AnalisePreco } from "../entities/AnalisePreco";
import { PricingDecisionSnapshot } from "../entities/pricing-decision-snapshot.entity";
import { PricingCalculateService } from "../propriedades/pricing-calculate.service";

type Repo<T> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe("StaysService", () => {
  let service: StaysService;
  let accountRepo: Repo<StaysAccount>;
  let listingRepo: Repo<StaysListing>;
  let priceUpdateRepo: Repo<PriceUpdate>;
  let userRepo: Repo<User>;
  let analiseRepo: Repo<AnalisePreco>;
  let pricingDecisionSnapshotRepo: Repo<PricingDecisionSnapshot>;
  let connector: {
    ping: jest.Mock;
    listListings: jest.Mock;
    pushPrice: jest.Mock;
  };
  const originalStaysApiBaseUrl = process.env.STAYS_API_BASE_URL;
  const originalStaysTokenKey = process.env.STAYS_TOKEN_ENCRYPTION_KEY;

  beforeEach(async () => {
    process.env.STAYS_API_BASE_URL = "https://stays.test";
    process.env.STAYS_TOKEN_ENCRYPTION_KEY = "test-encryption-key";

    accountRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation(async (d) => ({ id: "acc-1", ...d })),
    };
    listingRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation(async (d) => ({ id: "l-1", ...d })),
    };
    priceUpdateRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((d) => ({ id: "pu-1", ...d })),
      save: jest.fn().mockImplementation(async (d) => d),
    };
    userRepo = { findOne: jest.fn() };
    analiseRepo = { findOne: jest.fn().mockResolvedValue(null) };
    pricingDecisionSnapshotRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation(async (d) => d),
    };
    connector = {
      ping: jest.fn(),
      listListings: jest.fn(),
      pushPrice: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaysService,
        { provide: getRepositoryToken(StaysAccount), useValue: accountRepo },
        { provide: getRepositoryToken(StaysListing), useValue: listingRepo },
        { provide: getRepositoryToken(PriceUpdate), useValue: priceUpdateRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(AnalisePreco), useValue: analiseRepo },
        {
          provide: getRepositoryToken(PricingDecisionSnapshot),
          useValue: pricingDecisionSnapshotRepo,
        },
        { provide: StaysConnector, useValue: connector },
        PricingCalculateService,
      ],
    }).compile();

    service = module.get<StaysService>(StaysService);
  });

  afterAll(() => {
    if (originalStaysApiBaseUrl === undefined) {
      delete process.env.STAYS_API_BASE_URL;
    } else {
      process.env.STAYS_API_BASE_URL = originalStaysApiBaseUrl;
    }

    if (originalStaysTokenKey === undefined) {
      delete process.env.STAYS_TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.STAYS_TOKEN_ENCRYPTION_KEY = originalStaysTokenKey;
    }
  });

  describe("connectAccount", () => {
    const consentInput = {
      consentAccepted: true,
      consentVersion: "stays-connect-v1",
    };

    it("rejects before ping when consent was not accepted", async () => {
      userRepo.findOne!.mockResolvedValue({ id: "u1" });

      await expect(
        service.connectAccount("u1", {
          clientId: "c",
          accessToken: "real-token",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(connector.ping).not.toHaveBeenCalled();
      expect(accountRepo.save).not.toHaveBeenCalled();
    });

    it("rejects a blank consent version before validating credentials", async () => {
      userRepo.findOne!.mockResolvedValue({ id: "u1" });

      await expect(
        service.connectAccount("u1", {
          clientId: "c",
          accessToken: "real-token",
          consentAccepted: true,
          consentVersion: "   ",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(connector.ping).not.toHaveBeenCalled();
      expect(accountRepo.save).not.toHaveBeenCalled();
    });

    it("fails closed before ping when Stays envs are not configured", async () => {
      delete process.env.STAYS_API_BASE_URL;
      delete process.env.STAYS_TOKEN_ENCRYPTION_KEY;
      userRepo.findOne!.mockResolvedValue({ id: "u1" });

      await expect(
        service.connectAccount("u1", {
          clientId: "c",
          accessToken: "real-token",
          ...consentInput,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(connector.ping).not.toHaveBeenCalled();
      expect(accountRepo.save).not.toHaveBeenCalled();
    });

    it("rejects when the accessToken fails the ping validation", async () => {
      userRepo.findOne!.mockResolvedValue({ id: "u1" });
      connector.ping.mockResolvedValue(false);

      await expect(
        service.connectAccount("u1", {
          clientId: "c",
          accessToken: "bad",
          ...consentInput,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(accountRepo.save).not.toHaveBeenCalled();
    });

    it("persists a new account with status=active when ping passes", async () => {
      userRepo.findOne!.mockResolvedValue({ id: "u1" });
      accountRepo.findOne!.mockResolvedValue(null);
      connector.ping.mockResolvedValue(true);

      const result = await service.connectAccount("u1", {
        clientId: "c1",
        accessToken: "t1",
        ip: "127.0.0.1",
        userAgent: "jest",
        ...consentInput,
      });

      expect(result.status).toBe("active");
      expect(accountRepo.save!.mock.calls[0][0]).toMatchObject({
        consentVersion: "stays-connect-v1",
        consentIp: "127.0.0.1",
        consentUserAgent: "jest",
      });
      expect(
        accountRepo.save!.mock.calls[0][0].consentAcceptedAt,
      ).toBeInstanceOf(Date);
      expect(accountRepo.save).toHaveBeenCalled();
    });

    it("overwrites an existing account when reconnecting", async () => {
      userRepo.findOne!.mockResolvedValue({ id: "u1" });
      accountRepo.findOne!.mockResolvedValue({
        id: "acc-old",
        clientId: "old-c",
        accessToken: "old-t",
        status: "error",
        lastErrorMessage: "previous error",
      });
      connector.ping.mockResolvedValue(true);

      await service.connectAccount("u1", {
        clientId: "new-c",
        accessToken: "new-t",
        ...consentInput,
      });

      const saved = accountRepo.save!.mock.calls[0][0];
      expect(saved).toMatchObject({
        clientId: "new-c",
        accessToken: "new-t",
        consentVersion: "stays-connect-v1",
        consentIp: null,
        consentUserAgent: null,
        status: "active",
        lastErrorAt: null,
        lastErrorMessage: null,
      });
      expect(saved.consentAcceptedAt).toBeInstanceOf(Date);
    });
  });

  describe("previewPrice", () => {
    function withActiveAccount(overrides: Partial<StaysAccount> = {}) {
      const user = { id: "u1" };
      const account = {
        id: "acc-1",
        user,
        accessToken: "t",
        status: "active",
        consentAcceptedAt: new Date("2026-05-01T00:00:00.000Z"),
        consentVersion: "stays-connect-v1",
        maxIncreasePercent: 25,
        maxDecreasePercent: 20,
        ...overrides,
      } as any;
      accountRepo.findOne!.mockResolvedValue(account);
      return { user, account };
    }

    function withListing(listingId = "l-1", basePriceCents = 10000) {
      const listing = {
        id: listingId,
        staysListingId: `stays-${listingId}`,
        title: "Apto Centro",
        account: { id: "acc-1" },
        active: true,
        basePriceCents,
      };
      listingRepo.findOne!.mockResolvedValue(listing);
      return listing;
    }

    it("returns guardrail blockers without calling the external connector", async () => {
      withActiveAccount();
      withListing();
      priceUpdateRepo.findOne!.mockResolvedValue(null);

      const result = await service.previewPrice("u1", {
        listingId: "l-1",
        targetDate: "2026-06-01",
        previousPriceCents: 10000,
        newPriceCents: 13000,
      });

      expect(result.readyForPush).toBe(false);
      expect(result.withinGuardrails).toBe(false);
      expect(result.blockers.map((b) => b.code)).toContain(
        "increase_cap_exceeded",
      );
      expect(connector.pushPrice).not.toHaveBeenCalled();
      expect(priceUpdateRepo.save).not.toHaveBeenCalled();
    });

    it("uses the listing base price as baseline and flags idempotent replay", async () => {
      withActiveAccount();
      withListing("l-1", 10000);
      priceUpdateRepo.findOne!.mockResolvedValue({ id: "pu-existing" });

      const result = await service.previewPrice("u1", {
        listingId: "l-1",
        targetDate: "2026-06-01",
        newPriceCents: 11500,
      });

      expect(result).toMatchObject({
        previousPriceCents: 10000,
        diffCents: 1500,
        diffPercent: 15,
        readyForPush: true,
        existingPriceUpdateId: "pu-existing",
        idempotentReplay: true,
      });
      expect(connector.pushPrice).not.toHaveBeenCalled();
    });

    it("keeps preview available when push env is missing, but marks it not ready for push", async () => {
      delete process.env.STAYS_API_BASE_URL;
      withActiveAccount();
      withListing("l-1", 10000);
      priceUpdateRepo.findOne!.mockResolvedValue(null);

      const result = await service.previewPrice("u1", {
        listingId: "l-1",
        targetDate: "2026-06-01",
        newPriceCents: 11000,
      });

      expect(result.blockers).toHaveLength(0);
      expect(result.readyForPush).toBe(false);
      expect(result.warnings.map((w) => w.code)).toContain(
        "stays_api_base_url_missing",
      );
      expect(connector.pushPrice).not.toHaveBeenCalled();
    });
  });

  describe("pushPrice — guardrails de variação", () => {
    function withActiveAccount(overrides: Partial<StaysAccount> = {}) {
      const user = { id: "u1" };
      const account = {
        id: "acc-1",
        user,
        accessToken: "t",
        status: "active",
        consentAcceptedAt: new Date("2026-05-01T00:00:00.000Z"),
        consentVersion: "stays-connect-v1",
        maxIncreasePercent: 25,
        maxDecreasePercent: 20,
        ...overrides,
      } as any;
      accountRepo.findOne!.mockResolvedValue(account);
      return { user, account };
    }

    function withListing(listingId = "l-1", basePriceCents = 10000) {
      const listing = {
        id: listingId,
        staysListingId: `stays-${listingId}`,
        account: { id: "acc-1" },
        active: true,
        basePriceCents,
      };
      listingRepo.findOne!.mockResolvedValue(listing);
      return listing;
    }

    it("rejects when increase exceeds the account cap (+25%)", async () => {
      withActiveAccount();
      withListing();

      await expect(
        service.pushPrice("u1", {
          listingId: "l-1",
          targetDate: "2026-05-01",
          previousPriceCents: 10000,
          newPriceCents: 13000, // +30%
          origin: "ai_auto",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(connector.pushPrice).not.toHaveBeenCalled();
    });

    it("rejects when decrease exceeds the account cap (-20%)", async () => {
      withActiveAccount();
      withListing();

      await expect(
        service.pushPrice("u1", {
          listingId: "l-1",
          targetDate: "2026-05-01",
          previousPriceCents: 10000,
          newPriceCents: 7000, // -30%
          origin: "ai_auto",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("allows a push within the variation caps", async () => {
      withActiveAccount();
      withListing();
      priceUpdateRepo.findOne!.mockResolvedValue(null);
      connector.pushPrice.mockResolvedValue({
        ok: true,
        externalReference: "ext-1",
      });

      const result = await service.pushPrice("u1", {
        listingId: "l-1",
        targetDate: "2026-05-01",
        previousPriceCents: 10000,
        newPriceCents: 11500, // +15%
        origin: "ai_auto",
      });

      expect(connector.pushPrice).toHaveBeenCalledTimes(1);
      expect(result.status).toBe("success");
    });

    it("persists PriceUpdate lifecycle as pricing decision outcome", async () => {
      withActiveAccount();
      withListing();
      priceUpdateRepo.findOne!.mockResolvedValue(null);
      connector.pushPrice.mockResolvedValue({
        ok: true,
        externalReference: "ext-1",
      });
      analiseRepo.findOne!.mockResolvedValue({
        id: "analysis-1",
        status: "applied_stays",
        aceito: true,
        reservaStatus: "booked",
        receitaReal: 230,
        noitesReservadas: 2,
        resultadoRegistradoEm: new Date("2026-05-03T12:00:00.000Z"),
      });
      pricingDecisionSnapshotRepo.find!.mockResolvedValue([
        {
          id: "snapshot-1",
          targetDate: "2026-05-01",
          status: "suggested",
          selectedPriceCents: 11500,
          expectedRevenueCents: 22000,
          expectedIncrementalRevenueCents: 2000,
          inputSignals: {
            auditTrailVersion: "pricing-decision-audit-v0",
            generatedFrom: "pricing-calculate.service",
            relationIds: {
              analisePrecoId: "analysis-1",
            },
            selectedScenario: {
              scenario: "recommended",
              priceCents: 11500,
              multiplier: 1.15,
              bookingProbability: 0.62,
              expectedRevenueCents: 22000,
              expectedIncrementalRevenueCents: 2000,
            },
          },
          riskFlags: [],
        },
      ]);

      const result = await service.pushPrice("u1", {
        listingId: "l-1",
        targetDate: "2026-05-01",
        previousPriceCents: 10000,
        newPriceCents: 11500,
        origin: "ai_auto",
        analisePrecoId: "analysis-1",
      });

      expect(result.status).toBe("success");
      expect(pricingDecisionSnapshotRepo.save).toHaveBeenCalledTimes(2);
      expect(pricingDecisionSnapshotRepo.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          id: "snapshot-1",
          status: "applied",
          appliedPriceCents: 11500,
          priceUpdate: expect.objectContaining({
            id: "pu-1",
            status: "success",
            origin: "ai_auto",
          }),
          inputSignals: expect.objectContaining({
            outcome: expect.objectContaining({
              decisionStatus: "applied",
              status: "booked",
              appliedPriceCents: 11500,
              realizedRevenueCents: 23000,
              bookedNights: 2,
              reservationGenerated: true,
              priceAbsorbed: true,
              source: "price_update",
              sourceDetail: "ai_auto",
              priceUpdateId: "pu-1",
              priceUpdateStatus: "success",
              revenueDeltaCents: 1000,
            }),
          }),
        }),
      );
    });

    it("honors custom caps set on the account", async () => {
      withActiveAccount({ maxIncreasePercent: 50, maxDecreasePercent: 40 });
      withListing();
      priceUpdateRepo.findOne!.mockResolvedValue(null);
      connector.pushPrice.mockResolvedValue({ ok: true });

      // +40% seria bloqueado com teto padrão 25%, mas não com teto custom 50%
      const result = await service.pushPrice("u1", {
        listingId: "l-1",
        targetDate: "2026-05-01",
        previousPriceCents: 10000,
        newPriceCents: 14000,
        origin: "ai_auto",
      });

      expect(result.status).toBe("success");
    });

    it("skips the caps when previousPriceCents is zero (no baseline)", async () => {
      withActiveAccount();
      withListing("l-1", 0);
      priceUpdateRepo.findOne!.mockResolvedValue(null);
      connector.pushPrice.mockResolvedValue({ ok: true });

      // Não temos preço anterior para comparar — aceita qualquer valor novo.
      const result = await service.pushPrice("u1", {
        listingId: "l-1",
        targetDate: "2026-05-01",
        previousPriceCents: 0,
        newPriceCents: 50000,
        origin: "user_manual",
      });

      expect(result.status).toBe("success");
    });
  });

  describe("pushPrice — idempotência", () => {
    it("returns the existing PriceUpdate when idempotency key matches", async () => {
      accountRepo.findOne!.mockResolvedValue({
        id: "acc-1",
        user: { id: "u1" },
        accessToken: "t",
        status: "active",
        consentAcceptedAt: new Date("2026-05-01T00:00:00.000Z"),
        consentVersion: "stays-connect-v1",
        maxIncreasePercent: 25,
        maxDecreasePercent: 20,
      });
      listingRepo.findOne!.mockResolvedValue({
        id: "l-1",
        staysListingId: "stays-l-1",
        account: { id: "acc-1" },
        active: true,
      });

      const previousRecord = {
        id: "pu-previous",
        status: "success",
        targetDate: "2026-05-01",
        newPriceCents: 11500,
      };
      priceUpdateRepo.findOne!.mockResolvedValue(previousRecord);

      const result = await service.pushPrice("u1", {
        listingId: "l-1",
        targetDate: "2026-05-01",
        previousPriceCents: 10000,
        newPriceCents: 11500,
        origin: "ai_auto",
      });

      expect(result).toBe(previousRecord);
      expect(connector.pushPrice).not.toHaveBeenCalled();
      expect(priceUpdateRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("pushPrice — connector failures", () => {
    it("marks PriceUpdate as rejected when Stays returns ok=false", async () => {
      accountRepo.findOne!.mockResolvedValue({
        id: "acc-1",
        user: { id: "u1" },
        accessToken: "t",
        status: "active",
        consentAcceptedAt: new Date("2026-05-01T00:00:00.000Z"),
        consentVersion: "stays-connect-v1",
        maxIncreasePercent: 25,
        maxDecreasePercent: 20,
      });
      listingRepo.findOne!.mockResolvedValue({
        id: "l-1",
        staysListingId: "stays-l-1",
        account: { id: "acc-1" },
        active: true,
      });
      priceUpdateRepo.findOne!.mockResolvedValue(null);
      connector.pushPrice.mockResolvedValue({
        ok: false,
        rejectedReason: "listing inactive",
      });

      const result = await service.pushPrice("u1", {
        listingId: "l-1",
        targetDate: "2026-05-01",
        previousPriceCents: 10000,
        newPriceCents: 11500,
        origin: "ai_auto",
      });

      expect(result.status).toBe("rejected");
      expect(result.errorMessage).toBe("listing inactive");
    });

    it("marks account as error when connector throws (network/5xx)", async () => {
      const account = {
        id: "acc-1",
        user: { id: "u1" },
        accessToken: "t",
        status: "active",
        consentAcceptedAt: new Date("2026-05-01T00:00:00.000Z"),
        consentVersion: "stays-connect-v1",
        maxIncreasePercent: 25,
        maxDecreasePercent: 20,
        lastErrorAt: null,
        lastErrorMessage: null,
      };
      accountRepo.findOne!.mockResolvedValue(account);
      listingRepo.findOne!.mockResolvedValue({
        id: "l-1",
        staysListingId: "stays-l-1",
        account: { id: "acc-1" },
        active: true,
      });
      priceUpdateRepo.findOne!.mockResolvedValue(null);
      connector.pushPrice.mockRejectedValue(new Error("ECONNRESET"));

      await expect(
        service.pushPrice("u1", {
          listingId: "l-1",
          targetDate: "2026-05-01",
          previousPriceCents: 10000,
          newPriceCents: 11500,
          origin: "ai_auto",
        }),
      ).rejects.toThrow();

      // A conta foi marcada como error
      const accountSaves = accountRepo.save!.mock.calls.map((c) => c[0]);
      expect(accountSaves.some((a) => a.status === "error")).toBe(true);
      expect(priceUpdateRepo.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "error",
          errorMessage: "ECONNRESET",
        }),
      );
    });

    it("rejects when listing is inactive", async () => {
      accountRepo.findOne!.mockResolvedValue({
        id: "acc-1",
        user: { id: "u1" },
        accessToken: "t",
        status: "active",
        consentAcceptedAt: new Date("2026-05-01T00:00:00.000Z"),
        consentVersion: "stays-connect-v1",
        maxIncreasePercent: 25,
        maxDecreasePercent: 20,
      });
      listingRepo.findOne!.mockResolvedValue({
        id: "l-1",
        staysListingId: "stays-l-1",
        account: { id: "acc-1" },
        active: false, // inativo
      });

      await expect(
        service.pushPrice("u1", {
          listingId: "l-1",
          targetDate: "2026-05-01",
          previousPriceCents: 10000,
          newPriceCents: 11500,
          origin: "ai_auto",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects when account is not active (disconnected/pending/error)", async () => {
      accountRepo.findOne!.mockResolvedValue({
        id: "acc-1",
        user: { id: "u1" },
        status: "disconnected",
      });

      await expect(
        service.pushPrice("u1", {
          listingId: "l-1",
          targetDate: "2026-05-01",
          previousPriceCents: 10000,
          newPriceCents: 11500,
          origin: "ai_auto",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
  describe("local safety contracts", () => {
    const activeAccount = (overrides: Record<string, unknown> = {}) => ({
      id: "acc-1",
      user: { id: "u1" },
      accessToken: "token",
      status: "active",
      consentAcceptedAt: new Date("2026-05-01T00:00:00.000Z"),
      consentVersion: "stays-connect-v1",
      maxIncreasePercent: 25,
      maxDecreasePercent: 20,
      ...overrides,
    });

    const activeListing = () => ({
      id: "l-1",
      staysListingId: "stays-l-1",
      title: "Apto Centro",
      account: { id: "acc-1" },
      active: true,
      basePriceCents: 10000,
    });

    it("shows missing versioned consent as a preview blocker", async () => {
      accountRepo.findOne!.mockResolvedValue(
        activeAccount({
          consentAcceptedAt: null,
          consentVersion: null,
        }),
      );
      listingRepo.findOne!.mockResolvedValue(activeListing());
      priceUpdateRepo.findOne!.mockResolvedValue(null);

      const result = await service.previewPrice("u1", {
        listingId: "l-1",
        targetDate: "2026-08-01",
        previousPriceCents: 10000,
        newPriceCents: 11000,
      });

      expect(result.readyForPush).toBe(false);
      expect(result.blockers).toContainEqual(
        expect.objectContaining({ code: "consent_missing" }),
      );
      expect(connector.pushPrice).not.toHaveBeenCalled();
    });

    it("fails closed before a push when versioned consent is missing", async () => {
      accountRepo.findOne!.mockResolvedValue(
        activeAccount({ consentVersion: "" }),
      );

      await expect(
        service.pushPrice("u1", {
          listingId: "l-1",
          targetDate: "2026-08-01",
          previousPriceCents: 10000,
          newPriceCents: 11000,
          origin: "user_accepted",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(listingRepo.findOne).not.toHaveBeenCalled();
      expect(connector.pushPrice).not.toHaveBeenCalled();
    });

    it.each([
      [{ targetDate: "2026-02-30" }, "invalid date"],
      [{ newPriceCents: 0 }, "non-positive new price"],
      [{ previousPriceCents: -1 }, "negative rollback baseline"],
    ])(
      "rejects invalid input before creating an audit record: %s (%s)",
      async (override, _label) => {
        accountRepo.findOne!.mockResolvedValue(activeAccount());
        listingRepo.findOne!.mockResolvedValue(activeListing());

        await expect(
          service.pushPrice("u1", {
            listingId: "l-1",
            targetDate: "2026-08-01",
            previousPriceCents: 10000,
            newPriceCents: 11000,
            origin: "user_manual",
            ...override,
          }),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(priceUpdateRepo.save).not.toHaveBeenCalled();
        expect(connector.pushPrice).not.toHaveBeenCalled();
      },
    );

    it("recovers a concurrent unique-key race without a duplicate external push", async () => {
      const concurrent = {
        id: "pu-concurrent",
        status: "pending",
        analise: null,
      };
      accountRepo.findOne!.mockResolvedValue(activeAccount());
      listingRepo.findOne!.mockResolvedValue(activeListing());
      priceUpdateRepo
        .findOne!.mockResolvedValueOnce(null)
        .mockResolvedValueOnce(concurrent);
      priceUpdateRepo.save!.mockRejectedValueOnce({
        code: "ER_DUP_ENTRY",
        errno: 1062,
        message: "Duplicate entry for idempotencyKey",
      });

      await expect(
        service.pushPrice("u1", {
          listingId: "l-1",
          targetDate: "2026-08-01",
          previousPriceCents: 10000,
          newPriceCents: 11000,
          origin: "ai_auto",
        }),
      ).resolves.toBe(concurrent);

      expect(connector.pushPrice).not.toHaveBeenCalled();
    });

    it("creates an inverse, owner-scoped rollback with audit metadata", async () => {
      const original = {
        id: "pu-original",
        status: "success",
        targetDate: "2026-08-01",
        previousPriceCents: 10000,
        newPriceCents: 11500,
        currency: "BRL",
        listing: { id: "l-1", account: { id: "acc-1" } },
      };
      const rollback = {
        id: "pu-rollback",
        status: "success",
        origin: "rollback",
      } as any;
      priceUpdateRepo.findOne!.mockResolvedValue(original);
      const push = jest.spyOn(service, "pushPrice").mockResolvedValue(rollback);

      await expect(
        service.rollback("u1", "pu-original", {
          ip: "127.0.0.1",
          userAgent: "jest",
        }),
      ).resolves.toEqual(expect.objectContaining({ rollbackOf: original }));

      expect(priceUpdateRepo.findOne).toHaveBeenCalledWith({
        where: { id: "pu-original", user: { id: "u1" } },
        relations: ["listing", "listing.account"],
      });
      expect(push).toHaveBeenCalledWith("u1", {
        listingId: "l-1",
        targetDate: "2026-08-01",
        newPriceCents: 10000,
        previousPriceCents: 11500,
        currency: "BRL",
        origin: "rollback",
        ip: "127.0.0.1",
        userAgent: "jest",
      });
      expect(priceUpdateRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: "pu-rollback", rollbackOf: original }),
      );
    });

    it("rejects rollback of a push that was not successful", async () => {
      priceUpdateRepo.findOne!.mockResolvedValue({
        id: "pu-error",
        status: "error",
      });
      const push = jest.spyOn(service, "pushPrice");

      await expect(service.rollback("u1", "pu-error")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(push).not.toHaveBeenCalled();
    });
  });

  describe("account, listing and helper coverage", () => {
    const account = (overrides: Record<string, unknown> = {}) => ({
      id: "acc-1",
      user: { id: "u1" },
      accessToken: "token",
      status: "active",
      consentAcceptedAt: new Date("2026-05-01T00:00:00.000Z"),
      consentVersion: "v1",
      maxIncreasePercent: 25,
      maxDecreasePercent: 20,
      ...overrides,
    });

    const listing = (overrides: Record<string, unknown> = {}) => ({
      id: "l-1",
      staysListingId: "remote-1",
      title: "Apto",
      shortAddress: "Centro",
      account: { id: "acc-1" },
      active: true,
      basePriceCents: 10000,
      ...overrides,
    });

    it("rejects connecting an unknown user", async () => {
      userRepo.findOne!.mockResolvedValue(null);
      await expect(
        service.connectAccount("missing", {
          clientId: "c",
          accessToken: "t",
          consentAccepted: true,
          consentVersion: "v1",
        }),
      ).rejects.toThrow();
      expect(connector.ping).not.toHaveBeenCalled();
    });

    it("normalizes array user agents and bounds consent metadata", async () => {
      userRepo.findOne!.mockResolvedValue({ id: "u1" });
      accountRepo.findOne!.mockResolvedValue(null);
      connector.ping.mockResolvedValue(true);

      await service.connectAccount("u1", {
        clientId: "c",
        accessToken: "t",
        consentAccepted: true,
        consentVersion: " v2 ",
        ip: "x".repeat(80),
        userAgent: ["first", "second"],
      });

      expect(accountRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          consentVersion: "v2",
          consentIp: "x".repeat(64),
          consentUserAgent: "first second",
        }),
      );
    });

    it("disconnects an existing account and treats missing accounts as idempotent", async () => {
      const connected = account();
      accountRepo
        .findOne!.mockResolvedValueOnce(connected)
        .mockResolvedValueOnce(null);

      await service.disconnectAccount("u1");
      await service.disconnectAccount("u1");

      expect(accountRepo.save).toHaveBeenCalledTimes(1);
      expect(accountRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: "disconnected", accessToken: "" }),
      );
    });

    it("returns the account and lists no properties for a disconnected profile", async () => {
      const connected = account();
      accountRepo
        .findOne!.mockResolvedValueOnce(connected)
        .mockResolvedValueOnce(null);

      await expect(service.getAccount("u1")).resolves.toBe(connected);
      await expect(service.listListingsForUser("u1")).resolves.toEqual([]);
      expect(listingRepo.find).not.toHaveBeenCalled();
    });

    it("lists owner-scoped properties for a connected account", async () => {
      accountRepo.findOne!.mockResolvedValue(account());
      listingRepo.find!.mockResolvedValue([listing()]);

      await expect(service.listListingsForUser("u1")).resolves.toHaveLength(1);
      expect(listingRepo.find).toHaveBeenCalledWith({
        where: { account: { id: "acc-1" } },
        relations: ["propriedade"],
      });
    });

    it("rejects listing sync without an active account", async () => {
      accountRepo.findOne!.mockResolvedValue(
        account({ status: "disconnected" }),
      );
      await expect(service.syncListings("u1")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(connector.listListings).not.toHaveBeenCalled();
    });

    it("fails listing sync closed when the provider base URL is absent", async () => {
      delete process.env.STAYS_API_BASE_URL;
      accountRepo.findOne!.mockResolvedValue(account());
      await expect(service.syncListings("u1")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(connector.listListings).not.toHaveBeenCalled();
    });

    it("creates new listings and updates existing ones during synchronization", async () => {
      const connected = account();
      const existing = listing({ title: "Antigo", active: false });
      accountRepo.findOne!.mockResolvedValue(connected);
      connector.listListings.mockResolvedValue([
        {
          listingId: "remote-1",
          title: "Atualizado",
          address: "Praia",
          basePriceCents: 12000,
          active: true,
        },
        {
          listingId: "remote-2",
          title: "Novo",
          address: null,
          basePriceCents: null,
          active: true,
        },
      ]);
      listingRepo.find!.mockResolvedValue([existing]);

      const result = await service.syncListings("u1");

      expect(result).toHaveLength(2);
      expect(existing).toMatchObject({
        title: "Atualizado",
        shortAddress: "Praia",
        basePriceCents: 12000,
        active: true,
      });
      expect(listingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          staysListingId: "remote-2",
          account: connected,
        }),
      );
      expect(accountRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ lastSyncAt: expect.any(Date) }),
      );
    });

    it("covers preview failure and warning branches without provider writes", async () => {
      accountRepo.findOne!.mockResolvedValue(
        account({ status: "error", consentAcceptedAt: null }),
      );
      listingRepo.findOne!.mockResolvedValue(
        listing({ active: false, basePriceCents: null }),
      );

      const result = await service.previewPrice("u1", {
        listingId: "l-1",
        targetDate: "2026-02-30",
        newPriceCents: 0,
      });

      expect(result.readyForPush).toBe(false);
      expect(result.diffPercent).toBeNull();
      expect(result.blockers.map((issue) => issue.code)).toEqual(
        expect.arrayContaining([
          "account_not_active",
          "consent_missing",
          "listing_inactive",
          "invalid_target_date",
          "invalid_new_price",
        ]),
      );
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: "missing_previous_price" }),
      );
      expect(priceUpdateRepo.findOne).not.toHaveBeenCalled();
    });

    it("rejects previews for missing accounts and foreign listings", async () => {
      accountRepo
        .findOne!.mockResolvedValueOnce(null)
        .mockResolvedValueOnce(account());
      await expect(
        service.previewPrice("u1", {
          listingId: "l-1",
          targetDate: "2026-08-01",
          newPriceCents: 10000,
        }),
      ).rejects.toThrow();
      listingRepo.findOne!.mockResolvedValue(null);
      await expect(
        service.previewPrice("u1", {
          listingId: "foreign",
          targetDate: "2026-08-01",
          newPriceCents: 10000,
        }),
      ).rejects.toThrow();
    });

    it("rejects pushes for missing accounts and foreign listings", async () => {
      const input = {
        listingId: "l-1",
        targetDate: "2026-08-01",
        previousPriceCents: 10000,
        newPriceCents: 11000,
        origin: "user_manual" as const,
      };
      accountRepo
        .findOne!.mockResolvedValueOnce(null)
        .mockResolvedValueOnce(account());
      await expect(service.pushPrice("u1", input)).rejects.toThrow();
      listingRepo.findOne!.mockResolvedValue(null);
      await expect(service.pushPrice("u1", input)).rejects.toThrow();
      expect(priceUpdateRepo.create).not.toHaveBeenCalled();
    });

    it("rethrows non-duplicate persistence errors and races with no surviving row", async () => {
      const input = {
        listingId: "l-1",
        targetDate: "2026-08-01",
        previousPriceCents: 10000,
        newPriceCents: 11000,
        origin: "user_manual" as const,
      };
      accountRepo.findOne!.mockResolvedValue(account());
      listingRepo.findOne!.mockResolvedValue(listing());
      priceUpdateRepo.findOne!.mockResolvedValue(null);
      priceUpdateRepo.save!.mockRejectedValueOnce(new Error("disk full"));
      await expect(service.pushPrice("u1", input)).rejects.toThrow("disk full");

      jest.clearAllMocks();
      accountRepo.findOne!.mockResolvedValue(account());
      listingRepo.findOne!.mockResolvedValue(listing());
      priceUpdateRepo.findOne!.mockResolvedValue(null);
      priceUpdateRepo.create!.mockImplementation((data) => ({
        id: "pu-2",
        ...data,
      }));
      priceUpdateRepo.save!.mockRejectedValueOnce({ code: "ER_DUP_ENTRY" });
      await expect(service.pushPrice("u1", input)).rejects.toEqual({
        code: "ER_DUP_ENTRY",
      });
    });

    it("rejects rollback when the owner-scoped original is missing", async () => {
      priceUpdateRepo.findOne!.mockResolvedValue(null);
      await expect(service.rollback("u1", "missing")).rejects.toThrow();
    });

    it("records outcome against the target-date snapshot and tolerates audit failures", async () => {
      const matching = {
        id: "snap-match",
        targetDate: "2026-08-01",
        analisePreco: { id: "analysis-1" },
      };
      pricingDecisionSnapshotRepo.find!.mockResolvedValue([
        {
          id: "other",
          targetDate: "2026-08-02",
          analisePreco: { id: "analysis-1" },
        },
        matching,
      ]);
      analiseRepo.findOne!.mockResolvedValue({
        id: "analysis-1",
        precoSugerido: 110,
      });
      const outcome = {
        id: "pu-1",
        targetDate: "2026-08-01",
        origin: "user_accepted",
        createdAt: new Date(),
        analise: { id: "analysis-1" },
      } as any;
      jest
        .spyOn(
          (service as any).pricingCalculateService,
          "criarPatchOutcomeSnapshotDecisao",
        )
        .mockReturnValue({ appliedPriceCents: 11000 });

      await (service as any).recordPricingDecisionOutcome(outcome);
      expect(pricingDecisionSnapshotRepo.save).toHaveBeenCalledWith(matching);

      pricingDecisionSnapshotRepo.find!.mockRejectedValue(
        new Error("audit unavailable"),
      );
      await expect(
        (service as any).recordPricingDecisionOutcome(outcome),
      ).resolves.toBeUndefined();
    });

    it("returns early when an outcome has no analysis or snapshot", async () => {
      await expect(
        (service as any).recordPricingDecisionOutcome({
          id: "pu-no-analysis",
          analise: null,
        }),
      ).resolves.toBeUndefined();
      expect(pricingDecisionSnapshotRepo.find).not.toHaveBeenCalled();

      pricingDecisionSnapshotRepo.find!.mockResolvedValue([]);
      await expect(
        (service as any).recordPricingDecisionOutcome({
          id: "pu-no-snapshot",
          targetDate: "2026-08-01",
          analise: { id: "analysis-1" },
        }),
      ).resolves.toBeUndefined();
    });

    it("covers helper boundary contracts without external effects", () => {
      const subject = service as any;
      expect(subject.normalizeUserAgent(undefined)).toBeNull();
      expect(subject.normalizeUserAgent("agent")).toBe("agent");
      expect(subject.normalizeUserAgent(["a", "b"])).toBe("a b");
      expect(subject.normalizeUserAgent("x".repeat(300))).toHaveLength(255);

      expect(subject.isDuplicateKeyError({ code: "ER_DUP_ENTRY" })).toBe(true);
      expect(subject.isDuplicateKeyError({ errno: 1062 })).toBe(true);
      expect(
        subject.isDuplicateKeyError({ message: "unique constraint failed" }),
      ).toBe(true);
      expect(subject.isDuplicateKeyError({ message: "disk full" })).toBe(false);
      expect(subject.isDuplicateKeyError(null)).toBe(false);

      expect(subject.isValidTargetDate("2026-08-01")).toBe(true);
      expect(subject.isValidTargetDate("not-a-date")).toBe(false);
      expect(subject.isValidTargetDate("2026-02-30")).toBe(false);

      expect(subject.evaluateVariationCaps(0, 100, account())).toEqual({
        diffCents: 100,
        diffPercent: null,
        blockers: [],
      });
      expect(
        subject.evaluateVariationCaps(10000, 12500, account()).blockers,
      ).toEqual([]);
      expect(
        subject.evaluateVariationCaps(10000, 7500, account()).blockers,
      ).toEqual([expect.objectContaining({ code: "decrease_cap_exceeded" })]);
    });

    it("allows sync readiness without encryption but requires it for connection", () => {
      const subject = service as any;
      delete process.env.STAYS_TOKEN_ENCRYPTION_KEY;
      expect(() =>
        subject.assertStaysReadiness({ requireEncryptionKey: false }),
      ).not.toThrow();
      expect(() => subject.assertStaysReadiness()).toThrow(BadRequestException);
      process.env.STAYS_TOKEN_ENCRYPTION_KEY = "test-encryption-key";
    });
  });
});

describe("staysTokenTransformer", () => {
  const originalEncryptionKey = process.env.STAYS_TOKEN_ENCRYPTION_KEY;
  const originalAppEnv = process.env.APP_ENV;

  afterEach(() => {
    if (originalEncryptionKey === undefined) {
      delete process.env.STAYS_TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.STAYS_TOKEN_ENCRYPTION_KEY = originalEncryptionKey;
    }

    if (originalAppEnv === undefined) {
      delete process.env.APP_ENV;
    } else {
      process.env.APP_ENV = originalAppEnv;
    }
  });

  it("encrypts and decrypts a token when STAYS_TOKEN_ENCRYPTION_KEY is configured", () => {
    process.env.STAYS_TOKEN_ENCRYPTION_KEY = "test-encryption-key";
    process.env.APP_ENV = "test";

    const encrypted = staysTokenTransformer.to("stays-secret-token") as string;

    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain("stays-secret-token");
    expect(staysTokenTransformer.from(encrypted)).toBe("stays-secret-token");
  });

  it("keeps legacy plaintext readable when no key is configured", () => {
    delete process.env.STAYS_TOKEN_ENCRYPTION_KEY;
    process.env.APP_ENV = "test";

    expect(staysTokenTransformer.from("legacy-token")).toBe("legacy-token");
    expect(staysTokenTransformer.to("legacy-token")).toBe("legacy-token");
  });

  it("requires an encryption key to persist tokens in production", () => {
    delete process.env.STAYS_TOKEN_ENCRYPTION_KEY;
    process.env.APP_ENV = "production";

    expect(() => staysTokenTransformer.to("prod-token")).toThrow(
      "STAYS_TOKEN_ENCRYPTION_KEY is required",
    );
  });
});
