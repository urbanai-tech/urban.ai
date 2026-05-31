import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HostPanelsService } from './host-panels.service';

@ApiTags('pace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pace')
export class PaceController {
  constructor(private readonly hostPanels: HostPanelsService) {}

  @ApiOperation({ summary: 'Pace agregado do portfólio do usuário' })
  @Get('portfolio')
  async portfolio(
    @Req() req: any,
    @Query('targetDateFrom') targetDateFrom?: string,
    @Query('targetDateTo') targetDateTo?: string,
  ) {
    return this.hostPanels.pace(req.user.userId, { targetDateFrom, targetDateTo });
  }
}
