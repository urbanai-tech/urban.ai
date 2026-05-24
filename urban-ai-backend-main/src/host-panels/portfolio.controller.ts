import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HostPanelsService } from './host-panels.service';

@ApiTags('portfolio')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly hostPanels: HostPanelsService) {}

  @ApiOperation({ summary: 'Calendario consolidado de precos e recomendacoes do portfolio' })
  @Get('calendar')
  async calendar(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('propertyIds') propertyIds?: string,
    @Query('strategy') strategy?: string,
  ) {
    return this.hostPanels.portfolioCalendar(req.user.userId, {
      from,
      to,
      propertyIds,
      strategy,
    });
  }

  @ApiOperation({ summary: 'Maiores oportunidades do portfolio por data e imovel' })
  @Get('opportunities')
  async opportunities(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('propertyIds') propertyIds?: string,
    @Query('strategy') strategy?: string,
  ) {
    return this.hostPanels.portfolioOpportunities(req.user.userId, {
      from,
      to,
      propertyIds,
      strategy,
    });
  }

  @ApiOperation({ summary: 'Historico auditavel de acoes em lote do portfolio' })
  @Get('action-runs')
  async actionRuns(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('includeItems') includeItems?: string,
    @Query('action') action?: string,
  ) {
    return this.hostPanels.portfolioActionRuns(req.user.userId, {
      limit: limit ? Number(limit) : undefined,
      includeItems: includeItems === 'true' || includeItems === '1',
      action,
    });
  }

  @ApiOperation({ summary: 'Simula uma acao em lote do portfolio antes de aplicar' })
  @Post('simulate-action')
  async simulateAction(
    @Req() req: any,
    @Body()
    body: {
      propertyIds: string[];
      action: string;
      payload?: Record<string, unknown>;
      dates?: string[];
      from?: string;
      to?: string;
    },
  ) {
    return this.hostPanels.simulatePortfolioAction(req.user.userId, body);
  }

  @ApiOperation({ summary: 'Acao em lote sobre propriedades do portfolio' })
  @Post('bulk-action')
  async bulkAction(
    @Req() req: any,
    @Body()
    body: {
      propertyIds: string[];
      action: string;
      payload?: Record<string, unknown>;
      dates?: string[];
      from?: string;
      to?: string;
    },
  ) {
    return this.hostPanels.portfolioBulkAction(req.user.userId, body);
  }
}
