import { Injectable, Logger, Optional } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { StaysService } from "./stays.service";
import { StaysListing } from "../entities/stays-listing.entity";
import { AnalisePreco } from "../entities/AnalisePreco";
import { AdminJobRun } from "../entities/admin-job-run.entity";
import { runAdminJobWithTracking } from "../admin-job-runs/admin-job-run-tracker";
import {
  PricingDecisionSnapshot,
  PricingDecisionStatus,
} from "../entities/pricing-decision-snapshot.entity";
import { EventIntelligenceConfidence } from "../entities/event-intelligence-snapshot.entity";

interface StaysAutoApplyConfig {
  enabled: boolean;
  dryRun: boolean;
  allowedUserIds: Set<string>;
  allowedListingIds: Set<string>;
  cohort: string;
  requirePricingDecision: boolean;
  requireLiveAllowlists: boolean;
  minConfidence: EventIntelligenceConfidence;
  minBookingProbability: number;
  minRecommendedMultiplier: number;
  maxRecommendedMultiplier: number;
  blockedRiskFlags: Set<string>;
}

type StaysAutoApplyBatchResult = {
  processed: number;
  eligible: number;
  applied: number;
  dryRun: number;
  blocked: number;
  errors: number;
};

type StaysAutoApplyEligibility = {
  eligible: boolean;
  blockers: string[];
  warnings: string[];
  audit: StaysAutoApplyAuditContext;
};

type StaysAutoApplyAuditContext = {
  cohort: string;
  decisionSnapshotId: string | null;
  decisionStatus: PricingDecisionStatus | null;
  decisionIdempotencyKey: string | null;
  confidence: EventIntelligenceConfidence | null;
  bookingProbability: number | null;
  recommendedMultiplier: number | null;
  selectedPriceCents: number | null;
  recommendedPriceCents: number | null;
  previousPriceCents: number;
  newPriceCents: number;
  targetDate: string;
  riskFlags: string[];
  guardrails: PricingDecisionSnapshot["guardrails"] | null;
  rollbackReady: boolean;
};

/**
 * Cron do **modo autônomo**: aplica sugestões de preço aceitas pela IA
 * diretamente via Stays, sem confirmação humana.
 *
 * Regras de execução:
 *  1. Só processa imóveis cujo `effectiveOperationMode === 'auto'`
 *     (listing.operationMode = 'auto' OU
 *      listing.operationMode = 'inherit' && user.operationMode = 'auto')
 *  2. Só considera AnalisePreco com sugestão emitida nas últimas 24h que
 *     ainda não foi pushada (sem PriceUpdate correspondente).
 *  3. Chama StaysService.pushPrice com origin='ai_auto' — guardrails de
 *     variação e idempotência ficam no service.
 *
 * Frequência: hora em hora, 5 min após a hora cheia para dar tempo do
 * enrichment de eventos completar (`events-enrichment.service.ts` roda em
 * `0 * * * *`).
 */
@Injectable()
export class StaysAutoApplyService {
  private static readonly enabledEnv = "STAYS_AUTO_APPLY_ENABLED";
  private static readonly dryRunEnv = "STAYS_AUTO_APPLY_DRY_RUN";
  private static readonly userAllowlistEnv =
    "STAYS_AUTO_APPLY_ALLOWED_USER_IDS";
  private static readonly listingAllowlistEnv =
    "STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS";
  private static readonly userAllowlistAliasEnv =
    "STAYS_AUTO_APPLY_USER_ALLOWLIST";
  private static readonly listingAllowlistAliasEnv =
    "STAYS_AUTO_APPLY_LISTING_ALLOWLIST";
  private static readonly cohortEnv = "STAYS_AUTO_APPLY_COHORT";
  private static readonly requirePricingDecisionEnv =
    "STAYS_AUTO_APPLY_REQUIRE_PRICING_DECISION";
  private static readonly requireLiveAllowlistsEnv =
    "STAYS_AUTO_APPLY_REQUIRE_LIVE_ALLOWLISTS";
  private static readonly minConfidenceEnv = "STAYS_AUTO_APPLY_MIN_CONFIDENCE";
  private static readonly minBookingProbabilityEnv =
    "STAYS_AUTO_APPLY_MIN_BOOKING_PROBABILITY";
  private static readonly minMultiplierEnv =
    "STAYS_AUTO_APPLY_MIN_RECOMMENDED_MULTIPLIER";
  private static readonly maxMultiplierEnv =
    "STAYS_AUTO_APPLY_MAX_RECOMMENDED_MULTIPLIER";
  private static readonly blockedRiskFlagsEnv =
    "STAYS_AUTO_APPLY_BLOCKED_RISK_FLAGS";
  private static readonly defaultBlockedRiskFlags = [
    "low_confidence",
    "past_event",
    "property_unavailable",
    "property_unavailable_for_event_window",
    "previous_recommendation_rejected",
    "previous_recommendation_expired",
  ];

  private readonly logger = new Logger(StaysAutoApplyService.name);
  private isProcessing = false;

  constructor(
    @InjectRepository(StaysListing)
    private readonly listingRepo: Repository<StaysListing>,
    @InjectRepository(AnalisePreco)
    private readonly analiseRepo: Repository<AnalisePreco>,
    private readonly staysService: StaysService,
    @Optional()
    @InjectRepository(PricingDecisionSnapshot)
    private readonly pricingDecisionSnapshotRepo?: Repository<PricingDecisionSnapshot>,
    @Optional()
    @InjectRepository(AdminJobRun)
    private readonly jobRunRepo?: Repository<AdminJobRun>,
  ) {}

  @Cron("5 * * * *", {
    name: "stays-auto-apply",
    timeZone: "America/Sao_Paulo",
    waitForCompletion: true,
  })
  async handleCron() {
    if (this.isProcessing) {
      this.logger.debug(
        "Stays auto-apply ainda em execução; pulando este tick.",
      );
      return;
    }
    this.isProcessing = true;
    try {
      await this.runCronWithTracking("stays-auto-apply", () =>
        this.processBatch(),
      );
    } catch (err) {
      this.logger.error("Erro geral no stays-auto-apply", err);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Em vez de um único SELECT complexo, fazemos 2 queries bem indexadas:
   *  (a) pega todos os listings em modo auto-efetivo
   *  (b) para cada um, pega a última AnalisePreco não aplicada
   *
   * Isso mantém o código testável e o volume é pequeno (anfitrião típico
   * tem 1–10 imóveis; o modo auto será minoria no início).
   */
  async processBatch(): Promise<StaysAutoApplyBatchResult> {
    const config = this.getConfig();
    if (!config.enabled) {
      this.logger.log(
        `Stays auto-apply disabled: ${StaysAutoApplyService.enabledEnv} is not true; no prices will be pushed.`,
      );
      return {
        processed: 0,
        eligible: 0,
        applied: 0,
        dryRun: 0,
        blocked: 0,
        errors: 0,
      };
    }

    const autoListings = await this.findAutoModeListings();
    let eligible = 0;
    let applied = 0;
    let dryRun = 0;
    let blocked = 0;
    let errors = 0;

    for (const listing of autoListings) {
      const allowlist = this.allowlistDecision(listing, config);
      if (allowlist.blockers.length > 0) {
        blocked++;
        this.logBlockedAutoApply(
          listing,
          null,
          allowlist.blockers,
          allowlist.warnings,
        );
        continue;
      }

      const analise = await this.findPendingAnalise(listing);
      if (!analise) continue;

      try {
        const userId = listing.account?.user?.id;
        if (!userId) {
          this.logger.warn(
            `Stays auto-apply listing=${listing.id} sem userId; pulando.`,
          );
          continue;
        }

        const previousPriceCents =
          this.moneyToCents(analise.seuPrecoAtual) ??
          this.toIntegerCents(listing.basePriceCents) ??
          0;
        const newPriceCents = this.moneyToCents(analise.precoSugerido) ?? 0;
        if (newPriceCents <= 0 || previousPriceCents <= 0) {
          blocked++;
          this.logBlockedAutoApply(
            listing,
            analise,
            ["invalid_price_or_missing_rollback_baseline"],
            [],
          );
          this.logger.warn(
            `Preços inválidos na AnalisePreco ${analise.id}; pulando.`,
          );
          continue;
        }

        // A data-alvo é o dia do evento que originou a recomendação.
        // Se o evento tiver múltiplos dias, usamos o dataInicio.
        const targetDate = this.toDateStr(
          analise.evento?.dataInicio ?? new Date(),
        );
        const eligibility = await this.evaluateEligibility({
          listing,
          analise,
          targetDate,
          previousPriceCents,
          newPriceCents,
          config,
        });

        if (!eligibility.eligible) {
          blocked++;
          this.logBlockedAutoApply(
            listing,
            analise,
            eligibility.blockers,
            eligibility.warnings,
            eligibility.audit,
          );
          continue;
        }

        eligible++;

        if (config.dryRun) {
          dryRun++;
          this.logger.log(
            `Stays auto-apply dry-run: would push user=${userId} listing=${listing.id} staysListing=${listing.staysListingId} targetDate=${targetDate} previousPriceCents=${previousPriceCents} newPriceCents=${newPriceCents} analise=${analise.id} audit=${this.safeAuditJson(eligibility.audit)}.`,
          );
          continue;
        }

        // Re-read the emergency switch immediately before each external write.
        // This lets operations stop a batch that is already iterating.
        if (!this.parseBooleanEnv(StaysAutoApplyService.enabledEnv)) {
          blocked++;
          this.logBlockedAutoApply(
            listing,
            analise,
            ["auto_apply_kill_switch_disabled_during_batch"],
            eligibility.warnings,
            eligibility.audit,
          );
          continue;
        }

        await this.staysService.pushPrice(userId, {
          listingId: listing.id,
          targetDate,
          newPriceCents,
          previousPriceCents,
          currency: "BRL",
          origin: "ai_auto",
          analisePrecoId: analise.id,
          userAgent: this.buildAuditUserAgent(eligibility.audit),
        });
        applied++;
      } catch (err) {
        errors++;
        this.logger.warn(
          `Falha no auto-apply listing=${listing.id} analise=${analise.id}: ${(err as Error).message}`,
        );
      }
    }

    if (eligible > 0 || blocked > 0 || applied > 0 || errors > 0) {
      this.logger.log(
        `Stays auto-apply: processados=${autoListings.length} elegíveis=${eligible} dryRun=${dryRun} bloqueados=${blocked} aplicados=${applied} erros=${errors}`,
      );
    }
    return {
      processed: autoListings.length,
      eligible,
      applied,
      dryRun,
      blocked,
      errors,
    };
  }

  private getConfig(): StaysAutoApplyConfig {
    const config: StaysAutoApplyConfig = {
      enabled: this.parseBooleanEnv(StaysAutoApplyService.enabledEnv),
      dryRun: this.parseBooleanEnv(StaysAutoApplyService.dryRunEnv),
      allowedUserIds: this.parseListEnv(
        StaysAutoApplyService.userAllowlistEnv,
        StaysAutoApplyService.userAllowlistAliasEnv,
      ),
      allowedListingIds: this.parseListEnv(
        StaysAutoApplyService.listingAllowlistEnv,
        StaysAutoApplyService.listingAllowlistAliasEnv,
      ),
      cohort:
        process.env[StaysAutoApplyService.cohortEnv]?.trim() ||
        "event-safe-beta",
      requirePricingDecision: this.parseBooleanEnvDefault(
        StaysAutoApplyService.requirePricingDecisionEnv,
        true,
      ),
      requireLiveAllowlists: this.parseBooleanEnvDefault(
        StaysAutoApplyService.requireLiveAllowlistsEnv,
        true,
      ),
      minConfidence: this.parseConfidenceEnv(
        StaysAutoApplyService.minConfidenceEnv,
        "medium",
      ),
      minBookingProbability: this.parseNumberEnv(
        StaysAutoApplyService.minBookingProbabilityEnv,
        0.45,
        0,
        1,
      ),
      minRecommendedMultiplier: this.parseNumberEnv(
        StaysAutoApplyService.minMultiplierEnv,
        1,
        0.5,
        3,
      ),
      maxRecommendedMultiplier: this.parseNumberEnv(
        StaysAutoApplyService.maxMultiplierEnv,
        1.25,
        0.5,
        3,
      ),
      blockedRiskFlags: this.parseListEnv(
        StaysAutoApplyService.blockedRiskFlagsEnv,
      ),
    };
    if (config.blockedRiskFlags.size === 0) {
      config.blockedRiskFlags = new Set(
        StaysAutoApplyService.defaultBlockedRiskFlags,
      );
    }
    return config;
  }

  private async runCronWithTracking<T>(
    name: string,
    handler: () => Promise<T>,
  ): Promise<T> {
    if (!this.jobRunRepo) return handler();
    const run = await runAdminJobWithTracking(
      this.jobRunRepo,
      name,
      null,
      handler,
    );
    return run.result as T;
  }

  private allowlistDecision(
    listing: StaysListing,
    config: StaysAutoApplyConfig,
  ): { blockers: string[]; warnings: string[] } {
    const blockers: string[] = [];
    const userId = listing.account?.user?.id;
    if (
      config.allowedUserIds.size > 0 &&
      (!userId || !config.allowedUserIds.has(userId))
    ) {
      blockers.push("user_not_allowlisted");
    }

    const listingIds = [listing.id, listing.staysListingId].filter(Boolean);
    if (
      config.allowedListingIds.size > 0 &&
      !listingIds.some((listingId) => config.allowedListingIds.has(listingId))
    ) {
      blockers.push("listing_not_allowlisted");
    }

    return { blockers, warnings: [] };
  }

  private async findAutoModeListings(): Promise<StaysListing[]> {
    // Pega listings cujo operationMode seja auto OU inherit (e então filtra por user).
    const all = await this.listingRepo.find({
      where: { active: true },
      relations: ["account", "account.user", "propriedade"],
    });
    return all.filter((l) => {
      if (l.account?.status !== "active") return false;
      if (l.operationMode === "auto") return true;
      if (l.operationMode === "inherit") {
        return (l.account as any)?.user?.operationMode === "auto";
      }
      return false;
    });
  }

  private async findPendingAnalise(
    listing: StaysListing,
  ): Promise<AnalisePreco | null> {
    if (!listing.propriedade) return null;
    // Busca a análise mais recente (<=24h) sem push correspondente.
    // AnalisePreco é ligada a `endereco` (Address), que por sua vez referencia
    // List. Filtramos pela propriedade (list_id) via join no address.
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const candidate = await this.analiseRepo
      .createQueryBuilder("ap")
      .leftJoinAndSelect("ap.evento", "evento")
      .leftJoin("ap.endereco", "addr")
      .leftJoin(
        "price_updates",
        "pu",
        "pu.analise_preco_id = ap.id AND pu.status = :success",
        { success: "success" },
      )
      .where("addr.list_id = :listId", { listId: listing.propriedade.id })
      .andWhere("ap.criado_em >= :cutoff", { cutoff })
      .andWhere("ap.aceito = :aceito", { aceito: true })
      .andWhere("pu.id IS NULL")
      .orderBy("ap.criado_em", "DESC")
      .limit(1)
      .getOne();
    return candidate || null;
  }

  private async evaluateEligibility(input: {
    listing: StaysListing;
    analise: AnalisePreco;
    targetDate: string;
    previousPriceCents: number;
    newPriceCents: number;
    config: StaysAutoApplyConfig;
  }): Promise<StaysAutoApplyEligibility> {
    const {
      listing,
      analise,
      targetDate,
      previousPriceCents,
      newPriceCents,
      config,
    } = input;
    const blockers: string[] = [];
    const warnings: string[] = [];
    const decision = await this.findLatestPricingDecisionSnapshot(analise);
    const riskFlags = this.riskFlagsFromDecision(decision);
    const selectedScenario = decision?.inputSignals?.selectedScenario ?? null;
    const bookingProbability =
      this.toDecimal(decision?.bookingProbability) ??
      this.toDecimal(selectedScenario?.bookingProbability);
    const recommendedMultiplier =
      this.toDecimal(decision?.recommendedMultiplier) ??
      this.toDecimal(selectedScenario?.multiplier) ??
      this.multiplierFromPrices(newPriceCents, previousPriceCents);
    const selectedPriceCents =
      this.toIntegerCents(decision?.selectedPriceCents) ??
      this.toIntegerCents(selectedScenario?.priceCents);
    const recommendedPriceCents = this.toIntegerCents(
      decision?.recommendedPriceCents,
    );
    const decisionIdempotencyKey =
      typeof decision?.inputSignals?.idempotencyKey === "string"
        ? decision.inputSignals.idempotencyKey
        : null;
    const audit: StaysAutoApplyAuditContext = {
      cohort: config.cohort,
      decisionSnapshotId: decision?.id ?? null,
      decisionStatus: decision?.status ?? null,
      decisionIdempotencyKey,
      confidence: decision?.confidence ?? null,
      bookingProbability,
      recommendedMultiplier,
      selectedPriceCents,
      recommendedPriceCents,
      previousPriceCents,
      newPriceCents,
      targetDate,
      riskFlags,
      guardrails: decision?.guardrails ?? null,
      rollbackReady: previousPriceCents > 0,
    };

    if (
      !listing.account?.consentAcceptedAt ||
      !listing.account?.consentVersion
    ) {
      blockers.push("missing_stays_auto_apply_consent");
    }

    if (!audit.rollbackReady) blockers.push("missing_rollback_baseline");
    if (!this.isValidTargetDate(targetDate))
      blockers.push("invalid_target_date");

    if (!config.dryRun && config.requireLiveAllowlists) {
      if (config.allowedUserIds.size === 0)
        blockers.push("missing_user_allowlist_for_live_cohort");
      if (config.allowedListingIds.size === 0)
        blockers.push("missing_listing_allowlist_for_live_cohort");
    }

    if (!decision) {
      if (config.requirePricingDecision)
        blockers.push("missing_pricing_decision_snapshot");
    } else {
      if (!this.isSafeDecisionStatus(decision.status)) {
        blockers.push(`unsafe_pricing_decision_status:${decision.status}`);
      }

      if (
        decision.appliedPriceCents !== null &&
        decision.appliedPriceCents !== undefined
      ) {
        blockers.push("pricing_decision_already_has_applied_price");
      }

      if (
        this.confidenceRank(decision.confidence) <
        this.confidenceRank(config.minConfidence)
      ) {
        blockers.push(`confidence_below_${config.minConfidence}`);
      }

      if (bookingProbability === null) {
        blockers.push("missing_booking_probability");
      } else if (bookingProbability < config.minBookingProbability) {
        blockers.push("booking_probability_below_floor");
      }

      if (recommendedMultiplier === null) {
        blockers.push("missing_recommended_multiplier");
      } else {
        if (recommendedMultiplier < config.minRecommendedMultiplier) {
          blockers.push("recommended_multiplier_below_floor");
        }
        if (recommendedMultiplier > config.maxRecommendedMultiplier) {
          blockers.push("recommended_multiplier_above_ceiling");
        }
      }

      const decisionPriceCents = selectedPriceCents ?? recommendedPriceCents;
      if (decisionPriceCents === null) {
        warnings.push("missing_decision_price_for_audit");
      } else if (newPriceCents > Math.round(decisionPriceCents * 1.01)) {
        blockers.push("new_price_above_audited_decision_price");
      }

      if (!decisionIdempotencyKey)
        warnings.push("missing_pricing_decision_idempotency_key");
      if (decision.guardrails?.cappedRecommendedPrice)
        warnings.push("recommendation_capped_by_guardrail");
    }

    for (const flag of riskFlags) {
      if (config.blockedRiskFlags.has(flag))
        blockers.push(`blocked_risk_flag:${flag}`);
    }

    return {
      eligible: blockers.length === 0,
      blockers: this.unique(blockers),
      warnings: this.unique(warnings),
      audit,
    };
  }

  private async findLatestPricingDecisionSnapshot(
    analise: AnalisePreco,
  ): Promise<PricingDecisionSnapshot | null> {
    if (!this.pricingDecisionSnapshotRepo) return null;
    try {
      const snapshots = await this.pricingDecisionSnapshotRepo.find({
        where: { analisePreco: { id: analise.id } } as any,
        relations: {
          eventPropertyImpact: true,
          priceUpdate: true,
        } as any,
        order: {
          generatedAt: "DESC",
          createdAt: "DESC",
        } as any,
        take: 5,
      });
      return snapshots[0] ?? null;
    } catch (err) {
      this.logger.warn(
        `Stays auto-apply não conseguiu carregar PricingDecisionSnapshot analise=${analise.id}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private logBlockedAutoApply(
    listing: StaysListing,
    analise: AnalisePreco | null,
    blockers: string[],
    warnings: string[],
    audit?: StaysAutoApplyAuditContext,
  ) {
    const userId = listing.account?.user?.id ?? "unknown";
    this.logger.warn(
      `Stays auto-apply blocked user=${userId} listing=${listing.id} staysListing=${listing.staysListingId} analise=${analise?.id ?? "none"} blockers=${this.unique(blockers).join(",")} warnings=${this.unique(warnings).join(",") || "none"}${audit ? ` audit=${this.safeAuditJson(audit)}` : ""}.`,
    );
  }

  private buildAuditUserAgent(audit: StaysAutoApplyAuditContext): string {
    return [
      "urban-ai-auto-apply/1",
      `cohort=${audit.cohort}`,
      `decision=${audit.decisionSnapshotId ?? "none"}`,
      `confidence=${audit.confidence ?? "unknown"}`,
      `multiplier=${audit.recommendedMultiplier ?? "unknown"}`,
      `probability=${audit.bookingProbability ?? "unknown"}`,
      `rollback=${audit.rollbackReady ? "ready" : "blocked"}`,
    ]
      .join("; ")
      .slice(0, 255);
  }

  private riskFlagsFromDecision(
    decision?: PricingDecisionSnapshot | null,
  ): string[] {
    return this.unique([
      ...this.asStringArray(decision?.riskFlags),
      ...this.asStringArray(decision?.eventPropertyImpact?.riskFlags),
    ]);
  }

  private asStringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter(
          (item): item is string => typeof item === "string" && item.length > 0,
        )
      : [];
  }

  private isSafeDecisionStatus(status?: PricingDecisionStatus | null): boolean {
    return status === "suggested" || status === "accepted";
  }

  private confidenceRank(
    confidence?: EventIntelligenceConfidence | null,
  ): number {
    if (confidence === "high") return 3;
    if (confidence === "medium") return 2;
    if (confidence === "low") return 1;
    return 0;
  }

  private multiplierFromPrices(
    priceCents: number,
    basePriceCents: number,
  ): number | null {
    if (priceCents <= 0 || basePriceCents <= 0) return null;
    return Number((priceCents / basePriceCents).toFixed(2));
  }

  private moneyToCents(
    valueReais: number | string | null | undefined,
  ): number | null {
    if (valueReais === null || valueReais === undefined || valueReais === "")
      return null;
    const num =
      typeof valueReais === "string" ? Number(valueReais) : valueReais;
    return Number.isFinite(Number(num)) ? Math.round(Number(num) * 100) : null;
  }

  private toIntegerCents(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    return Number.isFinite(Number(value)) ? Math.round(Number(value)) : null;
  }

  private toDecimal(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  private toDateStr(d: Date | string): string {
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toISOString().slice(0, 10);
  }

  private isValidTargetDate(date: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsed = new Date(`${date}T00:00:00.000Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === date
    );
  }

  private parseBooleanEnv(name: string): boolean {
    const value = process.env[name]?.trim().toLowerCase();
    return (
      value === "true" || value === "1" || value === "yes" || value === "on"
    );
  }

  private parseBooleanEnvDefault(name: string, fallback: boolean): boolean {
    const value = process.env[name]?.trim().toLowerCase();
    if (!value) return fallback;
    if (["true", "1", "yes", "on"].includes(value)) return true;
    if (["false", "0", "no", "off"].includes(value)) return false;
    return fallback;
  }

  private parseConfidenceEnv(
    name: string,
    fallback: EventIntelligenceConfidence,
  ): EventIntelligenceConfidence {
    const value = process.env[name]?.trim().toLowerCase();
    if (value === "low" || value === "medium" || value === "high") return value;
    return fallback;
  }

  private parseNumberEnv(
    name: string,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const value = Number(process.env[name]);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(Math.max(value, min), max);
  }

  private parseListEnv(...names: string[]): Set<string> {
    return new Set(
      names
        .map((name) => process.env[name] ?? "")
        .join(",")
        .split(/[\s,;]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    );
  }

  private safeAuditJson(audit: StaysAutoApplyAuditContext): string {
    return JSON.stringify({
      cohort: audit.cohort,
      decisionSnapshotId: audit.decisionSnapshotId,
      decisionStatus: audit.decisionStatus,
      confidence: audit.confidence,
      bookingProbability: audit.bookingProbability,
      recommendedMultiplier: audit.recommendedMultiplier,
      previousPriceCents: audit.previousPriceCents,
      newPriceCents: audit.newPriceCents,
      targetDate: audit.targetDate,
      riskFlags: audit.riskFlags,
      rollbackReady: audit.rollbackReady,
    });
  }

  private unique(values: string[]): string[] {
    return Array.from(new Set(values.filter(Boolean)));
  }
}
