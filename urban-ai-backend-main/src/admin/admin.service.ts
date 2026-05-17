import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, IsNull, Not, In, LessThan } from 'typeorm';
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
import { AdminJobRun } from '../entities/admin-job-run.entity';
import { ContactSubmission } from '../entities/contact-submission.entity';
import { AdaptivePricingStrategy } from '../knn-engine/strategies/adaptive-pricing.strategy';
import { DatasetCollectorService } from '../knn-engine/dataset-collector.service';
import { calculateBacktest } from '../knn-engine/backtesting';
import { MapsService } from '../maps/maps.service';

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
    @InjectRepository(AdminJobRun) private readonly jobRunRepo: Repository<AdminJobRun>,
    @InjectRepository(ContactSubmission) private readonly contactSubmissionRepo: Repository<ContactSubmission>,
    private readonly adaptiveStrategy: AdaptivePricingStrategy,
    private readonly collector: DatasetCollectorService,
    private readonly mapsService: MapsService,
  ) {}

  async listJobRuns(limit = 10, name?: string) {
    const take = Math.max(1, Math.min(50, Number(limit) || 10));
    return this.jobRunRepo.find({
      where: name ? { name } : {},
      order: { startedAt: 'DESC' },
      take,
    });
  }

  async runTrackedJob<T>(
    name: string,
    triggeredByUserId: string | null,
    handler: () => Promise<T>,
  ) {
    const startedAt = new Date();
    const run = await this.jobRunRepo.save(
      this.jobRunRepo.create({
        name,
        status: 'running',
        triggeredByUserId,
        startedAt,
        finishedAt: null,
        durationMs: null,
        result: null,
        errorMessage: null,
      }),
    );

    try {
      const result = await handler();
      const finishedAt = new Date();
      const outcome = this.evaluateJobOutcome(result);
      const saved = await this.jobRunRepo.save({
        ...run,
        status: outcome.status,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        result,
        errorMessage: outcome.errorMessage,
      });
      return this.toJobRunResponse(saved);
    } catch (error: any) {
      const finishedAt = new Date();
      await this.jobRunRepo.save({
        ...run,
        status: 'error',
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        result: this.safeErrorPayload(error),
        errorMessage: error?.message || 'Job failed',
      });
      throw error;
    }
  }

  private evaluateJobOutcome(result: any): {
    status: 'success' | 'error';
    errorMessage: string | null;
  } {
    if (!result || typeof result !== 'object') {
      return { status: 'success', errorMessage: null };
    }

    if (result.ok === false) {
      return { status: 'error', errorMessage: result.errorMessage || result.message || 'Job reported ok=false' };
    }

    if (
      typeof result.attempted === 'number' &&
      result.attempted > 0 &&
      typeof result.failed === 'number' &&
      result.failed >= result.attempted &&
      Number(result.succeeded ?? 0) === 0
    ) {
      return {
        status: 'error',
        errorMessage: `Job failed all attempted items (${result.failed}/${result.attempted})`,
      };
    }

    if (typeof result.status === 'string') {
      const status = result.status.toLowerCase();
      if (status === 'failed' || status === 'error' || status.startsWith('blocked')) {
        return { status: 'error', errorMessage: result.errorMessage || result.message || result.status };
      }
    }

    return { status: 'success', errorMessage: null };
  }

  private toJobRunResponse(run: AdminJobRun) {
    return {
      id: run.id,
      name: run.name,
      status: run.status,
      triggeredByUserId: run.triggeredByUserId,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      durationMs: run.durationMs,
      result: run.result,
      errorMessage: run.errorMessage,
    };
  }

  private safeErrorPayload(error: any) {
    return {
      message: error?.message || 'Job failed',
      status: error?.status ?? error?.response?.statusCode ?? null,
      code: error?.code ?? error?.response?.code ?? null,
    };
  }

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

  async alphaDashboard(email = 'gustavo8gouveia@hotmail.com') {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('Usuario alpha nao encontrado');
    }

    const [addresses, analyses, eventsTotal, upcomingEvents, eventsLast24h] = await Promise.all([
      this.addressRepo.find({ where: { user: { id: user.id }, ativo: true }, relations: ['list'] }),
      this.analiseRepo.find({
        where: { usuarioProprietario: { id: user.id } },
        relations: ['endereco', 'endereco.list', 'evento'],
        order: { criadoEm: 'DESC' },
      }),
      this.eventRepo.count(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.ativo = :ativo', { ativo: true })
        .andWhere('e.dataInicio >= :now', { now: new Date() })
        .getCount(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.createdAt >= :cutoff', { cutoff: new Date(Date.now() - 24 * 60 * 60 * 1000) })
        .getCount(),
    ]);

    const lists = addresses.map((address) => address.list).filter(Boolean);
    const uniqueListIds = new Set(lists.map((list) => list.id));
    const completed = addresses.filter((address) => address.analisado === 'completed').length;
    const withManualPrice = lists.filter((list) => Number(list.manualDailyPrice) > 0).length;
    const withRevenue = lists.filter((list) => Number(list.averageMonthlyRevenue) > 0).length;
    const totalMonthlyRevenue = lists.reduce((sum, list) => sum + (Number(list.averageMonthlyRevenue) || 0), 0);
    const accepted = analyses.filter((analysis) => analysis.aceito).length;
    const applied = analyses.filter((analysis) => Number(analysis.precoAplicado) > 0).length;
    const feedbackCaptured = analyses.filter((analysis) => analysis.resultadoRegistradoEm || analysis.reservaStatus).length;
    const booked = analyses.filter((analysis) => analysis.reservaStatus === 'booked').length;
    const realRevenue = analyses.reduce((sum, analysis) => sum + (Number(analysis.receitaReal) || 0), 0);
    const potentialDailyLift = analyses.reduce((sum, analysis) => {
      const suggested = Number(analysis.precoSugerido);
      const current = Number(analysis.seuPrecoAtual);
      return Number.isFinite(suggested) && Number.isFinite(current)
        ? sum + Math.max(0, suggested - current)
        : sum;
    }, 0);

    const qualityFlags = analyses.reduce<Record<string, number>>((acc, analysis) => {
      for (const flag of this.eventQualityFlags(analysis.evento)) {
        acc[flag] = (acc[flag] ?? 0) + 1;
      }
      return acc;
    }, {});

    return {
      generatedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        ativo: user.ativo,
        role: user.role,
      },
      properties: {
        total: uniqueListIds.size,
        activeAddresses: addresses.length,
        completed,
        withManualPrice,
        withAverageMonthlyRevenue: withRevenue,
        totalAverageMonthlyRevenue: totalMonthlyRevenue,
      },
      recommendations: {
        total: analyses.length,
        accepted,
        applied,
        feedbackCaptured,
        booked,
        realRevenue,
        potentialDailyLift,
        distinctProperties: new Set(analyses.map((analysis) => analysis.endereco?.list?.id).filter(Boolean)).size,
        distinctEvents: new Set(analyses.map((analysis) => analysis.evento?.id).filter(Boolean)).size,
      },
      events: {
        total: eventsTotal,
        upcoming: upcomingEvents,
        createdLast24h: eventsLast24h,
        qualityFlags,
      },
      recentRecommendations: this.formatAlphaRecommendations(analyses.slice(0, 20)),
    };
  }

  async alphaRecommendations(email = 'gustavo8gouveia@hotmail.com', limit = 250) {
    const take = Math.max(1, Math.min(1000, Number(limit) || 250));
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('Usuario alpha nao encontrado');
    }
    const analyses = await this.analiseRepo.find({
      where: { usuarioProprietario: { id: user.id } },
      relations: ['endereco', 'endereco.list', 'evento'],
      order: { criadoEm: 'DESC' },
      take,
    });
    return {
      generatedAt: new Date().toISOString(),
      user: { id: user.id, email: user.email, username: user.username },
      total: analyses.length,
      rows: this.formatAlphaRecommendations(analyses),
    };
  }

  async runAlphaReprocess(email = 'gustavo8gouveia@hotmail.com') {
    return this.mapsService.reprocessAlphaPricing(email);
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
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const [data, total] = await this.userRepo.findAndCount({
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      order: { createdAt: 'DESC' },
      select: [
        'id', 'username', 'email', 'role', 'ativo', 'createdAt',
        'phone', 'company', 'pricingStrategy', 'operationMode', 'airbnbHostId',
      ],
    });
    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }

  async setUserRole(
    userId: string,
    role: 'host' | 'admin' | 'support',
    actorUserId?: string | null,
  ): Promise<User> {
    if (!['host', 'admin', 'support'].includes(role)) {
      throw new BadRequestException('role invalido');
    }
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario nao encontrado');
    if (actorUserId && actorUserId === userId && role !== 'admin') {
      throw new ForbiddenException('Voce nao pode remover seu proprio acesso admin.');
    }
    if (user.role === 'admin' && role !== 'admin') {
      const activeAdmins = await this.userRepo.count({ where: { role: 'admin', ativo: true } });
      if (activeAdmins <= 1 && user.ativo) {
        throw new ForbiddenException('Nao e possivel remover o ultimo admin ativo.');
      }
    }
    user.role = role;
    return this.userRepo.save(user);
  }

  async setUserActive(
    userId: string,
    ativo: boolean,
    actorUserId?: string | null,
  ): Promise<User> {
    if (typeof ativo !== 'boolean') {
      throw new BadRequestException('ativo deve ser booleano');
    }
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario nao encontrado');
    if (actorUserId && actorUserId === userId && ativo === false) {
      throw new ForbiddenException('Voce nao pode desativar seu proprio usuario.');
    }
    if (user.role === 'admin' && ativo === false) {
      const activeAdmins = await this.userRepo.count({ where: { role: 'admin', ativo: true } });
      if (activeAdmins <= 1 && user.ativo) {
        throw new ForbiddenException('Nao e possivel desativar o ultimo admin ativo.');
      }
    }
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
      readiness: {
        apiBaseConfigured: Boolean(process.env.STAYS_API_BASE_URL),
        tokenEncryptionConfigured: Boolean(process.env.STAYS_TOKEN_ENCRYPTION_KEY),
        betaPrivate: !process.env.STAYS_API_BASE_URL || !process.env.STAYS_TOKEN_ENCRYPTION_KEY,
        missingEnv: [
          !process.env.STAYS_API_BASE_URL ? 'STAYS_API_BASE_URL' : '',
          !process.env.STAYS_TOKEN_ENCRYPTION_KEY ? 'STAYS_TOKEN_ENCRYPTION_KEY' : '',
        ].filter(Boolean),
      },
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

  async occupancyProperties() {
    const addresses = await this.addressRepo.find({
      where: { ativo: true },
      relations: ['list', 'user'],
      take: 5000,
    });

    return addresses
      .filter((address) => !!address.list?.id)
      .map((address) => ({
        addressId: address.id,
        listId: address.list.id,
        title: address.list.titulo,
        airbnbListingId: address.list.id_do_anuncio,
        userId: address.user?.id ?? address.list.user?.id ?? null,
        userEmail: address.user?.email ?? address.list.user?.email ?? null,
        neighborhood: address.bairro ?? address.list.neighborhood ?? null,
        city: address.cidade ?? null,
        state: address.estado ?? null,
        manualDailyPrice: address.list.manualDailyPrice ?? null,
        dailyPrice: address.list.dailyPrice ?? null,
        averageMonthlyRevenue: address.list.averageMonthlyRevenue ?? null,
      }))
      .sort((a, b) => {
        const userCompare = String(a.userEmail ?? '').localeCompare(String(b.userEmail ?? ''));
        if (userCompare !== 0) return userCompare;
        return String(a.title ?? '').localeCompare(String(b.title ?? ''));
      });
  }

  async upsertManualOccupancy(input: {
    listId?: string;
    airbnbListingId?: string;
    date: string;
    status: 'booked' | 'available' | 'blocked' | 'unknown';
    revenueCents?: number | null;
    listedPriceCents?: number | null;
    currency?: string;
  }) {
    if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new BadRequestException('date deve estar no formato YYYY-MM-DD');
    }
    if (!['booked', 'available', 'blocked', 'unknown'].includes(input.status)) {
      throw new BadRequestException('status invalido');
    }

    const list = await this.listRepo.findOne({
      where: input.listId
        ? { id: input.listId }
        : { id_do_anuncio: input.airbnbListingId ?? '' },
      relations: ['user'],
    });
    if (!list) {
      throw new NotFoundException('Imovel nao encontrado');
    }

    const address = await this.addressRepo.findOne({
      where: { list: { id: list.id } } as any,
      relations: ['list'],
    });
    const existing = await this.occupancyRepo.findOne({
      where: { list: { id: list.id }, date: input.date } as any,
      relations: ['list', 'user', 'address'],
    });
    const record = existing ?? this.occupancyRepo.create();
    record.list = list;
    record.user = list.user;
    record.address = address ?? null;
    record.date = input.date;
    record.status = input.status;
    record.origin = 'manual';
    record.revenueCents = input.revenueCents ?? null;
    record.listedPriceCents = input.listedPriceCents ?? null;
    record.currency = input.currency ?? 'BRL';
    record.trainingReady = input.status === 'booked' || input.status === 'available';
    record.nightsBooked = input.status === 'booked' ? 1 : null;

    return this.occupancyRepo.save(record);
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

    const knownCollectors: Array<{
      source: string;
      critical: boolean;
      requiredEnv: string[];
      aliases?: string[];
    }> = [
      { source: 'api-football', critical: false, requiredEnv: ['API_FOOTBALL_KEY'] },
      { source: 'sp-cultura', critical: false, requiredEnv: [] },
      { source: 'usp-eventos', critical: false, requiredEnv: [] },
      { source: 'marcha-para-jesus', critical: false, requiredEnv: [] },
      { source: 'allianz-parque', critical: false, requiredEnv: [] },
      { source: 'anhembi', critical: false, requiredEnv: [] },
      { source: 'sao-paulo-expo', critical: false, requiredEnv: [] },
      { source: 'expo-center-norte', critical: false, requiredEnv: [] },
      { source: 'transamerica-expo', critical: false, requiredEnv: [] },
      { source: 'vibra-sao-paulo', critical: false, requiredEnv: [] },
      { source: 'tokio-marine-hall', critical: false, requiredEnv: [] },
      { source: 'espaco-unimed', critical: false, requiredEnv: [] },
      { source: 'wtc-sao-paulo', critical: false, requiredEnv: [] },
      { source: 'serpapi-events', critical: false, requiredEnv: ['SERPAPI_KEY'], aliases: ['serpapi_events'] },
      { source: 'tavily', critical: false, requiredEnv: ['TAVILY_API_KEY', 'GEMINI_API_KEY'] },
      { source: 'firecrawl', critical: false, requiredEnv: ['FIRECRAWL_API_KEY', 'GEMINI_API_KEY'] },
      { source: 'legacy-scrapyd-spiders', critical: false, requiredEnv: [] },
    ];

    const sources: any[] = rows.map((r: any) => {
      const rawSource = String(r.source ?? '(sem source)');
      const normalizedSource = rawSource.replace(/_/g, '-');
      const known = knownCollectors.find(
        (collector) =>
          collector.source === normalizedSource ||
          ('aliases' in collector && collector.aliases?.includes(rawSource)),
      );
      const total = Number(r.total ?? 0);
      const outOfScope = Number(r.outOfScope ?? 0);
      const pendingEnrichment = Number(r.pendingEnrichment ?? 0);
      const enriched = Number(r.enriched ?? 0);
      const withErrors = Number(r.withErrors ?? 0);
      const lastSeen = r.lastSeen ?? null;
      const missingEnv = known?.requiredEnv.filter((name) => !process.env[name]) ?? [];
      const stale = Boolean(
        lastSeen &&
          Date.now() - new Date(lastSeen).getTime() > 48 * 60 * 60 * 1000,
      );
      return {
        source: known?.source ?? rawSource,
        status: missingEnv.length ? 'missing_key' : stale ? 'stale' : 'has_events',
        critical: known?.critical ?? null,
        aliases: known?.aliases ?? [],
        requiredEnv: known?.requiredEnv ?? [],
        missingEnv,
        stale,
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
        lastSeen,
      };
    });
    const present = new Set(
      sources.map((source) => String(source.source ?? '').replace(/_/g, '-')),
    );
    for (const collector of knownCollectors) {
      if (present.has(collector.source)) {
        continue;
      }
      const missingEnv = collector.requiredEnv.filter((name) => !process.env[name]);
      sources.push({
        source: collector.source,
        status: missingEnv.length ? 'missing_key' : 'no_events',
        critical: collector.critical,
        total: 0,
        last7d: 0,
        last24h: 0,
        outOfScope: 0,
        outOfScopePercent: 0,
        pendingGeocode: 0,
        pendingEnrichment: 0,
        enriched: 0,
        withErrors: 0,
        errorRate: 0,
        lastSeen: null,
        missingEnv,
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      sources: sources.sort((a, b) => b.total - a.total || a.source.localeCompare(b.source)),
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
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const emailSender = process.env.EMAIL_SENDER || 'noreply@notify.myurbanai.com';
    const senderDomain = emailSender.includes('@') ? emailSender.split('@').pop() || '' : '';
    const mailerSendApiKeyConfigured = Boolean(process.env.MAILERSEND_API_KEY);
    const emailSenderConfigured = Boolean(process.env.EMAIL_SENDER);
    const senderUsesUrbanDomain = senderDomain.endsWith('myurbanai.com');
    const frontUrlConfigured = Boolean(process.env.FRONT_URL);
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() || '';
    const stripePublishableKey =
      process.env.STRIPE_PUBLIC_KEY?.trim() ||
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ||
      '';
    const stripeSecretMode = this.resolveStripeKeyMode(stripeSecretKey, 'sk');
    const stripePublishableMode = this.resolveStripeKeyMode(stripePublishableKey, 'pk');
    const stripePublishableConfigured = Boolean(stripePublishableKey);
    const stripeWebhookConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
    const stripeModeMismatch =
      stripeSecretMode !== 'missing' &&
      stripePublishableMode !== 'missing' &&
      stripeSecretMode !== 'unknown' &&
      stripePublishableMode !== 'unknown' &&
      stripeSecretMode !== stripePublishableMode;
    const supportEmail = process.env.SUPPORT_EMAIL?.trim() || 'suporte@myurbanai.com';
    const privacyEmail = process.env.PRIVACY_EMAIL?.trim() || 'privacidade@myurbanai.com';
    const supportEmailConfigured = Boolean(process.env.SUPPORT_EMAIL?.trim());
    const privacyEmailConfigured = Boolean(process.env.PRIVACY_EMAIL?.trim());
    const supportEmailDomainOk = this.emailDomain(supportEmail).endsWith('myurbanai.com');
    const privacyEmailDomainOk = this.emailDomain(privacyEmail).endsWith('myurbanai.com');
    const supportOwnerEmail = process.env.SUPPORT_OWNER_EMAIL?.trim() || '';
    const privacyOwnerEmail = process.env.PRIVACY_OWNER_EMAIL?.trim() || '';
    const supportOwnerConfigured = Boolean(supportOwnerEmail);
    const privacyOwnerConfigured = Boolean(privacyOwnerEmail);
    const supportOwnerDomainOk = !supportOwnerEmail || this.emailDomain(supportOwnerEmail).endsWith('myurbanai.com');
    const privacyOwnerDomainOk = !privacyOwnerEmail || this.emailDomain(privacyOwnerEmail).endsWith('myurbanai.com');

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
      paymentsByStatus,
      legacyPedingPayments,
      // Sources distinct
      distinctSources,
      // Coletores stale
      staleSources,
      activeAddresses,
      invalidLocalityAddresses,
      pricingLast24h,
      pricingLast30d,
      futurePricingCount,
      activeWithFuturePricing,
      appliedPriceCaptured,
      datasetDiagnostics,
      staysAccounts,
      staysListings,
      priceUpdatesLast30d,
      supportOpen,
      supportOverdue,
      supportP0Open,
      supportLgpdOpen,
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
      this.paymentRepo
        .createQueryBuilder('p')
        .select('p.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('p.status')
        .getRawMany(),
      this.paymentRepo.count({ where: { status: 'peding' as any } }),
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
      this.addressRepo.count({ where: { ativo: true } }),
      this.addressRepo
        .createQueryBuilder('a')
        .where('a.ativo = true')
        .andWhere(
          "(a.cidade IS NULL OR TRIM(a.cidade) = '' OR LOWER(a.cidade) = :undefinedCity OR a.estado IS NULL OR TRIM(a.estado) = '' OR TRIM(a.estado) = :undefinedState)",
          { undefinedCity: 'a definir', undefinedState: 'A' },
        )
        .getCount(),
      this.analiseRepo
        .createQueryBuilder('a')
        .where('a.criadoEm >= :since', { since: oneDayAgo })
        .getCount(),
      this.analiseRepo
        .createQueryBuilder('a')
        .where('a.criadoEm >= :since', { since: last30d })
        .getCount(),
      this.analiseRepo
        .createQueryBuilder('a')
        .innerJoin('a.evento', 'evento')
        .where('evento.dataInicio >= :now', { now })
        .getCount(),
      this.analiseRepo
        .createQueryBuilder('a')
        .innerJoin('a.evento', 'evento')
        .innerJoin('a.endereco', 'endereco')
        .select('COUNT(DISTINCT endereco.id)', 'count')
        .where('evento.dataInicio >= :now', { now })
        .getRawOne()
        .then((r: any) => Number(r?.count ?? 0)),
      this.analiseRepo
        .createQueryBuilder('a')
        .where('a.precoAplicado IS NOT NULL')
        .getCount(),
      this.collector.datasetDiagnostics(),
      this.staysAccountRepo.count(),
      this.staysListingRepo.count(),
      this.priceUpdateRepo
        .createQueryBuilder('p')
        .where('p.createdAt >= :since', { since: last30d })
        .getCount(),
      this.contactSubmissionRepo.count({
        where: { status: In(['new', 'in_progress'] as any) },
      }),
      this.contactSubmissionRepo.count({
        where: {
          status: In(['new', 'in_progress'] as any),
          dueAt: LessThan(now),
        },
      }),
      this.contactSubmissionRepo.count({
        where: {
          status: In(['new', 'in_progress'] as any),
          severity: 'P0',
        },
      }),
      this.contactSubmissionRepo.count({
        where: {
          status: In(['new', 'in_progress'] as any),
          category: 'privacy_lgpd',
        },
      }),
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
    const pricingCoveragePercent =
      activeAddresses > 0 ? Math.round((activeWithFuturePricing / activeAddresses) * 1000) / 10 : 0;
    const integrationsReadiness = this.buildTrack3Readiness({
      stripeSecretMode,
      stripePublishableMode,
      stripeSecretConfigured: Boolean(stripeSecretKey),
      stripeWebhookConfigured,
      stripePublishableConfigured,
      stripeModeMismatch,
      mailerSendApiKeyConfigured,
      emailSenderConfigured,
      senderUsesUrbanDomain,
      frontUrlConfigured,
      staysApiBaseConfigured: Boolean(process.env.STAYS_API_BASE_URL),
      staysTokenEncryptionConfigured: Boolean(process.env.STAYS_TOKEN_ENCRYPTION_KEY),
      supportP0Open,
      supportOverdue,
      supportLgpdOpen,
      supportEmailConfigured,
      privacyEmailConfigured,
      supportEmailDomainOk,
      privacyEmailDomainOk,
      supportOwnerConfigured,
      privacyOwnerConfigured,
      supportOwnerDomainOk,
      privacyOwnerDomainOk,
    });

    if (eventsNext30d < 100) {
      alerts.push({
        severity: 'red',
        message: `Cobertura de eventos futuros abaixo do gate beta: ${eventsNext30d}/100 nos proximos 30 dias`,
      });
    } else if (eventsNext30d < 200) {
      alerts.push({
        severity: 'amber',
        message: `Eventos futuros abaixo do alvo publico: ${eventsNext30d}/200 nos proximos 30 dias`,
      });
    }
    if (pricingLast24h === 0 && eventsNext30d > 0) {
      alerts.push({
        severity: 'red',
        message: 'Zero recomendacoes de preco criadas nas ultimas 24h apesar de haver eventos futuros',
      });
    }
    if (activeAddresses > 0 && pricingCoveragePercent < 70) {
      alerts.push({
        severity: 'red',
        message: `Cobertura de recomendacao futura abaixo do gate beta: ${pricingCoveragePercent}% dos imoveis ativos`,
      });
    }
    if (invalidLocalityAddresses > 0) {
      alerts.push({
        severity: 'amber',
        message: `${invalidLocalityAddresses} endereco(s) ativo(s) com cidade/UF invalidos`,
      });
    }
    if (datasetDiagnostics.health === 'red') {
      alerts.push({
        severity: 'red',
        message: `Dataset nao pronto: ${datasetDiagnostics.blockers.filter((b) => b.severity === 'red').length} bloqueio(s) critico(s)`,
      });
    } else if (datasetDiagnostics.health === 'amber') {
      alerts.push({
        severity: 'amber',
        message: 'Dataset ainda incompleto para validar ROI/MAPE com confianca',
      });
    }
    if (appliedPriceCaptured === 0) {
      alerts.push({
        severity: 'amber',
        message: 'Nenhum preco aplicado capturado; MAPE/ROI ainda nao sao comprovaveis',
      });
    }
    if (legacyPedingPayments > 0) {
      alerts.push({
        severity: 'amber',
        message: `${legacyPedingPayments} pagamento(s) com status legado "peding" aguardam saneamento`,
      });
    }
    if (stripeSecretMode === 'missing') {
      alerts.push({
        severity: 'amber',
        message: 'STRIPE_SECRET_KEY ausente; checkout e sync check ficam bloqueados',
      });
    } else if (stripeSecretMode === 'unknown') {
      alerts.push({
        severity: 'amber',
        message: 'STRIPE_SECRET_KEY com prefixo inesperado; validar se e sk_test ou sk_live',
      });
    }
    if (!stripeWebhookConfigured) {
      alerts.push({
        severity: 'amber',
        message: 'STRIPE_WEBHOOK_SECRET ausente; checkout pode abrir, mas assinatura local nao sincroniza',
      });
    }
    if (!stripePublishableConfigured) {
      alerts.push({
        severity: 'info',
        message: 'Publishable key Stripe nao visivel no backend; confirmar NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY no frontend',
      });
    } else if (stripePublishableMode === 'unknown') {
      alerts.push({
        severity: 'amber',
        message: 'Publishable key Stripe com prefixo inesperado; validar se e pk_test ou pk_live',
      });
    }
    if (stripeModeMismatch) {
      alerts.push({
        severity: 'red',
        message: `Stripe com modos misturados: secret=${stripeSecretMode}, publishable=${stripePublishableMode}`,
      });
    }
    if (supportP0Open > 0) {
      alerts.push({
        severity: 'red',
        message: `${supportP0Open} ticket(s) P0 abertos em suporte/LGPD`,
      });
    }
    if (supportOverdue > 0) {
      alerts.push({
        severity: 'amber',
        message: `${supportOverdue} ticket(s) de suporte/LGPD com SLA vencido`,
      });
    }
    if (supportLgpdOpen > 0) {
      alerts.push({
        severity: 'info',
        message: `${supportLgpdOpen} pedido(s) LGPD aberto(s); prazo operacional: 15 dias corridos`,
      });
    }
    if (!supportEmailConfigured) {
      alerts.push({
        severity: 'info',
        message: `SUPPORT_EMAIL nao configurado; usando fallback ${supportEmail}`,
      });
    }
    if (!privacyEmailConfigured) {
      alerts.push({
        severity: 'info',
        message: `PRIVACY_EMAIL nao configurado; usando fallback ${privacyEmail}`,
      });
    }
    if (!supportEmailDomainOk || !privacyEmailDomainOk) {
      alerts.push({
        severity: 'amber',
        message: 'Canais suporte/privacidade fora do dominio myurbanai.com; revisar antes do beta pago',
      });
    }
    if (!supportOwnerConfigured || !privacyOwnerConfigured) {
      alerts.push({
        severity: 'info',
        message: 'Donos operacionais de suporte/privacidade nao configurados; defina SUPPORT_OWNER_EMAIL e PRIVACY_OWNER_EMAIL',
      });
    } else if (!supportOwnerDomainOk || !privacyOwnerDomainOk) {
      alerts.push({
        severity: 'amber',
        message: 'Donos operacionais de suporte/privacidade fora do dominio myurbanai.com',
      });
    }
    if (!mailerSendApiKeyConfigured) {
      alerts.push({
        severity: 'amber',
        message: 'MAILERSEND_API_KEY ausente; e-mails transacionais e drip podem falhar',
      });
    }
    if (!emailSenderConfigured || !senderUsesUrbanDomain) {
      alerts.push({
        severity: 'info',
        message: `Sender de e-mail usando ${senderDomain || 'dominio invalido'}; validar SPF/DKIM antes do beta pago`,
      });
    }
    if (!frontUrlConfigured) {
      alerts.push({
        severity: 'info',
        message: 'FRONT_URL ausente; links em e-mails usam fallback app.myurbanai.com',
      });
    }
    if (!process.env.STAYS_API_BASE_URL || !process.env.STAYS_TOKEN_ENCRYPTION_KEY) {
      alerts.push({
        severity: 'info',
        message: 'Stays em beta privado: configure API base e encryption key antes de tokens reais',
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
      pricing: {
        last24h: pricingLast24h,
        last30d: pricingLast30d,
        futureRecommendations: futurePricingCount,
        activeAddresses,
        activeWithFuturePricing,
        coveragePercent: pricingCoveragePercent,
        appliedPriceCaptured,
        invalidLocalityAddresses,
      },
      dataset: {
        health: datasetDiagnostics.health,
        readiness: datasetDiagnostics.readiness,
        blockers: datasetDiagnostics.blockers.slice(0, 5),
        priceSnapshots: datasetDiagnostics.tables.priceSnapshots.total,
        occupancyRecords: datasetDiagnostics.tables.occupancyHistory.total,
        eventProximityFeatures: datasetDiagnostics.tables.eventProximityFeatures.total,
        latestSnapshotDate: datasetDiagnostics.tables.priceSnapshots.latestSnapshotDate,
      },
      billing: {
        activeSubscriptions,
        legacyPedingPayments,
        stripeSecretConfigured: Boolean(stripeSecretKey),
        stripeWebhookConfigured,
        stripePublishableConfigured,
        stripeSecretMode,
        stripePublishableMode,
        stripeModeMismatch,
        byStatus: (paymentsByStatus as any[]).map((r: any) => ({
          status: String(r.status ?? 'unknown'),
          count: Number(r.count ?? 0),
        })),
      },
      email: {
        mailerSendApiKeyConfigured,
        emailSenderConfigured,
        senderDomain,
        senderUsesUrbanDomain,
        frontUrlConfigured,
      },
      stays: {
        accounts: staysAccounts,
        listings: staysListings,
        priceUpdatesLast30d,
        apiBaseConfigured: Boolean(process.env.STAYS_API_BASE_URL),
        tokenEncryptionConfigured: Boolean(process.env.STAYS_TOKEN_ENCRYPTION_KEY),
        betaPrivate: !process.env.STAYS_API_BASE_URL || !process.env.STAYS_TOKEN_ENCRYPTION_KEY,
      },
      support: {
        open: supportOpen,
        overdue: supportOverdue,
        p0Open: supportP0Open,
        lgpdOpen: supportLgpdOpen,
        supportEmail,
        privacyEmail,
        supportEmailConfigured,
        privacyEmailConfigured,
        supportEmailDomainOk,
        privacyEmailDomainOk,
        supportOwnerEmail,
        privacyOwnerEmail,
        supportOwnerConfigured,
        privacyOwnerConfigured,
        supportOwnerDomainOk,
        privacyOwnerDomainOk,
      },
      integrationsReadiness,
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

  private resolveStripeKeyMode(
    key: string,
    expectedPrefix: 'sk' | 'pk',
  ): 'test' | 'live' | 'unknown' | 'missing' {
    if (!key) return 'missing';
    if (key.startsWith(`${expectedPrefix}_test_`) || key === `${expectedPrefix}_test`) return 'test';
    if (key.startsWith(`${expectedPrefix}_live_`) || key === `${expectedPrefix}_live`) return 'live';
    return 'unknown';
  }

  private emailDomain(email: string): string {
    return email.includes('@') ? email.split('@').pop()?.toLowerCase() || '' : '';
  }

  private buildTrack3Readiness(input: {
    stripeSecretMode: 'test' | 'live' | 'unknown' | 'missing';
    stripePublishableMode: 'test' | 'live' | 'unknown' | 'missing';
    stripeSecretConfigured: boolean;
    stripeWebhookConfigured: boolean;
    stripePublishableConfigured: boolean;
    stripeModeMismatch: boolean;
    mailerSendApiKeyConfigured: boolean;
    emailSenderConfigured: boolean;
    senderUsesUrbanDomain: boolean;
    frontUrlConfigured: boolean;
    staysApiBaseConfigured: boolean;
    staysTokenEncryptionConfigured: boolean;
    supportP0Open: number;
    supportOverdue: number;
    supportLgpdOpen: number;
    supportEmailConfigured: boolean;
    privacyEmailConfigured: boolean;
    supportEmailDomainOk: boolean;
    privacyEmailDomainOk: boolean;
    supportOwnerConfigured: boolean;
    privacyOwnerConfigured: boolean;
    supportOwnerDomainOk: boolean;
    privacyOwnerDomainOk: boolean;
  }) {
    const stripeBlockers: string[] = [];
    if (!input.stripeSecretConfigured) stripeBlockers.push('STRIPE_SECRET_KEY ausente');
    if (!input.stripeWebhookConfigured) stripeBlockers.push('STRIPE_WEBHOOK_SECRET ausente');
    if (!input.stripePublishableConfigured) stripeBlockers.push('Publishable key Stripe ausente');
    if (input.stripeSecretMode === 'unknown') stripeBlockers.push('Secret key Stripe com modo desconhecido');
    if (input.stripePublishableMode === 'unknown') stripeBlockers.push('Publishable key Stripe com modo desconhecido');
    if (input.stripeModeMismatch) stripeBlockers.push('Secret e publishable key Stripe em modos diferentes');

    const emailBlockers: string[] = [];
    if (!input.mailerSendApiKeyConfigured) emailBlockers.push('MAILERSEND_API_KEY ausente');
    if (!input.emailSenderConfigured) emailBlockers.push('EMAIL_SENDER ausente');
    if (!input.senderUsesUrbanDomain) emailBlockers.push('Sender fora do dominio myurbanai.com');
    if (!input.frontUrlConfigured) emailBlockers.push('FRONT_URL ausente');

    const staysBlockers: string[] = [];
    if (!input.staysApiBaseConfigured) staysBlockers.push('STAYS_API_BASE_URL ausente');
    if (!input.staysTokenEncryptionConfigured) staysBlockers.push('STAYS_TOKEN_ENCRYPTION_KEY ausente');

    const supportBlockers: string[] = [];
    if (input.supportP0Open > 0) supportBlockers.push(`${input.supportP0Open} ticket(s) P0 abertos`);
    if (input.supportOverdue > 0) supportBlockers.push(`${input.supportOverdue} ticket(s) com SLA vencido`);
    if (!input.supportEmailConfigured) supportBlockers.push('SUPPORT_EMAIL ausente');
    if (!input.privacyEmailConfigured) supportBlockers.push('PRIVACY_EMAIL ausente');
    if (!input.supportEmailDomainOk || !input.privacyEmailDomainOk) {
      supportBlockers.push('Canais suporte/privacidade fora do dominio myurbanai.com');
    }
    if (!input.supportOwnerConfigured) supportBlockers.push('SUPPORT_OWNER_EMAIL ausente');
    if (!input.privacyOwnerConfigured) supportBlockers.push('PRIVACY_OWNER_EMAIL ausente');
    if (!input.supportOwnerDomainOk || !input.privacyOwnerDomainOk) {
      supportBlockers.push('Donos operacionais fora do dominio myurbanai.com');
    }
    if (input.supportLgpdOpen > 0) {
      supportBlockers.push(`${input.supportLgpdOpen} pedido(s) LGPD exigem acompanhamento`);
    }

    return {
      stripe: this.readinessItem(
        'Stripe',
        stripeBlockers,
        'Configurar chaves test/live coerentes e rodar checkout + webhook em test mode.',
      ),
      email: this.readinessItem(
        'MailerSend',
        emailBlockers,
        'Validar dominio, DKIM/SPF e envio real transacional.',
      ),
      stays: this.readinessItem(
        'Stays',
        staysBlockers,
        'Configurar sandbox/API oficial e executar smoke beta privado.',
      ),
      support: this.readinessItem(
        'Suporte & LGPD',
        supportBlockers,
        'Confirmar donos operacionais e zerar P0/SLA vencido antes do beta pago.',
      ),
    };
  }

  private readinessItem(label: string, blockers: string[], nextAction: string) {
    return {
      label,
      status: blockers.length === 0 ? 'ready' : 'blocked',
      blockers,
      nextAction: blockers.length === 0 ? 'Executar smoke real e anexar evidencia.' : nextAction,
    };
  }

  private formatAlphaRecommendations(analyses: AnalisePreco[]) {
    return analyses.map((analysis) => {
      const current = Number(analysis.seuPrecoAtual);
      const suggested = Number(analysis.precoSugerido);
      return {
        id: analysis.id,
        createdAt: analysis.criadoEm?.toISOString?.() ?? analysis.criadoEm,
        property: {
          listId: analysis.endereco?.list?.id ?? null,
          addressId: analysis.endereco?.id ?? null,
          title: analysis.endereco?.list?.titulo ?? null,
          manualDailyPrice: analysis.endereco?.list?.manualDailyPrice ?? null,
          averageMonthlyRevenue: analysis.endereco?.list?.averageMonthlyRevenue ?? null,
        },
        event: {
          id: analysis.evento?.id ?? null,
          name: analysis.evento?.nome ?? null,
          city: analysis.evento?.cidade ?? null,
          state: analysis.evento?.estado ?? null,
          startsAt: analysis.evento?.dataInicio?.toISOString?.() ?? analysis.evento?.dataInicio ?? null,
          source: analysis.evento?.source ?? null,
          relevance: analysis.evento?.relevancia ?? null,
          expectedAttendance: analysis.evento?.expectedAttendance ?? analysis.evento?.capacidadeEstimada ?? null,
        },
        pricing: {
          current,
          suggested,
          lift: Number.isFinite(current) && Number.isFinite(suggested) ? suggested - current : null,
          liftPercent: analysis.diferencaPercentual,
          recommendation: analysis.recomendacao,
          reason: analysis.motivo_ia,
          distanceKm: analysis.distanciaSuaPropriedade,
        },
        lifecycle: {
          accepted: analysis.aceito,
          status: analysis.status,
          appliedPrice: analysis.precoAplicado,
          appliedAt: analysis.aplicadoEm?.toISOString?.() ?? analysis.aplicadoEm,
          applicationOrigin: analysis.origemAplicacao,
        },
        outcome: {
          reservationStatus: analysis.reservaStatus,
          realRevenue: analysis.receitaReal,
          bookedNights: analysis.noitesReservadas,
          capturedAt: analysis.resultadoRegistradoEm?.toISOString?.() ?? analysis.resultadoRegistradoEm,
          note: analysis.feedbackObservacao,
        },
        qualityFlags: this.eventQualityFlags(analysis.evento),
      };
    });
  }

  private eventQualityFlags(evento: EventEntity | null | undefined): string[] {
    const flags: string[] = [];
    if (!evento) return ['missing_event'];
    if (evento.ativo === false) flags.push('inactive');
    if (evento.outOfScope === true) flags.push('out_of_scope');
    if (evento.pendingGeocode === true) flags.push('pending_geocode');
    if (!evento.dataInicio || new Date(evento.dataInicio) < new Date()) flags.push('past_or_missing_date');
    if (!evento.latitude || !evento.longitude) flags.push('missing_coordinates');

    const sourceText = `${evento.source ?? ''} ${evento.categoria ?? ''} ${evento.venueType ?? ''} ${evento.nome ?? ''}`.toLowerCase();
    if (sourceText.includes('online') || sourceText.includes('virtual') || sourceText.includes('webinar')) {
      flags.push('online_event');
    }

    const relevance = Number(evento.relevancia);
    const radius = Number(evento.raioImpactoKm);
    if (Number.isFinite(relevance) && relevance <= 0 && Number.isFinite(radius) && radius <= 0) {
      flags.push('zero_impact');
    }
    return flags;
  }
}
