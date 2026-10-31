import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PerMinuteThrottle } from '../common/throttle-config';
import { AdminAuditedInHandler } from '../admin-audit/admin-audit.decorator';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import { AdminJobRun } from '../entities/admin-job-run.entity';
import { runAdminJobWithTracking } from '../admin-job-runs/admin-job-run-tracker';
import {
  loadReferenceVenues,
  readEventReferenceConfig,
  readProviderAvailability,
} from './event-reference.config';
import { EventReferenceCurationService } from './event-reference-curation.service';
import { EventCoverageService } from './event-coverage.service';
import { EventReferenceService, REFERENCE_CSV_TEMPLATE } from './event-reference.service';
import { ImportReferenceCsvDto, ReferenceDecisionDto } from './event-reference.dto';

/**
 * ADR 0026 — lista de referência de eventos (admin): fila de conflitos, lista, import CSV,
 * curadoria por agentes, casamento e métricas. Mutações passam pela auditoria global; as
 * decisões de aprovar/rejeitar registram before/after na própria rota.
 */
@ApiTags('admin-event-reference')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/event-reference')
export class EventReferenceController {
  constructor(
    private readonly references: EventReferenceService,
    private readonly curation: EventReferenceCurationService,
    private readonly coverage: EventCoverageService,
    private readonly audit: AdminAuditService,
    @InjectRepository(AdminJobRun) private readonly jobRunRepo: Repository<AdminJobRun>,
  ) {}

  @ApiOperation({ summary: 'Lista de referência (filtros por status, venue, nome e datas)' })
  @Get()
  async list(
    @Query('status') status?: string,
    @Query('venueKey') venueKey?: string,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.references.list({ status, venueKey, q, from, to, page: Number(page), limit: Number(limit) });
  }

  @ApiOperation({ summary: 'Fila de conflitos (divergência entre validadores) para revisão humana' })
  @Get('conflicts')
  async conflicts() {
    return { items: await this.references.conflictQueue() };
  }

  @ApiOperation({ summary: 'Configuração efetiva: venues, chaves presentes (só booleanos), tetos e pisos' })
  @Get('config')
  async config() {
    const config = readEventReferenceConfig();
    const providers = readProviderAvailability();
    const venues = loadReferenceVenues();
    return {
      config,
      providers,
      venues: venues.venues.map((v) => ({ key: v.key, name: v.name, size: v.size, officialUrl: v.officialUrl })),
      venuesSource: venues.source,
      warnings: [
        ...(venues.warning ? [venues.warning] : []),
        ...(!providers.gemini || !(providers.tavily || providers.serpapi || providers.firecrawl)
          ? ['Sem chaves para validar fora do banco: a curadoria só gera candidatos para a fila humana.']
          : []),
        ...(!providers.anthropic ? ['ANTHROPIC_API_KEY ausente: sem juiz independente.'] : []),
      ],
      counts: await this.coverage.countByStatus(),
      csvTemplate: REFERENCE_CSV_TEMPLATE,
    };
  }

  @ApiOperation({ summary: 'Recall e precisão: último snapshot por dimensão e série diária' })
  @Get('metrics')
  async metrics(@Query('days') days?: string) {
    return this.coverage.adminMetrics(Number(days) || 60);
  }

  @ApiOperation({ summary: 'Referências aprovadas que o radar ainda não encontrou' })
  @Get('missing')
  async missing(@Query('limit') limit?: string) {
    const items = await this.coverage.missingReferences(Number(limit) || 50);
    return { items: items.map((r) => ({ id: r.id, name: r.name, venueName: r.venueName, dateKey: r.dateKey, size: r.size, category: r.category })) };
  }

  @ApiOperation({ summary: 'Roda a curadoria por agentes agora (respeita os tetos de custo)' })
  @PerMinuteThrottle(2)
  @Post('curate')
  @HttpCode(200)
  async curate(@Req() req: any) {
    return runAdminJobWithTracking(this.jobRunRepo, 'event-reference-curation', req?.user?.userId ?? null, () =>
      this.curation.run(),
    );
  }

  @ApiOperation({ summary: 'Casa as referências com o banco e recalcula as métricas agora' })
  @PerMinuteThrottle(4)
  @Post('match')
  @HttpCode(200)
  async match(@Req() req: any) {
    return runAdminJobWithTracking(this.jobRunRepo, 'event-coverage-match-metrics', req?.user?.userId ?? null, () =>
      this.coverage.runMatchAndMetrics(),
    );
  }

  @ApiOperation({ summary: 'Importa referências por CSV (curadoria humana). Máx. 2000 linhas, 2MB.' })
  @ApiConsumes('multipart/form-data')
  @PerMinuteThrottle(10)
  @Post('import-csv')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async importCsv(
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Body() body: ImportReferenceCsvDto,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('arquivo CSV obrigatório (campo "file" no multipart)');
    return this.references.importCsv(file.buffer, req?.user?.userId ?? null, { status: body?.status });
  }

  @ApiOperation({ summary: 'Detalhe de uma referência com todos os votos e evidências' })
  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.references.get(id);
  }

  @AdminAuditedInHandler()
  @ApiOperation({ summary: 'Aprova uma referência (decisão humana)' })
  @PerMinuteThrottle(60)
  @Post(':id/approve')
  @HttpCode(200)
  async approve(@Param('id') id: string, @Body() body: ReferenceDecisionDto, @Req() req: any) {
    const actor = req?.user?.userId ?? null;
    const { before, after } = await this.references.approve(id, actor, body?.note);
    await this.audit.record({
      actorUserId: actor,
      action: 'event_reference.approve',
      entityType: 'event_reference',
      entityId: id,
      before: { status: before.status },
      after: { status: after.status, note: after.decisionNote },
    });
    return after;
  }

  @AdminAuditedInHandler()
  @ApiOperation({ summary: 'Rejeita uma referência (decisão humana)' })
  @PerMinuteThrottle(60)
  @Post(':id/reject')
  @HttpCode(200)
  async reject(@Param('id') id: string, @Body() body: ReferenceDecisionDto, @Req() req: any) {
    const actor = req?.user?.userId ?? null;
    const { before, after } = await this.references.reject(id, actor, body?.note);
    await this.audit.record({
      actorUserId: actor,
      action: 'event_reference.reject',
      entityType: 'event_reference',
      entityId: id,
      before: { status: before.status },
      after: { status: after.status, note: after.decisionNote },
    });
    return after;
  }
}
