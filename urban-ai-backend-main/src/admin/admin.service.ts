import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, IsNull, Not } from 'typeorm';
import { User } from '../entities/user.entity';
import { Address } from '../entities/addresses.entity';
import { List } from '../entities/list.entity';
import { Event as EventEntity } from '../entities/events.entity';
import { Payment } from '../entities/payment.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import { PriceSnapshot } from '../entities/price-snapshot.entity';
import { OccupancyHistory } from '../entities/occupancy-history.entity';
import { PriceUpdate } from '../entities/price-update.entity';
import { StaysAccount } from '../entities/stays-account.entity';
import { StaysListing } from '../entities/stays-listing.entity';
import { Waitlist } from '../entities/waitlist.entity';
import { CoverageRegion } from '../entities/coverage-region.entity';
import { AdaptivePricingStrategy } from '../knn-engine/strategies/adaptive-pricing.strategy';
import { DatasetCollectorService } from '../knn-engine/dataset-collector.service';
import { calculateBacktest } from '../knn-engine/backtesting';

/**
 * AdminService — agrega métricas de gestão Urban AI para o painel admin.
 *
 * Não expõe PII sensível (senha, token), apenas contagens, status e
 * indicadores. Usado pelos endpoints `/admin/*` que exigem `role='admin'`
 * via RolesGuard.
 */
@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Address) private readonly addressRepo: Repository<Address>,
    @InjectRepository(List) private readonly listRepo: Repository<List>,
    @InjectRepository(EventEntity) private readonly eventRepo: Repository<EventEntity>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(AnalisePreco) private readonly analiseRepo: Repository<AnalisePreco>,
    @InjectRepository(PriceSnapshot) private readonly snapshotRepo: Repository<PriceSnapshot>,
    @InjectRepository(OccupancyHistory) private readonly occupancyRepo: Repository<OccupancyHistory>,
    @InjectRepository(PriceUpdate) private readonly priceUpdateRepo: Repository<PriceUpdate>,
    @InjectRepository(StaysAccount) private readonly staysAccountRepo: Repository<StaysAccount>,
    @InjectRepository(StaysListing) private readonly staysListingRepo: Repository<StaysListing>,
    @InjectRepository(Waitlist) private readonly waitlistRepo: Repository<Waitlist>,
    @InjectRepository(CoverageRegion) private readonly coverageRepo: Repository<CoverageRegion>,
    private readonly adaptiveStrategy: AdaptivePricingStrategy,
    private readonly collector: DatasetCollectorService,
  ) {}

  /**
   * Visão geral do painel admin: contagens essenciais + estado da IA.
   * Roda em < 200ms mesmo com dataset grande (queries todas indexadas).
   */
  async overview() {
    const [
      totalUsers,
      activeUsers,
      adminUsers,
      totalProperties,
      totalEvents,
      eventsLast7d,
      totalAnalyses,
      analysesAccepted,
      activePayments,
      datasetSize,
      currentTier,
    ] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({ where: { ativo: true } }),
      this.userRepo.count({ where: { role: 'admin' } }),
      this.listRepo.count(),
      this.eventRepo.count(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.dataInicio >= :cutoff', { cutoff: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) })
        .getCount(),
      this.analiseRepo.count(),
      this.analiseRepo.count({ where: { aceito: true } }),
      this.paymentRepo
        .createQueryBuilder('p')
        .where('p.status IN (:...statuses)', { statuses: ['active', 'trialing'] })
        .getCount(),
      this.collector.datasetSize(),
      this.adaptiveStrategy.describeCurrentTier(),
    ]);

    const acceptanceRate =
      totalAnalyses > 0 ? Math.round((analysesAccepted / totalAnalyses) * 1000) / 10 : 0;

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        admins: adminUsers,
      },
      product: {
        propertiesRegistered: totalProperties,
        eventsTotal: totalEvents,
        eventsLast7d,
        analysesTotal: totalAnalyses,
        analysesAccepted,
        acceptanceRatePercent: acceptanceRate,
      },
      revenue: {
        activeSubscriptions: activePayments,
      },
      ai: {
        currentTier: currentTier.tier,
        currentStrategy: currentTier.strategy.name,
        reason: currentTier.reason,
        dataset: {
          totalSnapshots: datasetSize.total,
          distinctListings: datasetSize.distinctListings,
          distinctDays: datasetSize.distinctDays,
          trainingReady: datasetSize.trainingReady,
        },
      },
    };
  }

  /**
   * Detalhe da estratégia ativa de pricing — útil para o painel de IA.
   */
  async pricingStatus() {
    const decision = await this.adaptiveStrategy.describeCurrentTier();
    return {
      activeStrategy: decision.strategy.name,
      tier: decision.tier,
      reason: decision.reason,
      datasetSize: decision.datasetSize,
      strategyEnvDefault: process.env.PRICING_STRATEGY || 'adaptive',
      bootstrapOnBoot: process.env.PRICING_BOOTSTRAP_ON_BOOT !== 'false',
    };
  }

  /**
   * Métricas do dataset proprietário com breakdown por origem.
   */
  async datasetMetrics() {
    const [byOrigin, daysCovered, topListings] = await Promise.all([
      this.snapshotRepo
        .createQueryBuilder('s')
        .select('s.origin', 'origin')
        .addSelect('COUNT(*)', 'count')
        .groupBy('s.origin')
        .getRawMany(),
      this.snapshotRepo
        .createQueryBuilder('s')
        .select('COUNT(DISTINCT s.snapshotDate)', 'days')
        .getRawOne(),
      this.snapshotRepo
        .createQueryBuilder('s')
        .select('s.externalListingId', 'listingId')
        .addSelect('COUNT(*)', 'snapshots')
        .where('s.externalListingId IS NOT NULL')
        .groupBy('s.externalListingId')
        .orderBy('snapshots', 'DESC')
        .limit(10)
        .getRawMany(),
    ]);

    return {
      byOrigin: byOrigin.map((r: any) => ({ origin: r.origin, count: Number(r.count) })),
      daysCovered: Number(daysCovered?.days ?? 0),
      topListings: topListings.map((r: any) => ({
        listingId: r.listingId,
        snapshots: Number(r.snapshots),
      })),
    };
  }

  /**
   * Lista paginada de usuários para o painel admin.
   * Não expõe campo password.
   */
  async listUsers(page = 1, limit = 20) {
    const [data, total] = await this.userRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      select: [
        'id', 'username', 'email', 'role', 'ativo', 'createdAt',
        'phone', 'company', 'pricingStrategy', 'operationMode', 'airbnbHostId',
      ],
    });
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async setUserRole(userId: string, role: 'host' | 'admin' | 'support'): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new Error('Usuário não encontrado');
    user.role = role;
    return this.userRepo.save(user);
  }

  async setUserActive(userId: string, ativo: boolean): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new Error('Usuário não encontrado');
    user.ativo = ativo;
    return this.userRepo.save(user);
  }

  // =========================================================================
  // F6.2 — Analytics de eventos
  // =========================================================================

  /**
   * Análise da cobertura do motor de eventos:
   *  - Total + ativos
   *  - Por categoria, cidade, intervalo de relevância
   *  - Eventos com / sem coordenadas (geocoding gap)
   *  - Eventos sem relevância (Gemini enrichment gap)
   *  - Janela temporal (próximos 7/30/90 dias)
   *  - Top 10 eventos de maior relevância
   */
  async eventsAnalytics() {
    const now = new Date();
    const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in90d = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const [
      total,
      ativos,
      withCoords,
      withRelevance,
      next7d,
      next30d,
      next90d,
      megaUpcoming,
      byCategory,
      byCity,
      byRelevance,
      topUpcoming,
      lastCrawl,
    ] = await Promise.all([
      this.eventRepo.count(),
      this.eventRepo.count({ where: { ativo: true } }),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.latitude IS NOT NULL AND e.longitude IS NOT NULL')
        .getCount(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.relevancia IS NOT NULL')
        .getCount(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.dataInicio BETWEEN :start AND :end', { start: now, end: in7d })
        .getCount(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.dataInicio BETWEEN :start AND :end', { start: now, end: in30d })
        .getCount(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.dataInicio BETWEEN :start AND :end', { start: now, end: in90d })
        .getCount(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.dataInicio BETWEEN :start AND :end', { start: now, end: in30d })
        .andWhere('e.relevancia >= 80')
        .getCount(),
      this.eventRepo
        .createQueryBuilder('e')
        .select('COALESCE(e.categoria, \'sem categoria\')', 'categoria')
        .addSelect('COUNT(*)', 'count')
        .groupBy('categoria')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany(),
      this.eventRepo
        .createQueryBuilder('e')
        .select('e.cidade', 'cidade')
        .addSelect('COUNT(*)', 'count')
        .groupBy('e.cidade')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany(),
      this.eventRepo
        .createQueryBuilder('e')
        .select(
          `CASE
             WHEN e.relevancia IS NULL THEN 'sem relevância'
             WHEN e.relevancia < 30 THEN '0-29'
             WHEN e.relevancia < 60 THEN '30-59'
             WHEN e.relevancia < 80 THEN '60-79'
             ELSE '80-100 (mega)'
           END`,
          'bucket',
        )
        .addSelect('COUNT(*)', 'count')
        .groupBy('bucket')
        .getRawMany(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.dataInicio >= :now', { now })
        .andWhere('e.relevancia IS NOT NULL')
        .orderBy('e.relevancia', 'DESC')
        .addOrderBy('e.dataInicio', 'ASC')
        .limit(10)
        .getMany(),
      this.eventRepo
        .createQueryBuilder('e')
        .select('MAX(e.dataCrawl)', 'lastCrawl')
        .getRawOne(),
    ]);

    const coveragePercent = total > 0 ? Math.round((withCoords / total) * 1000) / 10 : 0;
    const enrichmentPercent =
      total > 0 ? Math.round((withRelevance / total) * 1000) / 10 : 0;

    // Contadores de cobertura geográfica (F6.2 Plus)
    const [inScope, outOfScope] = await Promise.all([
      this.eventRepo.count({ where: { outOfScope: false } }),
      this.eventRepo.count({ where: { outOfScope: true } }),
    ]);

    return {
      summary: {
        total,
        ativos,
        inScope,
        outOfScope,
        coveragePercent, // % com coordenadas
        enrichmentPercent, // % com relevância (Gemini)
        coordsMissing: total - withCoords,
        relevanceMissing: total - withRelevance,
      },
      upcoming: {
        next7d,
        next30d,
        next90d,
        megaUpcoming,
      },
      byCategory: byCategory.map((r: any) => ({
        categoria: r.categoria,
        count: Number(r.count),
      })),
      byCity: byCity.map((r: any) => ({
        cidade: r.cidade,
        count: Number(r.count),
      })),
      byRelevance: byRelevance.map((r: any) => ({
        bucket: r.bucket,
        count: Number(r.count),
      })),
      topUpcoming: topUpcoming.map((e) => ({
        id: e.id,
        nome: e.nome,
        cidade: e.cidade,
        dataInicio: e.dataInicio,
        relevancia: e.relevancia,
        categoria: e.categoria,
        capacidadeEstimada: e.capacidadeEstimada,
        raioImpactoKm: e.raioImpactoKm,
        hasCoords: e.latitude != null && e.longitude != null,
      })),
      lastCrawlAt: lastCrawl?.lastCrawl ?? null,
    };
  }

  // =========================================================================
  // Operação — Stays + push history + funnel + ocupação
  // =========================================================================

  /**
   * Saúde da integração Stays:
   *  - contas conectadas (active/error/disconnected)
   *  - listings sincronizados
   *  - PriceUpdates dos últimos 30 dias por status (success/rejected/error)
   *  - últimos 10 pushes para diagnóstico
   */
  async staysHealth() {
    const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      accountsByStatus,
      totalListings,
      activeListings,
      pushByStatus,
      autoListings,
      recentPushes,
    ] = await Promise.all([
      this.staysAccountRepo
        .createQueryBuilder('a')
        .select('a.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('a.status')
        .getRawMany(),
      this.staysListingRepo.count(),
      this.staysListingRepo.count({ where: { active: true } }),
      this.priceUpdateRepo
        .createQueryBuilder('pu')
        .select('pu.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('pu.createdAt >= :cutoff', { cutoff: cutoff30d })
        .groupBy('pu.status')
        .getRawMany(),
      this.staysListingRepo.count({ where: { operationMode: 'auto' as any } }),
      this.priceUpdateRepo.find({
        order: { createdAt: 'DESC' },
        take: 10,
        relations: ['user', 'listing'],
      }),
    ]);

    return {
      accountsByStatus: accountsByStatus.map((r: any) => ({
        status: r.status,
        count: Number(r.count),
      })),
      listings: {
        total: totalListings,
        active: activeListings,
        forcedAuto: autoListings,
      },
      pushLast30d: pushByStatus.map((r: any) => ({
        status: r.status,
        count: Number(r.count),
      })),
      recent: recentPushes.map((p) => ({
        id: p.id,
        targetDate: p.targetDate,
        previousPriceCents: p.previousPriceCents,
        newPriceCents: p.newPriceCents,
        origin: p.origin,
        status: p.status,
        errorMessage: p.errorMessage,
        createdAt: p.createdAt,
        userId: p.user?.id,
        listingId: p.listing?.id,
      })),
    };
  }

  /**
   * Funnel de produto:
   *  - Cadastros últimos 30d
   *  - Onboarding (com airbnbHostId)
   *  - Imóveis cadastrados
   *  - Análises geradas
   *  - Sugestões aceitas
   *  - Preço aplicado registrado (ground truth do MAPE)
   *  - Pagantes ativos
   */
  async productFunnel() {
    const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      signupsLast30d,
      withAirbnbId,
      withListingsCount,
      analysesLast30d,
      acceptedLast30d,
      appliedLast30d,
      activeSubscriptions,
      autoModeUsers,
    ] = await Promise.all([
      this.userRepo.count({ where: { createdAt: MoreThanOrEqual(cutoff30d) } }),
      this.userRepo.count({ where: { airbnbHostId: Not(IsNull()) } }),
      this.userRepo
        .createQueryBuilder('u')
        .innerJoin('u.notifications', 'n')
        .select('COUNT(DISTINCT u.id)', 'c')
        .getRawOne()
        .then((r: any) => Number(r?.c ?? 0))
        .catch(() => 0),
      this.analiseRepo
        .createQueryBuilder('a')
        .where('a.criadoEm >= :cutoff', { cutoff: cutoff30d })
        .getCount(),
      this.analiseRepo
        .createQueryBuilder('a')
        .where('a.criadoEm >= :cutoff', { cutoff: cutoff30d })
        .andWhere('a.aceito = true')
        .getCount(),
      this.analiseRepo
        .createQueryBuilder('a')
        .where('a.criadoEm >= :cutoff', { cutoff: cutoff30d })
        .andWhere('a.precoAplicado IS NOT NULL')
        .getCount(),
      this.paymentRepo
        .createQueryBuilder('p')
        .where('p.status IN (:...statuses)', { statuses: ['active', 'trialing'] })
        .getCount(),
      this.userRepo.count({ where: { operationMode: 'auto' } }),
    ]);

    const acceptanceRate =
      analysesLast30d > 0 ? Math.round((acceptedLast30d / analysesLast30d) * 1000) / 10 : 0;
    const applicationRate =
      acceptedLast30d > 0 ? Math.round((appliedLast30d / acceptedLast30d) * 1000) / 10 : 0;

    return {
      windowDays: 30,
      stages: {
        signups: signupsLast30d,
        onboardedWithAirbnbId: withAirbnbId,
        analysesGenerated: analysesLast30d,
        suggestionsAccepted: acceptedLast30d,
        appliedPriceCaptured: appliedLast30d,
        activeSubscriptions,
        operationModeAuto: autoModeUsers,
      },
      rates: {
        acceptanceRatePercent: acceptanceRate, // aceitos / análises geradas
        applicationRatePercent: applicationRate, // preço aplicado / aceitos
      },
    };
  }

  /**
   * Backtest do motor: agrupa AnalisePreco com precoAplicado preenchido
   * e calcula MAPE atual.
   */
  async pricingQuality() {
    const rows = await this.analiseRepo
      .createQueryBuilder('a')
      .select('a.precoSugerido', 'predicted')
      .addSelect('a.precoAplicado', 'actual')
      .where('a.precoAplicado IS NOT NULL')
      .andWhere('a.criadoEm >= :cutoff', {
        cutoff: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      })
      .getRawMany();

    const pairs = rows.map((r) => ({
      predicted: Number(r.predicted),
      actual: Number(r.actual),
    }));

    const result = calculateBacktest(pairs);
    return {
      windowDays: 90,
      sampleSize: result.sampleSize,
      discarded: result.discarded,
      mapePercent: Number.isFinite(result.mapePercent)
        ? Math.round(result.mapePercent * 100) / 100
        : null,
      rmse: Number.isFinite(result.rmse) ? Math.round(result.rmse * 100) / 100 : null,
      medianAbsoluteError: Number.isFinite(result.medianAbsoluteError)
        ? Math.round(result.medianAbsoluteError * 100) / 100
        : null,
      qualityGate: {
        threshold: 15,
        passes:
          Number.isFinite(result.mapePercent) && result.mapePercent <= 15 && result.sampleSize >= 30,
        meetsMinSample: result.sampleSize >= 30,
      },
    };
  }

  /**
   * Cobertura de ocupação (resolve gap de "não temos histórico de demanda").
   */
  async occupancyCoverage() {
    const [byStatus, byOrigin, distinctListings] = await Promise.all([
      this.occupancyRepo
        .createQueryBuilder('o')
        .select('o.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('o.status')
        .getRawMany(),
      this.occupancyRepo
        .createQueryBuilder('o')
        .select('o.origin', 'origin')
        .addSelect('COUNT(*)', 'count')
        .groupBy('o.origin')
        .getRawMany(),
      this.occupancyRepo
        .createQueryBuilder('o')
        .select('COUNT(DISTINCT o.list)', 'c')
        .getRawOne()
        .then((r: any) => Number(r?.c ?? 0)),
    ]);

    return {
      byStatus: byStatus.map((r: any) => ({ status: r.status, count: Number(r.count) })),
      byOrigin: byOrigin.map((r: any) => ({ origin: r.origin, count: Number(r.count) })),
      distinctListings,
    };
  }

  // ========================================================================
  // F6.2 Plus — Listing paginada de eventos com filtro de cobertura
  // ========================================================================

  /**
   * Lista paginada de eventos para o painel admin com filtros.
   * Usado pelo `/admin/events` quando admin quer auditar eventos individualmente.
   *
   * @param filters.scope 'in' (default — só dentro da cobertura) | 'out' | 'all'
   * @param filters.source filtro por source (api-football, sympla, scraper-eventim, etc.)
   * @param filters.search match contra nome/cidade
   * @param filters.upcoming se true, só dataInicio >= now
   */
  async eventsListing(filters: {
    page?: number;
    limit?: number;
    scope?: 'in' | 'out' | 'all';
    source?: string;
    search?: string;
    upcoming?: boolean;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
    const scope = filters.scope ?? 'in';

    const qb = this.eventRepo.createQueryBuilder('e');

    if (scope === 'in') qb.andWhere('e.outOfScope = :v', { v: false });
    else if (scope === 'out') qb.andWhere('e.outOfScope = :v', { v: true });

    if (filters.source) qb.andWhere('e.source = :src', { src: filters.source });

    if (filters.upcoming) qb.andWhere('e.dataInicio >= :now', { now: new Date() });

    if (filters.search) {
      const like = `%${filters.search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(e.nome) LIKE :like OR LOWER(COALESCE(e.cidade, \'\')) LIKE :like)',
        { like },
      );
    }

    qb.orderBy('e.dataInicio', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      page,
      limit,
      total,
      scope,
      items: items.map((e) => ({
        id: e.id,
        nome: e.nome,
        cidade: e.cidade,
        estado: e.estado,
        dataInicio: e.dataInicio,
        dataFim: e.dataFim,
        categoria: e.categoria,
        relevancia: e.relevancia,
        capacidadeEstimada: e.capacidadeEstimada,
        raioImpactoKm: e.raioImpactoKm,
        venueType: e.venueType,
        venueCapacity: e.venueCapacity,
        source: e.source,
        outOfScope: e.outOfScope,
        pendingGeocode: e.pendingGeocode,
        ativo: e.ativo,
        latitude: e.latitude,
        longitude: e.longitude,
        enrichmentAttempts: e.enrichmentAttempts,
        enrichmentLastError: e.enrichmentLastError,
        crawledUrl: e.crawledUrl,
      })),
    };
  }

  // ========================================================================
  // F6.2 Plus — Timeline diária de ingestão (in-scope vs out-of-scope)
  // ========================================================================

  /**
   * Agregado diário de eventos coletados nos últimos N dias, separados por
   * scope (in/out). Usado pelo gráfico de evolução em `/admin/events`.
   *
   * Critério: `e.dataCrawl` (timestamp da última coleta).
   *
   * @param days janela em dias (default 30, max 90)
   */
  async eventsTimeline(days: number = 30) {
    const safeDays = Math.max(1, Math.min(90, days));
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
    since.setHours(0, 0, 0, 0);

    const rows = await this.eventRepo
      .createQueryBuilder('e')
      .select('DATE(e.dataCrawl)', 'day')
      .addSelect(
        'SUM(CASE WHEN e.outOfScope = FALSE THEN 1 ELSE 0 END)',
        'inScope',
      )
      .addSelect(
        'SUM(CASE WHEN e.outOfScope = TRUE THEN 1 ELSE 0 END)',
        'outOfScope',
      )
      .where('e.dataCrawl >= :since', { since })
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany();

    // Preenche dias vazios (sem coleta) com 0/0 pra gráfico contínuo
    const map = new Map<string, { in: number; out: number }>();
    for (const r of rows) {
      const dayKey = String(r.day).slice(0, 10);
      map.set(dayKey, {
        in: Number(r.inScope ?? 0),
        out: Number(r.outOfScope ?? 0),
      });
    }
    const buckets: Array<{ day: string; inScope: number; outOfScope: number }> = [];
    for (let i = safeDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      const entry = map.get(key) ?? { in: 0, out: 0 };
      buckets.push({ day: key, inScope: entry.in, outOfScope: entry.out });
    }

    const totalIn = buckets.reduce((s, b) => s + b.inScope, 0);
    const totalOut = buckets.reduce((s, b) => s + b.outOfScope, 0);
    const peakDay = buckets.reduce(
      (acc, b) =>
        b.inScope + b.outOfScope > acc.total
          ? { day: b.day, total: b.inScope + b.outOfScope }
          : acc,
      { day: '', total: 0 },
    );

    return {
      days: safeDays,
      generatedAt: new Date().toISOString(),
      totalInScope: totalIn,
      totalOutScope: totalOut,
      avgPerDay: Math.round((totalIn + totalOut) / safeDays),
      peakDay,
      buckets,
    };
  }

  // ========================================================================
  // F6.2 Plus — Saúde dos coletores (por source)
  // ========================================================================

  /**
   * Métricas de saúde por `source`. Usado pra debugar quais coletores estão
   * trazendo lixo, qual fonte tem mais eventos out-of-scope, qual tem mais
   * falhas de enrichment, etc.
   *
   * Considera todos os eventos NÃO-source-NULL agrupados por source.
   * Inclui spider-* (legados Scrapy) e api-* / firecrawl / serpapi / tavily /
   * sp-cultura / admin-* (Camadas 1+2+3).
   */
  async collectorsHealth() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const rows = await this.eventRepo
      .createQueryBuilder('e')
      .select('COALESCE(e.source, \'(sem source)\')', 'source')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        'SUM(CASE WHEN e.dataCrawl >= :sevenDaysAgo THEN 1 ELSE 0 END)',
        'last7d',
      )
      .addSelect(
        'SUM(CASE WHEN e.dataCrawl >= :oneDayAgo THEN 1 ELSE 0 END)',
        'last24h',
      )
      .addSelect(
        'SUM(CASE WHEN e.outOfScope = TRUE THEN 1 ELSE 0 END)',
        'outOfScope',
      )
      .addSelect(
        'SUM(CASE WHEN e.pendingGeocode = TRUE THEN 1 ELSE 0 END)',
        'pendingGeocode',
      )
      .addSelect(
        'SUM(CASE WHEN e.relevancia IS NULL AND e.outOfScope = FALSE THEN 1 ELSE 0 END)',
        'pendingEnrichment',
      )
      .addSelect(
        'SUM(CASE WHEN e.relevancia IS NOT NULL THEN 1 ELSE 0 END)',
        'enriched',
      )
      .addSelect(
        'SUM(CASE WHEN e.enrichmentLastError IS NOT NULL THEN 1 ELSE 0 END)',
        'withErrors',
      )
      .addSelect('MAX(e.dataCrawl)', 'lastSeen')
      .setParameter('sevenDaysAgo', sevenDaysAgo)
      .setParameter('oneDayAgo', oneDayAgo)
      .groupBy('source')
      .orderBy('total', 'DESC')
      .getRawMany();

    return {
      generatedAt: new Date().toISOString(),
      sources: rows.map((r: any) => {
        const total = Number(r.total ?? 0);
        const outOfScope = Number(r.outOfScope ?? 0);
        const pendingEnrichment = Number(r.pendingEnrichment ?? 0);
        const enriched = Number(r.enriched ?? 0);
        const withErrors = Number(r.withErrors ?? 0);
        return {
          source: r.source,
          total,
          last7d: Number(r.last7d ?? 0),
          last24h: Number(r.last24h ?? 0),
          outOfScope,
          outOfScopePercent:
            total > 0 ? Math.round((outOfScope / total) * 1000) / 10 : 0,
          pendingGeocode: Number(r.pendingGeocode ?? 0),
          pendingEnrichment,
          enriched,
          withErrors,
          errorRate:
            enriched + withErrors > 0
              ? Math.round((withErrors / (enriched + withErrors)) * 1000) / 10
              : 0,
          lastSeen: r.lastSeen ?? null,
        };
      }),
    };
  }

  // ========================================================================
  // F6.2 Plus — Dashboard summary (overview executivo numa única chamada)
  // ========================================================================

  /**
   * Snapshot agregado pra `/admin/dashboard` — uma única chamada que cobre:
   *  - Eventos: total, in/out scope, pendingGeocode, pendingEnrichment,
   *    sources únicos, próximos 7d, mega-eventos
   *  - Waitlist: total, pending/invited/converted, top referrers
   *  - Receita: assinaturas ativas, MRR estimado (cap simples sem matriz F6.5)
   *  - Cobertura: regiões active/bootstrap, addresses ativos
   *  - Alertas: coletores stale (>48h sem dados), high errorRate, fila Gemini grande
   *  - Timeline: 7 dias últimos pro mini-chart
   *  - Saúde geral: 'green' | 'amber' | 'red' baseado nos alertas
   *
   * Faz tudo em paralelo, < 500ms mesmo com DB grande.
   */
  async dashboardSummary() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const next7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const next30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      // Eventos
      eventsTotal,
      eventsInScope,
      eventsOutOfScope,
      eventsPendingGeocode,
      eventsPendingEnrichment,
      eventsLast24h,
      eventsLast7d,
      eventsNext7d,
      eventsNext30d,
      megaUpcoming,
      // Waitlist
      waitlistTotal,
      waitlistByStatus,
      // Coverage
      coverageActive,
      coverageBootstrap,
      // Subscriptions
      activeSubscriptions,
      // Sources distinct
      distinctSources,
      // Coletores stale
      staleSources,
    ] = await Promise.all([
      this.eventRepo.count(),
      this.eventRepo.count({ where: { outOfScope: false } }),
      this.eventRepo.count({ where: { outOfScope: true } }),
      this.eventRepo.count({ where: { pendingGeocode: true } }),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.relevancia IS NULL')
        .andWhere('e.outOfScope = :v', { v: false })
        .getCount(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.dataCrawl >= :since', { since: oneDayAgo })
        .getCount(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.dataCrawl >= :since', { since: sevenDaysAgo })
        .getCount(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.dataInicio BETWEEN :start AND :end', { start: now, end: next7d })
        .andWhere('e.outOfScope = :v', { v: false })
        .getCount(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.dataInicio BETWEEN :start AND :end', { start: now, end: next30d })
        .andWhere('e.outOfScope = :v', { v: false })
        .getCount(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.dataInicio BETWEEN :start AND :end', { start: now, end: next30d })
        .andWhere('e.relevancia >= 80')
        .andWhere('e.outOfScope = :v', { v: false })
        .getCount(),
      this.waitlistRepo.count(),
      this.waitlistRepo
        .createQueryBuilder('w')
        .select('w.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('w.status')
        .getRawMany(),
      this.coverageRepo.count({ where: { status: 'active' } }),
      this.coverageRepo.count({ where: { status: 'bootstrap' } }),
      this.paymentRepo.count({ where: { status: 'active' as any } }),
      this.eventRepo
        .createQueryBuilder('e')
        .select('COUNT(DISTINCT e.source)', 'c')
        .where('e.source IS NOT NULL')
        .getRawOne()
        .then((r: any) => Number(r?.c ?? 0)),
      // Coletores stale: que tem total >0 mas dataCrawl mais recente é < 48h ago
      this.eventRepo
        .createQueryBuilder('e')
        .select('e.source', 'source')
        .addSelect('MAX(e.dataCrawl)', 'lastSeen')
        .addSelect('COUNT(*)', 'total')
        .where('e.source IS NOT NULL')
        .groupBy('e.source')
        .having('MAX(e.dataCrawl) < :cutoff', { cutoff: fortyEightHoursAgo })
        .andHaving('COUNT(*) >= 5') // ignora sources muito pequenas (curadoria, etc.)
        .getRawMany(),
    ]);

    // Timeline 7 dias (mini-chart)
    const timeline = await this.eventsTimeline(7);

    // Top sources últimos 7d (top 5)
    const topSources = await this.eventRepo
      .createQueryBuilder('e')
      .select('COALESCE(e.source, \'(sem source)\')', 'source')
      .addSelect('COUNT(*)', 'count')
      .where('e.dataCrawl >= :since', { since: sevenDaysAgo })
      .groupBy('source')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    // Alertas
    const alerts: Array<{ severity: 'red' | 'amber' | 'info'; message: string }> = [];

    if (eventsPendingEnrichment > 100) {
      alerts.push({
        severity: 'amber',
        message: `${eventsPendingEnrichment} eventos aguardando enrichment Gemini (cron 1h)`,
      });
    }
    if (eventsPendingGeocode > 50) {
      alerts.push({
        severity: 'amber',
        message: `${eventsPendingGeocode} eventos pendentes de geocoding (cron 30min)`,
      });
    }
    if ((staleSources as any[]).length > 0) {
      alerts.push({
        severity: 'red',
        message: `${(staleSources as any[]).length} coletor(es) sem dados há >48h: ${(staleSources as any[])
          .slice(0, 3)
          .map((s: any) => s.source)
          .join(', ')}`,
      });
    }
    if (eventsLast24h === 0 && eventsTotal > 0) {
      alerts.push({
        severity: 'red',
        message: 'Zero eventos coletados nas últimas 24h — todos os crons podem estar parados',
      });
    }
    if (coverageActive === 0 && coverageBootstrap === 0) {
      alerts.push({
        severity: 'amber',
        message: 'Nenhuma região de cobertura ativa — motor pode estar marcando tudo out-of-scope',
      });
    }

    // Saúde geral (resumo binário)
    const overallHealth: 'green' | 'amber' | 'red' = alerts.some((a) => a.severity === 'red')
      ? 'red'
      : alerts.some((a) => a.severity === 'amber')
        ? 'amber'
        : 'green';

    // Reduce by-status pro waitlist
    const wlByStatus = (waitlistByStatus as any[]).reduce(
      (acc: Record<string, number>, r: any) => {
        acc[r.status] = Number(r.count);
        return acc;
      },
      { pending: 0, invited: 0, converted: 0, declined: 0 },
    );

    return {
      generatedAt: now.toISOString(),
      health: overallHealth,
      alerts,
      events: {
        total: eventsTotal,
        inScope: eventsInScope,
        outOfScope: eventsOutOfScope,
        outOfScopePercent:
          eventsTotal > 0 ? Math.round((eventsOutOfScope / eventsTotal) * 1000) / 10 : 0,
        pendingGeocode: eventsPendingGeocode,
        pendingEnrichment: eventsPendingEnrichment,
        last24h: eventsLast24h,
        last7d: eventsLast7d,
        next7d: eventsNext7d,
        next30d: eventsNext30d,
        megaUpcoming,
        distinctSources,
      },
      waitlist: {
        total: waitlistTotal,
        pending: wlByStatus.pending,
        invited: wlByStatus.invited,
        converted: wlByStatus.converted,
      },
      coverage: {
        activeRegions: coverageActive,
        bootstrapRegions: coverageBootstrap,
      },
      revenue: {
        activeSubscriptions,
      },
      topSources: (topSources as any[]).map((r: any) => ({
        source: r.source,
        count: Number(r.count),
      })),
      timeline: {
        days: 7,
        buckets: timeline.buckets,
      },
    };
  }
}
