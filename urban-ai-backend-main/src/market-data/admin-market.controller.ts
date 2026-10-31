import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PerMinuteThrottle } from '../common/throttle-config';
import { LicensedDatasetImportService } from './licensed-dataset-import.service';
import { parseLicensedMappingJson } from './licensed-dataset.mapping';
import { MarketHealthService } from './market-health.service';
import { MarketLicense, UPLOADABLE_LICENSES } from './market-data.types';

export const MARKET_UPLOAD_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export class ImportLicensedDatasetDto {
  /** Fornecedor/rótulo do dataset (ex.: airroi). */
  @IsString() @Matches(/^[a-z0-9][a-z0-9_-]{1,23}$/)
  datasetLabel!: string;

  /** Slug do mercado (ex.: sao-paulo). */
  @IsString() @Matches(/^[a-z0-9][a-z0-9-]{1,47}$/)
  city!: string;

  /** Licença contratada: define se o dado pode ser exibido ao cliente. Sem padrão. */
  @IsIn(UPLOADABLE_LICENSES as unknown as string[])
  license!: MarketLicense;

  /** Data de coleta do arquivo (YYYY-MM-DD). */
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  collectedAt!: string;

  /** JSON { campo: "coluna" } (opcional). */
  @IsOptional() @IsString() @MaxLength(4000)
  mapping?: string;
}

/**
 * Saúde das fontes de mercado e upload do dataset licenciado (ADR 0028). Só admin.
 * O POST é registrado pela trilha de auditoria global das mutações administrativas.
 */
@ApiTags('admin-market')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/market')
export class AdminMarketController {
  constructor(
    private readonly health: MarketHealthService,
    private readonly licensedImport: LicensedDatasetImportService,
  ) {}

  @ApiOperation({
    summary: 'Saúde das fontes de mercado: volume por fonte e bairro, última atualização, cobertura de comp set',
  })
  @Get('health')
  async getHealth() {
    return this.health.health();
  }

  @PerMinuteThrottle(5)
  @ApiOperation({
    summary: 'Importa um dataset licenciado (CSV) para o mercado por bairro, com licença e data de coleta. Máx. 25 MB.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        datasetLabel: { type: 'string', example: 'airroi' },
        city: { type: 'string', example: 'sao-paulo' },
        license: { type: 'string', enum: [...UPLOADABLE_LICENSES] },
        collectedAt: { type: 'string', example: '2026-10-01' },
        mapping: { type: 'string', description: 'JSON { campo: "coluna" }' },
      },
    },
  })
  @Post('licensed-dataset/import')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MARKET_UPLOAD_MAX_BYTES } }))
  async importLicensedDataset(
    @UploadedFile() file: { buffer: Buffer; originalname?: string; size: number } | undefined,
    @Body() body: ImportLicensedDatasetDto,
    @Req() req: any,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('arquivo CSV obrigatório (campo "file" no multipart)');
    let mapping;
    try {
      mapping = parseLicensedMappingJson(body.mapping);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    return this.licensedImport.importCsv(file.buffer.toString('utf-8'), {
      datasetLabel: body.datasetLabel,
      city: body.city,
      license: body.license,
      collectedAt: body.collectedAt,
      mapping,
      fileName: file.originalname ? file.originalname.split(/[\\/]/).pop() : null,
      importedByUserId: req?.user?.userId ?? null,
    });
  }
}
