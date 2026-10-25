import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaysService } from './stays.service';
import {
  ConnectStaysDto,
  LinkStaysListingDto,
  ListPriceUpdatesQueryDto,
  PreviewStaysPriceDto,
  PushStaysPriceDto,
} from './stays.dto';

type AuthedReq = Request & { user: { userId: string } };

/**
 * Política de assinatura: `StaysController` é 'paid' por padrão
 * (src/subscription/subscription-policy.ts); exceções livres lá documentadas.
 */
@ApiTags('stays')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stays')
export class StaysController {
  constructor(private readonly stays: StaysService) {}

  @ApiOperation({ summary: 'Consultar o estado salvo da conta Stays' })
  @Get('account')
  async account(@Req() req: AuthedReq) {
    const account = await this.stays.getAccount(req.user.userId);
    return account ? this.publicAccount(account) : null;
  }

  @ApiOperation({ summary: 'Capacidades do ambiente (escrita/auto-apply ligados?)' })
  @Get('capabilities')
  capabilities() {
    return this.stays.getCapabilities();
  }

  @ApiOperation({ summary: 'Conectar conta Stays (Open API)' })
  @Post('connect')
  @HttpCode(200)
  async connect(
    @Req() req: AuthedReq,
    @Body() body: ConnectStaysDto,
  ) {
    const account = await this.stays.connectAccount(req.user.userId, {
      ...body,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    // Nunca retornamos o token — só os dados públicos da conta.
    return this.publicAccount(account);
  }

  @ApiOperation({ summary: 'Desconectar conta Stays' })
  @Delete('connect')
  @HttpCode(204)
  async disconnect(@Req() req: AuthedReq) {
    await this.stays.disconnectAccount(req.user.userId);
  }

  @ApiOperation({ summary: 'Sincronizar listings da Stays' })
  @Post('listings/sync')
  async syncListings(@Req() req: AuthedReq) {
    const listings = await this.stays.syncListings(req.user.userId);
    return { count: listings.length, listings: listings.map((l) => this.publicListing(l)) };
  }

  @ApiOperation({ summary: 'Listar listings Stays já sincronizados' })
  @Get('listings')
  async listListings(@Req() req: AuthedReq) {
    const listings = await this.stays.listListingsForUser(req.user.userId);
    return listings.map((l) => this.publicListing(l));
  }

  @ApiOperation({ summary: 'Sugestões de vínculo listing Stays ↔ imóvel Urban (o usuário confirma)' })
  @Get('listings/match-suggestions')
  async matchSuggestions(@Req() req: AuthedReq) {
    return this.stays.suggestListingMatches(req.user.userId);
  }

  @ApiOperation({ summary: 'Imóveis Urban do usuário disponíveis para vínculo' })
  @Get('properties')
  async linkableProperties(@Req() req: AuthedReq) {
    return this.stays.listLinkableProperties(req.user.userId);
  }

  @ApiOperation({ summary: 'Vincular um listing Stays a um imóvel Urban do próprio usuário' })
  @Put('listings/:id/property')
  async linkProperty(
    @Req() req: AuthedReq,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: LinkStaysListingDto,
  ) {
    const listing = await this.stays.linkListingToProperty(req.user.userId, id, body.propriedadeId);
    return this.publicListing(listing);
  }

  @ApiOperation({ summary: 'Desvincular o imóvel Urban de um listing Stays' })
  @Delete('listings/:id/property')
  async unlinkProperty(@Req() req: AuthedReq, @Param('id', new ParseUUIDPipe()) id: string) {
    const listing = await this.stays.linkListingToProperty(req.user.userId, id, null);
    return this.publicListing(listing);
  }

  @ApiOperation({ summary: 'Preço recomendado (evento futuro) do imóvel vinculado ao listing' })
  @Get('listings/:id/recommendation')
  async recommendation(@Req() req: AuthedReq, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.stays.getRecommendationForListing(req.user.userId, id);
  }

  @ApiOperation({ summary: 'Histórico de pushes de preço (PriceUpdate) do usuário' })
  @Get('price-updates')
  async priceUpdates(@Req() req: AuthedReq, @Query() query: ListPriceUpdatesQueryDto) {
    const records = await this.stays.listPriceUpdates(req.user.userId, query.listingId, query.limit ?? 20);
    return records.map((r) => this.publicPriceUpdate(r));
  }

  @ApiOperation({ summary: 'Previsualizar impacto e bloqueios antes de aplicar preço na Stays' })
  @Post('price/preview')
  async previewPrice(
    @Req() req: AuthedReq,
    @Body()
    body: PreviewStaysPriceDto,
  ) {
    return this.stays.previewPrice(req.user.userId, body);
  }

  @ApiOperation({ summary: 'Aplicar preço (user_accepted) — push manual via dashboard' })
  @Post('price/push')
  async pushPrice(
    @Req() req: AuthedReq,
    @Body()
    body: PushStaysPriceDto,
  ) {
    const record = await this.stays.pushPrice(req.user.userId, {
      ...body,
      origin: 'user_accepted',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return this.publicPriceUpdate(record);
  }

  @ApiOperation({ summary: 'Reverter um push anterior (rollback)' })
  @Post('price/:id/rollback')
  async rollback(@Req() req: AuthedReq, @Param('id', new ParseUUIDPipe()) id: string) {
    const record = await this.stays.rollback(req.user.userId, id, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return this.publicPriceUpdate(record);
  }

  private publicAccount(account: any) {
    return {
      id: account.id,
      status: account.status,
      clientId: account.clientId,
      accountSlug: account.apiAccountSlug ?? null,
      lastSyncAt: account.lastSyncAt,
      consentVersion: account.consentVersion,
      consentAcceptedAt: account.consentAcceptedAt,
    };
  }

  private publicListing(l: any) {
    return {
      id: l.id,
      staysListingId: l.staysListingId,
      title: l.title,
      shortAddress: l.shortAddress,
      basePriceCents: l.basePriceCents,
      providerMetadata: l.providerMetadata ?? null,
      active: l.active,
      operationMode: l.operationMode,
      propriedadeId: l.propriedade?.id ?? null,
    };
  }

  private publicPriceUpdate(r: any) {
    return {
      id: r.id,
      listingId: r.listing?.id ?? null,
      targetDate: r.targetDate,
      previousPriceCents: r.previousPriceCents,
      newPriceCents: r.newPriceCents,
      currency: r.currency,
      origin: r.origin,
      status: r.status,
      errorMessage: r.errorMessage,
      rollbackOfId: r.rollbackOf?.id ?? null,
      createdAt: r.createdAt,
    };
  }
}
