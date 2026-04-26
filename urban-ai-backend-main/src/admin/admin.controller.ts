import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';
import { AdminFinanceService } from './finance.service';

/**
 * Endpoints administrativos da Urban AI.
 *
 * Acesso restrito por dupla camada:
 *  - JwtAuthGuard (precisa estar autenticado)
 *  - RolesGuard com @Roles('admin') (precisa ter role admin)
 *
 * Throttling padrão (100/min global) — admin acessa pouco e tudo é leitura
 * cara, então não exigimos throttle adicional.
 *
 * NÃO expõe segredos (password, accessToken Stays, Stripe webhook secret etc.).
 */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly finance: AdminFinanceService,
  ) {}

  @ApiOperation({ summary: 'Visão geral do painel admin (KPIs)' })
  @Get('overview')
  async overview() {
    return this.admin.overview();
  }

  @ApiOperation({ summary: 'Status do motor de pricing (estratégia ativa, tier, dataset)' })
  @Get('pricing/status')
  async pricingStatus() {
    return this.admin.pricingStatus();
  }

  @ApiOperation({ summary: 'Métricas do dataset proprietário (por origem, top listings)' })
  @Get('dataset/metrics')
  async datasetMetrics() {
    return this.admin.datasetMetrics();
  }

  @ApiOperation({ summary: 'Analytics do motor de eventos (cobertura, categorias, top relevância)' })
  @Get('events/analytics')
  async eventsAnalytics() {
    return this.admin.eventsAnalytics();
  }

  @ApiOperation({ summary: 'Saúde da integração Stays (contas, listings, push history)' })
  @Get('stays/health')
  async staysHealth() {
    return this.admin.staysHealth();
  }

  @ApiOperation({ summary: 'Funnel de produto (signup → analyses → applied)' })
  @Get('funnel')
  async productFunnel() {
    return this.admin.productFunnel();
  }

  @ApiOperation({ summary: 'Qualidade do motor (MAPE sobre preço aplicado real)' })
  @Get('pricing/quality')
  async pricingQuality() {
    return this.admin.pricingQuality();
  }

  @ApiOperation({ summary: 'Cobertura de ocupação (status, origem, listings distintos)' })
  @Get('occupancy/coverage')
  async occupancyCoverage() {
    return this.admin.occupancyCoverage();
  }

  @ApiOperation({ summary: 'Listar usuários (paginado)' })
  @Get('users')
  async listUsers(@Query('page') page: string = '1', @Query('limit') limit: string = '20') {
    return this.admin.listUsers(parseInt(page, 10), parseInt(limit, 10));
  }

  @ApiOperation({ summary: 'Atualizar role do usuário' })
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Patch('users/:id/role')
  async setUserRole(
    @Param('id') userId: string,
    @Body() body: { role: 'host' | 'admin' | 'support' },
  ) {
    const user = await this.admin.setUserRole(userId, body.role);
    return { id: user.id, role: user.role };
  }

  @ApiOperation({ summary: 'Ativar/desativar usuário' })
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Patch('users/:id/active')
  async setUserActive(
    @Param('id') userId: string,
    @Body() body: { ativo: boolean },
  ) {
    const user = await this.admin.setUserActive(userId, body.ativo);
    return { id: user.id, ativo: user.ativo };
  }

  // ================== Finance — custos, receita, margem ==================

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
  async createCost(
    @Body()
    body: {
      name: string;
      category: string;
      recurrence: string;
      monthlyCostCents: number;
      percentOfRevenue?: number;
      description?: string;
      scalesWithListings?: boolean;
      notes?: string;
    },
  ) {
    return this.finance.createCost(body);
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Atualizar custo' })
  @Patch('finance/costs/:id')
  async updateCost(@Param('id') id: string, @Body() body: any) {
    return this.finance.updateCost(id, body);
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Remover custo' })
  @Delete('finance/costs/:id')
  async deleteCost(@Param('id') id: string) {
    return this.finance.deleteCost(id);
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary:
      'Popular custos default da Urban AI (idempotente). overwrite=true sobrescreve valores manuais.',
  })
  @Post('finance/costs/seed')
  async seedDefaultCosts(@Query('overwrite') overwrite: string = 'false') {
    return this.finance.seedDefaultCosts(overwrite === 'true');
  }

  // ================== Pricing config (planos) ==================

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
  async updatePlanPricing(@Param('name') name: string, @Body() body: any) {
    return this.finance.updatePlanPricing(name, body);
  }
}
