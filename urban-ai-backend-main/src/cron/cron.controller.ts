import { Controller, Get, UseGuards } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { CronService } from './cron.service';

@ApiTags('cron')
@Controller('cron')
export class CronController {
  constructor(private readonly cronService: CronService) { }

  private async notifyCronStatus(subject: string, content: string): Promise<void> {
    try {
      await this.cronService.enviarNotificacaoCron(subject, content);
    } catch (error) {
      console.error('Falha ao enviar notificacao de status do cron:', error);
    }
  }

  @Get('analises-aceitas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Buscar analises aceitas' })
  @ApiResponse({ status: 200, description: 'Processo iniciado com sucesso.' })
  async buscarAnalisesAceitas() {
    return this.cronService.buscarAnalisesAceitas();
  }

  // Cron para rodar todos os dias as 08:00
  @Cron('0 0 8 * * *', { timeZone: 'America/Sao_Paulo' })
  async handleDailyNotification() {
    console.log('Iniciando envio diario de notificacoes as 08:00');
    await this.notifyCronStatus('Cron iniciado', 'Cron iniciado');

    try {
      const result = await this.cronService.buscarAnalisesAceitas();
      await this.notifyCronStatus(
        'Cron concluido',
        `Cron concluido: ${result.processed} processadas, ${result.skipped} ignoradas, ${result.failed} com erro`,
      );
      console.log('Envio diario de notificacoes concluido');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.notifyCronStatus('Cron com erro', `Cron com erro: ${message}`);
      console.error('Erro no envio diario de notificacoes:', error);
    }
  }

  @Get('buscar-aceitas-teste')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Buscar analises aceitas',
    description: 'Busca todas as analises aceitas a partir da data de hoje e simula notificacoes.',
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
    description: 'Forca re-scraping de todos os imoveis ativos. Espacado ao longo de 8h para evitar rate limiting.',
  })
  @ApiResponse({ status: 200, description: 'Re-scraping concluido.' })
  async refreshMetadata() {
    return this.cronService.refreshPropertyMetadata();
  }

  // Cron: 1o dia de cada mes as 02:00 AM
  @Cron('0 0 2 1 * *', { timeZone: 'America/Sao_Paulo' })
  async handleMonthlyMetadataRefresh() {
    console.log('[cron] Iniciando re-scraping mensal automatico...');
    try {
      await this.cronService.refreshPropertyMetadata();
      console.log('[cron] Re-scraping mensal concluido');
    } catch (error) {
      console.error('[cron] Erro no re-scraping mensal:', error);
    }
  }
}
