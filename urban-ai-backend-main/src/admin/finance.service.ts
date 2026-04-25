import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PlatformCost } from '../entities/platform-cost.entity';
import { Payment } from '../entities/payment.entity';
import { Plan } from '../entities/plan.entity';
import { Address } from '../entities/addresses.entity';

/**
 * AdminFinanceService — agrega custos operacionais, receita e calcula
 * margem em tempo real.
 *
 * Não pretende ser um ERP. É um instrumento de gestão para o painel admin
 * responder rápido as perguntas:
 *   - "Estamos no positivo este mês?"
 *   - "Quanto custa cada imóvel ativo?"
 *   - "Margem por imóvel é compatível com o preço cobrado?"
 *   - "Aumentar preço em X% gera quanto de margem extra?"
 *
 * Receita estimada vem do `Payment` ativo + `listingsContratados` × preço
 * do plano (matriz F6.5). Mais preciso quando o webhook estiver gravando
 * billingCycle e quantity (já está, desde v2.7).
 */
@Injectable()
export class AdminFinanceService {
  constructor(
    @InjectRepository(PlatformCost) private readonly costRepo: Repository<PlatformCost>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(Address) private readonly addressRepo: Repository<Address>,
  ) {}

  // ================== CRUD básico ==================

  async listCosts(includeInactive = false) {
    return this.costRepo.find({
      where: includeInactive ? undefined : { active: true },
      order: { category: 'ASC', monthlyCostCents: 'DESC' },
    });
  }

  async createCost(input: {
    name: string;
    category: string;
    recurrence: string;
    monthlyCostCents: number;
    percentOfRevenue?: number;
    description?: string;
    scalesWithListings?: boolean;
    notes?: string;
  }) {
    const row = this.costRepo.create({
      name: input.name,
      category: input.category as any,
      recurrence: input.recurrence as any,
      monthlyCostCents: Math.max(0, Math.floor(input.monthlyCostCents)),
      percentOfRevenue: input.percentOfRevenue ?? null,
      description: input.description ?? null,
      scalesWithListings: input.scalesWithListings ?? false,
      notes: input.notes ?? null,
      active: true,
    });
    return this.costRepo.save(row);
  }

  async updateCost(
    id: string,
    input: Partial<{
      name: string;
      category: string;
      recurrence: string;
      monthlyCostCents: number;
      percentOfRevenue: number | null;
      description: string | null;
      scalesWithListings: boolean;
      notes: string | null;
      active: boolean;
    }>,
  ) {
    const row = await this.costRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Custo não encontrado');
    Object.assign(row, input);
    return this.costRepo.save(row);
  }

  async deleteCost(id: string) {
    const row = await this.costRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Custo não encontrado');
    await this.costRepo.remove(row);
    return { ok: true };
  }

  // ================== Cálculo agregado ==================

  /**
   * Receita mensal recorrente estimada.
   *
   * Soma todos os `Payment` ativos/trialing e calcula valor mensal
   * equivalente baseado em `billingCycle` (mensal=1, trimestral/3,
   * semestral/6, anual/12) × `listingsContratados` × preço do plano.
   *
   * Quando `billingCycle` ou `planName` estão NULL (Payments antigos
   * pré-F6.5), usa preço legado do Plan (compat).
   */
  async estimatedMrrCents(): Promise<{
    mrrCents: number;
    activePayments: number;
    byPlan: Array<{ planName: string; count: number; monthlyCents: number }>;
  }> {
    const payments = await this.paymentRepo.find({
      where: { status: In(['active', 'trialing']) },
    });

    const plans = await this.planRepo.find();
    const plansByName = new Map(plans.map((p) => [p.name, p]));

    const cycleMonths: Record<string, number> = {
      monthly: 1,
      quarterly: 3,
      semestral: 6,
      annual: 12,
      month: 1,
      year: 12,
    };

    let total = 0;
    const byPlanAgg = new Map<string, { count: number; monthlyCents: number }>();

    for (const p of payments) {
      const plan = plansByName.get(p.planName ?? '') || plansByName.get('profissional');
      if (!plan) continue;

      const cycle = (p.billingCycle ?? p.mode ?? 'monthly').toLowerCase();
      const months = cycleMonths[cycle] ?? 1;

      // Resolver preço por imóvel/mês equivalente da matriz F6.5;
      // se vazio (legado), usa price (mensal) ou priceAnnual.
      let pricePerListingMonth = 0;
      if (cycle === 'annual' || cycle === 'year') {
        const raw = plan.priceAnnualNew ?? plan.priceAnnual ?? plan.price ?? '0';
        pricePerListingMonth = Number(String(raw).replace(',', '.'));
      } else if (cycle === 'quarterly') {
        const raw = plan.priceQuarterly ?? plan.priceMonthly ?? plan.price ?? '0';
        pricePerListingMonth = Number(String(raw).replace(',', '.'));
      } else if (cycle === 'semestral') {
        const raw = plan.priceSemestral ?? plan.priceMonthly ?? plan.price ?? '0';
        pricePerListingMonth = Number(String(raw).replace(',', '.'));
      } else {
        const raw = plan.priceMonthly ?? plan.price ?? '0';
        pricePerListingMonth = Number(String(raw).replace(',', '.'));
      }

      const qty = Math.max(1, p.listingsContratados ?? 1);
      const monthlyEquivalent = Math.round(pricePerListingMonth * 100) * qty;
      total += monthlyEquivalent;

      const key = plan.name;
      const agg = byPlanAgg.get(key) ?? { count: 0, monthlyCents: 0 };
      agg.count += 1;
      agg.monthlyCents += monthlyEquivalent;
      byPlanAgg.set(key, agg);
    }

    return {
      mrrCents: total,
      activePayments: payments.length,
      byPlan: Array.from(byPlanAgg.entries()).map(([planName, agg]) => ({
        planName,
        count: agg.count,
        monthlyCents: agg.monthlyCents,
      })),
    };
  }

  /**
   * Total de custos mensais. Inclui:
   *  - todos os custos `monthly` ativos somados
   *  - todos os `usage_based` ativos (estimativa cadastrada)
   *  - todos os `one_time` ativos (já amortizados em monthlyCostCents)
   *  - todos os `percentual` ativos × MRR estimado
   */
  async totalMonthlyCostsCents(mrrCents: number): Promise<{
    totalCents: number;
    fixedCents: number;
    percentualCents: number;
    byCategory: Array<{ category: string; cents: number }>;
  }> {
    const costs = await this.costRepo.find({ where: { active: true } });

    let fixed = 0;
    let percentual = 0;
    const byCat = new Map<string, number>();

    for (const c of costs) {
      let monthly = 0;
      if (c.recurrence === 'percentual' && c.percentOfRevenue != null) {
        monthly = Math.round((Number(c.percentOfRevenue) / 100) * mrrCents);
        percentual += monthly;
      } else {
        monthly = c.monthlyCostCents;
        fixed += monthly;
      }
      byCat.set(c.category, (byCat.get(c.category) ?? 0) + monthly);
    }

    return {
      totalCents: fixed + percentual,
      fixedCents: fixed,
      percentualCents: percentual,
      byCategory: Array.from(byCat.entries())
        .map(([category, cents]) => ({ category, cents }))
        .sort((a, b) => b.cents - a.cents),
    };
  }

  /**
   * Visão consolidada para o painel `/admin/finance`. Calcula:
   *  - MRR estimado
   *  - Custos totais
   *  - Margem absoluta + %
   *  - Imóveis ativos (Address count)
   *  - Custo por imóvel ativo
   *  - Receita por imóvel ativo
   *  - Margem por imóvel ativo
   *
   * Esses números alimentam decisão de pricing (se margem por imóvel está
   * abaixo do CAC esperado, o preço está errado).
   */
  async overview() {
    const [mrr, addrCount] = await Promise.all([
      this.estimatedMrrCents(),
      this.addressRepo.count(),
    ]);
    const costs = await this.totalMonthlyCostsCents(mrr.mrrCents);

    const marginCents = mrr.mrrCents - costs.totalCents;
    const marginPercent = mrr.mrrCents > 0 ? (marginCents / mrr.mrrCents) * 100 : 0;

    const activeListings = Math.max(0, addrCount);
    const costPerListingCents = activeListings > 0 ? Math.round(costs.totalCents / activeListings) : 0;
    const revenuePerListingCents =
      activeListings > 0 ? Math.round(mrr.mrrCents / activeListings) : 0;
    const marginPerListingCents = revenuePerListingCents - costPerListingCents;

    return {
      currency: 'BRL',
      activeListings,
      activePayments: mrr.activePayments,
      revenue: {
        mrrCents: mrr.mrrCents,
        byPlan: mrr.byPlan,
      },
      costs: {
        totalCents: costs.totalCents,
        fixedCents: costs.fixedCents,
        percentualCents: costs.percentualCents,
        byCategory: costs.byCategory,
      },
      margin: {
        absoluteCents: marginCents,
        percent: Math.round(marginPercent * 100) / 100,
      },
      perListing: {
        revenueCents: revenuePerListingCents,
        costCents: costPerListingCents,
        marginCents: marginPerListingCents,
        marginPercent:
          revenuePerListingCents > 0
            ? Math.round((marginPerListingCents / revenuePerListingCents) * 10000) / 100
            : 0,
      },
    };
  }

  // ================== CRUD de planos (preços) ==================

  /**
   * Atualiza preço de um plano. Aceita parcial (só os campos enviados são
   * atualizados). NÃO toca em `stripePriceId*` — IDs do Stripe ficam fora
   * do CRUD admin pois mudar Price ID exige criar nova price no Dashboard
   * Stripe primeiro.
   */
  async updatePlanPricing(
    name: string,
    input: Partial<{
      price: string;
      priceAnnual: string;
      priceMonthly: string;
      priceQuarterly: string;
      priceSemestral: string;
      priceAnnualNew: string;
      originalPriceMonthly: string;
      originalPriceQuarterly: string;
      originalPriceSemestral: string;
      originalPriceAnnualNew: string;
      discountQuarterlyPercent: number;
      discountSemestralPercent: number;
      discountAnnualPercent: number;
      propertyLimit: number | null;
      title: string;
      features: string[];
      isActive: boolean;
      highlightBadge: string | null;
      discountBadge: string | null;
    }>,
  ) {
    const plan = await this.planRepo.findOne({ where: { name } });
    if (!plan) throw new NotFoundException(`Plano '${name}' não encontrado`);
    Object.assign(plan, input);
    return this.planRepo.save(plan);
  }

  async listPlans() {
    return this.planRepo.find({ order: { createdAt: 'ASC' } });
  }
}
