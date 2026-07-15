import { Controller, Get, Optional, UseGuards } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { CronService } from './cron.service';
import { ScheduledJobRunnerService, runScheduledJobOncePerWindow } from '../admin-job-runs/scheduled-job-runner.service';

@ApiTags('cron')
@Controller('cron')
export class CronController {
  constructor(
    private readonly cronService: CronService,
    @Optional() private readonly scheduledJobRunner?: ScheduledJobRunnerService,
  ) { }

  private async notifyCronStatus(subject: string, content: string): Promise<void> {
    try {
      await this.cronService.enviarNotificacaoCron(subject, content);
    } catch (error) {
      console.error('Falha ao enviar notificação de status do cron:', error);
    }
  }

  @Get('analises-aceitas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Buscar análises aceitas' })
  @ApiResponse({ status: 200, description: 'Processo iniciado com sucesso.' })
  async buscarAnalisesAceitas() {
    return this.cronService.buscarAnalisesAceitas();
  }

  // Cron para rodar todos os dias as 08:00
  @Cron('0 0 8 * * *', {
    name: 'accepted-analysis-notifications',
    timeZone: 'America/Sao_Paulo',
    waitForCompletion: true,
  })
  async handleDailyNotification() {
    await runScheduledJobOncePerWindow(
      this.scheduledJobRunner,
      'accepted-analysis-notifications',
      this.startOfUtcDay(),
      async () => {
      console.log('Iniciando envio diário de notificações às 08:00');
      await this.notifyCronStatus('Cron iniciado', 'Cron iniciado');

      try {
        const result = await this.cronService.buscarAnalisesAceitas();
        await this.notifyCronStatus(
          'Cron concluido',
          `Cron concluido: ${result.processed} processadas, ${result.skipped} ignoradas, ${result.failed} com erro`,
        );
        console.log('Envio diário de notificações concluído');
        return { ok: true, ...result };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.notifyCronStatus('Cron com erro', `Cron com erro: ${message}`);
        console.error('Erro no envio diário de notificações:', error);
        return { ok: false, errorMessage: message };
      }
      },
      () => undefined,
    );
  }

  @Get('buscar-aceitas-teste')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Buscar análises aceitas',
    description: 'Busca todas as análises aceitas a partir da data de hoje e simula notificações.',
  })
  @ApiResponse({ status: 200, description: 'Processo iniciado com sucesso.' })
  async buscarAnalisesAceitasTest() {
    return this.cronService.buscarAnalisesAceitasTeste();
  }

  // ===== RE-SCRAPING MENSAL =====
  @Get('refresh-metadata')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Re-scraping mensal de metadados',
    description: 'Força re-scraping de todos os imóveis ativos. Espaçado ao longo de 8h para evitar rate limiting.',
  })
  @ApiResponse({ status: 200, description: 'Re-scraping concluido.' })
  async refreshMetadata() {
    return this.cronService.refreshPropertyMetadata();
  }

  // Cron: 1o dia de cada mes as 02:00 AM
  @Cron('0 0 2 1 * *', {
    name: 'monthly-property-metadata-refresh',
    timeZone: 'America/Sao_Paulo',
    waitForCompletion: true,
  })
  async handleMonthlyMetadataRefresh() {
    await runScheduledJobOncePerWindow(
      this.scheduledJobRunner,
      'monthly-property-metadata-refresh',
      this.startOfUtcMonth(),
      async () => {
      console.log('[cron] Iniciando re-scraping mensal automático...');
      try {
        const result = await this.cronService.refreshPropertyMetadata();
        console.log('[cron] Re-scraping mensal concluido');
        return { ok: true, result };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[cron] Erro no re-scraping mensal:', error);
        return { ok: false, errorMessage: message };
      }
      },
      () => undefined,
    );
  }

  private startOfUtcDay(now = new Date()): Date {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private startOfUtcMonth(now = new Date()): Date {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
}
