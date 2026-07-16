import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { EventsEnrichmentService } from '../evento/events-enrichment.service';
import { EventsGeocoderService } from '../evento/events-geocoder.service';
import { DatasetCollectorService } from '../knn-engine/dataset-collector.service';
import { EventHistoricalService } from '../knn-engine/event-historical.service';
import { VenueCapacityService } from '../knn-engine/venue-capacity.service';
import { AdminService } from './admin.service';
import { AirbnbPricingAttemptLogService } from './airbnb-pricing-attempt-log.service';

/**
 * Operações administrativas de qualidade, dataset e jobs manuais.
 *
 * Os contratos continuam sob /admin; esta fronteira concentra diagnósticos e
 * comandos operacionais que compartilham tracking e limites mais restritivos.
 */
@ApiTags('admin-quality-operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminQualityOperationsController {
  constructor(
    private readonly admin: AdminService,
    private readonly datasetCollector: DatasetCollectorService,
    private readonly geocoder: EventsGeocoderService,
    private readonly enrichment: EventsEnrichmentService,
    private readonly airbnbPricingAttempts: AirbnbPricingAttemptLogService,
    private readonly venueCapacity: VenueCapacityService,
    private readonly eventHistorical: EventHistoricalService,
  ) {}

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
}
