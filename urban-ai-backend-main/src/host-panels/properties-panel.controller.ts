import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HostPanelsService } from './host-panels.service';
import { PricingRulesBodyDto } from './host-panel.dto';

@ApiTags('host-properties')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('properties')
export class PropertiesPanelController {
  constructor(private readonly hostPanels: HostPanelsService) {}

  @ApiOperation({ summary: 'Pace de reservas de um imóvel' })
  @Get(':id/pace')
  async pace(
    @Req() req: any,
    @Param('id') propertyId: string,
    @Query('targetDateFrom') targetDateFrom?: string,
    @Query('targetDateTo') targetDateTo?: string,
  ) {
    return this.hostPanels.pace(req.user.userId, {
      propertyId,
      targetDateFrom,
      targetDateTo,
    });
  }

  @ApiOperation({ summary: 'Regras de pricing salvas para um imóvel' })
  @Get(':id/pricing-rules')
  async getPricingRules(@Req() req: any, @Param('id') propertyId: string) {
    return this.hostPanels.getPricingRules(req.user.userId, propertyId);
  }

  @ApiOperation({ summary: 'Salvar regras de pricing de um imóvel' })
  @Put(':id/pricing-rules')
  async savePricingRules(
    @Req() req: any,
    @Param('id') propertyId: string,
    @Body() body: PricingRulesBodyDto,
  ) {
    return this.hostPanels.savePricingRules(req.user.userId, propertyId, body.rules);
  }

  @ApiOperation({ summary: 'Preview de 14 dias das regras de pricing' })
  @Post(':id/pricing-rules/preview')
  async previewPricingRules(
    @Req() req: any,
    @Param('id') propertyId: string,
    @Body() body: PricingRulesBodyDto,
  ) {
    return this.hostPanels.previewPricingRules(req.user.userId, propertyId, body.rules);
  }

  @ApiOperation({ summary: 'Copiar regras de pricing de outro imóvel do usuário' })
  @Post(':id/pricing-rules/copy-from/:sourceId')
  async copyPricingRules(
    @Req() req: any,
    @Param('id') propertyId: string,
    @Param('sourceId') sourceId: string,
  ) {
    return this.hostPanels.copyPricingRules(req.user.userId, propertyId, sourceId);
  }

  @ApiOperation({ summary: 'Inteligência de mercado para um imóvel' })
  @Get(':id/market-intel')
  async marketIntel(
    @Req() req: any,
    @Param('id') propertyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.hostPanels.marketIntel(req.user.userId, propertyId, { from, to });
  }
}
