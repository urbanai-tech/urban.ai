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
  ) {
    this.validateGeometry(body);
    if (!body.name || body.name.trim().length < 2) {
      throw new BadRequestException('name obrigatório (mín 2 chars)');
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
    return saved;
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Atualiza região existente' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Partial<CoverageRegion>) {
    const row = await this.regionRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Região não encontrada');
    this.validateGeometry({ ...row, ...body });
    Object.assign(row, body);
    const saved = await this.regionRepo.save(row);
    this.coverage.invalidateCache();
    return saved;
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Remove região' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const row = await this.regionRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Região não encontrada');
    await this.regionRepo.remove(row);
    this.coverage.invalidateCache();
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
}
