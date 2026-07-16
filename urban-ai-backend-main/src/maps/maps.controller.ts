import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Optional,
  Param,
  ParseArrayPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Cron } from '@nestjs/schedule';
import { IsUUID } from 'class-validator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { ProcessService } from 'src/process/process.service';
import { MapsService } from './maps.service';
import { ScheduledJobRunnerService, runScheduledJob } from '../admin-job-runs/scheduled-job-runner.service';

export class PropertyDto {
  @ApiProperty({ example: 'ddhddhdhh', description: 'ID da propriedade' })
  @IsUUID()
  id: string;
}

export class PropertyListDto extends Array<PropertyDto> {}

@ApiTags('maps')
@Controller('maps')
export class MapsController {
  private readonly logger = new Logger(MapsController.name);

  constructor(
    private readonly mapsService: MapsService,
    private readonly processService: ProcessService,
    @Optional() private readonly scheduledJobRunner?: ScheduledJobRunnerService,
  ) {}

  @Patch('events/:eventId/location')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Geocodifica e atualiza lat/lng de um evento' })
  @ApiParam({
    name: 'eventId',
    description: 'UUID do evento a ser atualizado',
    example: '0351e831-4549-11f0-84fc-42010a400016',
  })
  @ApiOkResponse({
    description: 'Resultado da geocodificação',
    schema: { example: { ok: true, lat: -23.55052, lng: -46.633308 } },
  })
  @ApiResponse({ status: 400, description: 'Erro de requisição ou evento não encontrado.' })
  async updateEventLocation(@Param('eventId') eventId: string) {
    return this.mapsService.updateLatLngByEventId(eventId);
  }

  @Post('events/update-all-locations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Geocodifica e atualiza lat/lng de todos eventos sem coordenadas' })
  @ApiOkResponse({
    description: 'Resultado da atualização em lote',
    schema: { example: { ok: true, updated: 5, failed: 2, total: 7 } },
  })
  async updateAllEventLocations() {
    return this.mapsService.updateAllEventsLatLng();
  }

  @Post('events/update-next-batch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Atualiza o próximo lote de eventos sem coordenada' })
  @ApiOkResponse({
    description: 'Resumo da atualização',
    schema: { example: { ok: true, updated: 45, failed: 5, total: 50, results: [] } },
  })
  async updateNextBatch(
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    return this.mapsService.updatePendingEventsLatLngBatch(Number(limit), Number(offset));
  }

  @Cron('0 3 * * 4', {
    name: 'weekly-map-processing',
    timeZone: 'America/Sao_Paulo',
    waitForCompletion: true,
  })
  async handleCron() {
    return runScheduledJob(this.scheduledJobRunner, 'weekly-map-processing', async () => {
      this.logger.log('Iniciando processamento agendado de quinta as 3h.');
      return this.iniciarProcessamentoCron();
    });
  }

  @Post('processar-lat-long-eventos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Geocodifica eventos sem lat/lng' })
  async processarLatLogEventos() {
    return this.mapsService.updateAllEventsLatLng();
  }

  @Post('processar-lat-long-adress')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Geocodifica enderecos sem lat/lng' })
  async processarLatLogAddress() {
    return this.mapsService.updateAllAddressLatLng();
  }

  @UseGuards(JwtAuthGuard)
  @Post('processar-analises-by-property')
  @ApiOperation({ summary: 'Processa análises para propriedades do usuário autenticado' })
  @ApiBody({
    description: 'Lista de propriedades com IDs a serem processados',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'ff126501-301a-4af6-b235-1e78a88095ae' },
        },
      },
    },
  })
  async processarAnalisesByProperty(
    @Req() req: any,
    @Body(new ParseArrayPipe({
      items: PropertyDto,
      whitelist: true,
      forbidNonWhitelisted: true,
    })) propertyList: PropertyListDto,
  ) {
    return this.iniciarProcessamentoByProperty(req?.user?.userId, propertyList);
  }

  @Post('processar-analises')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Processa análises para todos os usuários' })
  async processarAnalisesTodosUsuarios() {
    const status = await this.processService.getCurrentStatus();
    if (!status) {
      throw new BadRequestException('Não foi possível obter o status atual.');
    }

    this.logger.log(`Status atual: ${status.status}`);
    return this.iniciarProcessamento();
  }

  private async iniciarProcessamento() {
    try {
      this.logger.log('Iniciando processamento de análises de todos os usuários.');
      const result = await this.mapsService.processarAnalisesTodosUsuarios();

      return {
        message: 'Processamento concluido.',
        ...result,
      };
    } catch (error) {
      this.logger.error(
        'Erro ao processar análises de todos os usuários.',
        error instanceof Error ? error.stack : String(error),
      );
      return {
        message: 'Erro inesperado durante o processamento',
        totalAnalises: 0,
      };
    }
  }

  private async iniciarProcessamentoByProperty(userId: string, propertyList: PropertyDto[]) {
    if (!userId) {
      throw new BadRequestException('Usuário autenticado não encontrado.');
    }
    if (!Array.isArray(propertyList) || propertyList.length === 0) {
      throw new BadRequestException('Nenhuma propriedade informada.');
    }
    if (propertyList.length > 100) {
      throw new BadRequestException('MÃ¡ximo de 100 propriedades por processamento.');
    }

    const results = [];
    let totalProcessados = 0;

    for (const property of propertyList) {
      if (!property?.id) {
        results.push({ propertyAdressId: null, error: 'ID de propriedade ausente' });
        continue;
      }

      try {
        this.logger.log(`Iniciando processamento user=${userId} property=${property.id}`);
        const result = await this.mapsService.processarAnalisesByProperty(userId, property.id);
        results.push({ propertyAdressId: property.id, result });
        totalProcessados++;
      } catch (error) {
        this.logger.error(
          `Erro ao processar propriedade ${property.id}`,
          error instanceof Error ? error.stack : String(error),
        );
        results.push({
          propertyAdressId: property.id,
          error: 'Erro inesperado durante o processamento',
        });
      }
    }

    return {
      message: 'Processamento concluido.',
      totalProcessados,
      results,
    };
  }

  private async iniciarProcessamentoCron(): Promise<{ message: string; totalAnalises?: number }> {
    try {
      this.logger.log('Iniciando processamento agendado de análises de todos os usuários.');
      const result = await this.mapsService.processarAnalisesTodosUsuarios();

      return {
        message: 'Processamento concluido.',
        ...result,
      };
    } catch (error) {
      this.logger.error(
        'Erro ao processar análises de todos os usuários.',
        error instanceof Error ? error.stack : String(error),
      );
      return {
        message: 'Erro inesperado durante o processamento',
        totalAnalises: 0,
      };
    }
  }
}
