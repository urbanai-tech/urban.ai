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

  @ApiOperation({ summary: 'Acao em lote sobre propriedades do portfolio' })
  @Post('bulk-action')
  async bulkAction(
    @Req() req: any,
    @Body()
    body: {
      propertyIds: string[];
      action: string;
      payload?: Record<string, unknown>;
    },
  ) {
    return this.hostPanels.portfolioBulkAction(req.user.userId, body);
  }
}
