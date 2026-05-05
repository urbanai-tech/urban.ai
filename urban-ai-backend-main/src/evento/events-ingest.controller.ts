import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  EventsIngestService,
  IngestBatchResponse,
  IngestEventInput,
} from './events-ingest.service';
import { EventsGeocoderService } from './events-geocoder.service';
import { EventsCsvImportService } from './events-csv-import.service';

/**
 * Endpoint universal de ingestão de eventos (F6.2 Plus).
 *
 * Camadas que batem aqui:
 *  - Camada 1: clientes Python das APIs oficiais (api-football, Sympla, etc.)
 *  - Camada 2: pipeline Firecrawl
 *  - Camada 3: form admin de curadoria + import CSV
 *
 * Acesso restrito a role `admin` — coletores autenticam com um usuário
 * técnico admin (criado manualmente no DB) cujo JWT é setado em env var
 * dos serviços coletores.
 *
 * Throttle relaxado (60/min) porque batches diários costumam ser 1
 * request com 100-500 eventos.
 */
@ApiTags('events-ingest')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('events')
export class EventsIngestController {
  constructor(
    private readonly ingest: EventsIngestService,
    private readonly geocoder: EventsGeocoderService,
    private readonly csvImport: EventsCsvImportService,
  ) {}

  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({
    summary:
      'Ingere um lote de eventos (Camada 1/2/3). Idempotente por dedupHash; UPSERT conservador.',
  })
  @Post('ingest')
  @HttpCode(200)
  async ingest_(
    @Body() body: { events: IngestEventInput[] },
  ): Promise<IngestBatchResponse> {
    const events = body?.events ?? [];
    return this.ingest.ingestBatch(events);
  }

  @ApiOperation({
    summary: 'Status da fila de geocoding pendente (eventos sem lat/lng)',
  })
  @Get('geocoder/status')
  async geocoderStatus() {
    const pending = await this.geocoder.pendingCount();
    return { pendingGeocode: pending };
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary:
      'Dispara o geocoder agora (em vez de esperar o cron 30 min). Limit default 30.',
  })
  @Post('geocoder/run')
  @HttpCode(200)
  async geocoderRun(@Query('limit') limit: string = '30') {
    return this.geocoder.runOnce(parseInt(limit, 10));
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary:
      'Importa eventos via upload de arquivo CSV (Camada 3 — curadoria humana). Max 1000 linhas, 5MB.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        sourceLabel: { type: 'string', example: 'admin-csv-import' },
      },
    },
  })
  @Post('import-csv')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async importCsv(
    @UploadedFile() file: { buffer: Buffer; originalname?: string; size: number },
    @Body('sourceLabel') sourceLabel?: string,
  ) {
    if (!file) {
      throw new Error('arquivo CSV obrigatório (campo "file" no multipart)');
    }
    return this.csvImport.importFromBuffer(file.buffer, sourceLabel);
  }
}
