import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminFinanceService } from './finance.service';
import { StripeSyncCheckService } from './stripe-sync.service';
import {
  CreatePlatformCostDto,
  UpdatePlanPricingDto,
  UpdatePlatformCostDto,
} from './dto/admin-billing.dto';

/**
 * Contexto administrativo de billing e finanças.
 *
 * Mantém os contratos históricos sob /admin enquanto isola operações de
 * custos, planos e consistência Stripe do controller administrativo geral.
 */
@ApiTags('admin-billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminBillingController {
  constructor(
    private readonly finance: AdminFinanceService,
    private readonly stripeSync: StripeSyncCheckService,
    private readonly audit: AdminAuditService,
  ) {}

  @ApiOperation({ summary: 'Visão consolidada financeira (MRR, custos, margem, por imóvel)' })
  @Get('finance/overview')
  async financeOverview() {
    return this.finance.overview();
  }

  @ApiOperation({ summary: 'Listar custos cadastrados' })
  @Get('finance/costs')
  async listCosts(@Query('includeInactive') inactive: string = 'false') {
    return this.finance.listCosts(inactive === 'true');
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Criar custo operacional novo' })
  @Post('finance/costs')
  async createCost(@Body() body: CreatePlatformCostDto, @Req() req: any) {
    const cost = await this.finance.createCost(body);
    await this.audit.record({
      actorUserId: req?.user?.userId ?? null,
      action: 'finance.cost_create',
      entityType: 'platform_cost',
      entityId: cost.id,
      after: cost,
    });
    return cost;
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Atualizar custo' })
  @Patch('finance/costs/:id')
  async updateCost(@Param('id') id: string, @Body() body: UpdatePlatformCostDto, @Req() req: any) {
    const cost = await this.finance.updateCost(id, body);
    await this.audit.record({
      actorUserId: req?.user?.userId ?? null,
      action: 'finance.cost_update',
      entityType: 'platform_cost',
      entityId: cost.id,
      after: cost,
    });
    return cost;
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Remover custo' })
  @Delete('finance/costs/:id')
  async deleteCost(@Param('id') id: string, @Req() req: any) {
    const result = await this.finance.deleteCost(id);
    await this.audit.record({
      actorUserId: req?.user?.userId ?? null,
      action: 'finance.cost_delete',
      entityType: 'platform_cost',
      entityId: id,
    });
    return result;
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary:
      'Popular custos default da Urban AI (idempotente). overwrite=true sobrescreve valores manuais.',
  })
  @Post('finance/costs/seed')
  async seedDefaultCosts(@Query('overwrite') overwrite: string = 'false', @Req() req: any) {
    const shouldOverwrite = overwrite === 'true';
    const result = await this.finance.seedDefaultCosts(shouldOverwrite);
    await this.audit.record({
      actorUserId: req?.user?.userId ?? null,
      action: 'finance.cost_seed',
      entityType: 'platform_cost',
      metadata: { overwrite: shouldOverwrite, summary: result },
    });
    return result;
  }

  @ApiOperation({ summary: 'Listar planos com preços atuais (todos os ciclos)' })
  @Get('plans-config')
  async listPlansConfig() {
    return this.finance.listPlans();
  }

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({
    summary: 'Atualizar preço/features de um plano (NÃO atualiza Stripe Price IDs)',
  })
  @Patch('plans-config/:name')
  async updatePlanPricing(
    @Param('name') name: string,
    @Body() body: UpdatePlanPricingDto,
    @Req() req: any,
  ) {
    const plan = await this.finance.updatePlanPricing(name, body);
    await this.audit.record({
      actorUserId: req?.user?.userId ?? null,
      action: 'plan.pricing_update',
      entityType: 'plan',
      entityId: plan.id,
      after: plan,
      metadata: { name },
    });
    return plan;
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary:
      'Validar que os 8 Stripe Price IDs (matriz F6.5) existem e batem com o ciclo esperado',
  })
  @Get('stripe/sync-check')
  async stripeSyncCheck() {
    return this.stripeSync.check();
  }
}
