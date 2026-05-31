import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  CommunicationChannel,
  CommunicationStatus,
} from '../entities/communication-event.entity';
import { CommunicationLogService } from './communication-log.service';

@ApiTags('admin-communications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'support')
@Controller('admin/communications')
export class CommunicationsController {
  constructor(private readonly communications: CommunicationLogService) {}

  @ApiOperation({ summary: 'Resumo dos envios de comunicação nas últimas 24h' })
  @Get('summary')
  summary() {
    return this.communications.summary();
  }

  @ApiOperation({ summary: 'Logs de comunicação por canal/status/tipo' })
  @Get()
  list(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '30',
    @Query('channel') channel?: CommunicationChannel | 'all',
    @Query('status') status?: CommunicationStatus | 'all',
    @Query('kind') kind?: string,
    @Query('search') search?: string,
  ) {
    return this.communications.list({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      channel,
      status,
      kind,
      search,
    });
  }
}
