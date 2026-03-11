import { Controller, Patch, Param, Get, Post, Query, Logger, NotFoundException, UseGuards, Req, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiOkResponse, ApiResponse, ApiQuery, ApiBody, ApiProperty } from '@nestjs/swagger';
import { MapsService } from './maps.service';
import { ProcessService } from 'src/process/process.service';
import { Res } from '@nestjs/common';
import { Response } from 'express';
import { Cron } from '@nestjs/schedule';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { IsString } from 'class-validator';


export class PropertyDto {
  @ApiProperty({ example: 'ddhddhdhh', description: 'ID da propriedade' })
  @IsString()
  id: string;
}

@ApiTags('maps')
@Controller('maps')
export class MapsController {
  private readonly logger = new Logger(MapsController.name); // Instanciando o logger corretamente

  constructor(private readonly mapsService: MapsService,
    private readonly processService: ProcessService,
  ) { }

  @Patch('events/:eventId/location')
  @ApiOperation({
    summary: 'Geocodifica e atualiza lat/lng de um evento usando seu enderecoCompleto',
  })
  @ApiParam({
    name: 'eventId',
    description: 'UUID do evento a ser atualizado',
    example: '0351e831-4549-11f0-84fc-42010a400016',
  })
  @ApiOkResponse({
    description: 'Resultado da geocodificação bem-sucedida',
    schema: { example: { ok: true, lat: -23.55052, lng: -46.633308 } },
  })
  @ApiResponse({ status: 400, description: 'Erro de requisição ou evento não encontrado.' })
  async updateEventLocation(
    @Param('eventId') eventId: string,
  ) {
    return this.mapsService.updateLatLngByEventId(eventId);
  }

  @Post('events/update-all-locations')
  @ApiOperation({ summary: 'Geocodifica e atualiza lat/lng de todos eventos sem coordenadas' })
  @ApiOkResponse({ description: 'Resultado da atualização em lote', schema: { example: { ok: true, updated: 5, failed: 2, total: 7 } } })
  async updateAllEventLocations() {
    return this.mapsService.updateAllEventsLatLng();
  }

  @Post('events/update-next-batch')
  @ApiOperation({ summary: 'Atualiza o próximo lote de eventos sem coordenada' })
  @ApiOkResponse({ description: 'Resumo da atualização', schema: { example: { ok: true, updated: 45, failed: 5, total: 50, results: [] } } })
  async updateNextBatch(
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
  ) {
    return await this.mapsService.updatePendingEventsLatLngBatch(Number(limit), Number(offset));
  }



  @Cron('0 3 * * 4') // Toda quinta às 3h da manhã
  async handleCron() {
    this.logger.log('Iniciando o processamento agendado de quinta às 3h...');
    await this.iniciarProcessamentoCron()
  }

  @Post('processar-lat-long-eventos')
  @ApiOperation({ summary: 'Processa as análises lat long eventos' })
  @ApiOkResponse({
    description: 'Resultado do processamento das análises lat long eventos',
    schema: { example: { message: 'Processamento concluído', totalAnalises: 100 } }
  })
  async processarLatLogEventos(@Res() res: Response) {
    const result = this.mapsService.updateAllEventsLatLng();
    res.send({ result: "Processamento iniciado.." })
  }

  @Post('processar-lat-long-adress')
  @ApiOperation({ summary: 'Processa as análises lat long address' })
  @ApiOkResponse({
    description: 'Resultado do processamento das análises lat long address',
    schema: { example: { message: 'Processamento concluído', totalAnalises: 100 } }
  })
  async processarLatLogAddress(@Res() res: Response) {
    const result = this.mapsService.updateAllAddressLatLng();
    res.send({ result: "Processamento iniciado.." })
  }

  @UseGuards(JwtAuthGuard)
  @Post('processar-analises-by-property-teste')
  async processarAnalisesByPropertyTeste(
    @Req() req: any,
    @Body() propertyList: PropertyDto[]
  ) {
    return { value: true }
    //return this.iniciarProcessamentoByProperty(req.user.userId, propertyList);
  }


  @UseGuards(JwtAuthGuard)
  @Post('processar-analises-by-property')
  @ApiOperation({ summary: 'Processa as análises para todos os usuários' })
  @ApiBody({
    description: 'Lista de propriedades com IDs a serem processados',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'ddhddhdhh' }
        }
      },
      example: [
        { id: 'ff126501-301a-4af6-b235-1e78a88095ae' },
        { id: 'ff126501-301a-4af6-b235-1e78a88095ae' }
      ]
    }
  })
  @ApiOkResponse({
    description: 'Resultado do processamento das análises',
    schema: { example: { message: 'Processamento concluído', totalAnalises: 2 } }
  })
  async processarAnalisesByProperty(
    @Res() res: Response,
    @Req() req: any,
    @Body() propertyList: PropertyDto[]
  ) {
    const userId = '7296eafd-9186-4270-a673-2a3f57e50a36'
    const propertyAdressId = 'ff126501-301a-4af6-b235-1e78a88095ae'; //listId 
    //req?.user?.userId
    this.iniciarProcessamentoByProperty(res, req?.user?.userId, propertyList);
    console.log('apos')
  }
  @Post('processar-analises')
  @ApiOperation({ summary: 'Processa as análises para todos os usuários' })
  @ApiOkResponse({
    description: 'Resultado do processamento das análises',
    schema: { example: { message: 'Processamento concluído', totalAnalises: 100 } }
  })
  async processarAnalisesTeste(@Res() res: Response) {
    const status = await this.processService.getCurrentStatus();

    if (!status) {
      return res.status(500).json({ message: 'Não foi possível obter o status atual.' });
    }

    this.logger.log(`Status atual: ${status.status}`);
return this.iniciarProcessamento(res);
    // switch (status.status) {
    //   case 'running':
    //     return res.status(409).json({ message: 'O processamento já está em execução.' });

    //   case 'completed':
    //     return this.iniciarProcessamento(res);

    //   case 'error':
    //     return this.iniciarProcessamento(res);

    //   default:
    //     return this.iniciarProcessamento(res);
    // }
  }
  private async iniciarProcessamento(res: Response) {
    try {
      this.logger.log('Iniciando o processamento das análises de todos os usuários.');
      const result = this.mapsService.processarAnalisesTodosUsuarios();

      return res.status(200).json({
        message: 'Processamento iniciado com sucesso.',
        ...result,
      });
    } catch (error) {
      this.logger.error('Erro ao processar as análises de todos os usuários.', error.stack);
      return res.status(500).json({
        message: 'Erro inesperado durante o processamento',
        totalAnalises: 0,
      });
    }
  }
  private async iniciarProcessamentoByProperty(res: Response, userId: string, propertyList: PropertyDto[]) {


    const idsArray = propertyList.map(item => item.id);

    let count = 0;
    for (const propertyId of idsArray) {
      console.log("🏁 Propriedade: ", count, propertyId)
      try {
        const propertyAdressId = propertyId; //listId 
        this.logger.log('Iniciando o processamento das análises de todos os usuários.');
        const result = this.mapsService.processarAnalisesByProperty(userId, propertyAdressId);
        count++


      } catch (error) {
        this.logger.error('Erro ao processar as análises de todos os usuários.', error.stack);
        return res.status(500).json({
          message: 'Erro inesperado durante o processamento',
          totalAnalises: 0,
        });
      }
      return res.status(200).json({
        message: 'Processamento iniciado com sucesso.',
      });
    }
  }


  private async iniciarProcessamentoCron(): Promise<{ message: string; totalAnalises?: number }> {
    try {
      this.logger.log('Iniciando o processamento das análises de todos os usuários.');
      const result = await this.mapsService.processarAnalisesTodosUsuarios();

      return {
        message: 'Processamento iniciado com sucesso.',
        ...result,
      };
    } catch (error) {
      this.logger.error('Erro ao processar as análises de todos os usuários.', error.stack);
      return {
        message: 'Erro inesperado durante o processamento',
        totalAnalises: 0,
      };
    }
  }


}
