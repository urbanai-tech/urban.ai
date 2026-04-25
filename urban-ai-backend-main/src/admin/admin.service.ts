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

    return {
      summary: {
        total,
        ativos,
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
}
