import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EventIntelligenceService } from '../event-intelligence/event-intelligence.service';
import { SimulatePricingInput } from '../event-intelligence/event-intelligence.types';

@ApiTags('host-events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('host/events')
export class HostEventsController {
  constructor(private readonly eventIntelligence: EventIntelligenceService) {}

  @ApiOperation({ summary: 'Catalogo host de eventos mapeados pela Urban AI' })
  @Get('catalog')
  async catalog(
    @Req() req: any,
    @Query('city') city?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('category') category?: string,
    @Query('venue') venue?: string,
    @Query('search') search?: string,
    @Query('source') source?: string,
    @Query('nearMyProperties') nearMyProperties?: string,
    @Query('propertyId') propertyId?: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('confidence') confidence?: string,
    @Query('highImpact') highImpact?: string,
    @Query('limit') limit?: string,
  ) {
    return this.eventIntelligence.hostCatalog(req.user.userId, {
      city,
      from,
      to,
      category,
      venue,
      search,
      source,
      nearMyProperties,
      propertyId,
      radiusKm,
      confidence,
      highImpact,
      limit,
    });
  }

  @ApiOperation({ summary: 'Radar host de eventos que impactam os imoveis do usuario' })
  @Get('radar')
  async radar(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('propertyId') propertyId?: string,
    @Query('category') category?: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('confidence') confidence?: string,
  ) {
    return this.eventIntelligence.hostRadar(req.user.userId, {
      from,
      to,
      propertyId,
      category,
      radiusKm,
      confidence,
    });
  }

  @ApiOperation({ summary: 'Heatmap host de demanda futura por eventos' })
  @Get('heatmap')
  async heatmap(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('propertyId') propertyId?: string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    return this.eventIntelligence.hostHeatmap(req.user.userId, { from, to, propertyId, radiusKm });
  }

  @ApiOperation({ summary: 'Detalhe host de um evento com inteligencia e impacto' })
  @Get(':eventId')
  async detail(@Req() req: any, @Param('eventId') eventId: string) {
    return this.eventIntelligence.hostEventDetail(req.user.userId, eventId);
  }

  @ApiOperation({ summary: 'Inteligencia de demanda de um evento para host' })
  @Get(':eventId/intelligence')
  async intelligence(@Req() req: any, @Param('eventId') eventId: string) {
    return this.eventIntelligence.hostEventIntelligence(req.user.userId, eventId);
  }

  @ApiOperation({ summary: 'Impacto de um evento nos imoveis do host' })
  @Get(':eventId/property-impact')
  async propertyImpact(
    @Req() req: any,
    @Param('eventId') eventId: string,
    @Query('propertyId') propertyId?: string,
  ) {
    return this.eventIntelligence.hostEventPropertyImpact(req.user.userId, eventId, propertyId);
  }

  @ApiOperation({ summary: 'Simulacao de pricing por evento (contrato P0)' })
  @Post(':eventId/simulate-pricing')
  async simulatePricing(
    @Req() req: any,
    @Param('eventId') eventId: string,
    @Body() body: SimulatePricingInput,
  ) {
    return this.eventIntelligence.simulatePricing(req.user.userId, eventId, body ?? {});
  }
}
