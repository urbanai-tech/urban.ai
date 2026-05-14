import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CoverageRegion } from '../entities/coverage-region.entity';
import { CoverageService } from './coverage.service';
import { EventsEnrichmentService } from './events-enrichment.service';
import { AdminAuditService } from '../admin-audit/admin-audit.service';

/**
 * Controller admin pra gerenciar regiões de cobertura geográfica.
 *
 * Endpoints:
 *   GET    /admin/coverage              — lista todas as regiões
 *   GET    /admin/coverage/stats        — stats agregadas (#active, #imóveis)
 *   POST   /admin/coverage              — cria região
 *   PATCH  /admin/coverage/:id          — atualiza
 *   DELETE /admin/coverage/:id          — remove
 *   POST   /admin/coverage/check        — debug: testa um par lat/lng
 *   POST   /admin/coverage/reset-stale  — reset de eventos com relevancia=0 (bug antigo)
 */
@ApiTags('admin-coverage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/coverage')
export class CoverageController {
  constructor(
    @InjectRepository(CoverageRegion)
    private readonly regionRepo: Repository<CoverageRegion>,
    private readonly coverage: CoverageService,
    private readonly enrichment: EventsEnrichmentService,
    private readonly audit: AdminAuditService,
  ) {}

  @ApiOperation({ summary: 'Lista todas as regiões de cobertura' })
  @Get()
  async list() {
    return this.regionRepo.find({ order: { status: 'ASC', name: 'ASC' } });
  }

  @ApiOperation({ summary: 'Stats agregadas — quantas regiões ativas + imóveis cadastrados' })
  @Get('stats')
  async stats() {
    return this.coverage.stats();
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Cria nova região de cobertura' })
  @Post()
  async create(
    @Body()
    body: {
      name: string;
      status?: 'active' | 'bootstrap' | 'inactive';
      centerLat?: number | null;
      centerLng?: number | null;
      radiusKm?: number | null;
      minLat?: number | null;
      maxLat?: number | null;
      minLng?: number | null;
      maxLng?: number | null;
      notes?: string | null;
    },
    @Req() req: any,
  ) {
    this.validateGeometry(body);
    if (!body.name || body.name.trim().length < 2) {
      throw new BadRequestException('name obrigatório (mín 2 chars)');
    }
    if (body.status && !['active', 'bootstrap', 'inactive'].includes(body.status)) {
      throw new BadRequestException('status inválido');
    }
    const row = this.regionRepo.create({
      name: body.name.trim().slice(0, 128),
      status: body.status ?? 'active',
      centerLat: body.centerLat ?? null,
      centerLng: body.centerLng ?? null,
      radiusKm: body.radiusKm ?? null,
      minLat: body.minLat ?? null,
      maxLat: body.maxLat ?? null,
      minLng: body.minLng ?? null,
      maxLng: body.maxLng ?? null,
      notes: body.notes ?? null,
    });
    const saved = await this.regionRepo.save(row);
    this.coverage.invalidateCache();
    await this.audit.record({
      actorUserId: req?.user?.userId ?? null,
      action: 'coverage.create',
      entityType: 'coverage_region',
      entityId: saved.id,
      after: this.auditCoverage(saved),
    });
    return saved;
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Atualiza região existente' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Partial<CoverageRegion>, @Req() req: any) {
    const row = await this.regionRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Região não encontrada');
    const before = this.auditCoverage(row);
    const patch = this.pickCoveragePatch(body);
    this.validateGeometry({ ...row, ...patch });
    Object.assign(row, patch);
    const saved = await this.regionRepo.save(row);
    this.coverage.invalidateCache();
    await this.audit.record({
      actorUserId: req?.user?.userId ?? null,
      action: 'coverage.update',
      entityType: 'coverage_region',
      entityId: saved.id,
      before,
      after: this.auditCoverage(saved),
    });
    return saved;
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Remove região' })
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const row = await this.regionRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Região não encontrada');
    const before = this.auditCoverage(row);
    await this.regionRepo.remove(row);
    this.coverage.invalidateCache();
    await this.audit.record({
      actorUserId: req?.user?.userId ?? null,
      action: 'coverage.delete',
      entityType: 'coverage_region',
      entityId: id,
      before,
    });
    return { ok: true };
  }

  @ApiOperation({ summary: 'Testa se um par (lat,lng) está dentro da cobertura ativa' })
  @Post('check')
  @HttpCode(200)
  async check(@Body() body: { latitude: number; longitude: number }) {
    if (!Number.isFinite(body?.latitude) || !Number.isFinite(body?.longitude)) {
      throw new BadRequestException('latitude/longitude obrigatórios');
    }
    const inCoverage = await this.coverage.isWithinCoverage(
      Number(body.latitude),
      Number(body.longitude),
    );
    return { latitude: body.latitude, longitude: body.longitude, inCoverage };
  }

  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({
    summary:
      'Reseta eventos com relevancia=0 (bug antigo do enrichment) para re-tentativa via cron',
  })
  @Post('reset-stale-enrichment')
  @HttpCode(200)
  async resetStaleEnrichment() {
    return this.enrichment.resetStaleZeroRelevance();
  }

  // ============== Helpers ==============

  private validateGeometry(input: Partial<CoverageRegion>): void {
    const hasCircle =
      input.centerLat !== null && input.centerLat !== undefined &&
      input.centerLng !== null && input.centerLng !== undefined &&
      input.radiusKm !== null && input.radiusKm !== undefined;

    const hasBbox =
      input.minLat !== null && input.minLat !== undefined &&
      input.maxLat !== null && input.maxLat !== undefined &&
      input.minLng !== null && input.minLng !== undefined &&
      input.maxLng !== null && input.maxLng !== undefined;

    if (!hasCircle && !hasBbox) {
      throw new BadRequestException(
        'precisa setar OU (centerLat + centerLng + radiusKm) OU bounding box completo (minLat,maxLat,minLng,maxLng)',
      );
    }

    if (hasCircle) {
      const r = Number(input.radiusKm);
      if (!Number.isFinite(r) || r <= 0 || r > 1000) {
        throw new BadRequestException('radiusKm deve ser número 1..1000');
      }
    }

    if (hasBbox) {
      const minLat = Number(input.minLat);
      const maxLat = Number(input.maxLat);
      const minLng = Number(input.minLng);
      const maxLng = Number(input.maxLng);
      if (minLat >= maxLat) throw new BadRequestException('minLat deve ser < maxLat');
      if (minLng >= maxLng) throw new BadRequestException('minLng deve ser < maxLng');
    }
  }

  private pickCoveragePatch(input: Partial<CoverageRegion>): Partial<CoverageRegion> {
    const patch: Partial<CoverageRegion> = {};
    if (input.name !== undefined) {
      const name = String(input.name).trim();
      if (name.length < 2 || name.length > 128) {
        throw new BadRequestException('name obrigatório (mín 2 chars)');
      }
      patch.name = name;
    }
    if (input.status !== undefined) {
      if (!['active', 'bootstrap', 'inactive'].includes(input.status)) {
        throw new BadRequestException('status inválido');
      }
      patch.status = input.status;
    }
    for (const key of ['centerLat', 'centerLng', 'radiusKm', 'minLat', 'maxLat', 'minLng', 'maxLng'] as const) {
      if (input[key] !== undefined) {
        patch[key] = input[key] === null ? null : (Number(input[key]) as any);
      }
    }
    if (input.notes !== undefined) {
      patch.notes = input.notes ? String(input.notes).slice(0, 5000) : null;
    }
    return patch;
  }

  private auditCoverage(row: CoverageRegion) {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      centerLat: row.centerLat,
      centerLng: row.centerLng,
      radiusKm: row.radiusKm,
      minLat: row.minLat,
      maxLat: row.maxLat,
      minLng: row.minLng,
      maxLng: row.maxLng,
      notes: row.notes,
    };
  }
}
