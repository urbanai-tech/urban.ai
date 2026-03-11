import { Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, NotFoundException, Param, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { PropriedadeService } from './propriedade.service';
import { Address } from 'src/entities/addresses.entity';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiOkResponse, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { APITypes } from './types/nearProperties';
import { PricingCalculateService } from './pricing-calculate.service';

@ApiTags('Propriedades')
@Controller('propriedades')
export class PropriedadeController {
  constructor(private readonly propriedadeService: PropriedadeService,
    private readonly pricingCalculateService: PricingCalculateService
  ) { }

  @Get('hostId')
  @ApiOperation({ summary: 'Obter o hostId de uma propriedade' })
  @ApiQuery({ name: 'propertyId', type: String, required: true, description: 'ID da propriedade' })
  @ApiResponse({ status: 200, description: 'Host ID retornado com sucesso' })
  @ApiResponse({ status: 400, description: 'Parâmetro propertyId é obrigatório' })
  async getPropertyHostId(@Query('propertyId') propertyId: string) {
    if (!propertyId) {
      throw new HttpException('Property ID is required', HttpStatus.BAD_REQUEST);
    }
    try {
      const result = await this.propriedadeService.getPropertyHostId(propertyId);
      return { result };
    } catch (error) {
      throw new HttpException(error.message || 'Error fetching hostId', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('checkout-prices')
  @ApiOperation({ summary: 'Get Airbnb accommodation and service fee in USD' })
  @ApiQuery({ name: 'propertyId', type: String, required: true })
  @ApiQuery({ name: 'checkinDate', type: String, required: true, example: '2025-09-17' })
  @ApiQuery({ name: 'checkoutDate', type: String, required: true, example: '2025-09-19' })
  async getCheckoutPrices(
    @Query('propertyId') propertyId: string,
    @Query('checkinDate') checkinDate: string,
    @Query('checkoutDate') checkoutDate: string,
  ) {
    return this.propriedadeService.getAccommodationAndFee(propertyId, checkinDate, checkoutDate);
  }

  @Get('getPropertyDetails/:id')
  @ApiOperation({ summary: 'Obtém detalhes de uma propriedade pelo ID' })
  @ApiParam({
    name: 'id',
    description: 'ID único da propriedade no formato UUID ou código da plataforma',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @ApiResponse({
    status: 200,
    description: 'Detalhes da propriedade retornados com sucesso'
  })
  @ApiResponse({
    status: 404,
    description: 'Propriedade não encontrada'
  })
  async getPropertyDetails(@Param('id') id: string) {
    return this.propriedadeService.getPropertyDetails(id);
  }

  @Get('airbnb/room-info')
  @ApiOperation({ summary: 'Busca dados de checkout prefetch para uma propriedade' })
  @ApiQuery({
    name: 'propertyId',
    required: true,
    description: 'ID da propriedade no Airbnb',
    example: '703733125308691348'
  })
  @ApiQuery({
    name: 'checkinDate',
    required: true,
    description: 'Data de check-in (YYYY-MM-DD)',
    example: '2025-10-15'
  })
  @ApiQuery({
    name: 'checkoutDate',
    required: true,
    description: 'Data de check-out (YYYY-MM-DD)',
    example: '2025-10-16'
  })
  @ApiResponse({ status: 200, description: 'Dados de checkout retornados com sucesso.' })
  @ApiResponse({ status: 400, description: 'Parâmetros inválidos.' })
  @ApiResponse({ status: 500, description: 'Erro interno ao buscar dados.' })
  async getPrefetch(
    @Query('propertyId') propertyId: string,
    @Query('checkinDate') checkinDate: string,
    @Query('checkoutDate') checkoutDate: string
  ) {
    try {
      return await this.propriedadeService.getRoomPrice({
        roomId: propertyId,      // Corresponde ao parâmetro esperado
        checkIn: checkinDate,    // Corresponde ao parâmetro esperado
        checkOut: checkoutDate   // Corresponde ao parâmetro esperado
      });
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Erro ao buscar checkout prefetch',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // Controller
  @Get('airbnb/room-basic-info')
  @ApiOperation({ summary: 'Busca informações básicas de uma propriedade Airbnb' })
  @ApiQuery({
    name: 'roomId',
    required: true,
    description: 'ID da propriedade no Airbnb',
    example: '31193321'
  })
  @ApiResponse({ status: 200, description: 'Informações da propriedade retornadas com sucesso.' })
  @ApiResponse({ status: 400, description: 'Parâmetro inválido.' })
  @ApiResponse({ status: 500, description: 'Erro interno ao buscar informações da propriedade.' })
  async getBasicInfo(@Query('roomId') roomId: string) {
    try {
      return await this.propriedadeService.getRoomBasicInfo(roomId);
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Erro ao buscar informações da propriedade',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('airbnb/create-alert')
  @ApiOperation({ summary: 'Retorna lalerta de propriedades próxima a uma localização' })
  @ApiResponse({ status: 200, description: 'Listagens retornadas com sucesso.' })
  @ApiResponse({ status: 500, description: 'Erro ao buscar listagens.' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        latitude: { type: 'number', example: -15.81835863498257 },
        longitude: { type: 'number', example: -47.77052238123692 },
        bedrooms: { type: 'number', example: 1 },
        bathrooms: { type: 'number', example: 1 },
        accommodates: { type: 'number', example: 4 },
      },
      required: ['latitude', 'longitude', 'bedrooms', 'bathrooms', 'accommodates'],
    },
  })
  async createAlertAiibnb(
    @Body() body: {
      latitude: number;
      longitude: number;
      bedrooms: number;
      bathrooms: number;
      accommodates: number;
    }
  ) {
    return this.propriedadeService.criarAlertaAirbnb(body);
  }

  @Get('eventos-analisados-com-price')
  @ApiQuery({ name: 'propriedadeId', required: true })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async getEventos(
    @Query('propriedadeId') propriedadeId: string,
    @Query('dataInicial') dataInicial: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.propriedadeService.getEventosByEndereco(
      propriedadeId,
      dataInicial,
      Number(page),
      Number(limit),
    );
  }

  @Get('quantidade-eventos/:usuarioId')
  @ApiOperation({ summary: 'Quantidade de eventos futuros do usuário' })
  @ApiParam({
    name: 'usuarioId',
    description: 'ID do usuário dono das propriedades',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Quantidade de eventos retornada com sucesso',
    schema: {
      example: { quantidadeEventos: 5 },
    },
  })
  async getQuantidadeEventos(@Param('usuarioId') usuarioId: string) {
    const total = await this.propriedadeService.getQuantidadeEventosByUsuario(usuarioId, "");
    return { quantidadeEventos: total };
  }


  @Get('eventos-acompanhando')
  @UseGuards(JwtAuthGuard)
  @ApiQuery({ name: 'propriedadeId', required: true })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async getEventosAcompanhando(
    @Req() req: any,
    @Query('propriedadeId') propriedadeId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const targetUserId = req.user.userId;
    if (!targetUserId) {
      throw new UnauthorizedException("Token jwt necessário!")
    }
    return this.propriedadeService.getEventosAcompanhando(
      propriedadeId,
      Number(page),
      Number(limit),
      targetUserId
    );
  }

  @Get('eventos-analisados-com-price-para-maps')
  @ApiQuery({ name: 'propriedadeId', required: true })
  @ApiQuery({ name: 'raio', required: false })
  @ApiQuery({ name: 'dataInicial', required: false })
  @ApiQuery({ name: 'dataFinal', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async getEventosForMaps(
    @Query('propriedadeId') propriedadeId: string,
    @Query('dataInicial') dataInicial: string,
    @Query('dataFinal') dataFinal: string,
    @Query('page') page: number = 1,
    @Query('raio') raio: number = 50,
    @Query('limit') limit: number = 10,
  ) {
    return this.propriedadeService.getEventosByEnderecoForMap(
      propriedadeId,
      Number(page),
      Number(limit),
      Number(raio),
      dataInicial,
      dataFinal
    );
  }

  @Get('get-alert')
  @ApiOperation({ summary: 'Retorna dados de previsão de renda de uma propriedade pelo ID' })
  @ApiResponse({ status: 500, description: 'Erro ao buscar dados da propriedade.' })
  @ApiQuery({ name: 'id', required: true, type: 'string', example: '8a2999b68e85e90928bddeb0' })
  async getAlertById(@Query('id') id: string): Promise<APITypes> {
    const alerts = await this.propriedadeService.buscarAlertPorId(id);

    alerts?.comps.forEach(element => {
      console.log(element.similarity_score)
    });

    if (alerts?.comps?.length) {
      const maxObj = alerts.comps.reduce((prev, curr) =>
        curr.similarity_score > prev.similarity_score ? curr : prev
      );
      console.log(maxObj);
    }

    return alerts;
  }

  @Get('ajuste-preco')
  @ApiOperation({ summary: 'Calcula preço sugerido para uma propriedade com base em parâmetros' })
  @ApiResponse({ status: 200, description: 'Preço sugerido calculado com sucesso.' })
  @ApiResponse({ status: 500, description: 'Erro ao calcular o preço sugerido.' })
  @ApiQuery({ name: 'precoReferencia', required: true, type: Number, example: 35 })
  @ApiQuery({ name: 'seuPrecoAtual', required: true, type: Number, example: 30 })
  @ApiQuery({ name: 'capacidadeReferencia', required: true, type: Number, example: 3 })
  @ApiQuery({ name: 'suaCapacidade', required: true, type: Number, example: 4 })
  @ApiQuery({ name: 'banheiroReferencia', required: true, type: Number, example: 0 })
  @ApiQuery({ name: 'seuBanheiro', required: true, type: Number, example: 1 })
  @ApiQuery({ name: 'ocupacaoReferencia', required: true, type: Number, example: 55 })
  @ApiQuery({ name: 'suaOcupacao', required: false, type: Number, example: 60 })
  @ApiQuery({ name: 'fatorLocalizacao', required: false, type: Number, example: 1.05 })
  async calcularAjuste(
    @Query('precoReferencia') precoReferencia: number,
    @Query('seuPrecoAtual') seuPrecoAtual: number,
    @Query('capacidadeReferencia') capacidadeReferencia: number,
    @Query('suaCapacidade') suaCapacidade: number,
    @Query('banheiroReferencia') banheiroReferencia: number,
    @Query('seuBanheiro') seuBanheiro: number,
    @Query('ocupacaoReferencia') ocupacaoReferencia: number,
    @Query('suaOcupacao') suaOcupacao?: number,
    @Query('fatorLocalizacao') fatorLocalizacao?: number,
  ) {
    //const alerts = await this.propriedadeService.buscarAlertPorId("8a2999b68e85e90928bddeb0");
    //DESCOMENTAR AQUI
    //const getPricing = await this.propriedadeService.getPricingPropriedadeByEventAndByProperty();
    await this.propriedadeService.buscarAddress("b54f06c8-44b2-436c-815b-9f7c19ba40dc")
    // if (alerts?.comps?.length) {
    //   const maxObj = alerts.comps.reduce((prev, curr) =>
    //     curr.similarity_score > prev.similarity_score ? curr : prev
    //   );

    // }
    // return this.pricingCalculateService.calcular({
    //   precoReferencia: Number(precoReferencia),
    //   seuPrecoAtual: Number(seuPrecoAtual),
    //   capacidadeReferencia: Number(capacidadeReferencia),
    //   suaCapacidade: Number(suaCapacidade),
    //   banheiroReferencia: Number(banheiroReferencia),
    //   seuBanheiro: Number(seuBanheiro),
    //   ocupacaoReferencia: Number(ocupacaoReferencia),
    //   suaOcupacao: suaOcupacao !== undefined ? Number(suaOcupacao) : undefined,
    //   fatorLocalizacao: fatorLocalizacao !== undefined ? Number(fatorLocalizacao) : undefined,
    // });
    return { status: true }
  }

  @Get(':propertyId/coordinates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtém a latitude e longitude de uma propriedade do Airbnb.'
  })
  @ApiResponse({
    status: 200,
    description: 'Coordenadas encontradas com sucesso.',
    schema: {
      type: 'object',
      properties: {
        latitude: {
          type: 'number',
          example: -23.5618831
        },
        longitude: {
          type: 'number',
          example: -46.6351441
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Propriedade não encontrada ou sem coordenadas.'
  })
  @ApiResponse({
    status: 500,
    description: 'Erro interno do servidor.'
  })
  async getPropertyCoordinates(@Param('propertyId') propertyId: string) {
    const coordinates = await this.propriedadeService.getPropertyCoordinates(propertyId);

    if (!coordinates) {
      throw new NotFoundException('Propriedade não encontrada ou coordenadas não disponíveis.');
    }

    return coordinates;
  }

  @Delete('address/:id')
  @ApiOperation({ summary: 'Remove um endereço e o imóvel associado (list)' })
  @UseGuards(JwtAuthGuard)
  async deleteAddressAndList(@Param('id') id: string) {
    await this.propriedadeService.deleteAddressAndList(id);
    return { message: 'Endereço e list removidos com sucesso (quando aplicável)' };
  }


  // NOVO ENDPOINT PARA DROPDOWN
  @Get('dropdown/list')
  @ApiOperation({ summary: 'Lista de propriedades para dropdown (id e nome)' })
  @UseGuards(JwtAuthGuard)
  async getPropertiesForDropdown(
    @Req() req: any,
  ) {
    // Use userId específico se fornecido, senão use o usuário autenticado
    const targetUserId = req.user.userId;
    return this.propriedadeService.findPropertiesForDropdown(targetUserId);
  }
  @Get('user/')
  @ApiOperation({ summary: 'Buscar endereços por ID de usuário (com paginação)' })
  @ApiQuery({ name: 'page', required: false, description: 'Número da página', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Limite por página', type: Number })
  @UseGuards(JwtAuthGuard)
  async getAddressesByUser(
    @Req() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 10
  ): Promise<any> {
    return this.propriedadeService.findByUserId(req?.user?.userId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar endereço por ID' })
  @ApiParam({
    name: 'id',
    description: 'ID do endereço',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Endereço encontrado com sucesso',
    type: Address,
  })
  @ApiResponse({ status: 404, description: 'Endereço não encontrado' })
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string): Promise<Address> {
    const address = await this.propriedadeService.findAddressById(id);
    if (!address) {
      throw new NotFoundException('Endereço não encontrado');
    }
    return address;
  }
}