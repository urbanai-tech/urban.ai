import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PerMinuteThrottle } from '../common/throttle-config';
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
  @PerMinuteThrottle(30)
  @Get('billing/hosts')
  async listBillingHosts(@Query('status') status?: unknown, @Query('search') search?: unknown) {
    // Query string pode chegar como array (?status=a&status=b): só aceita string simples.
    const safeStatus =
      typeof status === 'string' && STATUS_FILTERS.has(status) ? (status as BillingHostStatus | 'attention' | 'all') : 'all';
    const safeSearch = typeof search === 'string' ? search.slice(0, 120) : undefined;
    return this.billingHosts.list({ status: safeStatus, search: safeSearch });
  }

  @ApiOperation({ summary: 'Reenvia ao anfitrião, por e-mail, o link de checkout/portal já gerado pelo Stripe' })
  @PerMinuteThrottle(10)
  @Post('billing/hosts/:userId/send-link')
  async sendBillingLink(@Param('userId', new ParseUUIDPipe()) userId: string, @Body() body: SendBillingLinkDto) {
    return this.billingHosts.sendLink(userId, body?.kind ?? 'auto');
  }

  @ApiOperation({ summary: 'v1 x v2 (sombra) x preço aplicado x resultado registrado' })
  @PerMinuteThrottle(20)
  @Get('outcomes/comparison')
  async outcomesComparison(@Query('limit') limit?: unknown) {
    return this.outcomes.comparison({ limit: typeof limit === 'string' ? Number(limit) || undefined : undefined });
  }
}
