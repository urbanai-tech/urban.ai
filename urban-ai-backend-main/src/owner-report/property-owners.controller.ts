import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PerMinuteThrottle } from '../common/throttle-config';
import { RequiresSubscription } from '../subscription/subscription-policy';
import { OwnerReportDeliveryService } from './owner-report-delivery.service';
import { OwnerReportsService } from './owner-reports.service';
import { CreateOwnerReportLinkDto, CreatePropertyOwnerDto, UpdatePropertyOwnerDto } from './property-owner.dto';
import { PropertyOwnersService } from './property-owners.service';

/**
 * Proprietários e relatórios mensais do anfitrião (ADR 0027). Tudo escopado a `req.user.userId`:
 * proprietário, imóvel ou link de outro anfitrião responde 404.
 */
@ApiTags('property-owners')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@RequiresSubscription()
@Controller('property-owners')
export class PropertyOwnersController {
  constructor(
    private readonly owners: PropertyOwnersService,
    private readonly reports: OwnerReportsService,
    private readonly delivery: OwnerReportDeliveryService,
  ) {}

  @ApiOperation({ summary: 'Texto e versão da declaração de base legal exigida no cadastro' })
  @Get('consent')
  consent() {
    return this.owners.getConsentInfo();
  }

  @ApiOperation({ summary: 'Lista os proprietários do anfitrião com os imóveis vinculados' })
  @Get()
  async list(@Req() req: any) {
    return this.owners.listForHost(req.user.userId);
  }

  @ApiOperation({ summary: 'Cadastra um proprietário (com declaração de base legal) e vincula imóveis' })
  @Post()
  async create(@Req() req: any, @Body() body: CreatePropertyOwnerDto) {
    return this.owners.create(req.user.userId, body, req.ip);
  }

  @ApiOperation({ summary: 'Edita um proprietário; trocar o e-mail exige nova declaração' })
  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: UpdatePropertyOwnerDto) {
    return this.owners.update(req.user.userId, id, body, req.ip);
  }

  @ApiOperation({ summary: 'Remove o proprietário e seus relatórios e links' })
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.owners.remove(req.user.userId, id);
  }

  @ApiOperation({ summary: 'Relatórios já gerados do proprietário, com o estado do envio e dos links' })
  @Get(':id/reports')
  async listReports(@Req() req: any, @Param('id') id: string) {
    return this.reports.listReportsForHost(req.user.userId, id);
  }

  @ApiOperation({ summary: 'Pré-visualiza o relatório de um mês (não grava, não conta visualização)' })
  @PerMinuteThrottle(30)
  @Get(':id/reports/:period/preview')
  async preview(@Req() req: any, @Param('id') id: string, @Param('period') period: string) {
    return this.reports.previewForHost(req.user.userId, id, period);
  }

  @ApiOperation({ summary: 'Emite um link seguro (somente leitura, com expiração) para o relatório do mês' })
  @PerMinuteThrottle(20)
  @Post(':id/reports/:period/links')
  async createLink(
    @Req() req: any,
    @Param('id') id: string,
    @Param('period') period: string,
    @Body() body: CreateOwnerReportLinkDto,
  ) {
    return this.reports.createLinkForHost(req.user.userId, id, period, body?.ttlDays);
  }

  @ApiOperation({ summary: 'Envia agora o relatório do mês ao proprietário (idempotente por mês)' })
  @PerMinuteThrottle(10)
  @HttpCode(200)
  @Post(':id/reports/:period/send')
  async send(@Req() req: any, @Param('id') id: string, @Param('period') period: string) {
    return this.delivery.sendNowForHost(req.user.userId, id, period);
  }

  @ApiOperation({ summary: 'Revoga todos os links ativos do proprietário' })
  @HttpCode(200)
  @Post(':id/links/revoke-all')
  async revokeAll(@Req() req: any, @Param('id') id: string) {
    return this.reports.revokeAllLinks(req.user.userId, id);
  }

  @ApiOperation({ summary: 'Revoga um link do relatório' })
  @HttpCode(200)
  @Post(':id/links/:linkId/revoke')
  async revoke(@Req() req: any, @Param('id') id: string, @Param('linkId') linkId: string) {
    return this.reports.revokeLink(req.user.userId, id, linkId);
  }
}
