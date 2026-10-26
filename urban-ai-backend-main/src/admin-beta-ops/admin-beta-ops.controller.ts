import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminBillingHostsService } from './admin-billing-hosts.service';
import { SendBillingLinkDto } from './admin-beta-ops.dto';
import { AdminOutcomesService } from './admin-outcomes.service';
import { BillingHostStatus } from './billing-hosts';

const STATUS_FILTERS = new Set<string>([
  'all',
  'attention',
  'alpha',
  'trialing',
  'trial_expired',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'expired',
  'none',
  'inactive',
]);

/**
 * Operação do beta pago (somente admin): cobrança assistida e medição dos resultados.
 * Mutações são auditadas pelo AdminAuditInterceptor global (o corpo é só o tipo de link).
 */
@ApiTags('admin-beta-ops')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminBetaOpsController {
  constructor(
    private readonly billingHosts: AdminBillingHostsService,
    private readonly outcomes: AdminOutcomesService,
  ) {}

  @ApiOperation({ summary: 'Anfitriões do beta com estado da assinatura (trial, ativo, pagamento falhou, cancelado)' })
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('billing/hosts')
  async listBillingHosts(@Query('status') status?: string, @Query('search') search?: string) {
    const safeStatus = status && STATUS_FILTERS.has(status) ? (status as BillingHostStatus | 'attention' | 'all') : 'all';
    return this.billingHosts.list({ status: safeStatus, search: search?.slice(0, 120) });
  }

  @ApiOperation({ summary: 'Reenvia ao anfitrião, por e-mail, o link de checkout/portal já gerado pelo Stripe' })
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('billing/hosts/:userId/send-link')
  async sendBillingLink(@Param('userId', new ParseUUIDPipe()) userId: string, @Body() body: SendBillingLinkDto) {
    return this.billingHosts.sendLink(userId, body?.kind ?? 'auto');
  }

  @ApiOperation({ summary: 'v1 x v2 (sombra) x preço aplicado x resultado registrado' })
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Get('outcomes/comparison')
  async outcomesComparison(@Query('limit') limit?: string) {
    return this.outcomes.comparison({ limit: Number(limit) || undefined });
  }
}
