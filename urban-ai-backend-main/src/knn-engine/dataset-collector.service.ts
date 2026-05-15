import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Not, Repository } from 'typeorm';
import { PriceSnapshot } from '../entities/price-snapshot.entity';
import { EventProximityFeature } from '../entities/event-proximity-feature.entity';
import { OccupancyHistory } from '../entities/occupancy-history.entity';
import { Address } from '../entities/addresses.entity';
import { List } from '../entities/list.entity';
import { Event } from '../entities/events.entity';

export type DatasetHealth = 'red' | 'amber' | 'green';
export type DatasetReadiness = 'empty' | 'collecting' | 'training_ready' | 'ground_truth_ready';

export interface DatasetCollectionResult {
  captured: number;
  skipped: number;
  duplicates: number;
  totalLists: number;
  skippedMissingPrice: number;
  skippedInvalidPrice: number;
  externalDataAvailable: boolean;
  status: 'ok' | 'empty_catalog' | 'blocked_missing_price_source' | 'partial_missing_prices';
  warnings: string[];
}

export interface EventProximityCollectionResult {
  captured: number;
  skipped: number;
  duplicates: number;
  totalAddresses: number;
  totalEvents: number;
  status: 'ok' | 'empty_addresses' | 'empty_events';
  warnings: string[];
}

export interface DatasetSize {
  total: number;
  distinctListings: number;
  distinctDays: number;
  trainingReady: number;
}

export interface DatasetDiagnostics {
  generatedAt: string;
  health: DatasetHealth;
  readiness: DatasetReadiness;
  blockers: Array<{
    code: string;
    severity: DatasetHealth;
    message: string;
    nextAction: string;
  }>;
  tables: {
    priceSnapshots: DatasetSize & {
      latestSnapshotDate: string | null;
      byOrigin: Array<{ origin: string; count: number }>;
    };
    occupancyHistory: {
      total: number;
      trainingReady: number;
      latestDate: string | null;
    };
    eventProximityFeatures: {
      total: number;
      latestSnapshotDate: string | null;
    };
  };
  externalDependencies: Record<
    string,
    {
      configured: boolean;
      status: 'configured' | 'missing' | 'defaulted';
      message: string;
    }
  >;
  lastOwnedListingsSnapshot: DatasetCollectionResult | null;
}

/**
 * F6.1 — Coletor passivo do dataset proprietário Urban AI.
 *
 * Estratégia de captura em 3 frentes complementares:
 *
 *  1. **Cron diário 03:30 BRT** (`recordOwnedListingsSnapshot`):
 *     varre todos os imóveis cadastrados (entity List) e grava `PriceSnapshot`
 *     com o preço base atual. Não depende de evento próximo. Independente
 *     de o anfitrião ter reserva ou não. **Constrói a série temporal limpa.**
 *
 *  2. **Captura de comps na análise** (`recordCompsFromAnalysis`):
 *     toda vez que `PropriedadeService.analiseDePreco` roda, ele extrai
 *     `alerts.comps` (imóveis parecidos da vizinhança via Airbnb GraphQL).
 *     Hoje esses comps são usados só para treinar KNN ad-hoc e descartados.
 *     Esta service persiste o snapshot de cada comp para enriquecer o
 *     dataset proprietário **gratuitamente** — uma análise = N pontos novos.
 *
 *  3. **Captura do preço aplicado** (`recordAppliedPrice`):
 *     quando uma sugestão é aceita E (eventualmente, F6.4) pushada via
 *     Stays, gravamos o preço REAL que o anfitrião aplicou. Esse é o
 *     ground truth para medir MAPE.
 *
 * Idempotência: índice composto (snapshotDate, externalListingId) impede
 * duplicação de snapshots no mesmo dia para o mesmo imóvel.
 */
@Injectable()
export class DatasetCollectorService {
  private readonly logger = new Logger(DatasetCollectorService.name);
  private isRunning = false;
  private lastOwnedListingsSnapshot: DatasetCollectionResult | null = null;

  constructor(
    @InjectRepository(PriceSnapshot) private readonly snapshotRepo: Repository<PriceSnapshot>,
    @InjectRepository(OccupancyHistory) private readonly occupancyRepo: Repository<OccupancyHistory>,
    @InjectRepository(EventProximityFeature)
    private readonly eventFeatureRepo: Repository<EventProximityFeature>,
    @InjectRepository(Address) private readonly addressRepo: Repository<Address>,
    @InjectRepository(List) private readonly listRepo: Repository<List>,
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
  ) {}

  // ============ Frente 1: snapshot diário dos imóveis cadastrados ============

  /**
   * Cron diário 03:30 BRT. Roda antes do scraping de eventos (04h) e
   * antes da análise (08h). Constrói série temporal independente de evento.
   */
  @Cron('30 3 * * *', { name: 'dataset-daily-snapshot', timeZone: 'America/Sao_Paulo' })
  async handleDailySnapshot() {
    if (this.isRunning) {
      this.logger.debug('Daily snapshot já em execução; pulando este tick.');
      return;
    }
    this.isRunning = true;
    try {
      const result = await this.recordOwnedListingsSnapshot();
      this.logger.log(
        `Daily snapshot: capturados=${result.captured} pulados=${result.skipped} duplicados=${result.duplicates}`,
      );
    } catch (err) {
      this.logger.error(`Daily snapshot falhou: ${(err as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }

  @Cron('45 3 * * *', { name: 'dataset-event-proximity-snapshot', timeZone: 'America/Sao_Paulo' })
  async handleDailyEventProximitySnapshot() {
    try {
      const result = await this.recordEventProximityFeatures();
      this.logger.log(
        `Event proximity snapshot: capturados=${result.captured} pulados=${result.skipped} duplicados=${result.duplicates}`,
      );
    } catch (err) {
      this.logger.error(`Event proximity snapshot falhou: ${(err as Error).message}`);
    }
  }

  async recordEventProximityFeatures(radiusKm = 5): Promise<EventProximityCollectionResult> {
    const snapshotDate = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [addresses, events] = await Promise.all([
      this.addressRepo.find({
        where: {
          ativo: true,
          latitude: Not(IsNull()),
          longitude: Not(IsNull()),
        } as any,
        relations: ['list'],
        take: 5000,
      }),
      this.eventRepo.find({
        where: {
          ativo: true,
          latitude: Not(IsNull()),
          longitude: Not(IsNull()),
          dataInicio: Between(now, in30Days),
        } as any,
        take: 5000,
      }),
    ]);

    if (addresses.length === 0) {
      return {
        captured: 0,
        skipped: 0,
        duplicates: 0,
        totalAddresses: 0,
        totalEvents: events.length,
        status: 'empty_addresses',
        warnings: ['No active geocoded addresses were available for event proximity snapshots.'],
      };
    }

    if (events.length === 0) {
      return {
        captured: 0,
        skipped: addresses.length,
        duplicates: 0,
        totalAddresses: addresses.length,
        totalEvents: 0,
        status: 'empty_events',
        warnings: ['No active geocoded events were available in the next 30 days.'],
      };
    }

    let captured = 0;
    let skipped = 0;
    let duplicates = 0;

    for (const address of addresses) {
      if (!address.list?.id || !this.isFiniteCoordinate(address.latitude, address.longitude)) {
        skipped++;
        continue;
      }

      const existing = await this.eventFeatureRepo.findOne({
        where: { snapshotDate, list: { id: address.list.id } } as any,
      });
      if (existing) {
        duplicates++;
        continue;
      }

      const aggregate = this.aggregateEventsForAddress(address, events, radiusKm, now);
      await this.eventFeatureRepo.save(
        this.eventFeatureRepo.create({
          snapshotDate,
          list: address.list,
          address,
          ...aggregate,
          competitiveSupplyCount: this.countComparableSupply(address, addresses),
          medianCompPriceCents: null,
        }),
      );
      captured++;
    }

    return {
      captured,
      skipped,
      duplicates,
      totalAddresses: addresses.length,
      totalEvents: events.length,
      status: 'ok',
      warnings: [],
    };
  }

  /**
   * Para cada imóvel cadastrado com preço base atual disponível, grava 1
   * `PriceSnapshot` do dia. Idempotente via índice (snapshotDate, externalListingId).
   *
   * O preço base "atual" hoje vem do que estiver populado em campos do
   * imóvel — quando F6.4 Stays estiver ativo, será o preço real do listing
   * Stays. Por enquanto o método aceita ser chamado manualmente passando
   * `priceCentsResolver` (ex.: integrações Airbnb GraphQL).
   */
  async recordOwnedListingsSnapshot(
    priceCentsResolver?: (list: List) => Promise<number | null>,
  ): Promise<DatasetCollectionResult> {
    const today = new Date().toISOString().slice(0, 10);

    const lists = await this.listRepo.find({ take: 5000 }); // soft cap p/ batch
    let captured = 0;
    let skipped = 0;
    let duplicates = 0;
    let skippedMissingPrice = 0;
    let skippedInvalidPrice = 0;
    const warnings: string[] = [];

    for (const list of lists) {
      let priceCents: number | null = null;
      if (priceCentsResolver) {
        priceCents = await priceCentsResolver(list).catch(() => null);
      }
      if (priceCents == null) {
        priceCents = this.resolveStoredListingPriceCents(list);
      }

      // Sem preço resolvido → pulamos (mas logamos no aggregate).
      if (priceCents == null) {
        skipped++;
        skippedMissingPrice++;
        continue;
      }
      if (!Number.isFinite(priceCents) || priceCents <= 0) {
        skipped++;
        skippedInvalidPrice++;
        continue;
      }

      const externalListingId = this.resolveListingKey(list);

      // Dedup — usa o índice composto. Se já existe snapshot hoje, pula.
      const existing = await this.snapshotRepo.findOne({
        where: {
          snapshotDate: today,
          externalListingId,
        },
      });
      if (existing) {
        duplicates++;
        continue;
      }

      const address = await this.addressRepo.findOne({ where: { list: { id: list.id } } as any });

      await this.snapshotRepo.save(
        this.snapshotRepo.create({
          snapshotDate: today,
          list,
          address: address ?? null,
          externalListingId,
          priceCents,
          currency: 'BRL',
          origin: 'self_cron',
          bedrooms: (list as any).quartos ?? null,
          bathrooms: (list as any).banheiros ?? null,
          bairro: address?.bairro ?? null,
          trainingReady: !!address?.latitude && !!address?.longitude,
        }),
      );
      captured++;
    }

    if (skippedMissingPrice > 0) {
      warnings.push(`${skippedMissingPrice} listings skipped because no current price was available.`);
    }
    if (skippedInvalidPrice > 0) {
      warnings.push(`${skippedInvalidPrice} listings skipped because the resolved price was invalid.`);
    }

    const result: DatasetCollectionResult = {
      captured,
      skipped,
      duplicates,
      totalLists: lists.length,
      skippedMissingPrice,
      skippedInvalidPrice,
      externalDataAvailable: !!priceCentsResolver,
      status: this.collectionStatus(lists.length, captured, duplicates, skippedMissingPrice),
      warnings,
    };
    this.lastOwnedListingsSnapshot = result;
    return result;
  }

  // ============ Frente 2: persistência dos comps que vêm de cada análise ============

  /**
   * Recebe a lista de comps (imóveis parecidos da vizinhança) extraída
   * durante uma análise de preço e grava cada um como snapshot.
   *
   * Volume típico: 5–30 comps por análise × ~N análises/dia = milhares de
   * pontos novos por dia praticamente "de graça".
   */
  async recordCompsFromAnalysis(
    comps: Array<{
      listingID: string;
      latitude?: number;
      longitude?: number;
      bedrooms?: number;
      bathrooms?: number;
      avg_booked_daily_rate_ltm?: number;
      similarity_score?: number;
      bairro?: string;
    }>,
  ): Promise<{ saved: number; duplicates: number }> {
    const today = new Date().toISOString().slice(0, 10);
    let saved = 0;
    let duplicates = 0;

    for (const c of comps) {
      if (!c.listingID || !c.avg_booked_daily_rate_ltm) continue;
      const priceCents = Math.round(Number(c.avg_booked_daily_rate_ltm) * 100);
      if (!Number.isFinite(priceCents) || priceCents <= 0) continue;

      const existing = await this.snapshotRepo.findOne({
        where: { snapshotDate: today, externalListingId: c.listingID },
      });
      if (existing) {
        duplicates++;
        continue;
      }

      await this.snapshotRepo.save(
        this.snapshotRepo.create({
          snapshotDate: today,
          externalListingId: c.listingID,
          priceCents,
          currency: 'BRL',
          origin: 'comp_extraction',
          bedrooms: c.bedrooms ?? null,
          bathrooms: c.bathrooms ?? null,
          bairro: c.bairro ?? null,
          similarityScore: c.similarity_score ?? null,
          trainingReady: !!(c.latitude && c.longitude),
        }),
      );
      saved++;
    }

    return { saved, duplicates };
  }

  // ============ Frente 3: preço REAL que o anfitrião aplicou ============

  /**
   * Quando o anfitrião aceita uma sugestão e o preço é (manual ou auto)
   * aplicado no canal de distribuição, gravar o ground truth para alimentar
   * cálculo de MAPE e treino futuro de XGBoost com erro real.
   */
  async recordAppliedPrice(input: {
    listingId: string;
    targetDate: string; // YYYY-MM-DD
    appliedPriceCents: number;
    listInternalId?: string;
  }): Promise<PriceSnapshot> {
    const existing = await this.snapshotRepo.findOne({
      where: { snapshotDate: input.targetDate, externalListingId: input.listingId },
    });

    if (existing) {
      existing.appliedPriceCents = input.appliedPriceCents;
      return this.snapshotRepo.save(existing);
    }

    return this.snapshotRepo.save(
      this.snapshotRepo.create({
        snapshotDate: input.targetDate,
        externalListingId: input.listingId,
        priceCents: input.appliedPriceCents,
        appliedPriceCents: input.appliedPriceCents,
        currency: 'BRL',
        origin: 'self_cron',
        trainingReady: false,
      }),
    );
  }

  // ============ Helpers de diagnóstico ============

  async datasetSize(): Promise<DatasetSize> {
    const total = await this.snapshotRepo.count();
    const trainingReady = await this.snapshotRepo.count({ where: { trainingReady: true } });

    const distinctListings = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('COUNT(DISTINCT s.externalListingId)', 'c')
      .getRawOne()
      .then((r: any) => Number(r.c));

    const distinctDays = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('COUNT(DISTINCT s.snapshotDate)', 'c')
      .getRawOne()
      .then((r: any) => Number(r.c));

    return { total, distinctListings, distinctDays, trainingReady };
  }

  async datasetDiagnostics(): Promise<DatasetDiagnostics> {
    const [datasetSize, byOrigin, latestSnapshotDate, occupancy, eventFeatures] =
      await Promise.all([
        this.datasetSize(),
        this.snapshotsByOrigin(),
        this.maxColumn(this.snapshotRepo, 's', 'snapshotDate'),
        this.occupancyMetrics(),
        this.eventFeatureMetrics(),
      ]);

    const externalDependencies = this.externalDependencyStatus();
    const blockers = this.buildBlockers(datasetSize, occupancy, eventFeatures, externalDependencies);
    const readiness = this.readiness(datasetSize, occupancy, eventFeatures);
    const health: DatasetHealth = blockers.some((b) => b.severity === 'red')
      ? 'red'
      : blockers.some((b) => b.severity === 'amber')
        ? 'amber'
        : 'green';

    return {
      generatedAt: new Date().toISOString(),
      health,
      readiness,
      blockers,
      tables: {
        priceSnapshots: {
          ...datasetSize,
          latestSnapshotDate,
          byOrigin,
        },
        occupancyHistory: occupancy,
        eventProximityFeatures: eventFeatures,
      },
      externalDependencies,
      lastOwnedListingsSnapshot: this.lastOwnedListingsSnapshot,
    };
  }

  private resolveListingKey(list: List): string {
    const external = (list as any).id_do_anuncio;
    if (external) return String(external);
    return `urban-list:${list.id}`;
  }

  private resolveStoredListingPriceCents(list: List): number | null {
    return (
      this.priceLikeToCents((list as any).dailyPrice) ??
      this.priceLikeToCents((list as any).raw) ??
      this.priceLikeToCents((list as any).priceText)
    );
  }

  private priceLikeToCents(value: unknown): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
    }
    if (typeof value !== 'string') return null;

    const sanitized = value.trim().replace(/[^\d,.-]/g, '');
    if (!sanitized) return null;

    const normalized = sanitized.includes(',')
      ? sanitized.replace(/\./g, '').replace(',', '.')
      : sanitized.replace(/^(\d{1,3}(?:\.\d{3})+)$/, (match) => match.replace(/\./g, ''));

    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : null;
  }

  private aggregateEventsForAddress(address: Address, events: Event[], radiusKm: number, now: Date) {
    const next7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const next14d = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const matches = events
      .map((event) => ({
        event,
        distanceKm: this.distanceKm(
          Number(address.latitude),
          Number(address.longitude),
          Number(event.latitude),
          Number(event.longitude),
        ),
      }))
      .filter(({ event, distanceKm }) => {
        const impactRadius = Number(event.raioImpactoKm ?? radiusKm);
        return Number.isFinite(distanceKm) && distanceKm <= Math.max(radiusKm, impactRadius || 0);
      });

    const in7d = matches.filter(({ event }) => event.dataInicio <= next7d);
    const in14d = matches.filter(({ event }) => event.dataInicio <= next14d);
    const relevance = matches
      .map(({ event }) => Number(event.relevancia ?? 0))
      .filter((value) => Number.isFinite(value) && value > 0);
    const closest = in14d.reduce<null | { distanceKm: number }>(
      (best, item) => (!best || item.distanceKm < best.distanceKm ? item : best),
      null,
    );

    return {
      eventsNext7d: in7d.length,
      eventsNext14d: in14d.length,
      eventsNext30d: matches.length,
      megaEventsNext30d: matches.filter(({ event }) => Number(event.relevancia ?? 0) >= 80).length,
      closestEventDistanceKm: closest ? Number(closest.distanceKm.toFixed(3)) : null,
      closestEventTravelMin: closest ? Number(((closest.distanceKm / 25) * 60).toFixed(2)) : null,
      avgRelevanceScore: relevance.length
        ? Number((relevance.reduce((sum, value) => sum + value, 0) / relevance.length).toFixed(2))
        : null,
      maxRelevanceScore: relevance.length ? Math.max(...relevance) : null,
      predominantCategory: this.predominantCategory(matches.map(({ event }) => event.categoria)),
    };
  }

  private countComparableSupply(address: Address, addresses: Address[]): number | null {
    const bairro = String(address.bairro ?? '').trim().toLowerCase();
    if (!bairro) return null;
    return addresses.filter(
      (candidate) =>
        candidate.id !== address.id &&
        String(candidate.bairro ?? '').trim().toLowerCase() === bairro,
    ).length;
  }

  private predominantCategory(categories: Array<string | null | undefined>): string | null {
    const counts = new Map<string, number>();
    for (const category of categories) {
      const normalized = String(category ?? '').trim().toLowerCase();
      if (!normalized) continue;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
    const [winner] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    return winner ?? null;
  }

  private isFiniteCoordinate(latitude: unknown, longitude: unknown): boolean {
    return Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
  }

  private distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  private collectionStatus(
    totalLists: number,
    captured: number,
    duplicates: number,
    skippedMissingPrice: number,
  ): DatasetCollectionResult['status'] {
    if (totalLists === 0) return 'empty_catalog';
    if (captured + duplicates === 0 && skippedMissingPrice > 0) return 'blocked_missing_price_source';
    if (skippedMissingPrice > 0) return 'partial_missing_prices';
    return 'ok';
  }

  private async snapshotsByOrigin(): Promise<Array<{ origin: string; count: number }>> {
    const rows = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('COALESCE(s.origin, :unknown)', 'origin')
      .addSelect('COUNT(*)', 'count')
      .setParameter('unknown', 'unknown')
      .groupBy('origin')
      .getRawMany();

    return rows.map((row: any) => ({
      origin: String(row.origin ?? 'unknown'),
      count: Number(row.count ?? 0),
    }));
  }

  private async occupancyMetrics(): Promise<DatasetDiagnostics['tables']['occupancyHistory']> {
    const [total, trainingReady, latestDate] = await Promise.all([
      this.occupancyRepo.count(),
      this.occupancyRepo.count({ where: { trainingReady: true } }),
      this.maxColumn(this.occupancyRepo, 'o', 'date'),
    ]);

    return { total, trainingReady, latestDate };
  }

  private async eventFeatureMetrics(): Promise<
    DatasetDiagnostics['tables']['eventProximityFeatures']
  > {
    const [total, latestSnapshotDate] = await Promise.all([
      this.eventFeatureRepo.count(),
      this.maxColumn(this.eventFeatureRepo, 'f', 'snapshotDate'),
    ]);

    return { total, latestSnapshotDate };
  }

  private async maxColumn(
    repo: Repository<any>,
    alias: string,
    column: string,
  ): Promise<string | null> {
    const row = await repo
      .createQueryBuilder(alias)
      .select(`MAX(${alias}.${column})`, 'latest')
      .getRawOne();

    return row?.latest ? String(row.latest).slice(0, 10) : null;
  }

  private externalDependencyStatus(): DatasetDiagnostics['externalDependencies'] {
    const isConfigured = (name: string) => !!process.env[name]?.trim();
    const isProdLike = ['production', 'staging'].includes(
      String(process.env.NODE_ENV || process.env.APP_ENV || '').toLowerCase(),
    );

    return {
      AIRROI_API_KEY: {
        configured: isConfigured('AIRROI_API_KEY'),
        status: isConfigured('AIRROI_API_KEY') ? 'configured' : 'missing',
        message: isConfigured('AIRROI_API_KEY')
          ? 'External pricing dataset import can be enabled.'
          : 'External pricing dataset import is inactive until AIRROI_API_KEY is configured.',
      },
      STAYS_API_BASE_URL: {
        configured: isConfigured('STAYS_API_BASE_URL'),
        status: isConfigured('STAYS_API_BASE_URL') ? 'configured' : 'defaulted',
        message: isConfigured('STAYS_API_BASE_URL')
          ? 'Stays sync base URL is explicitly configured.'
          : 'Stays connector will use its default URL; configure sandbox/prod explicitly before real sync.',
      },
      STAYS_TOKEN_ENCRYPTION_KEY: {
        configured: isConfigured('STAYS_TOKEN_ENCRYPTION_KEY'),
        status: isConfigured('STAYS_TOKEN_ENCRYPTION_KEY') ? 'configured' : 'missing',
        message:
          isConfigured('STAYS_TOKEN_ENCRYPTION_KEY') || !isProdLike
            ? 'Stays token encryption gate is clear for this environment.'
            : 'Stays token encryption key is required before real production/staging tokens.',
      },
      GOOGLE_MAPS_API_KEY: {
        configured: isConfigured('GOOGLE_MAPS_API_KEY'),
        status: isConfigured('GOOGLE_MAPS_API_KEY') ? 'configured' : 'missing',
        message: isConfigured('GOOGLE_MAPS_API_KEY')
          ? 'Travel-time/event proximity enrichment can use Maps data.'
          : 'Event proximity features that depend on travel time are inactive.',
      },
    };
  }

  private buildBlockers(
    datasetSize: DatasetSize,
    occupancy: DatasetDiagnostics['tables']['occupancyHistory'],
    eventFeatures: DatasetDiagnostics['tables']['eventProximityFeatures'],
    externalDependencies: DatasetDiagnostics['externalDependencies'],
  ): DatasetDiagnostics['blockers'] {
    const blockers: DatasetDiagnostics['blockers'] = [];

    if (datasetSize.total === 0) {
      blockers.push({
        code: 'price_snapshots_empty',
        severity: 'red',
        message: 'No price snapshots exist yet; model tier must remain on rules.',
        nextAction:
          'Run owned listing snapshot with a real price resolver or persist comps from recommendation analyses.',
      });
    } else if (datasetSize.trainingReady === 0) {
      blockers.push({
        code: 'price_snapshots_not_training_ready',
        severity: 'amber',
        message: 'Price snapshots exist, but none are marked trainingReady.',
        nextAction: 'Populate lat/lng/features for snapshots before using them for model training.',
      });
    }

    if (occupancy.total === 0) {
      blockers.push({
        code: 'occupancy_history_empty',
        severity: 'red',
        message: 'No occupancy history exists; ROI and demand ground truth cannot be measured.',
        nextAction: 'Import manual/Stays occupancy records before claiming measured revenue uplift.',
      });
    }

    if (eventFeatures.total === 0) {
      blockers.push({
        code: 'event_proximity_features_empty',
        severity: 'amber',
        message: 'No event proximity feature snapshots exist.',
        nextAction:
          'Add a dedicated feature snapshot job or call the collector from the recommendation batch.',
      });
    }

    if (!externalDependencies.AIRROI_API_KEY.configured) {
      blockers.push({
        code: 'airroi_api_key_missing',
        severity: 'amber',
        message: externalDependencies.AIRROI_API_KEY.message,
        nextAction: 'Configure AIRROI_API_KEY when external dataset acquisition is approved.',
      });
    }

    if (
      externalDependencies.STAYS_TOKEN_ENCRYPTION_KEY.status === 'missing' &&
      ['production', 'staging'].includes(
        String(process.env.NODE_ENV || process.env.APP_ENV || '').toLowerCase(),
      )
    ) {
      blockers.push({
        code: 'stays_token_encryption_key_missing',
        severity: 'red',
        message: externalDependencies.STAYS_TOKEN_ENCRYPTION_KEY.message,
        nextAction: 'Configure STAYS_TOKEN_ENCRYPTION_KEY before enabling real Stays ground truth.',
      });
    }

    const lastRun = this.lastOwnedListingsSnapshot;
    if (lastRun?.status === 'blocked_missing_price_source') {
      blockers.push({
        code: 'owned_listing_snapshot_missing_price_source',
        severity: 'red',
        message: 'Owned listing snapshot ran, but no stored or external price source was available.',
        nextAction:
          'Populate dailyPrice/raw/priceText on listings or wire an external resolver into DatasetCollectorService.recordOwnedListingsSnapshot.',
      });
    }

    return blockers;
  }

  private readiness(
    datasetSize: DatasetSize,
    occupancy: DatasetDiagnostics['tables']['occupancyHistory'],
    eventFeatures: DatasetDiagnostics['tables']['eventProximityFeatures'],
  ): DatasetReadiness {
    if (datasetSize.total === 0) return 'empty';
    if (datasetSize.trainingReady > 0 && occupancy.trainingReady > 0 && eventFeatures.total > 0) {
      return 'ground_truth_ready';
    }
    if (datasetSize.trainingReady > 0) return 'training_ready';
    return 'collecting';
  }
}
