import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CronService } from './cron.service';
import { AnalisePreco } from 'src/entities/AnalisePreco';
import { Cron } from '@nestjs/schedule';
import { MailerService } from 'src/mailer/mailer.service';


@ApiTags('cron') // Grupo no Swagger
@Controller('cron')
export class CronController {
  constructor(private readonly cronService: CronService, private readonly mailerService: MailerService) { }

  @Get('analises-aceitas')
  @ApiOperation({ summary: 'Buscar análises aceitas' })
  @ApiResponse({ status: 200, description: 'Lista de análises aceitas', type: [AnalisePreco] })
  async buscarAnalisesAceitas(): Promise<AnalisePreco[]> {
    return this.cronService.buscarAnalisesAceitas();
  }

  // Cron para rodar todos os dias às 08:00
  @Cron('0 0 8 * * *', { timeZone: 'America/Sao_Paulo' })
  async handleDailyNotification() {
    console.log('🕗 Iniciando envio diário de notificações às 08:00');
    this.cronService.enviarNotificacaoCron("Cron iniciado", "Cron iniciado")
    
    try {
      await this.cronService.buscarAnalisesAceitas();
      this.cronService.enviarNotificacaoCron("Cron concluído", "Cron concluído")
      console.log('✅ Envio diário de notificações concluído');
    } catch (error) {
      this.cronService.enviarNotificacaoCron("Cron com erro", "Cron com erro")
      console.error('❌ Erro no envio diário de notificações:', error);
    }
  }



  @Get('buscar-aceitas-teste')
  @ApiOperation({
    summary: 'Buscar análises aceitas',
    description: 'Busca todas as análises aceitas a partir da data de hoje e simula notificações.',
  })
  @ApiResponse({ status: 200, description: 'Processo iniciado com sucesso.' })
  async buscarAnalisesAceitasTest() {
    return await this.cronService.buscarAnalisesAceitasTeste();
  }

  // ===== RE-SCRAPING MENSAL =====
  @Get('refresh-metadata')
  @ApiOperation({
    summary: 'Re-scraping mensal de metadados',
    description: 'Força re-scraping de todos os imóveis ativos. Espaçado ao longo de 8h para evitar rate limiting.',
  })
  @ApiResponse({ status: 200, description: 'Re-scraping concluído.' })
  async refreshMetadata() {
    return await this.cronService.refreshPropertyMetadata();
  }

  // Cron: 1º dia de cada mês às 02:00 AM
  @Cron('0 0 2 1 * *', { timeZone: 'America/Sao_Paulo' })
  async handleMonthlyMetadataRefresh() {
    console.log('🔄 [cron] Iniciando re-scraping mensal automático...');
    try {
      await this.cronService.refreshPropertyMetadata();
      console.log('✅ [cron] Re-scraping mensal concluído');
    } catch (error) {
      console.error('❌ [cron] Erro no re-scraping mensal:', error);
    }
  }
}
