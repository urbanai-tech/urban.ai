import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Brackets, DataSource, QueryRunner, Repository } from 'typeorm';
import { Address } from '../entities/addresses.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import {
  EventIntelligenceConfidence,
  EventIntelligenceDriver,
  EventIntelligenceSnapshot,
} from '../entities/event-intelligence-snapshot.entity';
import {
  EventPropertyImpact,
  EventPropertyRecommendedAction,
  PriceAbsorptionScenario,
} from '../entities/event-property-impact.entity';
import { PricingDecisionSnapshot, PricingDecisionStatus } from '../entities/pricing-decision-snapshot.entity';
import { Event as EventEntity } from '../entities/events.entity';
import {
  EventPricingIntelligenceService,
  type EventDemandScoreResult,
  type IntelligenceDriver as EngineIntelligenceDriver,
  type PriceAbsorptionCurveInput,
  type PriceAbsorptionCurveResult,
  type PriceAbsorptionScenario as EnginePriceAbsorptionScenario,
  type PropertyCaptureScoreResult,
  type RecommendedPricingAction,
} from '../knn-engine/event-pricing-intelligence.service';
import { PricingCalculateService } from '../propriedades/pricing-calculate.service';
import {
  EventCatalogItem,
  EventCatalogQuery,
  EventIntelligencePayload,
  EventPropertyImpactPayload,
  SimulatePricingInput,
} from './event-intelligence.types';
import { EventHeatmapProjectionService } from './event-heatmap-projection.service';
import { ScheduledJobRunnerService, runScheduledJob } from '../admin-job-runs/scheduled-job-runner.service';

const CONTRACT_VERSION = 'event-radar-v0';
const ENGINE_PENDING_STUB = 'stub_pending_engine';
const MS_PER_DAY = 86_400_000;
const PRICING_DECISION_IDEMPOTENCY_VERSION = 'pricing-decision-v0';
const RECOMPUTE_RETRY_DELAYS_MS = [50, 150];
const RECOMPUTE_MAX_ATTEMPTS = RECOMPUTE_RETRY_DELAYS_MS.length + 1;

type DateRange = { from: string; to: string };
type ComputedPropertyImpact = {
  analysis: AnalisePreco;
  payload: EventPropertyImpactPayload & { eventId?: string };
};
type PersistenceStats = {
  eventIntelligenceSnapshotsCreated: number;
  eventIntelligenceSnapshotsReused: number;
  eventPropertyImpactsCreated: number;
  eventPropertyImpactsReused: number;
  eventPropertyImpactsSkippedAsDuplicate: number;
  pricingDecisionSnapshotsCreated: number;
  pricingDecisionSnapshotsReused: number;
};
type PersistedSnapshotResult = {
  snapshot: EventIntelligenceSnapshot;
  reused: boolean;
};
type PersistedImpactResult = {
  impacts: EventPropertyImpact[];
  pricingDecisionSnapshots: PricingDecisionSnapshot[];
  stats: PersistenceStats;
};
type PersistedPricingDecisionResult = {
  snapshot: PricingDecisionSnapshot;
  reused: boolean;
};
type RecomputeLockProvider = 'mysql_advisory_lock' | 'in_process';
type RecomputeRuntimeContext = {
  lockKey: string;
  lockProvider: RecomputeLockProvider | null;
  attempts: number;
  operationRetries: number;
  retryDelaysMs: number[];
};
type RecomputeEventFailure = {
  eventId: string;
  message: string;
  code: string | null;
};
type EventIntelligenceBackfillOptions = EventCatalogQuery & {
  lookaheadDays?: string | number;
  force?: string | boolean;
};
type DatabaseRecomputeLock = {
  lockKey: string;
  queryRunner: QueryRunner;
};

class RecomputeLockBusyError extends Error {
  readonly code = 'RECOMPUTE_LOCK_BUSY';

  constructor(readonly lockKey: string) {
    super(`Recompute lock ocupado: ${lockKey}`);
  }
}

@Injectable()
export class EventIntelligenceService {
  private readonly logger = new Logger(EventIntelligenceService.name);
  private readonly inProcessRecomputeLocks = new Set<string>();

  constructor(
    @InjectRepository(EventEntity) private readonly eventRepo: Repository<EventEntity>,
    @InjectRepository(EventIntelligenceSnapshot)
    private readonly snapshotRepo: Repository<EventIntelligenceSnapshot>,
    @InjectRepository(EventPropertyImpact)
    private readonly impactRepo: Repository<EventPropertyImpact>,
    @InjectRepository(PricingDecisionSnapshot)
    private readonly pricingDecisionSnapshotRepo: Repository<PricingDecisionSnapshot>,
    @InjectRepository(Address) private readonly addressRepo: Repository<Address>,
    @InjectRepository(AnalisePreco) private readonly analiseRepo: Repository<AnalisePreco>,
    private readonly pricingIntelligence: EventPricingIntelligenceService,
    private readonly pricingCalculateService: PricingCalculateService,
    private readonly heatmapProjection: EventHeatmapProjectionService,
    @Optional() @InjectDataSource() private readonly dataSource?: DataSource,
    @Optional() private readonly scheduledJobRunner?: ScheduledJobRunnerService,
  ) {}

  async hostCatalog(userId: string, query: EventCatalogQuery) {
    const range = this.resolveRange(query.from, query.to, 90);
    const events = await this.findEvents({ ...query, from: range.from, to: range.to, scope: 'in' }, false);
    const snapshots = await this.latestSnapshotsByEventIds(events.map((event) => event.id));
    const nearMyProperties = this.isTrue(query.nearMyProperties);
    const radiusKm = this.positiveNumber(query.radiusKm);
    const shouldFilterNear = nearMyProperties || radiusKm !== null || this.isSpecificFilter(query.propertyId);
    const propertyFilter = this.isSpecificFilter(query.propertyId) ? query.propertyId : undefined;
    const ownedAddresses = shouldFilterNear ? await this.findOwnedAddresses(userId, propertyFilter) : [];

    const filtered = shouldFilterNear
      ? events.filter((event) => this.isNearAnyOwnedProperty(event, snapshots.get(event.id), ownedAddresses, radiusKm))
      : events;

    return {
      contractVersion: CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
      filters: { ...query, from: range.from, to: range.to },
      items: filtered.map((event) => this.toCatalogItem(event, snapshots.get(event.id))),
      meta: {
        count: filtered.length,
        dataStatus: snapshots.size ? 'persisted_or_derived' : 'derived_from_event_fields',
      },
    };
  }

  async hostRadar(userId: string, query: EventCatalogQuery) {
    const range = this.resolveRange(query.from, query.to, 30);
    const persistedImpacts = await this.findPersistedImpactsInRange({
      userId,
      from: range.from,
      to: range.to,
      propertyId: query.propertyId,
      category: query.category,
      confidence: this.normalizeConfidence(query.confidence),
    });

    const impactDtos = persistedImpacts.length
      ? persistedImpacts.map((impact) => this.toPersistedImpactPayload(impact))
      : (await this.findAnaliseImpactsInRange(userId, query, range)).map((analysis) =>
          this.toAnalysisImpactPayload(analysis),
        );

    const filteredImpacts = this.filterImpactsByConfidence(impactDtos, query.confidence);
    const eventIds = Array.from(new Set(filteredImpacts.map((impact: any) => impact.eventId).filter(Boolean)));
    const events = eventIds.length
      ? await this.eventRepo
          .createQueryBuilder('event')
          .where('event.id IN (:...eventIds)', { eventIds })
          .andWhere('event.duplicateOfEventId IS NULL')
          .andWhere("(event.dedupStatus IS NULL OR event.dedupStatus = 'canonical')")
          .getMany()
      : [];
    const snapshots = await this.latestSnapshotsByEventIds(eventIds);
    const eventsById = new Map(events.map((event) => [event.id, event]));
    const grouped = new Map<string, EventPropertyImpactPayload[]>();

    for (const impact of filteredImpacts) {
      const eventId = (impact as any).eventId;
      if (!eventId) continue;
      grouped.set(eventId, [...(grouped.get(eventId) ?? []), this.stripInternalImpactFields(impact)]);
    }

    const items = Array.from(grouped.entries())
      .map(([eventId, impacts]) => {
        const event = eventsById.get(eventId);
        if (!event) return null;
        const snapshot = snapshots.get(eventId);
        const bestImpact = [...impacts].sort(
          (a, b) =>
            this.nullableNumber(b.expectedIncrementalRevenueCents) -
            this.nullableNumber(a.expectedIncrementalRevenueCents),
        )[0];
        return {
          event: this.toCatalogItem(event, snapshot),
          intelligence: this.toIntelligencePayload(event, snapshot),
          bestImpact,
          impacts,
        };
      })
      .filter(Boolean);

    return {
      contractVersion: CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
      filters: { ...query, from: range.from, to: range.to },
      summary: this.buildRadarSummary(items as any[]),
      items,
      stubs: this.radarHasComputedPricing(items as any[]) ? [] : this.engineStubs(),
    };
  }

  async hostEventDetail(userId: string, eventId: string) {
    const event = await this.getEventOrThrow(eventId);
    const snapshot = await this.latestSnapshot(event.id);
    const propertyImpact = await this.hostEventPropertyImpact(userId, event.id);

    return {
      contractVersion: CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
      event: this.toCatalogItem(event, snapshot),
      intelligence: this.toIntelligencePayload(event, snapshot),
      propertyImpact: propertyImpact.items,
      relatedEvents: await this.relatedEvents(event),
      stubs: this.hasComputedPricing(propertyImpact.items) ? [] : propertyImpact.stubs,
    };
  }

  async hostEventIntelligence(userId: string, eventId: string) {
    void userId;
    const event = await this.getEventOrThrow(eventId);
    const snapshot = await this.latestSnapshot(event.id);
    return {
      contractVersion: CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
      event: this.toCatalogItem(event, snapshot),
      intelligence: this.toIntelligencePayload(event, snapshot),
    };
  }

  async hostEventPropertyImpact(userId: string, eventId: string, propertyId?: string) {
    const event = await this.getEventOrThrow(eventId);
    const persisted = await this.findPersistedImpactsForEvent(event.id, userId, propertyId);
    const items = persisted.length
      ? persisted.map((impact) => this.toPersistedImpactPayload(impact))
      : (await this.findAnaliseImpactsForEvent(event.id, userId, propertyId)).map((analysis) =>
          this.toAnalysisImpactPayload(analysis),
        );

    return {
      contractVersion: CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
      eventId,
      items: items.map((item) => this.stripInternalImpactFields(item)),
      meta: {
        count: items.length,
        dataStatus: persisted.length ? 'persisted' : items.length ? 'derived_from_analise_preco' : ENGINE_PENDING_STUB,
      },
      stubs: this.hasComputedPricing(items) ? [] : this.engineStubs(),
    };
  }

  async hostHeatmap(userId: string, query: EventCatalogQuery) {
    const range = this.resolveRange(query.from, query.to, 30);
    const propertyFilter = this.isSpecificFilter(query.propertyId) ? query.propertyId : undefined;
    const addresses = await this.findOwnedAddresses(userId, propertyFilter);
    const events = await this.findEvents({ ...query, from: range.from, to: range.to, scope: 'in' }, false);
    const snapshots = await this.latestSnapshotsByEventIds(events.map((event) => event.id));
    const nearEvents = addresses.length
      ? events.filter((event) =>
          this.isNearAnyOwnedProperty(event, snapshots.get(event.id), addresses, this.positiveNumber(query.radiusKm)),
        )
      : [];
    const impactCounts = await this.loadImpactCounts(nearEvents.map((event) => event.id));

    return {
      contractVersion: CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
      filters: { ...query, from: range.from, to: range.to },
      cells: this.heatmapProjection.buildCells(nearEvents, snapshots, impactCounts, range),
      stubs: this.engineStubs(['supplyCompressionScore']),
    };
  }

  async simulatePricing(userId: string, eventId: string, input: SimulatePricingInput) {
    const event = await this.getEventOrThrow(eventId);
    const propertyId = input?.propertyId;
    const propertyImpact = propertyId
      ? await this.hostEventPropertyImpact(userId, eventId, propertyId)
      : await this.hostEventPropertyImpact(userId, eventId);
    const firstImpact = propertyImpact.items[0] ?? null;
    const scenarios = firstImpact?.priceAbsorptionScenarios ?? [];

    if (scenarios.length) {
      const selectedScenario =
        scenarios.find((scenario) => scenario.scenario === input?.strategy) ??
        scenarios.find((scenario) => scenario.scenario === 'recommended') ??
        scenarios[0];
      return {
        contractVersion: CONTRACT_VERSION,
        generatedAt: new Date().toISOString(),
        status: 'ok',
        event: this.toCatalogItem(event, await this.latestSnapshot(eventId)),
        propertyImpact: firstImpact,
        scenarios,
        selectedScenario,
        message: 'Curva de absorção calculada a partir do motor de eventos/pricing v0.',
      };
    }

    return {
      contractVersion: CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
      status: ENGINE_PENDING_STUB,
      event: this.toCatalogItem(event, await this.latestSnapshot(eventId)),
      propertyImpact: firstImpact,
      scenarios: [] as PriceAbsorptionScenario[],
      message:
        'Simulação de curva de absorção depende do motor da Nico. O endpoint já fixa o contrato para Maya/Otto/Tais.',
      requiredEngineFields: [
        'minAbsorbablePriceCents',
        'maxAbsorbablePriceCents',
        'bookingProbability',
        'expectedRevenueCents',
        'priceAbsorptionScenarios',
      ],
    };
  }

  async adminIntelligence(query: EventCatalogQuery) {
    const range = this.resolveRange(query.from, query.to, 90);
    const events = await this.findEvents({ ...query, from: range.from, to: range.to }, true);
    const snapshots = await this.latestSnapshotsByEventIds(events.map((event) => event.id));
    const impactCounts = await this.loadImpactCounts(events.map((event) => event.id));
    const recommendationCounts = await this.loadRecommendationCounts(events.map((event) => event.id));
    const confidence = this.normalizeConfidence(query.confidence);

    const items = events
      .map((event) => {
        const snapshot = snapshots.get(event.id);
        return {
          event: this.toCatalogItem(event, snapshot),
          intelligence: this.toIntelligencePayload(event, snapshot),
          impact: {
            affectedPropertiesCount: impactCounts.get(event.id) ?? 0,
            recommendationsGenerated: recommendationCounts.get(event.id) ?? 0,
          },
          admin: {
            pendingGeocode: Boolean(event.pendingGeocode),
            outOfScope: Boolean(event.outOfScope),
            enrichmentAttempts: event.enrichmentAttempts ?? 0,
            dataQualityFlags: this.dataQualityFlags(event, snapshot),
          },
        };
      })
      .filter((item) => !confidence || item.intelligence.confidence === confidence);

    return {
      contractVersion: CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
      filters: { ...query, from: range.from, to: range.to },
      summary: this.buildAdminSummary(items),
      items,
      stubs: this.engineStubs(['eventRevenuePotentialCents', 'supplyCompressionScore']),
    };
  }

  async adminEventIntelligence(eventId: string) {
    const event = await this.getEventOrThrow(eventId);
    const snapshot = await this.latestSnapshot(eventId);
    return {
      contractVersion: CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
      event: this.toCatalogItem(event, snapshot),
      intelligence: this.toIntelligencePayload(event, snapshot),
      admin: {
        sourceId: event.sourceId ?? null,
        dedupHash: event.dedupHash ?? null,
        pendingGeocode: Boolean(event.pendingGeocode),
        outOfScope: Boolean(event.outOfScope),
        enrichmentAttempts: event.enrichmentAttempts ?? 0,
        enrichmentLastAttemptAt: this.toIso(event.enrichmentLastAttemptAt),
        enrichmentLastError: event.enrichmentLastError ?? null,
        dataCrawl: this.toIso(event.dataCrawl),
      },
    };
  }

  async adminEventPropertyImpact(eventId: string) {
    await this.getEventOrThrow(eventId);
    const persisted = await this.findPersistedImpactsForEvent(eventId);
    const items = persisted.length
      ? persisted.map((impact) => this.toPersistedImpactPayload(impact))
      : (await this.findAnaliseImpactsForEvent(eventId)).map((analysis) => this.toAnalysisImpactPayload(analysis));

    return {
      contractVersion: CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
      eventId,
      items: items.map((item) => this.stripInternalImpactFields(item)),
      meta: {
        count: items.length,
        dataStatus: persisted.length ? 'persisted' : items.length ? 'derived_from_analise_preco' : ENGINE_PENDING_STUB,
      },
      stubs: this.hasComputedPricing(items) ? [] : this.engineStubs(),
    };
  }

  async adminHeatmap(query: EventCatalogQuery) {
    const range = this.resolveRange(query.from, query.to, 90);
    const events = await this.findEvents({ ...query, from: range.from, to: range.to }, true);
    const snapshots = await this.latestSnapshotsByEventIds(events.map((event) => event.id));
    const impactCounts = await this.loadImpactCounts(events.map((event) => event.id));

    return {
      contractVersion: CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
      filters: { ...query, from: range.from, to: range.to },
      metric: query.metric ?? 'eventDemandScore',
      cells: this.heatmapProjection.buildCells(events, snapshots, impactCounts, range),
      stubs: this.engineStubs(['supplyCompressionScore']),
    };
  }

  async adminBlindSpots() {
    const range = this.resolveRange(undefined, undefined, 90);
    const events = await this.findEvents({ from: range.from, to: range.to, scope: 'all', limit: 300 }, true);
    const snapshots = await this.latestSnapshotsByEventIds(events.map((event) => event.id));
    const impactCounts = await this.loadImpactCounts(events.map((event) => event.id));
    const staleCutoff = Date.now() - 72 * 60 * 60 * 1000;

    const buckets = {
      missingCoordinates: events.filter((event) => !this.hasCoordinates(event)),
      missingOfficialUrl: events.filter((event) => !event.linkSiteOficial),
      staleSource: events.filter((event) => !event.dataCrawl || new Date(event.dataCrawl).getTime() < staleCutoff),
      missingIntelligenceSnapshot: events.filter((event) => !snapshots.has(event.id)),
      highDemandWithoutPropertyImpact: events.filter((event) => {
        const snapshot = snapshots.get(event.id);
        const score = this.numberOrNull(snapshot?.eventDemandScore) ?? this.numberOrNull(event.relevancia) ?? 0;
        return score >= 70 && (impactCounts.get(event.id) ?? 0) === 0;
      }),
    };

    return {
      contractVersion: CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
      window: range,
      buckets: Object.fromEntries(
        Object.entries(buckets).map(([key, rows]) => [
          key,
          {
            count: rows.length,
            items: rows.slice(0, 25).map((event) => ({
              event: this.toCatalogItem(event, snapshots.get(event.id)),
              adminFlags: this.dataQualityFlags(event, snapshots.get(event.id)),
            })),
          },
        ]),
      ),
      stubs: this.engineStubs(['blindSpotSeverity', 'uncapturedRevenueCents']),
    };
  }

  async recomputeEventIntelligence(eventId: string, triggeredByUserId?: string | null) {
    const jobRunId = this.recomputeJobRunId('event', eventId);
    return this.withRecomputeRetry(this.eventRecomputeLockKey(eventId), jobRunId, async (runtime) => {
      const event = await this.getEventOrThrow(eventId);
      const processed = await this.recomputeLoadedEvent(event, jobRunId);

      return this.recomputeResult({
        jobRunId,
        triggeredByUserId,
        eventIds: [eventId],
        eventsProcessed: 1,
        analysesRead: processed.analysesRead,
        snapshots: [processed.snapshot],
        impacts: processed.impacts,
        pricingDecisionSnapshots: processed.pricingDecisionSnapshots,
        skippedAnalyses: processed.skippedAnalyses,
        query: { eventId },
        persistence: processed.stats,
        runtime,
      });
    });
  }

  async recomputeIntelligenceBatch(query: EventCatalogQuery, triggeredByUserId?: string | null) {
    const range = this.resolveRange(query.from, query.to, 30);
    const jobRunId = this.recomputeJobRunId('batch');
    const normalizedQuery = { ...query, from: range.from, to: range.to };

    return this.withRecomputeRetry(this.batchRecomputeLockKey(normalizedQuery), jobRunId, async (runtime) => {
      const events = await this.findEvents(normalizedQuery, true);
      const snapshots: EventIntelligenceSnapshot[] = [];
      const impacts: EventPropertyImpact[] = [];
      const pricingDecisionSnapshots: PricingDecisionSnapshot[] = [];
      const failures: RecomputeEventFailure[] = [];
      const persistence = this.emptyPersistenceStats();
      let analysesRead = 0;
      let skippedAnalyses = 0;

      for (const event of events) {
        try {
          const processed = await this.withRecomputeOperationRetry(runtime, () =>
            this.recomputeLoadedEvent(event, jobRunId),
          );
          analysesRead += processed.analysesRead;
          skippedAnalyses += processed.skippedAnalyses;
          snapshots.push(processed.snapshot);
          impacts.push(...processed.impacts);
          pricingDecisionSnapshots.push(...processed.pricingDecisionSnapshots);
          this.addPersistenceStats(persistence, processed.stats);
        } catch (error: any) {
          failures.push(this.toRecomputeEventFailure(event.id, error));
        }
      }

      return this.recomputeResult({
        jobRunId,
        triggeredByUserId,
        eventIds: events.map((event) => event.id),
        eventsProcessed: snapshots.length,
        analysesRead,
        snapshots,
        impacts,
        pricingDecisionSnapshots,
        skippedAnalyses,
        query: normalizedQuery,
        persistence,
        runtime,
        failures,
      });
    });
  }

  async backfillFutureEventIntelligence(
    options: EventIntelligenceBackfillOptions = {},
    triggeredByUserId?: string | null,
  ) {
    const range = this.resolveBackfillRange(options);
    const limit = this.backfillLimit(options.limit);
    const force = this.isTrue(options.force);
    const scope = options.scope ?? 'in';
    const jobRunId = this.recomputeJobRunId('backfill');
    const normalizedQuery: EventCatalogQuery = {
      from: range.from,
      to: range.to,
      source: options.source,
      category: options.category,
      city: options.city,
      search: options.search,
      scope,
      limit: Math.min(limit * (force ? 1 : 3), 300),
    };

    return this.withRecomputeRetry(
      this.backfillRecomputeLockKey({ ...normalizedQuery, force, limit }),
      jobRunId,
      async (runtime) => {
        const candidateEvents = await this.findEvents(normalizedQuery, true);
        const existingSnapshots = force
          ? new Map<string, EventIntelligenceSnapshot>()
          : await this.latestSnapshotsByEventIds(candidateEvents.map((event) => event.id));
        const eligibleEvents = candidateEvents.filter((event) => force || !existingSnapshots.has(event.id));
        const events = eligibleEvents.slice(0, limit);
        const skippedExistingSnapshots = force ? 0 : candidateEvents.length - eligibleEvents.length;
        const snapshots: EventIntelligenceSnapshot[] = [];
        const impacts: EventPropertyImpact[] = [];
        const pricingDecisionSnapshots: PricingDecisionSnapshot[] = [];
        const failures: RecomputeEventFailure[] = [];
        const persistence = this.emptyPersistenceStats();
        let analysesRead = 0;
        let skippedAnalyses = 0;

        for (const event of events) {
          try {
            const processed = await this.withRecomputeOperationRetry(runtime, () =>
              this.recomputeLoadedEvent(event, jobRunId),
            );
            analysesRead += processed.analysesRead;
            skippedAnalyses += processed.skippedAnalyses;
            snapshots.push(processed.snapshot);
            impacts.push(...processed.impacts);
            pricingDecisionSnapshots.push(...processed.pricingDecisionSnapshots);
            this.addPersistenceStats(persistence, processed.stats);
          } catch (error: any) {
            failures.push(this.toRecomputeEventFailure(event.id, error));
          }
        }

        const result = this.recomputeResult({
          jobRunId,
          triggeredByUserId,
          eventIds: events.map((event) => event.id),
          eventsProcessed: snapshots.length,
          analysesRead,
          snapshots,
          impacts,
          pricingDecisionSnapshots,
          skippedAnalyses,
          query: {
            ...normalizedQuery,
            limit,
            force,
            candidatesScanned: candidateEvents.length,
            skippedExistingSnapshots,
          },
          persistence,
          runtime,
          failures,
        });

        return {
          ...result,
          backfill: {
            mode: 'future_events',
            force,
            range,
            limit,
            candidatesScanned: candidateEvents.length,
            skippedExistingSnapshots,
          },
        };
      },
    );
  }

  @Cron('20 4 * * *', {
    name: 'event-intelligence-backfill',
    timeZone: 'America/Sao_Paulo',
    waitForCompletion: true,
  })
  async handleBackfillCron() {
    if (!this.isTrue(process.env.EVENT_INTELLIGENCE_BACKFILL_CRON_ENABLED)) return;
    await runScheduledJob(this.scheduledJobRunner, 'event-intelligence-backfill', async () => {
      try {
        const result = await this.backfillFutureEventIntelligence({
          limit: process.env.EVENT_INTELLIGENCE_BACKFILL_CRON_LIMIT ?? 20,
          lookaheadDays: process.env.EVENT_INTELLIGENCE_BACKFILL_LOOKAHEAD_DAYS ?? 90,
        });
        this.logger.log(
          `event-intelligence-backfill: ${result.summary.eventsProcessed}/${result.summary.eventsAttempted} eventos processados, ${result.summary.eventsFailed} falhas`,
        );
        return result;
      } catch (error: any) {
        const message = error?.message ?? String(error);
        this.logger.error(`event-intelligence-backfill falhou: ${message}`);
        return { ok: false, errorMessage: message };
      }
    });
  }

  private async recomputeLoadedEvent(event: EventEntity, jobRunId: string) {
    const analyses = await this.findAnaliseImpactsForEvent(event.id);
    const computedImpacts = this.computePersistableImpacts(analyses);
    const persistedSnapshot = await this.persistEventIntelligenceSnapshot(event, jobRunId, computedImpacts);
    const persisted = await this.persistEventPropertyImpacts(computedImpacts, persistedSnapshot.snapshot, jobRunId);
    const stats = this.emptyPersistenceStats();
    stats.eventIntelligenceSnapshotsCreated = persistedSnapshot.reused ? 0 : 1;
    stats.eventIntelligenceSnapshotsReused = persistedSnapshot.reused ? 1 : 0;
    this.addPersistenceStats(stats, persisted.stats);

    return {
      analysesRead: analyses.length,
      skippedAnalyses: analyses.length - computedImpacts.length,
      snapshot: persistedSnapshot.snapshot,
      impacts: persisted.impacts,
      pricingDecisionSnapshots: persisted.pricingDecisionSnapshots,
      stats,
    };
  }

  private computePersistableImpacts(analyses: AnalisePreco[]): ComputedPropertyImpact[] {
    return analyses
      .map((analysis) => ({ analysis, payload: this.toAnalysisImpactPayload(analysis) }))
      .filter(({ analysis, payload }) => this.canPersistImpact(analysis, payload));
  }

  private canPersistImpact(
    analysis: AnalisePreco,
    payload: EventPropertyImpactPayload & { eventId?: string },
  ): boolean {
    return Boolean(
      analysis.id &&
        analysis.evento &&
        analysis.endereco &&
        analysis.usuarioProprietario &&
        payload.propertyId &&
        payload.eventId,
    );
  }

  private async findExistingEventIntelligenceSnapshot(eventId: string, jobRunId: string) {
    return this.snapshotRepo.findOne({
      where: {
        jobRunId,
        event: { id: eventId } as EventEntity,
      },
      relations: { event: true },
      order: { generatedAt: 'DESC' },
    });
  }

  private async findExistingEventPropertyImpact(
    jobRunId: string,
    analysis: AnalisePreco,
    payload: EventPropertyImpactPayload & { eventId?: string },
  ) {
    if (!payload.eventId || !payload.propertyId || !analysis.id) return null;
    return this.impactRepo.findOne({
      where: {
        jobRunId,
        event: { id: payload.eventId } as EventEntity,
        property: { id: payload.propertyId } as Address,
        analisePreco: { id: analysis.id } as AnalisePreco,
      },
      relations: {
        event: true,
        property: true,
        list: true,
        hostUser: true,
        intelligenceSnapshot: true,
        analisePreco: true,
      },
      order: { generatedAt: 'DESC' },
    });
  }

  private eventPropertyImpactRetryKey(
    jobRunId: string,
    analysis: AnalisePreco,
    payload: EventPropertyImpactPayload & { eventId?: string },
  ) {
    return [
      jobRunId,
      payload.eventId ?? analysis.evento?.id ?? 'no-event',
      payload.propertyId ?? analysis.endereco?.id ?? 'no-property',
      analysis.id ?? 'no-analysis',
    ].join(':');
  }

  private async persistEventIntelligenceSnapshot(
    event: EventEntity,
    jobRunId: string,
    computedImpacts: ComputedPropertyImpact[],
  ): Promise<PersistedSnapshotResult> {
    const existing = await this.findExistingEventIntelligenceSnapshot(event.id, jobRunId);
    if (existing) return { snapshot: existing, reused: true };

    const demand = this.deriveEventDemand(event);
    const revenuePotentialCents = this.eventRevenuePotentialFromImpacts(computedImpacts);
    const snapshot = this.snapshotRepo.create({
      event,
      generatedAt: new Date(demand.generatedAt),
      jobRunId,
      metricVersion: demand.metricVersion,
      modelVersion: demand.modelVersion,
      eventDemandScore: demand.eventDemandScore,
      eventRevenuePotentialCents: revenuePotentialCents,
      demandRadiusKm: demand.demandRadiusKm,
      sourceReliabilityScore: demand.sourceReliabilityScore,
      sourceFreshnessHours: this.sourceFreshnessHours(event.dataCrawl),
      confidence: demand.confidence,
      expectedAttendance: demand.expectedAttendance,
      venueType: event.venueType ?? null,
      category: event.categoria ?? null,
      leadTimeDays: demand.leadTimeDays,
      overlapEventsCount: 0,
      supplyCompressionScore: this.averagePropertyCaptureScore(computedImpacts),
      interpretation: demand.interpretation,
      drivers: this.toDriverPayload(demand.drivers),
      hotRegions: [],
      riskFlags: this.unique([...demand.riskFlags, ...this.riskFlags(event)]),
      dataQualityFlags: this.unique([
        ...demand.dataQualityFlags,
        ...this.dataQualityFlags(event, null, { includeMissingSnapshot: false }),
      ]),
    });
    return { snapshot: await this.snapshotRepo.save(snapshot), reused: false };
  }

  private async persistEventPropertyImpacts(
    computedImpacts: ComputedPropertyImpact[],
    snapshot: EventIntelligenceSnapshot,
    jobRunId: string,
  ): Promise<PersistedImpactResult> {
    const impacts: EventPropertyImpact[] = [];
    const pricingDecisionSnapshots: PricingDecisionSnapshot[] = [];
    const stats = this.emptyPersistenceStats();
    const seenImpactKeys = new Set<string>();

    for (const { analysis, payload } of computedImpacts) {
      const impactKey = this.eventPropertyImpactRetryKey(jobRunId, analysis, payload);
      if (seenImpactKeys.has(impactKey)) {
        stats.eventPropertyImpactsSkippedAsDuplicate += 1;
        continue;
      }
      seenImpactKeys.add(impactKey);

      const existingImpact = await this.findExistingEventPropertyImpact(jobRunId, analysis, payload);
      const persistedImpact =
        existingImpact ??
        (await this.impactRepo.save(
          this.impactRepo.create({
            event: analysis.evento,
            intelligenceSnapshot: snapshot,
            property: analysis.endereco,
            list: analysis.endereco?.list ?? null,
            hostUser: analysis.usuarioProprietario,
            analisePreco: analysis,
            generatedAt: new Date(payload.generatedAt),
            jobRunId,
            metricVersion: payload.metricVersion,
            modelVersion: payload.modelVersion,
            distanceKm: payload.distanceKm,
            travelTimeMinutes: payload.travelTimeMinutes ?? null,
            propertyCaptureScore: payload.propertyCaptureScore,
            basePriceCents: payload.basePriceCents,
            currentPriceCents: payload.currentPriceCents,
            recommendedPriceCents: payload.recommendedPriceCents,
            minAbsorbablePriceCents: payload.minAbsorbablePriceCents,
            maxAbsorbablePriceCents: payload.maxAbsorbablePriceCents,
            recommendedMultiplier: payload.recommendedMultiplier,
            maxPlausibleMultiplier: payload.maxPlausibleMultiplier,
            bookingProbability: payload.bookingProbability,
            expectedRevenueCents: payload.expectedRevenueCents,
            expectedIncrementalRevenueCents: payload.expectedIncrementalRevenueCents,
            confidence: payload.confidence,
            mainDrivers: payload.mainDrivers as EventPropertyImpact['mainDrivers'],
            priceAbsorptionScenarios: payload.priceAbsorptionScenarios,
            recommendedAction: payload.recommendedAction,
            riskFlags: payload.riskFlags,
          }),
        ));
      if (existingImpact) {
        stats.eventPropertyImpactsReused += 1;
      } else {
        stats.eventPropertyImpactsCreated += 1;
      }
      impacts.push(persistedImpact);

      const decisionSnapshot = await this.persistPricingDecisionSnapshot({
        analysis,
        payload,
        eventIntelligenceSnapshot: snapshot,
        eventPropertyImpact: persistedImpact,
        jobRunId,
      });
      if (decisionSnapshot) {
        if (decisionSnapshot.reused) {
          stats.pricingDecisionSnapshotsReused += 1;
        } else {
          stats.pricingDecisionSnapshotsCreated += 1;
        }
        pricingDecisionSnapshots.push(decisionSnapshot.snapshot);
      }
    }
    return { impacts, pricingDecisionSnapshots, stats };
  }

  private async persistPricingDecisionSnapshot(input: {
    analysis: AnalisePreco;
    payload: EventPropertyImpactPayload & { eventId?: string };
    eventIntelligenceSnapshot: EventIntelligenceSnapshot;
    eventPropertyImpact: EventPropertyImpact;
    jobRunId: string;
  }): Promise<PersistedPricingDecisionResult | null> {
    const { analysis, payload, eventIntelligenceSnapshot, eventPropertyImpact, jobRunId } = input;
    if (!analysis.usuarioProprietario || !analysis.endereco || !analysis.evento || !eventPropertyImpact.id) {
      return null;
    }

    const draft = this.pricingCalculateService.criarSnapshotDecisaoPricingEvento({
      user: analysis.usuarioProprietario,
      property: analysis.endereco,
      list: analysis.endereco?.list ?? null,
      event: analysis.evento,
      eventIntelligenceSnapshot,
      eventPropertyImpact,
      analisePreco: analysis,
      targetDate: analysis.evento.dataInicio ?? null,
      generatedAt: payload.generatedAt,
      jobRunId,
      status: this.pricingDecisionStatusFromAnalysis(analysis),
      selectedScenario: 'recommended',
      appliedPriceCents: this.moneyToCents(analysis.precoAplicado),
      inputSignals: {
        sourcePayload: 'event_property_impact_v0',
      },
      priceInput: this.priceInputFromImpactPayload(payload, eventIntelligenceSnapshot),
    });
    const idempotency = this.pricingDecisionIdempotency(draft);
    draft.inputSignals = {
      ...draft.inputSignals,
      idempotencyVersion: PRICING_DECISION_IDEMPOTENCY_VERSION,
      idempotencyKey: idempotency.idempotencyKey,
      signalsHash: idempotency.signalsHash,
    };

    const existing = await this.findExistingPricingDecisionSnapshot(draft, idempotency.idempotencyKey);
    if (existing) return { snapshot: existing, reused: true };
    return {
      snapshot: await this.pricingDecisionSnapshotRepo.save(this.pricingDecisionSnapshotRepo.create(draft)),
      reused: false,
    };
  }

  private async findExistingPricingDecisionSnapshot(
    draft: Partial<PricingDecisionSnapshot>,
    idempotencyKey: string,
  ): Promise<PricingDecisionSnapshot | null> {
    const relationIds = draft.inputSignals?.relationIds ?? {};
    const where = this.compactWhere({
      event: relationIds.eventId ? { id: relationIds.eventId } : undefined,
      property: relationIds.propertyId ? { id: relationIds.propertyId } : undefined,
      analisePreco: relationIds.analisePrecoId ? { id: relationIds.analisePrecoId } : undefined,
      targetDate: draft.targetDate ?? undefined,
      decisionType: draft.decisionType ?? undefined,
      modelVersion: draft.modelVersion ?? undefined,
      metricVersion: draft.metricVersion ?? undefined,
    });

    const candidates = await this.pricingDecisionSnapshotRepo.find({
      where: where as any,
      relations: {
        event: true,
        property: true,
        analisePreco: true,
      },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return candidates.find((candidate) => candidate.inputSignals?.idempotencyKey === idempotencyKey) ?? null;
  }

  private pricingDecisionIdempotency(draft: Partial<PricingDecisionSnapshot>) {
    const signalsHash = createHash('sha256')
      .update(this.stableJson(this.pricingDecisionSignalsForHash(draft)))
      .digest('hex')
      .slice(0, 32);
    const relationIds = draft.inputSignals?.relationIds ?? {};
    const scenario = draft.inputSignals?.selectedScenario?.scenario ?? 'recommended';
    const parts = [
      PRICING_DECISION_IDEMPOTENCY_VERSION,
      relationIds.eventId ?? 'no-event',
      relationIds.propertyId ?? 'no-property',
      relationIds.listId ?? 'no-list',
      relationIds.analisePrecoId ?? 'no-analysis',
      draft.targetDate ?? 'no-target-date',
      draft.decisionType ?? 'event_pricing',
      scenario,
      draft.modelVersion ?? 'no-model',
      draft.metricVersion ?? 'no-metric',
      signalsHash,
    ];

    return {
      signalsHash,
      idempotencyKey: parts.join(':'),
    };
  }

  private pricingDecisionSignalsForHash(draft: Partial<PricingDecisionSnapshot>) {
    const pricing = draft.inputSignals?.pricing ?? {};
    return {
      basePriceCents: pricing.basePriceCents ?? draft.basePriceCents ?? null,
      currentPriceCents: pricing.currentPriceCents ?? draft.currentPriceCents ?? null,
      marketReferencePriceCents: pricing.marketReferencePriceCents ?? draft.recommendedPriceCents ?? null,
      eventDemandScore: pricing.eventDemandScore ?? null,
      propertyCaptureScore: pricing.propertyCaptureScore ?? null,
      supplyCompressionScore: pricing.supplyCompressionScore ?? null,
      affectedNights: pricing.affectedNights ?? null,
      selectedScenario: draft.inputSignals?.selectedScenario ?? null,
      guardrails: draft.guardrails ?? null,
    };
  }

  private stableJson(value: unknown) {
    return JSON.stringify(this.stableValue(value));
  }

  private stableValue(value: unknown): unknown {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((item) => this.stableValue(item));
    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce((acc, key) => {
          acc[key] = this.stableValue((value as Record<string, unknown>)[key]);
          return acc;
        }, {} as Record<string, unknown>);
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? Math.round(value * 1_000_000) / 1_000_000 : null;
    }
    return value === undefined ? null : value;
  }

  private compactWhere(where: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(where).filter(([, value]) => value !== undefined));
  }

  private async withRecomputeRetry<T>(
    lockKey: string,
    jobRunId: string,
    handler: (runtime: RecomputeRuntimeContext) => Promise<T>,
  ): Promise<T> {
    const runtime: RecomputeRuntimeContext = {
      lockKey,
      lockProvider: null,
      attempts: 0,
      operationRetries: 0,
      retryDelaysMs: [],
    };
    let lastError: any;

    for (let attempt = 1; attempt <= RECOMPUTE_MAX_ATTEMPTS; attempt += 1) {
      runtime.attempts = attempt;
      try {
        return await this.withRecomputeLock(lockKey, async (lockProvider) => {
          runtime.lockProvider = lockProvider;
          return handler(runtime);
        });
      } catch (error: any) {
        lastError = error;
        if (attempt >= RECOMPUTE_MAX_ATTEMPTS || !this.isRetryableRecomputeError(error)) break;
        const delayMs = RECOMPUTE_RETRY_DELAYS_MS[attempt - 1] ?? 0;
        runtime.retryDelaysMs.push(delayMs);
        await this.sleep(delayMs);
      }
    }

    throw lastError;
  }

  private async withRecomputeOperationRetry<T>(
    runtime: RecomputeRuntimeContext,
    handler: () => Promise<T>,
  ): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= RECOMPUTE_MAX_ATTEMPTS; attempt += 1) {
      try {
        return await handler();
      } catch (error: any) {
        lastError = error;
        if (attempt >= RECOMPUTE_MAX_ATTEMPTS || !this.isRetryableRecomputeError(error)) break;
        runtime.operationRetries += 1;
        const delayMs = RECOMPUTE_RETRY_DELAYS_MS[attempt - 1] ?? 0;
        runtime.retryDelaysMs.push(delayMs);
        await this.sleep(delayMs);
      }
    }
    throw lastError;
  }

  private async withRecomputeLock<T>(
    lockKey: string,
    handler: (lockProvider: RecomputeLockProvider) => Promise<T>,
  ): Promise<T> {
    const dbLock = await this.tryAcquireDatabaseRecomputeLock(lockKey);
    if (dbLock) {
      try {
        return await handler('mysql_advisory_lock');
      } finally {
        await this.releaseDatabaseRecomputeLock(dbLock);
      }
    }

    if (this.inProcessRecomputeLocks.has(lockKey)) {
      throw new RecomputeLockBusyError(lockKey);
    }
    this.inProcessRecomputeLocks.add(lockKey);
    try {
      return await handler('in_process');
    } finally {
      this.inProcessRecomputeLocks.delete(lockKey);
    }
  }

  private async tryAcquireDatabaseRecomputeLock(lockKey: string): Promise<DatabaseRecomputeLock | null> {
    if (!this.supportsMysqlAdvisoryLocks()) return null;
    const dbLockKey = this.mysqlLockKey(lockKey);
    const queryRunner = this.dataSource!.createQueryRunner();
    await queryRunner.connect();
    try {
      const rows = await queryRunner.query('SELECT GET_LOCK(?, 0) AS acquired', [dbLockKey]);
      const first = this.firstDbRow(rows);
      const acquired = Number(first?.acquired ?? first?.['GET_LOCK(?, 0)'] ?? 0) === 1;
      if (!acquired) {
        await queryRunner.release();
        throw new RecomputeLockBusyError(lockKey);
      }
      return { lockKey: dbLockKey, queryRunner };
    } catch (error) {
      if (!queryRunner.isReleased) await queryRunner.release();
      throw error;
    }
  }

  private async releaseDatabaseRecomputeLock(lock: DatabaseRecomputeLock) {
    try {
      await lock.queryRunner.query('SELECT RELEASE_LOCK(?) AS released', [lock.lockKey]);
    } catch {
      // Advisory lock release failures are non-actionable here; MySQL releases them when the connection closes.
    } finally {
      if (!lock.queryRunner.isReleased) await lock.queryRunner.release();
    }
  }

  private supportsMysqlAdvisoryLocks() {
    const type = this.dataSource?.options?.type;
    return (
      (type === 'mysql' || type === 'mariadb') &&
      typeof this.dataSource?.createQueryRunner === 'function'
    );
  }

  private firstDbRow(rows: unknown): Record<string, unknown> | null {
    if (!Array.isArray(rows)) return null;
    const first = rows[0];
    if (Array.isArray(first)) return (first[0] as Record<string, unknown>) ?? null;
    return (first as Record<string, unknown>) ?? null;
  }

  private mysqlLockKey(lockKey: string) {
    const hash = createHash('sha256').update(lockKey).digest('hex').slice(0, 24);
    return `event-intel:${hash}`;
  }

  private eventRecomputeLockKey(eventId: string) {
    return `event-intelligence:event:${eventId}`;
  }

  private batchRecomputeLockKey(query: EventCatalogQuery) {
    return `event-intelligence:batch:${createHash('sha256')
      .update(this.stableJson(this.stableValue(query)))
      .digest('hex')
      .slice(0, 32)}`;
  }

  private backfillRecomputeLockKey(query: Record<string, unknown>) {
    return `event-intelligence:backfill:${createHash('sha256')
      .update(this.stableJson(this.stableValue(query)))
      .digest('hex')
      .slice(0, 32)}`;
  }

  private isRetryableRecomputeError(error: any) {
    const code = error?.code ?? error?.errno ?? '';
    const message = String(error?.message ?? '').toLowerCase();
    return (
      error instanceof RecomputeLockBusyError ||
      [
        'RECOMPUTE_LOCK_BUSY',
        'ER_LOCK_DEADLOCK',
        'ER_LOCK_WAIT_TIMEOUT',
        'PROTOCOL_CONNECTION_LOST',
        'ECONNRESET',
        'ETIMEDOUT',
      ].includes(String(code)) ||
      message.includes('deadlock') ||
      message.includes('lock wait timeout') ||
      message.includes('connection lost') ||
      message.includes('timeout')
    );
  }

  private sleep(delayMs: number) {
    return delayMs > 0 ? new Promise((resolve) => setTimeout(resolve, delayMs)) : Promise.resolve();
  }

  private emptyPersistenceStats(): PersistenceStats {
    return {
      eventIntelligenceSnapshotsCreated: 0,
      eventIntelligenceSnapshotsReused: 0,
      eventPropertyImpactsCreated: 0,
      eventPropertyImpactsReused: 0,
      eventPropertyImpactsSkippedAsDuplicate: 0,
      pricingDecisionSnapshotsCreated: 0,
      pricingDecisionSnapshotsReused: 0,
    };
  }

  private addPersistenceStats(target: PersistenceStats, source: PersistenceStats) {
    for (const key of Object.keys(target) as Array<keyof PersistenceStats>) {
      target[key] += source[key];
    }
  }

  private toRecomputeEventFailure(eventId: string, error: any): RecomputeEventFailure {
    return {
      eventId,
      message: error?.message || 'Falha ao reprocessar evento',
      code: error?.code ? String(error.code) : null,
    };
  }

  private recomputeResult(input: {
    jobRunId: string;
    triggeredByUserId?: string | null;
    eventIds: string[];
    eventsProcessed: number;
    analysesRead: number;
    snapshots: EventIntelligenceSnapshot[];
    impacts: EventPropertyImpact[];
    pricingDecisionSnapshots: PricingDecisionSnapshot[];
    skippedAnalyses: number;
    query: Record<string, unknown>;
    persistence: PersistenceStats;
    runtime: RecomputeRuntimeContext;
    failures?: RecomputeEventFailure[];
  }) {
    const failures = input.failures ?? [];
    const status = failures.length
      ? input.snapshots.length
        ? 'partial_success'
        : 'failed'
      : 'ok';

    return {
      contractVersion: CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
      status,
      jobRunId: input.jobRunId,
      triggeredByUserId: input.triggeredByUserId ?? null,
      query: input.query,
      eventIds: input.eventIds,
      summary: {
        eventsAttempted: input.eventIds.length,
        eventsProcessed: input.eventsProcessed,
        eventsFailed: failures.length,
        analysesRead: input.analysesRead,
        skippedAnalyses: input.skippedAnalyses,
      },
      writes: {
        eventIntelligenceSnapshot: input.snapshots.length > 0,
        eventIntelligenceSnapshotsCount: input.snapshots.length,
        eventPropertyImpact: input.impacts.length > 0,
        eventPropertyImpactsCount: input.impacts.length,
        pricingDecisionSnapshot: input.pricingDecisionSnapshots.length > 0,
        pricingDecisionSnapshotsCount: input.pricingDecisionSnapshots.length,
        created: {
          eventIntelligenceSnapshots: input.persistence.eventIntelligenceSnapshotsCreated,
          eventPropertyImpacts: input.persistence.eventPropertyImpactsCreated,
          pricingDecisionSnapshots: input.persistence.pricingDecisionSnapshotsCreated,
        },
        reused: {
          eventIntelligenceSnapshots: input.persistence.eventIntelligenceSnapshotsReused,
          eventPropertyImpacts: input.persistence.eventPropertyImpactsReused,
          pricingDecisionSnapshots: input.persistence.pricingDecisionSnapshotsReused,
        },
        skipped: {
          duplicateEventPropertyImpacts: input.persistence.eventPropertyImpactsSkippedAsDuplicate,
        },
      },
      runtime: {
        lockKey: input.runtime.lockKey,
        lockProvider: input.runtime.lockProvider,
        attempts: input.runtime.attempts,
        operationRetries: input.runtime.operationRetries,
        retryDelaysMs: input.runtime.retryDelaysMs,
        queueMode: 'inline_lock_retry',
        retryPolicy: {
          maxAttempts: RECOMPUTE_MAX_ATTEMPTS,
          retryable: ['lock_busy', 'deadlock', 'lock_wait_timeout', 'connection_lost', 'timeout'],
        },
      },
      failures,
      snapshots: input.snapshots.map((snapshot) => ({
        id: snapshot.id ?? null,
        eventId: snapshot.event?.id ?? null,
        eventDemandScore: this.numberOrNull(snapshot.eventDemandScore),
        eventRevenuePotentialCents: this.numberOrNull(snapshot.eventRevenuePotentialCents),
        confidence: snapshot.confidence,
        generatedAt: this.toIso(snapshot.generatedAt),
        jobRunId: snapshot.jobRunId ?? null,
      })),
      propertyImpacts: input.impacts.slice(0, 25).map((impact) => ({
        id: impact.id ?? null,
        eventId: impact.event?.id ?? null,
        propertyId: impact.property?.id ?? null,
        propertyCaptureScore: this.numberOrNull(impact.propertyCaptureScore),
        recommendedPriceCents: this.numberOrNull(impact.recommendedPriceCents),
        bookingProbability: this.numberOrNull(impact.bookingProbability),
        expectedRevenueCents: this.numberOrNull(impact.expectedRevenueCents),
        recommendedAction: impact.recommendedAction,
      })),
      pricingDecisionSnapshots: input.pricingDecisionSnapshots.slice(0, 25).map((snapshot) => ({
        id: snapshot.id ?? null,
        eventId: snapshot.event?.id ?? null,
        propertyId: snapshot.property?.id ?? null,
        analisePrecoId: snapshot.analisePreco?.id ?? null,
        selectedPriceCents: this.numberOrNull(snapshot.selectedPriceCents),
        bookingProbability: this.numberOrNull(snapshot.bookingProbability),
        status: snapshot.status,
      })),
      message:
        'Recompute v0 persistiu ou reutilizou snapshots de evento, impactos por imóvel e decisões auditáveis com lock/retry idempotente por job.',
    };
  }

  private eventRevenuePotentialFromImpacts(computedImpacts: ComputedPropertyImpact[]) {
    const total = computedImpacts.reduce(
      (sum, { payload }) => sum + Math.max(0, this.numberOrNull(payload.expectedIncrementalRevenueCents) ?? 0),
      0,
    );
    return total || null;
  }

  private averagePropertyCaptureScore(computedImpacts: ComputedPropertyImpact[]) {
    return this.average(
      computedImpacts
        .map(({ payload }) => this.numberOrNull(payload.propertyCaptureScore))
        .filter((score): score is number => score !== null),
    );
  }

  private priceInputFromImpactPayload(
    payload: EventPropertyImpactPayload,
    eventIntelligenceSnapshot: EventIntelligenceSnapshot,
  ): PriceAbsorptionCurveInput {
    const eventDemandScore = this.numberOrNull(eventIntelligenceSnapshot.eventDemandScore);
    const propertyCaptureScore = this.numberOrNull(payload.propertyCaptureScore);
    const supplyCompressionScore =
      this.numberOrNull(eventIntelligenceSnapshot.supplyCompressionScore) ??
      (eventDemandScore !== null && propertyCaptureScore !== null
        ? Math.round(eventDemandScore * 0.65 + propertyCaptureScore * 0.35)
        : null);

    return {
      basePriceCents: this.numberOrNull(payload.basePriceCents),
      currentPriceCents: this.numberOrNull(payload.currentPriceCents),
      marketReferencePriceCents: this.numberOrNull(payload.recommendedPriceCents),
      eventDemandScore,
      propertyCaptureScore,
      supplyCompressionScore,
      affectedNights: null,
      confidence: payload.confidence,
    };
  }

  private pricingDecisionStatusFromAnalysis(analysis: AnalisePreco): PricingDecisionStatus {
    if (analysis.status === 'applied_manual' || analysis.status === 'applied_stays') return 'applied';
    if (analysis.status === 'accepted' || analysis.aceito) return 'accepted';
    if (analysis.status === 'rejected') return 'rejected';
    if (analysis.status === 'expired') return 'expired';
    return 'suggested';
  }

  private recomputeJobRunId(scope: 'event' | 'batch' | 'backfill', eventId?: string) {
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
    const suffix = eventId ? `-${eventId.slice(0, 8)}` : '';
    return `event-intelligence-${scope}-${timestamp}${suffix}`;
  }

  private async findEvents(query: EventCatalogQuery, admin: boolean): Promise<EventEntity[]> {
    const range = this.resolveRange(query.from, query.to, admin ? 90 : 30);
    const qb = this.eventRepo
      .createQueryBuilder('event')
      .where('event.dataInicio BETWEEN :from AND :to', {
        from: this.startDate(range.from),
        to: this.endDate(range.to),
      })
      .andWhere('event.duplicateOfEventId IS NULL')
      .andWhere("(event.dedupStatus IS NULL OR event.dedupStatus = 'canonical')")
      .orderBy('event.dataInicio', 'ASC')
      .addOrderBy('event.relevancia', 'DESC')
      .take(this.limit(query.limit, admin ? 200 : 100));

    if (!admin) {
      qb.andWhere('event.ativo = :active', { active: true }).andWhere('event.outOfScope = :outOfScope', {
        outOfScope: false,
      });
    } else if (query.scope === 'in') {
      qb.andWhere('event.outOfScope = :outOfScope', { outOfScope: false });
    } else if (query.scope === 'out') {
      qb.andWhere('event.outOfScope = :outOfScope', { outOfScope: true });
    }

    if (this.isSpecificFilter(query.city)) qb.andWhere('event.cidade = :city', { city: query.city });
    if (this.isSpecificFilter(query.category)) qb.andWhere('event.categoria = :category', { category: query.category });
    if (this.isSpecificFilter(query.source)) qb.andWhere('event.source = :source', { source: query.source });
    if (this.isTrue(query.highImpact)) qb.andWhere('event.relevancia >= :minHighImpact', { minHighImpact: 60 });
    if (query.venue) qb.andWhere('event.enderecoCompleto LIKE :venue', { venue: `%${query.venue}%` });
    if (query.search) {
      qb.andWhere(
        new Brackets((search) => {
          search
            .where('event.nome LIKE :search')
            .orWhere('event.descricao LIKE :search')
            .orWhere('event.enderecoCompleto LIKE :search');
        }),
      ).setParameter('search', `%${query.search}%`);
    }

    return qb.getMany();
  }

  private async latestSnapshotsByEventIds(eventIds: string[]) {
    const uniqueIds = Array.from(new Set(eventIds.filter(Boolean)));
    const map = new Map<string, EventIntelligenceSnapshot>();
    if (!uniqueIds.length) return map;

    const snapshots = await this.snapshotRepo
      .createQueryBuilder('snapshot')
      .leftJoinAndSelect('snapshot.event', 'event')
      .where('event.id IN (:...eventIds)', { eventIds: uniqueIds })
      .orderBy('snapshot.generatedAt', 'DESC')
      .getMany();

    for (const snapshot of snapshots) {
      const eventId = snapshot.event?.id;
      if (eventId && !map.has(eventId)) map.set(eventId, snapshot);
    }

    return map;
  }

  private async latestSnapshot(eventId: string) {
    return this.snapshotRepo
      .createQueryBuilder('snapshot')
      .leftJoinAndSelect('snapshot.event', 'event')
      .where('event.id = :eventId', { eventId })
      .orderBy('snapshot.generatedAt', 'DESC')
      .getOne();
  }

  private async getEventOrThrow(eventId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento não encontrado');
    if (event.duplicateOfEventId) {
      const canonical = await this.eventRepo.findOne({ where: { id: event.duplicateOfEventId } });
      if (canonical) return canonical;
    }
    if (event.dedupStatus && event.dedupStatus !== 'canonical') {
      throw new NotFoundException('Evento não encontrado');
    }
    return event;
  }

  private async findOwnedAddresses(userId: string, propertyId?: string) {
    const qb = this.addressRepo
      .createQueryBuilder('address')
      .leftJoinAndSelect('address.list', 'list')
      .leftJoin('address.user', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('address.ativo = :active', { active: true })
      .take(1000);
    if (this.isSpecificFilter(propertyId)) qb.andWhere('address.id = :propertyId', { propertyId });
    return qb.getMany();
  }

  private async findPersistedImpactsForEvent(eventId: string, userId?: string, propertyId?: string) {
    const qb = this.impactRepo
      .createQueryBuilder('impact')
      .leftJoinAndSelect('impact.event', 'event')
      .leftJoinAndSelect('impact.property', 'property')
      .leftJoinAndSelect('impact.list', 'list')
      .leftJoinAndSelect('impact.hostUser', 'hostUser')
      .leftJoinAndSelect('impact.intelligenceSnapshot', 'snapshot')
      .leftJoinAndSelect('impact.analisePreco', 'analysis')
      .where('event.id = :eventId', { eventId })
      .andWhere('event.duplicateOfEventId IS NULL')
      .andWhere("(event.dedupStatus IS NULL OR event.dedupStatus = 'canonical')")
      .orderBy('impact.generatedAt', 'DESC')
      .take(500);
    if (userId) qb.andWhere('hostUser.id = :userId', { userId });
    if (this.isSpecificFilter(propertyId)) qb.andWhere('property.id = :propertyId', { propertyId });
    return this.latestPersistedImpacts(await qb.getMany());
  }

  private async findPersistedImpactsInRange(input: {
    userId: string;
    from: string;
    to: string;
    propertyId?: string;
    category?: string;
    confidence?: EventIntelligenceConfidence | null;
  }) {
    const qb = this.impactRepo
      .createQueryBuilder('impact')
      .leftJoinAndSelect('impact.event', 'event')
      .leftJoinAndSelect('impact.property', 'property')
      .leftJoinAndSelect('impact.list', 'list')
      .leftJoinAndSelect('impact.hostUser', 'hostUser')
      .leftJoinAndSelect('impact.intelligenceSnapshot', 'snapshot')
      .leftJoinAndSelect('impact.analisePreco', 'analysis')
      .where('hostUser.id = :userId', { userId: input.userId })
      .andWhere('event.dataInicio BETWEEN :from AND :to', {
        from: this.startDate(input.from),
        to: this.endDate(input.to),
      })
      .andWhere('event.duplicateOfEventId IS NULL')
      .andWhere("(event.dedupStatus IS NULL OR event.dedupStatus = 'canonical')")
      .orderBy('impact.generatedAt', 'DESC')
      .take(500);
    if (this.isSpecificFilter(input.propertyId)) qb.andWhere('property.id = :propertyId', { propertyId: input.propertyId });
    if (this.isSpecificFilter(input.category)) qb.andWhere('event.categoria = :category', { category: input.category });
    if (input.confidence) qb.andWhere('impact.confidence = :confidence', { confidence: input.confidence });
    return this.latestPersistedImpacts(await qb.getMany());
  }

  private latestPersistedImpacts(impacts: EventPropertyImpact[]) {
    const latest = new Map<string, EventPropertyImpact>();
    for (const impact of impacts) {
      const key = [
        impact.event?.id ?? 'no-event',
        impact.property?.id ?? 'no-property',
        impact.analisePreco?.id ?? impact.list?.id ?? 'no-analysis',
      ].join(':');
      if (!latest.has(key)) latest.set(key, impact);
    }
    return Array.from(latest.values());
  }

  private async findAnaliseImpactsForEvent(eventId: string, userId?: string, propertyId?: string) {
    const qb = this.analiseRepo
      .createQueryBuilder('analysis')
      .leftJoinAndSelect('analysis.evento', 'event')
      .leftJoinAndSelect('analysis.endereco', 'address')
      .leftJoinAndSelect('address.list', 'list')
      .leftJoinAndSelect('analysis.usuarioProprietario', 'owner')
      .where('event.id = :eventId', { eventId })
      .andWhere('event.duplicateOfEventId IS NULL')
      .andWhere("(event.dedupStatus IS NULL OR event.dedupStatus = 'canonical')")
      .orderBy('analysis.criadoEm', 'DESC')
      .take(500);
    if (userId) qb.andWhere('owner.id = :userId', { userId });
    if (this.isSpecificFilter(propertyId)) qb.andWhere('address.id = :propertyId', { propertyId });
    return qb.getMany();
  }

  private async findAnaliseImpactsInRange(userId: string, query: EventCatalogQuery, range: DateRange) {
    const qb = this.analiseRepo
      .createQueryBuilder('analysis')
      .leftJoinAndSelect('analysis.evento', 'event')
      .leftJoinAndSelect('analysis.endereco', 'address')
      .leftJoinAndSelect('address.list', 'list')
      .leftJoinAndSelect('analysis.usuarioProprietario', 'owner')
      .where('owner.id = :userId', { userId })
      .andWhere('event.dataInicio BETWEEN :from AND :to', {
        from: this.startDate(range.from),
        to: this.endDate(range.to),
      })
      .andWhere('event.duplicateOfEventId IS NULL')
      .andWhere("(event.dedupStatus IS NULL OR event.dedupStatus = 'canonical')")
      .orderBy('analysis.criadoEm', 'DESC')
      .take(500);
    if (this.isSpecificFilter(query.propertyId)) qb.andWhere('address.id = :propertyId', { propertyId: query.propertyId });
    if (this.isSpecificFilter(query.category)) qb.andWhere('event.categoria = :category', { category: query.category });
    const radiusKm = this.positiveNumber(query.radiusKm);
    if (radiusKm !== null) qb.andWhere('analysis.distanciaSuaPropriedade <= :radiusKm', { radiusKm });
    return qb.getMany();
  }

  private async loadImpactCounts(eventIds: string[]) {
    const map = new Map<string, number>();
    const uniqueIds = Array.from(new Set(eventIds.filter(Boolean)));
    if (!uniqueIds.length) return map;

    const rows = await this.impactRepo
      .createQueryBuilder('impact')
      .select('event.id', 'eventId')
      .addSelect('COUNT(DISTINCT property.id)', 'affectedPropertiesCount')
      .leftJoin('impact.event', 'event')
      .leftJoin('impact.property', 'property')
      .where('event.id IN (:...eventIds)', { eventIds: uniqueIds })
      .groupBy('event.id')
      .getRawMany();

    for (const row of rows) map.set(row.eventId, Number(row.affectedPropertiesCount) || 0);
    return map;
  }

  private async loadRecommendationCounts(eventIds: string[]) {
    const map = new Map<string, number>();
    const uniqueIds = Array.from(new Set(eventIds.filter(Boolean)));
    if (!uniqueIds.length) return map;

    const rows = await this.analiseRepo
      .createQueryBuilder('analysis')
      .select('event.id', 'eventId')
      .addSelect('COUNT(analysis.id)', 'recommendationsGenerated')
      .leftJoin('analysis.evento', 'event')
      .where('event.id IN (:...eventIds)', { eventIds: uniqueIds })
      .groupBy('event.id')
      .getRawMany();

    for (const row of rows) map.set(row.eventId, Number(row.recommendationsGenerated) || 0);
    return map;
  }

  private toCatalogItem(event: EventEntity, snapshot?: EventIntelligenceSnapshot | null): EventCatalogItem {
    const derivedDemand = snapshot ? null : this.deriveEventDemand(event);
    const demandScore =
      this.numberOrNull(snapshot?.eventDemandScore) ??
      derivedDemand?.eventDemandScore ??
      this.numberOrNull(event.relevancia);
    const confidence = snapshot?.confidence ?? derivedDemand?.confidence ?? this.confidenceFromEvent(event);
    const badges = new Set<string>();
    if ((demandScore ?? 0) >= 80) badges.add('alto impacto');
    if ((demandScore ?? 0) >= 55) badges.add('demanda aquecida');
    if (event.linkSiteOficial) badges.add('fonte oficial');
    if (snapshot) badges.add('evento monitorado');
    if (event.pendingGeocode) badges.add('geocode pendente');

    return {
      id: event.id,
      name: event.nome,
      description: event.descricao ?? null,
      startsAt: this.toIso(event.dataInicio),
      endsAt: this.toIso(event.dataFim),
      city: event.cidade ?? null,
      state: event.estado ?? null,
      venueName: this.venueName(event),
      address: event.enderecoCompleto ?? null,
      latitude: this.numberOrNull(event.latitude),
      longitude: this.numberOrNull(event.longitude),
      category: event.categoria ?? null,
      imageUrl: event.imagem_url ?? null,
      officialUrl: event.linkSiteOficial ?? null,
      crawledUrl: event.crawledUrl ?? null,
      source: event.source ?? null,
      urbanScore: this.numberOrNull(event.relevancia),
      demandScore,
      confidence,
      badges: Array.from(badges),
    };
  }

  private toIntelligencePayload(
    event: EventEntity,
    snapshot?: EventIntelligenceSnapshot | null,
  ): EventIntelligencePayload {
    const derivedDemand = snapshot ? null : this.deriveEventDemand(event);
    const eventDemandScore =
      this.numberOrNull(snapshot?.eventDemandScore) ??
      derivedDemand?.eventDemandScore ??
      this.numberOrNull(event.relevancia);
    const expectedAttendance =
      this.numberOrNull(snapshot?.expectedAttendance) ??
      derivedDemand?.expectedAttendance ??
      this.numberOrNull(event.expectedAttendance) ??
      this.numberOrNull(event.capacidadeEstimada) ??
      this.numberOrNull(event.venueCapacity);
    const sourceFreshnessHours =
      this.numberOrNull(snapshot?.sourceFreshnessHours) ?? this.sourceFreshnessHours(event.dataCrawl);
    const drivers = snapshot?.drivers?.length
      ? snapshot.drivers
      : derivedDemand
        ? this.toDriverPayload(derivedDemand.drivers)
        : this.derivedDrivers(event, eventDemandScore, expectedAttendance);

    return {
      eventDemandScore,
      eventRevenuePotentialCents: this.numberOrNull(snapshot?.eventRevenuePotentialCents),
      demandRadiusKm:
        this.numberOrNull(snapshot?.demandRadiusKm) ??
        derivedDemand?.demandRadiusKm ??
        this.numberOrNull(event.raioImpactoKm),
      expectedAttendance,
      sourceReliabilityScore:
        this.numberOrNull(snapshot?.sourceReliabilityScore) ??
        derivedDemand?.sourceReliabilityScore ??
        this.deriveSourceReliabilityScore(event),
      sourceFreshnessHours,
      confidence: snapshot?.confidence ?? derivedDemand?.confidence ?? this.confidenceFromEvent(event),
      interpretation:
        snapshot?.interpretation ??
        derivedDemand?.interpretation ??
        this.derivedInterpretation(event, eventDemandScore, expectedAttendance),
      drivers,
      hotRegions: snapshot?.hotRegions ?? [],
      riskFlags: snapshot?.riskFlags ?? this.unique([...(derivedDemand?.riskFlags ?? []), ...this.riskFlags(event)]),
      dataQualityFlags:
        snapshot?.dataQualityFlags ??
        this.unique([...(derivedDemand?.dataQualityFlags ?? []), ...this.dataQualityFlags(event, snapshot)]),
      generatedAt: this.toIso(snapshot?.generatedAt) ?? derivedDemand?.generatedAt ?? new Date().toISOString(),
      modelVersion: snapshot?.modelVersion ?? derivedDemand?.modelVersion ?? 'stub-contract-v0',
      metricVersion: snapshot?.metricVersion ?? derivedDemand?.metricVersion ?? 'event-demand-v0',
      jobRunId: snapshot?.jobRunId ?? null,
      dataStatus: snapshot ? 'persisted' : 'derived_from_event_fields',
    };
  }

  private toPersistedImpactPayload(impact: EventPropertyImpact): EventPropertyImpactPayload & { eventId?: string } {
    return {
      eventId: impact.event?.id,
      propertyId: impact.property?.id,
      propertyName: this.propertyName(impact.property, impact.list),
      listId: impact.list?.id ?? impact.property?.list?.id ?? null,
      distanceKm: this.numberOrNull(impact.distanceKm),
      travelTimeMinutes: this.numberOrNull(impact.travelTimeMinutes),
      propertyCaptureScore: this.numberOrNull(impact.propertyCaptureScore),
      basePriceCents: this.numberOrNull(impact.basePriceCents),
      currentPriceCents: this.numberOrNull(impact.currentPriceCents),
      recommendedPriceCents: this.numberOrNull(impact.recommendedPriceCents),
      minAbsorbablePriceCents: this.numberOrNull(impact.minAbsorbablePriceCents),
      maxAbsorbablePriceCents: this.numberOrNull(impact.maxAbsorbablePriceCents),
      recommendedMultiplier: this.numberOrNull(impact.recommendedMultiplier),
      maxPlausibleMultiplier: this.numberOrNull(impact.maxPlausibleMultiplier),
      bookingProbability: this.numberOrNull(impact.bookingProbability),
      expectedRevenueCents: this.numberOrNull(impact.expectedRevenueCents),
      expectedIncrementalRevenueCents: this.numberOrNull(impact.expectedIncrementalRevenueCents),
      confidence: impact.confidence ?? 'low',
      mainDrivers: impact.mainDrivers ?? [],
      priceAbsorptionScenarios: impact.priceAbsorptionScenarios ?? [],
      recommendedAction: impact.recommendedAction ?? 'watch',
      riskFlags: impact.riskFlags ?? [],
      generatedAt: this.toIso(impact.generatedAt),
      modelVersion: impact.modelVersion,
      metricVersion: impact.metricVersion,
      jobRunId: impact.jobRunId ?? null,
      dataStatus: 'persisted',
    };
  }

  private toAnalysisImpactPayload(analysis: AnalisePreco): EventPropertyImpactPayload & { eventId?: string } {
    const event = analysis.evento;
    const address = analysis.endereco;
    const currentPriceCents = this.moneyToCents(analysis.seuPrecoAtual);
    const legacyRecommendedPriceCents = this.moneyToCents(analysis.precoSugerido);
    const legacyRecommendedMultiplier =
      currentPriceCents && legacyRecommendedPriceCents
        ? Math.round((legacyRecommendedPriceCents / currentPriceCents) * 100) / 100
        : null;
    const eventDemand = event ? this.deriveEventDemand(event) : null;
    const distanceKm = this.numberOrNull(analysis.distanciaSuaPropriedade);
    const propertyCapture = eventDemand
      ? this.pricingIntelligence.propertyCaptureScore({
          distanceKm,
          travelTimeMinutes: null,
          eventDemandScore: eventDemand.eventDemandScore,
          demandRadiusKm: eventDemand.demandRadiusKm,
          currentPriceCents,
          basePriceCents: currentPriceCents ?? legacyRecommendedPriceCents,
          compMedianPriceCents: legacyRecommendedPriceCents,
          available: this.availabilityFromAnalysis(analysis),
          rating: this.numberOrNull((address?.list as any)?.rating),
          reviewCount: this.numberOrNull((address?.list as any)?.reviewCount),
          accommodates: this.numberOrNull((address?.list as any)?.hospedes),
          bedrooms: this.numberOrNull((address?.list as any)?.quartos),
          bathrooms: this.numberOrNull((address?.list as any)?.banheiros),
          eventStartsAt: event?.dataInicio,
          eventEndsAt: event?.dataFim,
        })
      : null;
    const curveBasePriceCents = currentPriceCents ?? legacyRecommendedPriceCents;
    const curve =
      curveBasePriceCents && eventDemand
        ? this.pricingIntelligence.priceAbsorptionCurve({
            basePriceCents: curveBasePriceCents,
            currentPriceCents,
            marketReferencePriceCents: legacyRecommendedPriceCents,
            eventDemandScore: eventDemand.eventDemandScore,
            propertyCaptureScore: propertyCapture?.propertyCaptureScore,
            supplyCompressionScore: this.deriveSupplyCompressionScore(eventDemand, propertyCapture),
            affectedNights: propertyCapture?.affectedNights,
            confidence: propertyCapture?.confidence ?? eventDemand.confidence,
          })
        : null;
    const recommendedPriceCents = curve?.recommendedPriceCents ?? legacyRecommendedPriceCents;
    const recommendedMultiplier = curve?.recommendedMultiplier ?? legacyRecommendedMultiplier;
    const confidence = curve?.confidence ?? propertyCapture?.confidence ?? eventDemand?.confidence ?? 'low';
    const priceScenarios = curve ? this.toPriceAbsorptionScenarios(curve.scenarios) : [];
    const mainDrivers: Array<EventIntelligenceDriver | string> =
      propertyCapture || curve
        ? [
            'derived_from_existing_analise_preco',
            ...this.toDriverPayload([...(propertyCapture?.drivers ?? []), ...(curve?.drivers ?? [])]).slice(0, 8),
          ]
        : ['derived_from_existing_analise_preco', 'price_absorption_curve_pending_nico_engine'];
    const riskFlags =
      propertyCapture || curve
        ? this.unique([
            ...(propertyCapture?.riskFlags ?? []),
            ...(curve?.riskFlags ?? []),
            ...this.analysisRiskFlags(analysis),
          ])
        : ['booking_probability_pending_engine'];

    return {
      eventId: event?.id,
      propertyId: address?.id,
      propertyName: this.propertyName(address, address?.list),
      listId: address?.list?.id ?? null,
      distanceKm,
      travelTimeMinutes: null,
      propertyCaptureScore: propertyCapture?.propertyCaptureScore ?? null,
      basePriceCents: curve?.basePriceCents ?? curveBasePriceCents ?? null,
      currentPriceCents,
      recommendedPriceCents,
      minAbsorbablePriceCents: curve?.minAbsorbablePriceCents ?? null,
      maxAbsorbablePriceCents: curve?.maxAbsorbablePriceCents ?? null,
      recommendedMultiplier,
      maxPlausibleMultiplier: curve?.maxPlausibleMultiplier ?? null,
      bookingProbability: curve?.bookingProbability ?? null,
      expectedRevenueCents: curve?.expectedRevenueCents ?? null,
      expectedIncrementalRevenueCents:
        curve?.expectedIncrementalRevenueCents ??
        (currentPriceCents !== null && recommendedPriceCents !== null ? recommendedPriceCents - currentPriceCents : null),
      confidence,
      mainDrivers,
      priceAbsorptionScenarios: priceScenarios,
      recommendedAction: this.actionFromComputedPricing(analysis, propertyCapture, curve, recommendedMultiplier),
      riskFlags,
      generatedAt: curve?.generatedAt ?? this.toIso(analysis.criadoEm) ?? new Date().toISOString(),
      modelVersion: curve?.modelVersion ?? eventDemand?.modelVersion ?? 'stub-contract-v0',
      metricVersion: curve?.metricVersion ?? 'property-impact-rules-v0',
      jobRunId: null,
      dataStatus: 'derived_from_analise_preco',
    };
  }

  private buildRadarSummary(items: Array<{ impacts: EventPropertyImpactPayload[] }>) {
    const propertyIds = new Set<string>();
    let expectedIncrementalRevenueCents = 0;
    let opportunities = 0;
    for (const item of items) {
      for (const impact of item.impacts) {
        propertyIds.add(impact.propertyId);
        if (impact.expectedIncrementalRevenueCents !== null) {
          expectedIncrementalRevenueCents += impact.expectedIncrementalRevenueCents;
        }
        if (impact.recommendedAction !== 'watch') opportunities += 1;
      }
    }
    return {
      relevantEvents: items.length,
      impactedProperties: propertyIds.size,
      opportunities,
      expectedIncrementalRevenueCents,
      dataStatus: items.length ? 'persisted_or_derived' : ENGINE_PENDING_STUB,
    };
  }

  private buildAdminSummary(items: any[]) {
    const totalRevenuePotentialCents = items.reduce(
      (sum, item) => sum + (this.numberOrNull(item.intelligence.eventRevenuePotentialCents) ?? 0),
      0,
    );
    const highDemandEvents = items.filter((item) => (item.intelligence.eventDemandScore ?? 0) >= 70).length;
    const affectedProperties = items.reduce(
      (sum, item) => sum + (item.impact?.affectedPropertiesCount ?? 0),
      0,
    );
    const recommendationsGenerated = items.reduce(
      (sum, item) => sum + (item.impact?.recommendationsGenerated ?? 0),
      0,
    );
    const avgConfidenceScore = this.average(items.map((item) => this.confidenceScore(item.intelligence.confidence)));

    return {
      events: items.length,
      highDemandEvents,
      totalRevenuePotentialCents,
      affectedProperties,
      recommendationsGenerated,
      averageConfidence: this.confidenceFromScore(avgConfidenceScore ?? 0),
    };
  }

  private async relatedEvents(event: EventEntity) {
    if (!event.cidade) return [];
    const events = await this.eventRepo
      .createQueryBuilder('event')
      .where('event.id != :eventId', { eventId: event.id })
      .andWhere('event.duplicateOfEventId IS NULL')
      .andWhere("(event.dedupStatus IS NULL OR event.dedupStatus = 'canonical')")
      .andWhere('event.cidade = :city', { city: event.cidade })
      .andWhere('event.dataInicio BETWEEN :from AND :to', {
        from: this.startDate(this.dateOnly(event.dataInicio) ?? this.today()),
        to: this.endDate(this.addDays(this.dateOnly(event.dataInicio) ?? this.today(), 14)),
      })
      .orderBy('event.relevancia', 'DESC')
      .take(6)
      .getMany();
    const snapshots = await this.latestSnapshotsByEventIds(events.map((row) => row.id));
    return events.map((row) => this.toCatalogItem(row, snapshots.get(row.id)));
  }

  private stripInternalImpactFields<T extends EventPropertyImpactPayload & { eventId?: string }>(impact: T) {
    const { eventId: _eventId, ...publicImpact } = impact;
    return publicImpact;
  }

  private filterImpactsByConfidence(items: Array<EventPropertyImpactPayload & { eventId?: string }>, confidence?: string) {
    const normalized = this.normalizeConfidence(confidence);
    return normalized ? items.filter((item) => item.confidence === normalized) : items;
  }

  private isNearAnyOwnedProperty(
    event: EventEntity,
    snapshot: EventIntelligenceSnapshot | undefined,
    addresses: Address[],
    radiusOverrideKm?: number | null,
  ) {
    const eventLat = this.numberOrNull(event.latitude);
    const eventLng = this.numberOrNull(event.longitude);
    if (eventLat === null || eventLng === null) return false;
    const radiusKm = radiusOverrideKm ?? this.numberOrNull(snapshot?.demandRadiusKm) ?? this.numberOrNull(event.raioImpactoKm) ?? 8;
    return addresses.some((address) => {
      const lat = this.numberOrNull(address.latitude);
      const lng = this.numberOrNull(address.longitude);
      if (lat === null || lng === null) return false;
      return this.distanceKm(eventLat, eventLng, lat, lng) <= radiusKm;
    });
  }

  private deriveEventDemand(event: EventEntity): EventDemandScoreResult {
    return this.pricingIntelligence.eventDemandScore({
      relevancia: this.numberOrNull(event.relevancia),
      expectedAttendance: this.numberOrNull(event.expectedAttendance),
      capacidadeEstimada: this.numberOrNull(event.capacidadeEstimada),
      historicalAttendance: this.numberOrNull(event.historicalAttendance),
      venueCapacity: this.numberOrNull(event.venueCapacity),
      venueType: event.venueType ?? null,
      categoria: event.categoria ?? null,
      raioImpactoKm: this.numberOrNull(event.raioImpactoKm),
      startsAt: event.dataInicio,
      source: event.source ?? null,
      dataCrawl: event.dataCrawl,
      sourceFreshnessHours: this.sourceFreshnessHours(event.dataCrawl),
      overlapEventsCount: null,
    });
  }

  private toDriverPayload(drivers: Array<EngineIntelligenceDriver | EventIntelligenceDriver>): EventIntelligenceDriver[] {
    return drivers.map((driver) => {
      const score = this.numberOrNull((driver as EngineIntelligenceDriver).score);
      const value = (driver as EngineIntelligenceDriver).value;
      const details = [
        score !== null ? `score ${score}` : null,
        value !== null && value !== undefined && value !== '' ? `valor ${value}` : null,
      ].filter(Boolean);

      return {
        key: driver.key,
        label: driver.label,
        weight: this.numberOrNull(driver.weight) ?? 0,
        explanation: details.length ? `${driver.explanation} (${details.join(', ')}).` : driver.explanation,
      };
    });
  }

  private toPriceAbsorptionScenarios(scenarios: EnginePriceAbsorptionScenario[]): PriceAbsorptionScenario[] {
    return scenarios.map((scenario) => ({
      scenario: scenario.scenario,
      priceCents: scenario.priceCents,
      multiplier: scenario.multiplier,
      bookingProbability: scenario.bookingProbability,
      expectedRevenueCents: scenario.expectedRevenueCents,
      interpretation: `${scenario.label}: ${scenario.explanation}${
        scenario.isRecommended ? ' Recomendado pelo motor v0.' : ''
      }`,
    }));
  }

  private deriveSupplyCompressionScore(
    eventDemand: EventDemandScoreResult,
    propertyCapture?: PropertyCaptureScoreResult | null,
  ) {
    const captureScore = propertyCapture?.propertyCaptureScore ?? eventDemand.eventDemandScore;
    return Math.round(eventDemand.eventDemandScore * 0.65 + captureScore * 0.35);
  }

  private actionFromComputedPricing(
    analysis: AnalisePreco,
    propertyCapture: PropertyCaptureScoreResult | null,
    curve: PriceAbsorptionCurveResult | null,
    multiplier: number | null,
  ): EventPropertyRecommendedAction {
    if (analysis.status === 'accepted' || analysis.status === 'applied_manual' || analysis.status === 'applied_stays') {
      return 'apply';
    }
    if (analysis.status === 'rejected' || analysis.status === 'expired') return 'watch';
    if (propertyCapture?.recommendedAction === 'review') return 'review';
    if (curve && curve.bookingProbability >= 0.5 && curve.recommendedMultiplier >= 1.2 && curve.confidence !== 'low') {
      return 'apply';
    }
    if (propertyCapture?.recommendedAction) return this.engineActionToEventAction(propertyCapture.recommendedAction);
    return this.actionFromAnalysis(analysis, multiplier);
  }

  private engineActionToEventAction(action: RecommendedPricingAction): EventPropertyRecommendedAction {
    return action;
  }

  private availabilityFromAnalysis(analysis: AnalisePreco): boolean | null {
    if (analysis.reservaStatus === 'blocked' || analysis.reservaStatus === 'booked') return false;
    if (analysis.reservaStatus === 'not_booked') return true;
    return null;
  }

  private analysisRiskFlags(analysis: AnalisePreco) {
    const flags: string[] = [];
    if (analysis.reservaStatus === 'blocked' || analysis.reservaStatus === 'booked') {
      flags.push('property_unavailable_for_event_window');
    }
    if (analysis.status === 'rejected') flags.push('previous_recommendation_rejected');
    if (analysis.status === 'expired') flags.push('previous_recommendation_expired');
    return flags;
  }

  private hasComputedPricing(items: EventPropertyImpactPayload[]) {
    return items.some(
      (item) => item.bookingProbability !== null && (item.priceAbsorptionScenarios?.length ?? 0) > 0,
    );
  }

  private radarHasComputedPricing(items: Array<{ impacts?: EventPropertyImpactPayload[] }>) {
    return items.some((item) => this.hasComputedPricing(item.impacts ?? []));
  }

  private derivedDrivers(
    event: EventEntity,
    demandScore: number | null,
    expectedAttendance: number | null,
  ): EventIntelligenceDriver[] {
    const drivers: EventIntelligenceDriver[] = [
      {
        key: 'event_relevance',
        label: 'Relevância do evento',
        weight: demandScore ?? 0,
        explanation: 'Derivado do campo relevância até o motor de demanda persistir o score final.',
      },
    ];
    if (expectedAttendance !== null) {
      drivers.push({
        key: 'expected_attendance',
        label: 'Público esperado',
        weight: Math.min(100, Math.round(expectedAttendance / 1000)),
        explanation: 'Usa expectedAttendance, capacidadeEstimada ou venueCapacity quando disponível.',
      });
    }
    if (event.raioImpactoKm) {
      drivers.push({
        key: 'impact_radius',
        label: 'Raio de impacto',
        weight: Math.min(100, Math.round(Number(event.raioImpactoKm) * 5)),
        explanation: 'Raio atual vem do enriquecimento do evento e será recalibrado pelo motor.',
      });
    }
    return drivers;
  }

  private derivedInterpretation(event: EventEntity, score: number | null, expectedAttendance: number | null) {
    if (score === null) {
      return 'Ainda não há score suficiente para interpretar este evento com segurança.';
    }
    const size = expectedAttendance ? ` e público estimado de ${expectedAttendance}` : '';
    if (score >= 80) return `Este evento deve aquecer a região com alta intensidade${size}.`;
    if (score >= 50) return `Este evento pode gerar demanda adicional localizada${size}.`;
    return `Este evento parece ter impacto mais moderado para hospedagem${size}.`;
  }

  private dataQualityFlags(
    event: EventEntity,
    snapshot?: EventIntelligenceSnapshot | null,
    options?: { includeMissingSnapshot?: boolean },
  ) {
    const flags: string[] = [];
    if (!snapshot && options?.includeMissingSnapshot !== false) flags.push('missing_event_intelligence_snapshot');
    if (!this.hasCoordinates(event)) flags.push('missing_coordinates');
    if (!event.linkSiteOficial) flags.push('missing_official_url');
    if (!event.expectedAttendance && !event.capacidadeEstimada && !event.venueCapacity) {
      flags.push('missing_attendance_estimate');
    }
    if (event.pendingGeocode) flags.push('pending_geocode');
    if (event.outOfScope) flags.push('out_of_scope');
    return flags;
  }

  private riskFlags(event: EventEntity) {
    const flags: string[] = [];
    if (!this.hasCoordinates(event)) flags.push('cannot_calculate_property_distance');
    if (!event.linkSiteOficial && !event.crawledUrl) flags.push('source_validation_limited');
    return flags;
  }

  private actionFromAnalysis(analysis: AnalisePreco, multiplier: number | null): EventPropertyRecommendedAction {
    if (analysis.status === 'accepted' || analysis.status === 'applied_manual' || analysis.status === 'applied_stays') {
      return 'apply';
    }
    if ((multiplier ?? 0) >= 1.25) return 'simulate';
    return 'watch';
  }

  private engineStubs(fields?: string[]) {
    return [
      {
        owner: 'Nico Engine',
        status: ENGINE_PENDING_STUB,
        fields: fields ?? [
          'eventRevenuePotentialCents',
          'propertyCaptureScore',
          'bookingProbability',
          'expectedRevenueCents',
          'priceAbsorptionScenarios',
        ],
      },
    ];
  }

  private resolveRange(from?: string, to?: string, defaultDays = 30): DateRange {
    const start = from || this.today();
    const end = to || this.addDays(start, defaultDays);
    return { from: this.dateOnly(start), to: this.dateOnly(end) };
  }

  private startDate(value: string) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private endDate(value: string) {
    return new Date(`${value}T23:59:59.999Z`);
  }

  private today() {
    return this.dateOnly(new Date());
  }

  private addDays(value: string, days: number) {
    return this.dateOnly(new Date(this.startDate(value).getTime() + days * MS_PER_DAY));
  }

  private resolveBackfillRange(options: EventIntelligenceBackfillOptions): DateRange {
    const today = this.today();
    const from = this.maxDateOnly(options.from, today);
    const lookaheadDays = this.lookaheadDays(options.lookaheadDays);
    const to = options.to ? this.maxDateOnly(options.to, from) : this.addDays(from, lookaheadDays);
    return { from, to };
  }

  private maxDateOnly(value: string | undefined, floor: string) {
    const normalized = value ? this.dateOnly(value) : floor;
    return normalized < floor ? floor : normalized;
  }

  private lookaheadDays(value: unknown) {
    const parsed = Number(value);
    return Math.max(1, Math.min(365, Number.isFinite(parsed) ? parsed : 90));
  }

  private dateOnly(value: string | Date) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return this.today();
    return date.toISOString().slice(0, 10);
  }

  private toIso(value?: string | Date | null) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  private numberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  private nullableNumber(value: unknown): number {
    return this.numberOrNull(value) ?? 0;
  }

  private moneyToCents(value: unknown) {
    const number = this.numberOrNull(value);
    return number === null ? null : Math.round(number * 100);
  }

  private limit(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Math.max(1, Math.min(500, Number.isFinite(parsed) ? parsed : fallback));
  }

  private backfillLimit(value: unknown) {
    const parsed = Number(value);
    return Math.max(1, Math.min(100, Number.isFinite(parsed) ? parsed : 25));
  }

  private isTrue(value: unknown) {
    return value === true || value === 'true' || value === '1';
  }

  private isSpecificFilter(value: unknown): boolean {
    return typeof value === 'string' ? value.trim() !== '' && value !== 'all' : Boolean(value);
  }

  private positiveNumber(value: unknown): number | null {
    const number = this.numberOrNull(value);
    return number !== null && number > 0 ? number : null;
  }

  private normalizeConfidence(value?: string): EventIntelligenceConfidence | null {
    if (value === 'low' || value === 'medium' || value === 'high') return value;
    return null;
  }

  private confidenceFromEvent(event: EventEntity): EventIntelligenceConfidence {
    const score = this.numberOrNull(event.relevancia) ?? 0;
    if (score >= 75 && this.hasCoordinates(event)) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  private confidenceScore(confidence: EventIntelligenceConfidence) {
    if (confidence === 'high') return 85;
    if (confidence === 'medium') return 60;
    return 30;
  }

  private confidenceFromScore(score: number): EventIntelligenceConfidence {
    if (score >= 75) return 'high';
    if (score >= 45) return 'medium';
    return 'low';
  }

  private deriveSourceReliabilityScore(event: EventEntity) {
    if (event.linkSiteOficial) return 85;
    if (event.source?.includes('api')) return 75;
    if (event.crawledUrl) return 60;
    return 40;
  }

  private sourceFreshnessHours(dataCrawl?: Date | null) {
    if (!dataCrawl) return null;
    const crawledAt = new Date(dataCrawl).getTime();
    if (Number.isNaN(crawledAt)) return null;
    return Math.round(((Date.now() - crawledAt) / 3_600_000) * 10) / 10;
  }

  private hasCoordinates(event: EventEntity) {
    return this.numberOrNull(event.latitude) !== null && this.numberOrNull(event.longitude) !== null;
  }

  private venueName(event: EventEntity) {
    const local = (event as any).local;
    if (typeof local === 'string' && local.trim()) return local.trim();
    return null;
  }

  private propertyName(address?: Address | null, list?: any) {
    const propertyList = list ?? address?.list;
    return (
      propertyList?.internalNickname ||
      propertyList?.titulo ||
      propertyList?.internalCode ||
      address?.getEnderecoCompleto?.() ||
      address?.id ||
      '(sem nome)'
    );
  }

  private average(values: number[]) {
    const valid = values.filter((value) => Number.isFinite(value));
    if (!valid.length) return null;
    return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 100) / 100;
  }

  private unique(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  private distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const radius = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return radius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  private deg2rad(value: number) {
    return value * (Math.PI / 180);
  }
}
