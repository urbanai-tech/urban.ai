import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';
import { AdminFinanceService } from './finance.service';
import { StripeSyncCheckService } from './stripe-sync.service';
import { DatasetCollectorService } from '../knn-engine/dataset-collector.service';
import { EventsGeocoderService } from '../evento/events-geocoder.service';
import { EventsEnrichmentService } from '../evento/events-enrichment.service';
import { VenueCapacityService } from '../knn-engine/venue-capacity.service';
import { EventHistoricalService } from '../knn-engine/event-historical.service';
import { RoiService } from '../roi/roi.service';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import { OnboardingDripService } from '../email/onboarding-drip.service';
import { EventDedupAdminService } from './event-dedup-admin.service';
import { EventIntelligenceService } from '../event-intelligence/event-intelligence.service';
import { AirbnbPricingAttemptLogService } from './airbnb-pricing-attempt-log.service';

/**
 * Endpoints administrativos da Urban AI.
 *
 * Acesso restrito por dupla camada:
 *  - JwtAuthGuard (precisa estar autenticado)
 *  - RolesGuard com @Roles('admin') (precisa ter role admin)
 *
 * Throttling padrão (100/min global) — admin acessa pouco e tudo é leitura
 * cara, então não exigimos throttle adicional.
 *
 * NÃO expõe segredos (password, accessToken Stays, Stripe webhook secret etc.).
 */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly finance: AdminFinanceService,
    private readonly stripeSync: StripeSyncCheckService,
    private readonly datasetCollector: DatasetCollectorService,
    private readonly geocoder: EventsGeocoderService,
    private readonly enrichment: EventsEnrichmentService,
    private readonly roi: RoiService,
    private readonly audit: AdminAuditService,
    private readonly onboardingDrip: OnboardingDripService,
    private readonly eventDedup: EventDedupAdminService,
    private readonly eventIntelligence: EventIntelligenceService,
    private readonly airbnbPricingAttempts: AirbnbPricingAttemptLogService,
    private readonly venueCapacity: VenueCapacityService,
    private readonly eventHistorical: EventHistoricalService,
  ) {}

  // ================== Onboarding drip (gap H9) ==================

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary:
      'Dispara manualmente o drip de onboarding (D+1/D+3/D+7) — útil pra smoke e debug.',
  })
  @Post('onboarding-drip/run-now')
  async runOnboardingDripNow() {
    return this.onboardingDrip.processAll();
  }

  @ApiOperation({ summary: 'Visão geral do painel admin (KPIs)' })
  @Get('overview')
  async overview() {
    return this.admin.overview();
  }

  @ApiOperation({
    summary:
      'Dashboard executivo — snapshot agregado em 1 chamada (eventos, waitlist, alertas, timeline 7d, saúde geral)',
  })
  @Get('dashboard-summary')
  async dashboardSummary() {
    return this.admin.dashboardSummary();
  }

  @ApiOperation({ summary: 'Logs de auditoria das mutacoes administrativas' })
  @Get('audit-logs')
  async auditLogs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '25',
    @Query('actorUserId') actorUserId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.audit.list({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      actorUserId,
      action,
      entityType,
      entityId,
    });
  }

  @ApiOperation({ summary: 'Status do motor de pricing (estratégia ativa, tier, dataset)' })
  @Get('pricing/status')
  async pricingStatus() {
    return this.admin.pricingStatus();
  }

  @ApiOperation({ summary: 'Painel alpha por usuário: KPIs, qualidade de eventos e recomendações recentes' })
  @Get('alpha/dashboard')
  async alphaDashboard(@Query('email') email: string) {
    return this.admin.alphaDashboard(email);
  }

  @ApiOperation({ summary: 'Export/auditoria das recomendações alpha' })
  @Get('alpha/recommendations')
  async alphaRecommendations(
    @Query('email') email: string,
    @Query('limit') limit: string = '250',
  ) {
    return this.admin.alphaRecommendations(email, parseInt(limit, 10));
  }

  @ApiOperation({ summary: 'Reprocessar propriedades do usuário alpha' })
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('alpha/reprocess')
  async alphaReprocess(@Query('email') email: string, @Req() req: any) {
    return this.admin.runTrackedJob(
      'alpha-pricing-reprocess',
      req?.user?.userId ?? null,
      () => this.admin.runAlphaReprocess(email),
    );
  }

  @ApiOperation({ summary: 'Métricas do dataset proprietário (por origem, top listings)' })
  @Get('dataset/metrics')
  async datasetMetrics() {
    return this.admin.datasetMetrics();
  }

  @ApiOperation({ summary: 'Diagnóstico completo do dataset proprietário e dependências' })
  @Get('dataset/diagnostics')
  async datasetDiagnostics() {
    return this.datasetCollector.datasetDiagnostics();
  }

  @ApiOperation({ summary: 'Saúde operacional do pipeline Price Intelligence' })
  @Get('price-intelligence/health')
  async priceIntelligenceHealth(@Query('windowDays') windowDays: string = '7') {
    return this.admin.priceIntelligenceHealth(parseInt(windowDays, 10));
  }

  @ApiOperation({ summary: 'Saúde das tentativas Airbnb/headless de preço' })
  @Get('airbnb/pricing-attempts/health')
  async airbnbPricingAttemptHealth(@Query('windowHours') windowHours: string = '24') {
    return this.airbnbPricingAttempts.health(parseInt(windowHours, 10));
  }

  @ApiOperation({ summary: 'Executar snapshot manual dos imóveis cadastrados' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('dataset/snapshot/run')
  async runDatasetSnapshot(@Req() req: any) {
    return this.admin.runTrackedJob(
      'dataset-snapshot',
      req?.user?.userId ?? null,
      () => this.datasetCollector.recordOwnedListingsSnapshot(),
    );
  }

  @ApiOperation({ summary: 'Executar snapshot manual das features de proximidade a eventos' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('dataset/event-proximity/run')
  async runEventProximitySnapshot(@Req() req: any) {
    return this.admin.runTrackedJob(
      'event-proximity-snapshot',
      req?.user?.userId ?? null,
      () => this.datasetCollector.recordEventProximityFeatures(),
    );
  }

  @ApiOperation({ summary: 'Histórico de execução dos jobs admin' })
  @Get('jobs/runs')
  async jobRuns(@Query('limit') limit: string = '10', @Query('name') name?: string) {
    return this.admin.listJobRuns(parseInt(limit, 10), name);
  }

  @ApiOperation({ summary: 'Executar geocoder de eventos com histórico admin' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('jobs/geocoder/run')
  async runGeocoderJob(@Query('limit') limit: string = '50', @Req() req: any) {
    return this.admin.runTrackedJob(
      'geocoder',
      req?.user?.userId ?? null,
      () => this.geocoder.runOnce(parseInt(limit, 10)),
    );
  }

  @ApiOperation({ summary: 'Resetar enrichment stale com histórico admin' })
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('jobs/reset-stale-enrichment/run')
  async runResetStaleEnrichment(@Req() req: any) {
    return this.admin.runTrackedJob(
      'reset-stale-enrichment',
      req?.user?.userId ?? null,
      () => this.enrichment.resetStaleZeroRelevance(),
    );
  }

  @ApiOperation({ summary: 'Backfill de venueCapacity em toda a base de eventos (IA-3c)' })
  @Throttle({ default: { ttl: 60_000, limit: 2 } })
  @Post('jobs/venue-capacity/run')
  async runVenueCapacityBackfill(@Req() req: any) {
    return this.admin.runTrackedJob(
      'venue-capacity-backfill',
      req?.user?.userId ?? null,
      () => this.venueCapacity.backfillAll(),
    );
  }

  @ApiOperation({ summary: 'Importar âncoras históricas (Wikidata) + aplicar aos eventos (IA-3b)' })
  @Throttle({ default: { ttl: 60_000, limit: 2 } })
  @Post('jobs/event-historical/run')
  async runEventHistorical(@Req() req: any) {
    return this.admin.runTrackedJob(
      'event-historical',
      req?.user?.userId ?? null,
      async () => {
        const seeded = await this.eventHistorical.seedCuratedAnchors();
        const imported = await this.eventHistorical.importFromWikidata();
        const refreshed = await this.eventHistorical.refreshFromFirecrawl();
        const feedback = await this.eventHistorical.recomputeFeedbackAnchors();
        const applied = await this.eventHistorical.applyAnchorsAll();
        return { seeded, imported, refreshed, feedback, applied };
      },
    );
  }

  @ApiOperation({ summary: 'Analytics do motor de eventos (cobertura, categorias, top relevância)' })
  @Get('events/analytics')
  async eventsAnalytics() {
    return this.admin.eventsAnalytics();
  }

  @ApiOperation({ summary: 'Listar candidatos de deduplicação de eventos para revisão admin' })
  @Get('events/dedup/candidates')
  async eventDedupCandidates(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('status') status: string = 'pending',
    @Query('confidenceBand') confidenceBand: string = 'all',
    @Query('source') source?: string,
    @Query('search') search?: string,
  ) {
    return this.eventDedup.listEventDedupCandidates({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status: this.dedupStatus(status),
      confidenceBand: this.dedupConfidence(confidenceBand),
      source,
      search,
    });
  }

  @ApiOperation({ summary: 'Rodar scan admin para encontrar candidatos de deduplicação de eventos' })
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('events/dedup/scan')
  async scanEventDedupCandidates(@Body() body: any = {}) {
    return this.eventDedup.scanEventDedupCandidates({
      from: body?.from,
      to: body?.to,
      limit: body?.limit,
      lookbackDays: body?.lookbackDays,
      lookaheadDays: body?.lookaheadDays,
      minScore: body?.minScore,
      highScore: body?.highScore,
      includeInactive: Boolean(body?.includeInactive),
      source: body?.source,
    });
  }

  @ApiOperation({ summary: 'Aprovar merge de um candidato de deduplicação' })
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('events/dedup/candidates/:id/approve')
  async approveEventDedupCandidate(@Param('id') id: string, @Req() req: any) {
    return this.eventDedup.approveEventDedupCandidate(id, req?.user?.userId ?? null);
  }

  @ApiOperation({ summary: 'Rejeitar candidato de deduplicação' })
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('events/dedup/candidates/:id/reject')
  async rejectEventDedupCandidate(
    @Param('id') id: string,
    @Body() body: { reason?: string } = {},
    @Req() req: any,
  ) {
    return this.eventDedup.rejectEventDedupCandidate(id, req?.user?.userId ?? null, body?.reason ?? null);
  }

  @ApiOperation({
    summary:
      'Listagem paginada de eventos com filtros (scope, source, search). Default scope=in.',
  })
  @Get('events/list')
  async eventsList(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('scope') scope: string = 'in',
    @Query('source') source?: string,
    @Query('search') search?: string,
    @Query('upcoming') upcoming?: string,
  ) {
    return this.admin.eventsListing({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      scope: (scope === 'out' || scope === 'all' ? scope : 'in') as 'in' | 'out' | 'all',
      source,
      search,
      upcoming: upcoming === 'true',
    });
  }

  @ApiOperation({
    summary: 'Saúde dos coletores agrupada por source (volume, % out-of-scope, errors)',
  })
  @Get('events/collectors-health')
  async collectorsHealth() {
    return this.admin.collectorsHealth();
  }

  @ApiOperation({
    summary:
      'Timeline diária dos últimos N dias (in-scope vs out-of-scope) — gráfico de evolução',
  })
  @Get('events/timeline')
  async eventsTimeline(@Query('days') days: string = '30') {
    return this.admin.eventsTimeline(parseInt(days, 10));
  }

  private dedupStatus(status: string): any {
    return ['pending', 'approved', 'rejected', 'obsolete', 'all'].includes(status) ? status : 'pending';
  }

  private dedupConfidence(confidenceBand: string): any {
    return ['high', 'medium', 'low', 'all'].includes(confidenceBand) ? confidenceBand : 'all';
  }

  @ApiOperation({ summary: 'Radar admin de inteligência de eventos e potencial de demanda' })
  @Get('events/intelligence')
  async eventsIntelligence(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('source') source?: string,
    @Query('category') category?: string,
    @Query('scope') scope: 'in' | 'out' | 'all' = 'in',
    @Query('confidence') confidence?: string,
    @Query('city') city?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.eventIntelligence.adminIntelligence({
      from,
      to,
      source,
      category,
      scope,
      confidence,
      city,
      search,
      limit,
    });
  }

  @ApiOperation({ summary: 'Heatmap admin de demanda por eventos' })
  @Get('events/heatmap')
  async eventsHeatmap(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('metric') metric?: string,
    @Query('category') category?: string,
    @Query('source') source?: string,
    @Query('scope') scope: 'in' | 'out' | 'all' = 'in',
  ) {
    return this.eventIntelligence.adminHeatmap({
      from,
      to,
      metric,
      category,
      source,
      scope,
    });
  }

  @ApiOperation({ summary: 'Blind spots admin de cobertura, fonte e inteligência de eventos' })
  @Get('events/blind-spots')
  async eventsBlindSpots() {
    return this.eventIntelligence.adminBlindSpots();
  }

  @ApiOperation({ summary: 'Detalhe admin da inteligência de um evento' })
  @Get('events/:eventId/intelligence')
  async eventIntelligenceDetail(@Param('eventId') eventId: string) {
    return this.eventIntelligence.adminEventIntelligence(eventId);
  }

  @ApiOperation({ summary: 'Impacto de um evento em imóveis da plataforma' })
  @Get('events/:eventId/property-impact')
  async eventPropertyImpact(@Param('eventId') eventId: string) {
    return this.eventIntelligence.adminEventPropertyImpact(eventId);
  }

  @ApiOperation({ summary: 'Reprocessar inteligência de um evento (contrato P0)' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('events/:eventId/recompute-intelligence')
  async recomputeEventIntelligence(@Param('eventId') eventId: string, @Req() req: any) {
    return this.eventIntelligence.recomputeEventIntelligence(eventId, req?.user?.userId ?? null);
  }

  @ApiOperation({ summary: 'Reprocessar inteligência de eventos em lote (contrato P0)' })
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('events/intelligence/recompute')
  async recomputeEventsIntelligence(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('source') source?: string,
    @Query('category') category?: string,
    @Query('scope') scope: 'in' | 'out' | 'all' = 'in',
  ) {
    return this.eventIntelligence.recomputeIntelligenceBatch(
      { from, to, source, category, scope },
      req?.user?.userId ?? null,
    );
  }

  @ApiOperation({ summary: 'Backfill controlado da inteligência de eventos futuros sem snapshot' })
  @Throttle({ default: { ttl: 60_000, limit: 2 } })
  @Post('events/intelligence/backfill')
  async backfillFutureEventIntelligence(
    @Req() req: any,
    @Body() body: any = {},
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('lookaheadDays') lookaheadDays?: string,
    @Query('limit') limit?: string,
    @Query('source') source?: string,
    @Query('category') category?: string,
    @Query('city') city?: string,
    @Query('search') search?: string,
    @Query('scope') scope: 'in' | 'out' | 'all' = 'in',
    @Query('force') force?: string,
  ) {
    return this.admin.runTrackedJob(
      'event-intelligence-backfill',
      req?.user?.userId ?? null,
      () =>
        this.eventIntelligence.backfillFutureEventIntelligence(
          {
            from: body?.from ?? from,
            to: body?.to ?? to,
            lookaheadDays: body?.lookaheadDays ?? lookaheadDays,
            limit: body?.limit ?? limit,
            source: body?.source ?? source,
            category: body?.category ?? category,
            city: body?.city ?? city,
            search: body?.search ?? search,
            scope: body?.scope ?? scope,
            force: body?.force ?? force,
          },
          req?.user?.userId ?? null,
        ),
    );
  }

  @ApiOperation({ summary: 'Saúde da integração Stays (contas, listings, push history)' })
  @Get('stays/health')
  async staysHealth() {
    return this.admin.staysHealth();
  }

  @ApiOperation({ summary: 'Funnel de produto (signup → analyses → applied)' })
  @Get('funnel')
  async productFunnel() {
    return this.admin.productFunnel();
  }

  @ApiOperation({ summary: 'Qualidade do motor (MAPE sobre preço aplicado real)' })
  @Get('pricing/quality')
  async pricingQuality() {
    return this.admin.pricingQuality();
  }

  @ApiOperation({ summary: 'Cobertura de ocupação (status, origem, listings distintos)' })
  @Get('occupancy/coverage')
  async occupancyCoverage() {
    return this.admin.occupancyCoverage();
  }

  @ApiOperation({ summary: 'Imóveis elegíveis para apontamento manual de ocupação' })
  @Get('occupancy/properties')
  async occupancyProperties() {
    return this.admin.occupancyProperties();
  }

  @ApiOperation({ summary: 'ROI dos anfitriões: dinheiro atribuído à Urban AI por usuário' })
  @Get('roi')
  async roiOverview(
    @Query('windowDays') windowDays: string = '30',
    @Query('limit') limit: string = '25',
  ) {
    return this.roi.getAdminRoi({
      windowDays: parseInt(windowDays, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({ summary: 'Criar/atualizar ocupação manual de um imóvel por dia' })
  @Post('occupancy/manual')
  async upsertManualOccupancy(
    @Body()
    body: {
      listId?: string;
      airbnbListingId?: string;
      date: string;
      status: 'booked' | 'available' | 'blocked' | 'unknown';
      revenueCents?: number | null;
      listedPriceCents?: number | null;
      currency?: string;
    },
    @Req() req: any,
  ) {
    const result = await this.admin.upsertManualOccupancy(body);
    await this.audit.record({
      actorUserId: req?.user?.userId ?? null,
      action: 'occupancy.manual_upsert',
      entityType: 'occupancy_history',
      entityId: result?.id ?? null,
      after: result,
      metadata: { listId: body.listId, airbnbListingId: body.airbnbListingId, date: body.date },
    });
    return result;
  }

  @ApiOperation({ summary: 'Listar usuários (paginado)' })
  @Get('users')
  async listUsers(@Query('page') page: string = '1', @Query('limit') limit: string = '20') {
    return this.admin.listUsers(parseInt(page, 10), parseInt(limit, 10));
  }

  @ApiOperation({ summary: 'Detalhe de usuário para painel admin' })
  @Get('users/:id')
  async getUser(@Param('id') userId: string) {
    return this.admin.getUserDetail(userId);
  }

  @ApiOperation({ summary: 'Imóveis de um usuário para painel admin' })
  @Get('users/:id/properties')
  async getUserProperties(@Param('id') userId: string) {
    return this.admin.getUserProperties(userId);
  }

  @ApiOperation({ summary: 'Assinatura ativa/recente de um usuário para painel admin' })
  @Get('users/:id/subscription')
  async getUserSubscription(@Param('id') userId: string) {
    return this.admin.getUserSubscription(userId);
  }

  @ApiOperation({ summary: 'Atualizar role do usuário' })
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Patch('users/:id/role')
  async setUserRole(
    @Param('id') userId: string,
    @Body() body: { role: 'host' | 'admin' | 'support' },
    @Req() req: any,
  ) {
    const user = await this.admin.setUserRole(userId, body.role, req?.user?.userId ?? null);
    await this.audit.record({
      actorUserId: req?.user?.userId ?? null,
      action: 'user.role_update',
      entityType: 'user',
      entityId: user.id,
      after: { id: user.id, role: user.role },
    });
    return { id: user.id, role: user.role };
  }

  @ApiOperation({ summary: 'Ativar/desativar usuário' })
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Patch('users/:id/active')
  async setUserActive(
    @Param('id') userId: string,
    @Body() body: { ativo: boolean },
    @Req() req: any,
  ) {
    const user = await this.admin.setUserActive(userId, body.ativo, req?.user?.userId ?? null);
    await this.audit.record({
      actorUserId: req?.user?.userId ?? null,
      action: 'user.active_update',
      entityType: 'user',
      entityId: user.id,
      after: { id: user.id, ativo: user.ativo },
    });
    return { id: user.id, ativo: user.ativo };
  }

  // ================== Finance — custos, receita, margem ==================

  @ApiOperation({ summary: 'Visão consolidada financeira (MRR, custos, margem, por imóvel)' })
  @Get('finance/overview')
  async financeOverview() {
    return this.finance.overview();
  }

  @ApiOperation({ summary: 'Listar custos cadastrados' })
  @Get('finance/costs')
  async listCosts(@Query('includeInactive') inactive: string = 'false') {
    return this.finance.listCosts(inactive === 'true');
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Criar custo operacional novo' })
  @Post('finance/costs')
  async createCost(
    @Body()
    body: {
      name: string;
      category: string;
      recurrence: string;
      monthlyCostCents: number;
      percentOfRevenue?: number;
      description?: string;
      scalesWithListings?: boolean;
      notes?: string;
    },
    @Req() req: any,
  ) {
    const cost = await this.finance.createCost(body);
    await this.audit.record({
      actorUserId: req?.user?.userId ?? null,
      action: 'finance.cost_create',
      entityType: 'platform_cost',
      entityId: cost.id,
      after: cost,
    });
    return cost;
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Atualizar custo' })
  @Patch('finance/costs/:id')
  async updateCost(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const cost = await this.finance.updateCost(id, body);
    await this.audit.record({
      actorUserId: req?.user?.userId ?? null,
      action: 'finance.cost_update',
      entityType: 'platform_cost',
      entityId: cost.id,
      after: cost,
    });
    return cost;
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Remover custo' })
  @Delete('finance/costs/:id')
  async deleteCost(@Param('id') id: string, @Req() req: any) {
    const result = await this.finance.deleteCost(id);
    await this.audit.record({
      actorUserId: req?.user?.userId ?? null,
      action: 'finance.cost_delete',
      entityType: 'platform_cost',
      entityId: id,
    });
    return result;
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary:
      'Popular custos default da Urban AI (idempotente). overwrite=true sobrescreve valores manuais.',
  })
  @Post('finance/costs/seed')
  async seedDefaultCosts(@Query('overwrite') overwrite: string = 'false', @Req() req: any) {
    const result = await this.finance.seedDefaultCosts(overwrite === 'true');
    await this.audit.record({
      actorUserId: req?.user?.userId ?? null,
      action: 'finance.cost_seed',
      entityType: 'platform_cost',
      metadata: { overwrite: overwrite === 'true', summary: result },
    });
    return result;
  }

  // ================== Pricing config (planos) ==================

  @ApiOperation({ summary: 'Listar planos com preços atuais (todos os ciclos)' })
  @Get('plans-config')
  async listPlansConfig() {
    return this.finance.listPlans();
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary: 'Atualizar preço/features de um plano (NÃO atualiza Stripe Price IDs)',
  })
  @Patch('plans-config/:name')
  async updatePlanPricing(@Param('name') name: string, @Body() body: any, @Req() req: any) {
    const plan = await this.finance.updatePlanPricing(name, body);
    await this.audit.record({
      actorUserId: req?.user?.userId ?? null,
      action: 'plan.pricing_update',
      entityType: 'plan',
      entityId: plan.id,
      after: plan,
      metadata: { name },
    });
    return plan;
  }

  // ================== Stripe — sync check ==================

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary:
      'Validar que os 8 Stripe Price IDs (matriz F6.5) existem e batem com o ciclo esperado',
  })
  @Get('stripe/sync-check')
  async stripeSyncCheck() {
    return this.stripeSync.check();
  }
}
