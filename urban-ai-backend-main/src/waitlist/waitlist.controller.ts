import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WaitlistService } from './waitlist.service';

/**
 * Controller da Waitlist (F8.2).
 *
 * Endpoints públicos (rate-limited):
 *  - POST /waitlist           — inscreve um email
 *  - GET  /waitlist/me        — consulta posição via referralCode (lookup leve)
 *  - GET  /waitlist/invite    — valida token de convite (admin já mandou email)
 *
 * Endpoints admin:
 *  - GET    /admin/waitlist
 *  - GET    /admin/waitlist/stats
 *  - POST   /admin/waitlist/:id/invite
 *  - PATCH  /admin/waitlist/:id/notes
 *  - DELETE /admin/waitlist/:id
 */
@ApiTags('waitlist')
@Controller()
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  // ================== PÚBLICO ==================

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Inscrever um e-mail na lista de espera (pré-lançamento)' })
  @Post('waitlist')
  async signup(
    @Body()
    body: {
      email: string;
      name?: string;
      phone?: string;
      source?: string;
      referredBy?: string;
    },
    @Req() req: Request,
  ) {
    if (!body?.email) {
      throw new BadRequestException('email é obrigatório');
    }
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      null;
    const ua = (req.headers['user-agent'] as string) ?? null;
    return this.waitlist.signup({
      email: body.email,
      name: body.name,
      phone: body.phone,
      source: body.source,
      referredBy: body.referredBy,
      signupIp: ip ?? undefined,
      userAgent: ua ?? undefined,
    });
  }

  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({
    summary: 'Consultar posição na fila via referralCode (sem auth, sem expor email)',
  })
  @Get('waitlist/me')
  async getMyStatus(@Query('code') code: string) {
    if (!code || code.length < 4) {
      throw new BadRequestException('referralCode obrigatório');
    }
    const result = await this.waitlist.getStatusByCode(code);
    if (!result) {
      throw new BadRequestException('referralCode não encontrado');
    }
    return result;
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Validar token de convite (página de aceite)' })
  @Get('waitlist/invite')
  async validateInvite(@Query('token') token: string) {
    if (!token) throw new BadRequestException('token obrigatório');
    const entry = await this.waitlist.lookupByInviteToken(token);
    if (!entry) {
      return { valid: false, reason: 'token inválido ou expirado' };
    }
    return {
      valid: true,
      email: entry.email,
      name: entry.name,
      position: entry.position,
    };
  }

  // ================== ADMIN ==================

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Listar entradas da lista de espera (admin)' })
  @Get('admin/waitlist')
  async list(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.waitlist.list({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      status,
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Stats da lista de espera (total, byStatus, bySource, top referrers)' })
  @Get('admin/waitlist/stats')
  async stats() {
    return this.waitlist.stats();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Convidar uma entry (gera magic link + envia email)' })
  @Post('admin/waitlist/:id/invite')
  async invite(@Param('id') id: string) {
    const frontUrl = process.env.FRONT_BASE_URL || 'https://urban.ai';
    return this.waitlist.invite(id, frontUrl);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({ summary: 'Atualizar notas internas de uma entry' })
  @Patch('admin/waitlist/:id/notes')
  async updateNotes(@Param('id') id: string, @Body() body: { notes: string | null }) {
    return this.waitlist.updateNotes(id, body.notes);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Remover uma entry da lista' })
  @Delete('admin/waitlist/:id')
  async remove(@Param('id') id: string) {
    return this.waitlist.remove(id);
  }
}
