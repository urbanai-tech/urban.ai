import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EventCoverageReportService } from './event-coverage-report.service';

/**
 * D6 — painel "Cobertura de eventos" (somente leitura, admin).
 *   GET /admin/event-coverage
 */
@ApiTags('admin-event-coverage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/event-coverage')
export class EventCoverageReportController {
  constructor(private readonly report: EventCoverageReportService) {}

  @ApiOperation({
    summary:
      'Cobertura de eventos futuros em SP (7/30/90 dias, por fonte, histograma, geocoding, categoria, duplicatas) vs. meta',
  })
  @Get()
  async coverage() {
    return this.report.report();
  }
}
