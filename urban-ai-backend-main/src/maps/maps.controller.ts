import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Param,
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
import { IsString } from 'class-validator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { ProcessService } from 'src/process/process.service';
import { MapsService } from './maps.service';

export class PropertyDto {
  @ApiProperty({ example: 'ddhddhdhh', description: 'ID da propriedade' })
  @IsString()
  id: string;
}

@ApiTags('maps')
@Controller('maps')
export class MapsController {
  private readonly logger = new Logger(MapsController.name);

  constructor(
    private readonly mapsService: MapsService,
    private readonly processService: ProcessService,
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
    description: 'Resultado da geocodificacao',
    schema: { example: { ok: true, lat: -23.55052, lng: -46.633308 } },
  })
  @ApiResponse({ status: 400, description: 'Erro de requisicao ou evento nao encontrado.' })
  async updateEventLocation(@Param('eventId') eventId: string) {
    return this.mapsService.updateLatLngByEventId(eventId);
  }

  @Post('events/update-all-locations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Geocodifica e atualiza lat/lng de todos eventos sem coordenadas' })
  @ApiOkResponse({
    description: 'Resultado da atualizacao em lote',
    schema: { example: { ok: true, updated: 5, failed: 2, total: 7 } },
  })
  async updateAllEventLocations() {
    return this.mapsService.updateAllEventsLatLng();
  }

  @Post('events/update-next-batch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Atualiza o proximo lote de eventos sem coordenada' })
  @ApiOkResponse({
    description: 'Resumo da atualizacao',
    schema: { example: { ok: true, updated: 45, failed: 5, total: 50, results: [] } },
  })
  async updateNextBatch(
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    return this.mapsService.updatePendingEventsLatLngBatch(Number(limit), Number(offset));
  }

  @Cron('0 3 * * 4')
  async handleCron() {
    this.logger.log('Iniciando processamento agendado de quinta as 3h.');
    await this.iniciarProcessamentoCron();
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
  @ApiOperation({ summary: 'Processa analises para propriedades do usuario autenticado' })
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
    @Body() propertyList: PropertyDto[],
  ) {
    return this.iniciarProcessamentoByProperty(req?.user?.userId, propertyList);
  }

  @Post('processar-analises')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Processa analises para todos os usuarios' })
  async processarAnalisesTodosUsuarios() {
    const status = await this.processService.getCurrentStatus();
    if (!status) {
      throw new BadRequestException('Nao foi possivel obter o status atual.');
    }

    this.logger.log(`Status atual: ${status.status}`);
    return this.iniciarProcessamento();
  }

  private async iniciarProcessamento() {
    try {
      this.logger.log('Iniciando processamento de analises de todos os usuarios.');
      const result = await this.mapsService.processarAnalisesTodosUsuarios();

      return {
        message: 'Processamento concluido.',
        ...result,
      };
    } catch (error) {
      this.logger.error(
        'Erro ao processar analises de todos os usuarios.',
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
      throw new BadRequestException('Usuario autenticado nao encontrado.');
    }
    if (!Array.isArray(propertyList) || propertyList.length === 0) {
      throw new BadRequestException('Nenhuma propriedade informada.');
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
      this.logger.log('Iniciando processamento agendado de analises de todos os usuarios.');
      const result = await this.mapsService.processarAnalisesTodosUsuarios();

      return {
        message: 'Processamento concluido.',
        ...result,
      };
    } catch (error) {
      this.logger.error(
        'Erro ao processar analises de todos os usuarios.',
        error instanceof Error ? error.stack : String(error),
      );
      return {
        message: 'Erro inesperado durante o processamento',
        totalAnalises: 0,
      };
    }
  }
}
