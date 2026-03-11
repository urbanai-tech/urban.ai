// src/connect/connect.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
  ValidationPipe,
  UsePipes,
  HttpStatus,
  Query,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery } from "@nestjs/swagger";
import { ConnectService } from "../connect/connect.service";
import { List } from "../entities/list.entity";
import { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Address } from "../entities/addresses.entity";

// Interface para tipar Request com user
export interface AuthenticatedRequest extends Request {
  user?: { userId: string; id: string };
}

@ApiTags("Connect")
@Controller("connect")
export class ConnectController {
  constructor(private readonly connectService: ConnectService) { }




  @Get("user-managed-listings/:userId")
  @ApiOperation({
    summary: "Recupera lista de imóveis gerenciados por um usuário",
  })
  @ApiParam({
    name: "userId",
    description: "Identificador do usuário no sistema",
    example: "1234-abcd",
  })
  @ApiResponse({
    status: 200,
    description:
      "Array de objetos List com os imóveis gerenciados pelo usuário",
    type: List,
    isArray: true,
  })
  async userListings(@Param("userId") userId: string): Promise<List[]> {
    return this.connectService.getUserManagedListings(userId);
  }

  @Get("listing-price/:id")
  @ApiOperation({
    summary:
      "Retorna o valor total em reais para um imóvel do Airbnb de hoje até 3 dias após hoje.",
  })
  @ApiParam({
    name: "id",
    description: "ID do imóvel (listing)",
    example: "683140321450954340",
  })
  @ApiResponse({
    status: 200,
    description:
      "Valor total em reais, datas de check-in e check-out e detalhamento bruto da resposta da API.",
    schema: {
      example: {
        total: 1130,
        currency: "BRL",
        breakdown: {
          /* ... */
        },
        checkin: "2025-05-21",
        checkout: "2025-05-24",
      },
    },
  })
  async getListingPrice(@Param("id") id: string): Promise<any> {
    return this.connectService.getListingTotalPriceBRLForNext3Days(id);
  }

  @Get("cep/:cep")
  @ApiOperation({
    summary: "Consulta informações de endereço a partir do CEP (BrasilAPI)",
  })
  @ApiParam({
    name: "cep",
    description: "CEP brasileiro no formato 21775280 ou 21775-280",
    example: "21775280",
  })
  @ApiResponse({
    status: 200,
    description: "Informações de endereço retornadas pela BrasilAPI",
    schema: {
      example: {
        cep: "21775-280",
        state: "RJ",
        city: "Rio de Janeiro",
        neighborhood: "Realengo",
        street: "Rua Professor Venceslau",
        location: {
          type: "Point",
          coordinates: [-43.4439164, -22.8771237],
        },
        service: "correios",
      },
    },
  })
  async getAddressByCep(@Param("cep") cep: string): Promise<any> {
    return this.connectService.getAddressByCep(cep);
  }

  @UseGuards(JwtAuthGuard)
  @Post("register")
  @ApiOperation({ summary: "Registrar imóveis selecionados na tabela List" })
  @ApiResponse({
    status: 201,
    description: "Imóveis registrados com sucesso.",
    type: [List],
  })
  @UsePipes(
    new ValidationPipe({
      whitelist: false,
      transform: true,
    }),
  )
  async registerProperties(
    @Body() properties: List[],
    @Req() req: AuthenticatedRequest,
  ): Promise<List[]> {
    const userId = req.user.userId;
    return this.connectService.saveProperties(properties, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get("user-addresses")
  @ApiOperation({ summary: "Recupera os imóveis associados ao usuário" })
  @ApiResponse({
    status: 200,
    description: "Lista de imóveis associados ao usuário",
    type: List,
    isArray: true,
  })
  async getUserAddresses(@Req() req: AuthenticatedRequest): Promise<List[]> {
    const userId = req.user.userId;
    console.log('Headers:', req.headers);
    console.log('Authorization:', req.headers.authorization);
    console.log('User from request:', req.user);

    if (!userId) {
      throw new UnauthorizedException(
        "Usuário não autenticado ou ID não fornecido",
      );
    }

    return this.connectService.getUserListingsByUserId(userId as string);
  }

  @Get('created')
  @UseGuards(JwtAuthGuard)
  async createSingleAddress(@Req() req: any,
    @Body() address: Address[],

  ): Promise<any> {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Usuário não autenticado");
    }
    return await this.connectService.createMultipleAddresses(address, userId)
  }

  // Endpoint para criar/atualizar múltiplos endereços - DEVE VIR DEPOIS
  @UseGuards(JwtAuthGuard)
  @Post(["addresses", "create-addresses"])
  @ApiOperation({
    summary: "Criar/atualizar múltiplos endereços para o usuário autenticado",
    description: "Disponível nas rotas POST /connect/addresses e POST /connect/create-addresses"
  })
  @ApiBody({
    description:
      "Array de objetos Address. Cada Address deve conter pelo menos: cep, numero, list.id",
    type: Address,
    isArray: true,
  })
  @ApiResponse({
    status: 201,
    description: "Retorna a lista de endereços criados/atualizados",
    type: Address,
    isArray: true,
  })
  //
  async createMultipleAddresses(
    @Body() addresses: any[],
    @Req() req: AuthenticatedRequest
  ): Promise<Address[]> {
    console.clear()
    console.log(req?.user)
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException("Usuário não autenticado");
    }

    return this.connectService.createMultipleAddresses(addresses, userId) as Promise<Address[]>;
  }
    @Get('resolve')
  @ApiOperation({ summary: 'Resolve Airbnb short link to final URL' })
  @ApiQuery({
    name: 'url',
    type: String,
    description: 'Airbnb short URL (ex: https://www.airbnb.com/l/Wm23LHmL)',
    example: 'https://www.airbnb.com/l/Wm23LHmL',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Final Airbnb URL resolved successfully',
    schema: {
      example: {
        finalUrl:
          'https://www.airbnb.com.br/rooms/1500322322785854842?viralityEntryPoint=1...',
      },
    },
  })
  async resolve(@Query('url') url: string) {
    const finalUrl = await this.connectService.resolveUrl(url);
    return { finalUrl };
  }
}