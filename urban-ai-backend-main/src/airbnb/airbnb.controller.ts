import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { AirbnbService } from './airbnb.service';

@ApiTags('Airbnb') // Tag no Swagger
@Controller('airbnb')
export class AirbnbController {
  constructor(private readonly airbnbService: AirbnbService) {}

  @Get('availability/:propertyId')
  @ApiOperation({ summary: 'Verificar disponibilidade de um imóvel' })
  @ApiParam({ name: 'propertyId', description: 'ID do imóvel no Airbnb' })
  @ApiResponse({ status: 200, description: 'Disponibilidade retornada com sucesso' })
  async getAvailability(@Param('propertyId') propertyId: string) {
    return this.airbnbService.getAvailability(propertyId);
  }

  @Get('price/:propertyId')
  @ApiOperation({ summary: 'Obter primeiro preço disponível para um imóvel' })
  @ApiParam({ name: 'propertyId', description: 'ID do imóvel no Airbnb' })
  @ApiResponse({ status: 200, description: 'Preço retornado com sucesso' })
  async getFirstAvailablePrice(@Param('propertyId') propertyId: string) {
    return this.airbnbService.getFirstAvailablePrice(propertyId);
  }
}
