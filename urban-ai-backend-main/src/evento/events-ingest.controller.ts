import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  EventsIngestService,
  IngestBatchResponse,
  IngestEventInput,
} from './events-ingest.service';

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
  constructor(private readonly ingest: EventsIngestService) {}

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
}
