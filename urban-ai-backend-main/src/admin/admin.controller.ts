import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PerMinuteThrottle } from '../common/throttle-config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminEventsService } from './admin-events.service';
import { AdminJobRunsService } from './admin-job-runs.service';
import { AdminOperationsService } from './admin-operations.service';
import { AdminUsersService } from './admin-users.service';
import { RoiService } from '../roi/roi.service';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import { OnboardingDripService } from '../email/onboarding-drip.service';
import { EventDedupAdminService } from './event-dedup-admin.service';
import { EventIntelligenceService } from '../event-intelligence/event-intelligence.service';
import {
  AdminManualOccupancyDto,
  BackfillEventIntelligenceDto,
  RejectEventDedupCandidateDto,
  ScanEventDedupCandidatesDto,
  SetUserActiveDto,
  SetUserRoleDto,
  ListAdminUsersQueryDto,
} from './dto/admin-core.dto';
import { AdminAuditedInHandler } from '../admin-audit/admin-audit.decorator';

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
    private readonly adminDashboard: AdminDashboardService,
    private readonly adminEvents: AdminEventsService,
    private readonly adminOperations: AdminOperationsService,
    private readonly adminUsers: AdminUsersService,
    private readonly adminJobRuns: AdminJobRunsService,
    private readonly roi: RoiService,
    private readonly audit: AdminAuditService,
    private readonly onboardingDrip: OnboardingDripService,
    private readonly eventDedup: EventDedupAdminService,
    private readonly eventIntelligence: EventIntelligenceService,
  ) {}

  // ================== Onboarding drip (gap H9) ==================

  @PerMinuteThrottle(5)
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
    return this.adminDashboard.overview();
  }

  @ApiOperation({
    summary:
      'Dashboard executivo — snapshot agregado em 1 chamada (eventos, waitlist, alertas, timeline 7d, saúde geral)',
  })
  @Get('dashboard-summary')
  async dashboardSummary() {
    return this.adminDashboard.dashboardSummary();
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

  @ApiOperation({ summary: 'Analytics do motor de eventos (cobertura, categorias, top relevância)' })
  @Get('events/analytics')
  async eventsAnalytics() {
    return this.adminEvents.eventsAnalytics();
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
  @PerMinuteThrottle(3)
  @Post('events/dedup/scan')
  async scanEventDedupCandidates(@Body() body: ScanEventDedupCandidatesDto = new ScanEventDedupCandidatesDto()) {
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
  @PerMinuteThrottle(20)
  @Post('events/dedup/candidates/:id/approve')
  async approveEventDedupCandidate(@Param('id') id: string, @Req() req: any) {
    return this.eventDedup.approveEventDedupCandidate(id, req?.user?.userId ?? null);
  }

  @ApiOperation({ summary: 'Rejeitar candidato de deduplicação' })
  @PerMinuteThrottle(20)
  @Post('events/dedup/candidates/:id/reject')
  async rejectEventDedupCandidate(
    @Param('id') id: string,
    @Body() body: RejectEventDedupCandidateDto = new RejectEventDedupCandidateDto(),
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
    return this.adminEvents.eventsListing({
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
    return this.adminEvents.collectorsHealth();
  }

  @ApiOperation({
    summary:
      'Timeline diária dos últimos N dias (in-scope vs out-of-scope) — gráfico de evolução',
  })
  @Get('events/timeline')
  async eventsTimeline(@Query('days') days: string = '30') {
    return this.adminEvents.eventsTimeline(parseInt(days, 10));
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
  @PerMinuteThrottle(5)
  @Post('events/:eventId/recompute-intelligence')
  async recomputeEventIntelligence(@Param('eventId') eventId: string, @Req() req: any) {
    return this.eventIntelligence.recomputeEventIntelligence(eventId, req?.user?.userId ?? null);
  }

  @ApiOperation({ summary: 'Reprocessar inteligência de eventos em lote (contrato P0)' })
  @PerMinuteThrottle(3)
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
  @PerMinuteThrottle(2)
  @Post('events/intelligence/backfill')
  async backfillFutureEventIntelligence(
    @Req() req: any,
    @Body() body: BackfillEventIntelligenceDto = new BackfillEventIntelligenceDto(),
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
    return this.adminJobRuns.runTrackedJob(
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
    return this.adminOperations.staysHealth();
  }

  @ApiOperation({ summary: 'Funnel de produto (signup → analyses → applied)' })
  @Get('funnel')
  async productFunnel() {
    return this.adminOperations.productFunnel();
  }

  @ApiOperation({ summary: 'Qualidade do motor (MAPE sobre preço aplicado real)' })
  @Get('pricing/quality')
  async pricingQuality() {
    return this.adminOperations.pricingQuality();
  }

  @ApiOperation({ summary: 'Cobertura de ocupação (status, origem, listings distintos)' })
  @Get('occupancy/coverage')
  async occupancyCoverage() {
    return this.adminOperations.occupancyCoverage();
  }

  @ApiOperation({ summary: 'Imóveis elegíveis para apontamento manual de ocupação' })
  @Get('occupancy/properties')
  async occupancyProperties() {
    return this.adminOperations.occupancyProperties();
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

  @AdminAuditedInHandler()
  @PerMinuteThrottle(60)
  @ApiOperation({ summary: 'Criar/atualizar ocupação manual de um imóvel por dia' })
  @Post('occupancy/manual')
  async upsertManualOccupancy(
    @Body() body: AdminManualOccupancyDto,
    @Req() req: any,
  ) {
    const result = await this.adminOperations.upsertManualOccupancy(body);
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
  async listUsers(@Query() query: ListAdminUsersQueryDto) {
    const { page, limit, ...filters } = query;
    return this.adminUsers.listUsers(page ?? 1, limit ?? 20, filters);
  }

  @ApiOperation({ summary: 'Detalhe de usuário para painel admin' })
  @Get('users/:id')
  async getUser(@Param('id') userId: string) {
    return this.adminUsers.getUserDetail(userId);
  }

  @ApiOperation({ summary: 'Imóveis de um usuário para painel admin' })
  @Get('users/:id/properties')
  async getUserProperties(@Param('id') userId: string) {
    return this.adminUsers.getUserProperties(userId);
  }

  @ApiOperation({ summary: 'Assinatura ativa/recente de um usuário para painel admin' })
  @Get('users/:id/subscription')
  async getUserSubscription(@Param('id') userId: string) {
    return this.adminUsers.getUserSubscription(userId);
  }

  @AdminAuditedInHandler()
  @ApiOperation({ summary: 'Atualizar role do usuário' })
  @PerMinuteThrottle(20)
  @Patch('users/:id/role')
  async setUserRole(
    @Param('id') userId: string,
    @Body() body: SetUserRoleDto,
    @Req() req: any,
  ) {
    const user = await this.adminUsers.setUserRole(userId, body.role, req?.user?.userId ?? null);
    await this.audit.record({
      actorUserId: req?.user?.userId ?? null,
      action: 'user.role_update',
      entityType: 'user',
      entityId: user.id,
      after: { id: user.id, role: user.role },
    });
    return { id: user.id, role: user.role };
  }

  @AdminAuditedInHandler()
  @ApiOperation({ summary: 'Ativar/desativar usuário' })
  @PerMinuteThrottle(20)
  @Patch('users/:id/active')
  async setUserActive(
    @Param('id') userId: string,
    @Body() body: SetUserActiveDto,
    @Req() req: any,
  ) {
    const user = await this.adminUsers.setUserActive(userId, body.ativo, req?.user?.userId ?? null);
    await this.audit.record({
      actorUserId: req?.user?.userId ?? null,
      action: 'user.active_update',
      entityType: 'user',
      entityId: user.id,
      after: { id: user.id, ativo: user.ativo },
    });
    return { id: user.id, ativo: user.ativo };
  }

}
