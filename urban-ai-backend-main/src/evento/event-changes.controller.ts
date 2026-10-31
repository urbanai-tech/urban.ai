import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EventChangeType } from '../entities/event-change-history.entity';
import { EventChangeHistoryService } from './event-change-history.service';

const VALID_TYPES: EventChangeType[] = [
  'first_seen',
  'rescheduled',
  'venue_changed',
  'url_changed',
  'cancelled',
  'postponed',
  'possibly_cancelled',
  'reappeared',
];

/** `?types=rescheduled,cancelled` -> lista validada (tipos desconhecidos são descartados). */
export function parseChangeTypes(raw: string | undefined): EventChangeType[] | undefined {
  if (!raw) return undefined;
  const wanted = raw
    .split(',')
    .map((t) => t.trim())
    .filter((t): t is EventChangeType => (VALID_TYPES as string[]).includes(t));
  return wanted.length > 0 ? wanted : undefined;
}

const toInt = (raw: string | undefined): number | undefined => {
  const value = Number(raw);
  return raw !== undefined && Number.isFinite(value) ? Math.trunc(value) : undefined;
};

/**
 * Histórico e qualidade de eventos (somente leitura, admin), irmão do painel de cobertura:
 *   GET /admin/event-coverage/changes
 *   GET /admin/event-coverage/lead-time
 */
@ApiTags('admin-event-coverage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/event-coverage')
export class EventChangesController {
  constructor(private readonly history: EventChangeHistoryService) {}

  @ApiOperation({
    summary:
      'Mudanças de evento (remarcados, cancelados, possivelmente cancelados, venue/URL) com resumo e série diária',
  })
  @ApiQuery({ name: 'days', required: false, description: 'Janela em dias (1-180, padrão 30)' })
  @ApiQuery({ name: 'types', required: false, description: 'Tipos separados por vírgula' })
  @ApiQuery({ name: 'limit', required: false, description: 'Máximo de linhas recentes (1-200, padrão 100)' })
  @Get('changes')
  async changes(@Query('days') days?: string, @Query('types') types?: string, @Query('limit') limit?: string) {
    return this.history.changesReport({
      days: toInt(days),
      types: parseChangeTypes(types),
      limit: toInt(limit),
    });
  }

  @ApiOperation({
    summary: 'Lead time (first_seen até a data do evento): mediana e distribuição por fonte, categoria e porte',
  })
  @ApiQuery({ name: 'days', required: false, description: 'Janela em dias em torno de hoje (1-180, padrão 90)' })
  @Get('lead-time')
  async leadTime(@Query('days') days?: string) {
    return this.history.leadTimeReport(toInt(days) ?? 90);
  }
}
