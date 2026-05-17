import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminPropertiesService } from './admin-properties.service';

@ApiTags('admin-properties')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/properties')
export class AdminPropertiesController {
  constructor(private readonly properties: AdminPropertiesService) {}

  @ApiOperation({ summary: 'Listagem admin de imoveis com agregados de pricing' })
  @Get()
  async list(@Query('limit') limit: string = '200', @Query('search') search?: string) {
    return this.properties.list({
      limit: parseInt(limit, 10),
      search,
    });
  }

  @ApiOperation({ summary: 'Detalhe admin de um imovel para drill-down operacional' })
  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.properties.detail(id);
  }

  @ApiOperation({ summary: 'Reprocessar recomendacoes de pricing de um imovel' })
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post(':id/reprocess')
  async reprocess(@Param('id') id: string) {
    return this.properties.reprocess(id);
  }
}
