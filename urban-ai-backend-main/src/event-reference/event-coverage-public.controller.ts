import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PerMinuteThrottle } from '../common/throttle-config';
import { SubscriptionFree } from '../subscription/subscription-policy';
import { EventCoveragePublicService } from './event-coverage-public.service';

/**
 * Cobertura de eventos, versão pública (ADR 0026): só agregados, sem dado pessoal e sem nomes
 * de eventos. Aberto (sem login), com limite por IP e cache em memória + Cache-Control.
 */
@ApiTags('public-event-coverage')
@SubscriptionFree()
@Controller('public/event-coverage')
export class EventCoveragePublicController {
  constructor(private readonly service: EventCoveragePublicService) {}

  @ApiOperation({ summary: 'Recall dos grandes eventos de SP (último mês), eventos acompanhados e venues cobertos' })
  @PerMinuteThrottle(30)
  @Header('Cache-Control', 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400')
  @Get()
  async summary() {
    return this.service.summary();
  }
}
