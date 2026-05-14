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
  ) {}

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

  @ApiOperation({ summary: 'Status do motor de pricing (estratégia ativa, tier, dataset)' })
  @Get('pricing/status')
  async pricingStatus() {
    return this.admin.pricingStatus();
  }

  @ApiOperation({ summary: 'Métricas do dataset proprietário (por origem, top listings)' })
  @Get('dataset/metrics')
  async datasetMetrics() {
    return this.admin.datasetMetrics();
  }

  @ApiOperation({ summary: 'Diagnostico completo do dataset proprietario e dependencias' })
  @Get('dataset/diagnostics')
  async datasetDiagnostics() {
    return this.datasetCollector.datasetDiagnostics();
  }

  @ApiOperation({ summary: 'Executar snapshot manual dos imoveis cadastrados' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('dataset/snapshot/run')
  async runDatasetSnapshot(@Req() req: any) {
    return this.admin.runTrackedJob(
      'dataset-snapshot',
      req?.user?.userId ?? null,
      () => this.datasetCollector.recordOwnedListingsSnapshot(),
    );
  }

  @ApiOperation({ summary: 'Historico de execucao dos jobs admin' })
  @Get('jobs/runs')
  async jobRuns(@Query('limit') limit: string = '10', @Query('name') name?: string) {
    return this.admin.listJobRuns(parseInt(limit, 10), name);
  }

  @ApiOperation({ summary: 'Executar geocoder de eventos com historico admin' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('jobs/geocoder/run')
  async runGeocoderJob(@Query('limit') limit: string = '50', @Req() req: any) {
    return this.admin.runTrackedJob(
      'geocoder',
      req?.user?.userId ?? null,
      () => this.geocoder.runOnce(parseInt(limit, 10)),
    );
  }

  @ApiOperation({ summary: 'Resetar enrichment stale com historico admin' })
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('jobs/reset-stale-enrichment/run')
  async runResetStaleEnrichment(@Req() req: any) {
    return this.admin.runTrackedJob(
      'reset-stale-enrichment',
      req?.user?.userId ?? null,
      () => this.enrichment.resetStaleZeroRelevance(),
    );
  }

  @ApiOperation({ summary: 'Analytics do motor de eventos (cobertura, categorias, top relevância)' })
  @Get('events/analytics')
  async eventsAnalytics() {
    return this.admin.eventsAnalytics();
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

  @ApiOperation({ summary: 'Listar usuários (paginado)' })
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({ summary: 'Criar/atualizar ocupacao manual de um imovel por dia' })
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
  ) {
    return this.admin.upsertManualOccupancy(body);
  }

  @ApiOperation({ summary: 'Listar usuarios (paginado)' })
  @Get('users')
  async listUsers(@Query('page') page: string = '1', @Query('limit') limit: string = '20') {
    return this.admin.listUsers(parseInt(page, 10), parseInt(limit, 10));
  }

  @ApiOperation({ summary: 'Atualizar role do usuário' })
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Patch('users/:id/role')
  async setUserRole(
    @Param('id') userId: string,
    @Body() body: { role: 'host' | 'admin' | 'support' },
  ) {
    const user = await this.admin.setUserRole(userId, body.role);
    return { id: user.id, role: user.role };
  }

  @ApiOperation({ summary: 'Ativar/desativar usuário' })
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Patch('users/:id/active')
  async setUserActive(
    @Param('id') userId: string,
    @Body() body: { ativo: boolean },
  ) {
    const user = await this.admin.setUserActive(userId, body.ativo);
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
  ) {
    return this.finance.createCost(body);
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Atualizar custo' })
  @Patch('finance/costs/:id')
  async updateCost(@Param('id') id: string, @Body() body: any) {
    return this.finance.updateCost(id, body);
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Remover custo' })
  @Delete('finance/costs/:id')
  async deleteCost(@Param('id') id: string) {
    return this.finance.deleteCost(id);
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary:
      'Popular custos default da Urban AI (idempotente). overwrite=true sobrescreve valores manuais.',
  })
  @Post('finance/costs/seed')
  async seedDefaultCosts(@Query('overwrite') overwrite: string = 'false') {
    return this.finance.seedDefaultCosts(overwrite === 'true');
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
  async updatePlanPricing(@Param('name') name: string, @Body() body: any) {
    return this.finance.updatePlanPricing(name, body);
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
