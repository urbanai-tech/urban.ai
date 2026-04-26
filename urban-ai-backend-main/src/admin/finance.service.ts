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

  /**
   * Seed idempotente dos custos operacionais conhecidos da Urban AI (abril/2026).
   *
   * Idempotente: usa `name` como chave natural — se já existe, atualiza só os
   * campos que vieram NULL ou zerados (não sobrescreve o que o admin editou
   * manualmente). Se não existe, cria.
   *
   * Valores são estimativas baseadas em planos atuais e uso médio. Devem ser
   * revisados pelo admin pelo `/admin/finance` após o primeiro deploy.
   *
   * @param overwrite Se true, sobrescreve valores mesmo que o custo já exista.
   *                  Default false para preservar edits manuais.
   */
  async seedDefaultCosts(overwrite = false): Promise<{
    created: number;
    updated: number;
    skipped: number;
    items: Array<{ name: string; action: 'created' | 'updated' | 'skipped' }>;
  }> {
    type Seed = {
      name: string;
      category: string;
      recurrence: string;
      monthlyCostCents: number;
      percentOfRevenue?: number;
      description?: string;
      scalesWithListings?: boolean;
      notes?: string;
    };

    const seeds: Seed[] = [
      // Infra
      {
        name: 'Railway (backend + DB)',
        category: 'infra',
        recurrence: 'monthly',
        monthlyCostCents: 5000_00, // R$50/mês start, escala com uso
        description: 'Hosting NestJS + MySQL Railway',
        notes: 'Plano Hobby/Pro; escala com tráfego. Revisar fatura mensal.',
      },
      {
        name: 'Upstash Redis (BullMQ)',
        category: 'infra',
        recurrence: 'usage_based',
        monthlyCostCents: 1000_00, // ~R$10
        description: 'Fila de jobs (sync Stays, scrapers)',
      },
      {
        name: 'Sentry (error tracking)',
        category: 'infra',
        recurrence: 'monthly',
        monthlyCostCents: 13000_00, // ~$26 dev plan
        description: 'Error monitoring backend + frontend',
      },
      {
        name: 'UptimeRobot',
        category: 'infra',
        recurrence: 'monthly',
        monthlyCostCents: 0,
        description: 'Free tier; upgrade R$30/mês quando passar de 50 monitors',
        notes: 'Atualmente free tier — promover quando a operação justificar',
      },

      // APIs
      {
        name: 'Google Gemini (LLM)',
        category: 'apis',
        recurrence: 'usage_based',
        monthlyCostCents: 8000_00, // ~R$80
        description: 'Análise de eventos + extração estruturada',
        scalesWithListings: true,
        notes: 'Custo por token. Free tier 1500 req/dia inicialmente.',
      },
      {
        name: 'Google Maps APIs',
        category: 'apis',
        recurrence: 'usage_based',
        monthlyCostCents: 2000_00, // ~R$20
        description: 'Geocoding, Places para listings cadastrados',
        scalesWithListings: true,
      },
      {
        name: 'Firecrawl',
        category: 'apis',
        recurrence: 'monthly',
        monthlyCostCents: 0, // free tier inicial
        description: 'Scraping de eventos (Sympla, Eventbrite, prefeituras)',
        notes: 'Free tier; upgrade ~$19/mo quando passar de 500 páginas/mês',
      },

      // Comms
      {
        name: 'Mailersend',
        category: 'comms',
        recurrence: 'monthly',
        monthlyCostCents: 0, // free 3k emails/mês
        description: 'Transactional email (boas-vindas, alertas, recuperação)',
        notes: 'Free 3k emails/mês; upgrade quando passar',
      },

      // Payments
      {
        name: 'Stripe (taxa de processamento)',
        category: 'payments',
        recurrence: 'percentual',
        monthlyCostCents: 0, // calculado em tempo real
        percentOfRevenue: 4.99,
        description: 'Taxa Stripe BR ~3.99% + R$0.39/transação. Aprox 4.99% efetivo.',
      },

      // People (estimativa — ajuste manual no painel)
      {
        name: 'Sócios fundadores (custo de oportunidade)',
        category: 'people',
        recurrence: 'monthly',
        monthlyCostCents: 0,
        description: 'Gustavo + Fabrício + Rogério — equity, sem pró-labore inicial',
        notes: 'Não é despesa contábil; rastrear custo de oportunidade aqui se desejado',
      },

      // Marketing — ajustar conforme spend real
      {
        name: 'Marketing performance (Meta/Google Ads)',
        category: 'marketing',
        recurrence: 'monthly',
        monthlyCostCents: 0,
        description: 'Spend de aquisição. Ajustar pelo painel conforme campanha.',
      },

      // Legal — amortização
      {
        name: 'Compliance LGPD (advogado pontual)',
        category: 'legal',
        recurrence: 'one_time',
        monthlyCostCents: 50000, // R$500/mês amortizado de R$6k/ano
        description: 'Revisão LGPD + termos. Amortizado em 12 meses.',
        notes: 'Custo one-time R$6k anual amortizado mensalmente',
      },

      // Data sources externos (Tier 0 enquanto dataset próprio amadurece)
      {
        name: 'AirROI (free public dataset)',
        category: 'data',
        recurrence: 'monthly',
        monthlyCostCents: 0,
        description: 'Dataset público gratuito de mercado Airbnb',
        notes: 'Sem custo — público. Linha aqui só para visibilidade no painel.',
      },
    ];

    const items: Array<{ name: string; action: 'created' | 'updated' | 'skipped' }> = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const seed of seeds) {
      const existing = await this.costRepo.findOne({ where: { name: seed.name } });
      if (!existing) {
        await this.costRepo.save(
          this.costRepo.create({
            name: seed.name,
            category: seed.category as any,
            recurrence: seed.recurrence as any,
            monthlyCostCents: seed.monthlyCostCents,
            percentOfRevenue: seed.percentOfRevenue ?? null,
            description: seed.description ?? null,
            scalesWithListings: seed.scalesWithListings ?? false,
            notes: seed.notes ?? null,
            active: true,
          }),
        );
        created++;
        items.push({ name: seed.name, action: 'created' });
      } else if (overwrite) {
        Object.assign(existing, {
          category: seed.category,
          recurrence: seed.recurrence,
          monthlyCostCents: seed.monthlyCostCents,
          percentOfRevenue: seed.percentOfRevenue ?? null,
          description: seed.description ?? null,
          scalesWithListings: seed.scalesWithListings ?? false,
          notes: seed.notes ?? null,
        });
        await this.costRepo.save(existing);
        updated++;
        items.push({ name: seed.name, action: 'updated' });
      } else {
        skipped++;
        items.push({ name: seed.name, action: 'skipped' });
      }
    }

    return { created, updated, skipped, items };
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
