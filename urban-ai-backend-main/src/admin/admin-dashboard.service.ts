import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan } from 'typeorm';
import { User } from '../entities/user.entity';
import { Address } from '../entities/addresses.entity';
import { List } from '../entities/list.entity';
import { Event as EventEntity } from '../entities/events.entity';
import { Payment } from '../entities/payment.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import { PriceUpdate } from '../entities/price-update.entity';
import { StaysAccount } from '../entities/stays-account.entity';
import { StaysListing } from '../entities/stays-listing.entity';
import { Waitlist } from '../entities/waitlist.entity';
import { CoverageRegion } from '../entities/coverage-region.entity';
import { ContactSubmission } from '../entities/contact-submission.entity';
import { AdaptivePricingStrategy } from '../knn-engine/strategies/adaptive-pricing.strategy';
import { DatasetCollectorService } from '../knn-engine/dataset-collector.service';
import { countPt } from './admin-format.util';
import { AdminEventsService } from './admin-events.service';

/**
 * AdminDashboardService — visão geral (`/admin/overview`) e snapshot executivo
 * (`/admin/dashboard`), incluindo o readiness das integrações da Trilha 3.
 * Não expõe PII sensível (senha, token), apenas contagens, status e indicadores.
 */
@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,
    @InjectRepository(List) private readonly listRepo: Repository<List>,
    @InjectRepository(EventEntity)
    private readonly eventRepo: Repository<EventEntity>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(AnalisePreco)
    private readonly analiseRepo: Repository<AnalisePreco>,
    @InjectRepository(PriceUpdate)
    private readonly priceUpdateRepo: Repository<PriceUpdate>,
    @InjectRepository(StaysAccount)
    private readonly staysAccountRepo: Repository<StaysAccount>,
    @InjectRepository(StaysListing)
    private readonly staysListingRepo: Repository<StaysListing>,
    @InjectRepository(Waitlist)
    private readonly waitlistRepo: Repository<Waitlist>,
    @InjectRepository(CoverageRegion)
    private readonly coverageRepo: Repository<CoverageRegion>,
    @InjectRepository(ContactSubmission)
    private readonly contactSubmissionRepo: Repository<ContactSubmission>,
    private readonly adaptiveStrategy: AdaptivePricingStrategy,
    private readonly collector: DatasetCollectorService,
    private readonly adminEvents: AdminEventsService,
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
        .where('e.dataInicio >= :cutoff', {
          cutoff: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        })
        .getCount(),
      this.analiseRepo.count(),
      this.analiseRepo.count({ where: { aceito: true } }),
      this.paymentRepo
        .createQueryBuilder('p')
        .where('p.status IN (:...statuses)', {
          statuses: ['active', 'trialing'],
        })
        .getCount(),
      this.collector.datasetSize(),
      this.adaptiveStrategy.describeCurrentTier(),
    ]);

    const acceptanceRate = totalAnalyses > 0 ? Math.round((analysesAccepted / totalAnalyses) * 1000) / 10 : 0;

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
    const emailSender = process.env.EMAIL_SENDER || 'noreply@myurbanai.com';
    const senderDomain = emailSender.includes('@') ? emailSender.split('@').pop() || '' : '';
    const brevoApiKeyConfigured = Boolean(process.env.BREVO_API_KEY);
    const emailSenderConfigured = Boolean(process.env.EMAIL_SENDER);
    const senderUsesUrbanDomain = this.isUrbanEmailDomain(senderDomain);
    const frontUrlConfigured = Boolean(process.env.FRONT_URL);
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() || '';
    const stripePublishableKey =
      process.env.STRIPE_PUBLIC_KEY?.trim() || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || '';
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
    const supportEmailDomainOk = this.isUrbanEmailDomain(this.emailDomain(supportEmail));
    const privacyEmailDomainOk = this.isUrbanEmailDomain(this.emailDomain(privacyEmail));
    const supportOwnerEmail = process.env.SUPPORT_OWNER_EMAIL?.trim() || '';
    const privacyOwnerEmail = process.env.PRIVACY_OWNER_EMAIL?.trim() || '';
    const supportOwnerConfigured = Boolean(supportOwnerEmail);
    const privacyOwnerConfigured = Boolean(privacyOwnerEmail);
    const supportOwnerDomainOk = !supportOwnerEmail || this.isUrbanEmailDomain(this.emailDomain(supportOwnerEmail));
    const privacyOwnerDomainOk = !privacyOwnerEmail || this.isUrbanEmailDomain(this.emailDomain(privacyOwnerEmail));

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
      this.eventRepo.createQueryBuilder('e').where('e.dataCrawl >= :since', { since: oneDayAgo }).getCount(),
      this.eventRepo.createQueryBuilder('e').where('e.dataCrawl >= :since', { since: sevenDaysAgo }).getCount(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.dataInicio BETWEEN :start AND :end', {
          start: now,
          end: next7d,
        })
        .andWhere('e.outOfScope = :v', { v: false })
        .getCount(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.dataInicio BETWEEN :start AND :end', {
          start: now,
          end: next30d,
        })
        .andWhere('e.outOfScope = :v', { v: false })
        .getCount(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.dataInicio BETWEEN :start AND :end', {
          start: now,
          end: next30d,
        })
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
      this.analiseRepo.createQueryBuilder('a').where('a.criadoEm >= :since', { since: oneDayAgo }).getCount(),
      this.analiseRepo.createQueryBuilder('a').where('a.criadoEm >= :since', { since: last30d }).getCount(),
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
      this.analiseRepo.createQueryBuilder('a').where('a.precoAplicado IS NOT NULL').getCount(),
      this.collector.datasetDiagnostics(),
      this.staysAccountRepo.count(),
      this.staysListingRepo.count(),
      this.priceUpdateRepo.createQueryBuilder('p').where('p.createdAt >= :since', { since: last30d }).getCount(),
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
    const timeline = await this.adminEvents.eventsTimeline(7);

    // Top sources últimos 7d (top 5)
    const topSources = await this.eventRepo
      .createQueryBuilder('e')
      .select("COALESCE(e.source, '(sem source)')", 'source')
      .addSelect('COUNT(*)', 'count')
      .where('e.dataCrawl >= :since', { since: sevenDaysAgo })
      .groupBy('source')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    // Alertas
    const alerts: Array<{
      severity: 'red' | 'amber' | 'info';
      message: string;
    }> = [];

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
      brevoApiKeyConfigured,
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
        message: `Cobertura de eventos futuros abaixo do gate beta: ${eventsNext30d}/100 nos próximos 30 dias`,
      });
    } else if (eventsNext30d < 200) {
      alerts.push({
        severity: 'amber',
        message: `Eventos futuros abaixo do alvo público: ${eventsNext30d}/200 nos próximos 30 dias`,
      });
    }
    if (pricingLast24h === 0 && eventsNext30d > 0) {
      alerts.push({
        severity: 'red',
        message: 'Zero recomendações de preço criadas nas últimas 24h apesar de haver eventos futuros',
      });
    }
    if (activeAddresses > 0 && pricingCoveragePercent < 70) {
      alerts.push({
        severity: 'red',
        message: `Cobertura de recomendação futura abaixo do gate beta: ${pricingCoveragePercent}% dos imóveis ativos`,
      });
    }
    if (invalidLocalityAddresses > 0) {
      alerts.push({
        severity: 'amber',
        message: `${countPt(invalidLocalityAddresses, 'endereço ativo com cidade/UF inválidos', 'endereços ativos com cidade/UF inválidos')}`,
      });
    }
    if (datasetDiagnostics.health === 'red') {
      alerts.push({
        severity: 'red',
        message: `Dataset não pronto: ${countPt(
          datasetDiagnostics.blockers.filter((b) => b.severity === 'red').length,
          'bloqueio crítico',
          'bloqueios críticos',
        )}`,
      });
    } else if (datasetDiagnostics.health === 'amber') {
      alerts.push({
        severity: 'amber',
        message: 'Dataset ainda incompleto para validar ROI/MAPE com confiança',
      });
    }
    if (appliedPriceCaptured === 0) {
      alerts.push({
        severity: 'amber',
        message: 'Nenhum preço aplicado capturado; MAPE/ROI ainda não são comprováveis',
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
        message: 'STRIPE_SECRET_KEY com prefixo inesperado; validar se é sk_test ou sk_live',
      });
    }
    if (!stripeWebhookConfigured) {
      alerts.push({
        severity: 'amber',
        message: 'STRIPE_WEBHOOK_SECRET ausente; checkout pode abrir, mas assinatura local não sincroniza',
      });
    }
    if (!stripePublishableConfigured) {
      alerts.push({
        severity: 'info',
        message: 'Publishable key Stripe não visível no backend; confirmar NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY no frontend',
      });
    } else if (stripePublishableMode === 'unknown') {
      alerts.push({
        severity: 'amber',
        message: 'Publishable key Stripe com prefixo inesperado; validar se é pk_test ou pk_live',
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
        message: `SUPPORT_EMAIL não configurado; usando fallback ${supportEmail}`,
      });
    }
    if (!privacyEmailConfigured) {
      alerts.push({
        severity: 'info',
        message: `PRIVACY_EMAIL não configurado; usando fallback ${privacyEmail}`,
      });
    }
    if (!supportEmailDomainOk || !privacyEmailDomainOk) {
      alerts.push({
        severity: 'amber',
        message: 'Canais de suporte/privacidade fora do domínio myurbanai.com; revisar antes do beta pago',
      });
    }
    if (!supportOwnerConfigured || !privacyOwnerConfigured) {
      alerts.push({
        severity: 'info',
        message:
          'Donos operacionais de suporte/privacidade não configurados; defina SUPPORT_OWNER_EMAIL e PRIVACY_OWNER_EMAIL',
      });
    } else if (!supportOwnerDomainOk || !privacyOwnerDomainOk) {
      alerts.push({
        severity: 'amber',
        message: 'Donos operacionais de suporte/privacidade fora do domínio myurbanai.com',
      });
    }
    if (!brevoApiKeyConfigured) {
      alerts.push({
        severity: 'amber',
        message: 'BREVO_API_KEY ausente; e-mails transacionais e drip podem falhar',
      });
    }
    if (!emailSenderConfigured || !senderUsesUrbanDomain) {
      alerts.push({
        severity: 'info',
        message: `Sender de e-mail usando ${senderDomain || 'domínio inválido'}; validar SPF/DKIM antes do beta pago`,
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
        outOfScopePercent: eventsTotal > 0 ? Math.round((eventsOutOfScope / eventsTotal) * 1000) / 10 : 0,
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
        brevoApiKeyConfigured,
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

  private resolveStripeKeyMode(key: string, expectedPrefix: 'sk' | 'pk'): 'test' | 'live' | 'unknown' | 'missing' {
    if (!key) return 'missing';
    if (key.startsWith(`${expectedPrefix}_test_`) || key === `${expectedPrefix}_test`) return 'test';
    if (key.startsWith(`${expectedPrefix}_live_`) || key === `${expectedPrefix}_live`) return 'live';
    return 'unknown';
  }

  private emailDomain(email: string): string {
    return email.includes('@') ? email.split('@').pop()?.toLowerCase() || '' : '';
  }

  private isUrbanEmailDomain(domain: string): boolean {
    return domain.trim().toLowerCase() === 'myurbanai.com';
  }

  private buildTrack3Readiness(input: {
    stripeSecretMode: 'test' | 'live' | 'unknown' | 'missing';
    stripePublishableMode: 'test' | 'live' | 'unknown' | 'missing';
    stripeSecretConfigured: boolean;
    stripeWebhookConfigured: boolean;
    stripePublishableConfigured: boolean;
    stripeModeMismatch: boolean;
    brevoApiKeyConfigured: boolean;
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
    if (input.stripeSecretMode === 'unknown') stripeBlockers.push('Secret key Stripe com modo desconhecido');
    if (input.stripePublishableMode === 'unknown') stripeBlockers.push('Publishable key Stripe com modo desconhecido');
    if (input.stripeModeMismatch) stripeBlockers.push('Secret e publishable key Stripe em modos diferentes');

    const emailBlockers: string[] = [];
    if (!input.brevoApiKeyConfigured) emailBlockers.push('BREVO_API_KEY ausente');
    if (!input.emailSenderConfigured) emailBlockers.push('EMAIL_SENDER ausente');
    if (!input.senderUsesUrbanDomain) emailBlockers.push('Sender fora do domínio myurbanai.com');

    const staysBlockers: string[] = [];
    if (!input.staysApiBaseConfigured) staysBlockers.push('STAYS_API_BASE_URL ausente');
    if (!input.staysTokenEncryptionConfigured) staysBlockers.push('STAYS_TOKEN_ENCRYPTION_KEY ausente');

    const supportBlockers: string[] = [];
    if (input.supportP0Open > 0) supportBlockers.push(`${input.supportP0Open} ticket(s) P0 abertos`);
    if (input.supportOverdue > 0) supportBlockers.push(`${input.supportOverdue} ticket(s) com SLA vencido`);
    if (!input.supportEmailDomainOk || !input.privacyEmailDomainOk) {
      supportBlockers.push('Canais de suporte/privacidade fora do domínio myurbanai.com');
    }
    if (!input.supportOwnerConfigured) supportBlockers.push('SUPPORT_OWNER_EMAIL ausente');
    if (!input.privacyOwnerConfigured) supportBlockers.push('PRIVACY_OWNER_EMAIL ausente');
    if (input.supportLgpdOpen > 0) {
      supportBlockers.push(`${input.supportLgpdOpen} pedido(s) LGPD exigem acompanhamento`);
    }

    return {
      stripe: this.readinessItem(
        'Stripe',
        stripeBlockers,
        'Configurar chaves test/live coerentes e rodar checkout + webhook em test mode.',
      ),
      email: this.readinessItem('Brevo', emailBlockers, 'Validar domínio, DKIM/SPF e envio real transacional.'),
      stays: this.readinessItem('Stays', staysBlockers, 'Configurar sandbox/API oficial e executar smoke beta privado.'),
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
      nextAction: blockers.length === 0 ? 'Executar smoke real e anexar evidência.' : nextAction,
    };
  }
}
