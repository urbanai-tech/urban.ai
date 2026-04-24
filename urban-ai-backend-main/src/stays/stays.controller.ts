import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaysService } from './stays.service';

type AuthedReq = Request & { user: { userId: string } };

@ApiTags('stays')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stays')
export class StaysController {
  constructor(private readonly stays: StaysService) {}

  @ApiOperation({ summary: 'Conectar conta Stays (Open API)' })
  @Post('connect')
  @HttpCode(200)
  async connect(
    @Req() req: AuthedReq,
    @Body() body: { clientId: string; accessToken: string },
  ) {
    const account = await this.stays.connectAccount(req.user.userId, body);
    // Nunca retornamos o token — só os dados públicos da conta.
    return {
      id: account.id,
      status: account.status,
      clientId: account.clientId,
      lastSyncAt: account.lastSyncAt,
    };
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

  @ApiOperation({ summary: 'Aplicar preço (user_accepted) — push manual via dashboard' })
  @Post('price/push')
  async pushPrice(
    @Req() req: AuthedReq,
    @Body()
    body: {
      listingId: string;
      targetDate: string;
      newPriceCents: number;
      previousPriceCents: number;
      currency?: string;
      analisePrecoId?: string;
    },
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
  async rollback(@Req() req: AuthedReq, @Param('id') id: string) {
    const record = await this.stays.rollback(req.user.userId, id, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return this.publicPriceUpdate(record);
  }

  private publicListing(l: any) {
    return {
      id: l.id,
      staysListingId: l.staysListingId,
      title: l.title,
      shortAddress: l.shortAddress,
      basePriceCents: l.basePriceCents,
      active: l.active,
      operationMode: l.operationMode,
      propriedadeId: l.propriedade?.id ?? null,
    };
  }

  private publicPriceUpdate(r: any) {
    return {
      id: r.id,
      targetDate: r.targetDate,
      previousPriceCents: r.previousPriceCents,
      newPriceCents: r.newPriceCents,
      currency: r.currency,
      origin: r.origin,
      status: r.status,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt,
    };
  }
}
