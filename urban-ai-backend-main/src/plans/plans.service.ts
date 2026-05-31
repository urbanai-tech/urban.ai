import { BadRequestException, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingCycle, Plan } from '../entities/plan.entity';
import { getEnvKeys, isBillingCycle } from '../payments/stripe-price-id.resolver';

@Injectable()
export class PlansService implements OnModuleInit {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
  ) {}

  async onModuleInit() {
    await this.seedPlans();
  }

  async seedPlans() {
    // Idempotente: preserva ajustes feitos no banco e só preenche campos ausentes.
    // ⚠️ Esse comportamento sobrescreve dados a cada boot. Migrar para
    this.logger.log('Ensuring initial plans (com matriz F6.5)...');

    // Tabela F6.5 — preço POR IMÓVEL, POR MÊS equivalente.
    // Mensal é "caro" (ancora); demais ciclos têm desconto progressivo.
    const starter = this.planRepository.create({
      name: 'starter',
      title: 'Starter',
      // Legados (compat F5B):
      price: '149',
      originalPrice: '149',
      priceAnnual: '97',
      originalPriceAnnual: '149',
      stripePriceId: process.env.STARTER_MENSAL_PLAN || '',
      stripePriceIdAnnual: process.env.STARTER_ANUAL_PLAN || '',
      // Matriz F6.5 (por imóvel/mês equivalente):
      priceMonthly: '149',
      priceQuarterly: '129',     // -13%
      priceSemestral: '109',     // -27%
      priceAnnualNew: '97',      // -35%
      originalPriceMonthly: '149',
      originalPriceQuarterly: '149',
      originalPriceSemestral: '149',
      originalPriceAnnualNew: '149',
      stripePriceIdMonthly: process.env.STARTER_PRICE_MONTHLY || '',
      stripePriceIdQuarterly: process.env.STARTER_PRICE_QUARTERLY || '',
      stripePriceIdSemestral: process.env.STARTER_PRICE_SEMESTRAL || '',
      stripePriceIdAnnualNew: process.env.STARTER_PRICE_ANNUAL || '',
      discountQuarterlyPercent: 13,
      discountSemestralPercent: 27,
      discountAnnualPercent: 35,
      // Display:
      discountBadge: '35% OFF anual',
      period: '/imóvel/mês',
      propertyLimit: 3,
      minProperties: 1,
      maxProperties: 3,
      maxCheckoutQuantity: 3,
      selfServiceEnabled: true,
      sortOrder: 10,
      features: [
        'Cobrança por imóvel — cresce com seu portfólio',
        'Monitoramento de eventos em SP',
        'Recomendações de preço diárias',
        'Dashboard com histórico 30 dias',
      ],
    });

    const profissional = this.planRepository.create({
      name: 'profissional',
      title: 'Profissional',
      price: '99',
      originalPrice: '99',
      priceAnnual: '67',
      originalPriceAnnual: '99',
      stripePriceId: process.env.PROFISSIONAL_MENSAL_PLAN || '',
      stripePriceIdAnnual: process.env.PROFISSIONAL_ANUAL_PLAN || '',
      priceMonthly: '99',
      priceQuarterly: '85',     // -14%
      priceSemestral: '72',     // -27%
      priceAnnualNew: '67',     // -32%
      originalPriceMonthly: '99',
      originalPriceQuarterly: '99',
      originalPriceSemestral: '99',
      originalPriceAnnualNew: '99',
      stripePriceIdMonthly: process.env.PROFISSIONAL_PRICE_MONTHLY || '',
      stripePriceIdQuarterly: process.env.PROFISSIONAL_PRICE_QUARTERLY || '',
      stripePriceIdSemestral: process.env.PROFISSIONAL_PRICE_SEMESTRAL || '',
      stripePriceIdAnnualNew: process.env.PROFISSIONAL_PRICE_ANNUAL || '',
      discountQuarterlyPercent: 14,
      discountSemestralPercent: 27,
      discountAnnualPercent: 32,
      highlightBadge: 'MAIS ESCOLHIDO',
      discountBadge: '32% OFF anual',
      period: '/imóvel/mês',
      propertyLimit: 500,
      minProperties: 4,
      maxProperties: 500,
      maxCheckoutQuantity: 500,
      selfServiceEnabled: true,
      sortOrder: 20,
      features: [
        'Cobrança por imóvel — sem teto rígido',
        'Monitoramento avançado de eventos',
        'Recomendações com contexto de evento e raio',
        'Modo automático via Stays (aplicação direta)',
        'Histórico completo no dashboard',
        'Notificações por e-mail + painel',
        'Suporte prioritário',
      ],
    });

    const escala = this.planRepository.create({
      name: 'escala',
      title: 'Escala',
      price: 'Sob consulta',
      originalPrice: null,
      isCustomPrice: true,
      period: '',
      propertyLimit: null,
      minProperties: 501,
      maxProperties: null,
      maxCheckoutQuantity: null,
      selfServiceEnabled: false,
      sortOrder: 30,
      features: [
        'Imóveis Ilimitados',
        'Comercial dedicado',
        'SLA personalizado',
      ],
      stripePriceId: '',
    });

    const seeds = [starter, profissional, escala];
    const plans: Plan[] = [];

    for (const seed of seeds) {
      const existing = await this.planRepository.findOne({ where: { name: seed.name } });
      plans.push(existing ? this.mergeSeedPlan(existing, seed) : seed);
    }

    await this.planRepository.save(plans);
    this.logger.log('Plans ensured successfully (com matriz F6.5).');
  }

  private mergeSeedPlan(existing: Plan, seed: Plan): Plan {
    const merged = Object.assign(existing, this.fillMissing(existing, seed));
    this.applyStripeEnvOverrides(merged, seed);
    return merged;
  }

  private fillMissing(existing: Plan, seed: Plan): Partial<Plan> {
    const patch: Partial<Plan> = {};

    for (const [key, value] of Object.entries(seed) as Array<[keyof Plan, any]>) {
      const current = existing[key];
      const isMissing =
        current === undefined ||
        current === null ||
        (typeof current === 'string' && current.trim() === '');

      if (isMissing) {
        (patch as any)[key] = value;
      }
    }

    return patch;
  }

  private applyStripeEnvOverrides(plan: Plan, seed: Plan) {
    const fieldsByCycle = {
      monthly: ['stripePriceIdMonthly', 'stripePriceId'],
      quarterly: ['stripePriceIdQuarterly'],
      semestral: ['stripePriceIdSemestral'],
      annual: ['stripePriceIdAnnualNew', 'stripePriceIdAnnual'],
    } as const;

    for (const [cycle, fields] of Object.entries(fieldsByCycle)) {
      const envValue = this.firstConfiguredEnv(getEnvKeys(plan.name, cycle as any));
      if (envValue) {
        (plan as any)[fields[0]] = envValue;
        continue;
      }

      for (const field of fields) {
        if (!(plan as any)[field] && (seed as any)[field]) {
          (plan as any)[field] = (seed as any)[field];
        }
      }
    }
  }

  private firstConfiguredEnv(keys: string[]): string | null {
    for (const key of keys) {
      const value = process.env[key]?.trim();
      if (value) return value;
    }
    return null;
  }

  async getActivePlans(): Promise<Plan[]> {
    return this.planRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', minProperties: 'ASC', createdAt: 'ASC' },
    });
  }

  async getPlanByName(name: string): Promise<Plan> {
    return this.planRepository.findOne({ where: { name } });
  }

  async getSelfServicePlanForQuantity(quantity: number): Promise<Plan | null> {
    if (!Number.isInteger(quantity) || quantity < 1) return null;

    const plans = await this.getActivePlans();
    return (
      plans.find((plan) => {
        if (plan.selfServiceEnabled === false || plan.isCustomPrice) return false;
        const min = plan.minProperties ?? 1;
        const max = plan.maxProperties ?? plan.propertyLimit ?? null;
        const checkoutMax = plan.maxCheckoutQuantity ?? max ?? null;
        if (quantity < min) return false;
        if (max !== null && quantity > max) return false;
        if (checkoutMax !== null && quantity > checkoutMax) return false;
        return true;
      }) ?? null
    );
  }

  async quoteSelfService(quantityInput: unknown, cycleInput: unknown = 'annual') {
    const quantity = this.resolveQuoteQuantity(quantityInput);
    const billingCycle: BillingCycle = isBillingCycle(cycleInput) ? cycleInput : 'annual';
    const plan = await this.getSelfServicePlanForQuantity(quantity);

    if (!plan) {
      return {
        quantity,
        billingCycle,
        selfService: false,
        contactRequired: true,
        planName: null,
        planTitle: 'Escala',
      };
    }

    const pricePerPropertyMonthly = this.priceForCycle(plan, billingCycle);
    const monthsInCycle = this.monthsForCycle(billingCycle);
    const monthlyEquivalentTotal = pricePerPropertyMonthly * quantity;
    const cycleTotal = monthlyEquivalentTotal * monthsInCycle;

    return {
      quantity,
      billingCycle,
      selfService: true,
      contactRequired: false,
      planName: plan.name,
      planTitle: plan.title,
      minProperties: plan.minProperties ?? 1,
      maxProperties: plan.maxProperties ?? plan.propertyLimit ?? null,
      pricePerPropertyMonthly,
      monthlyEquivalentTotal,
      cycleTotal,
      monthsInCycle,
      discountPercent: this.discountForCycle(plan, billingCycle),
    };
  }

  private resolveQuoteQuantity(value: unknown): number {
    const parsed = Number(value ?? 1);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100000) {
      throw new BadRequestException('quantity invalida');
    }
    return Math.floor(parsed);
  }

  private priceForCycle(plan: Plan, cycle: BillingCycle): number {
    const raw =
      cycle === 'monthly'
        ? plan.priceMonthly
        : cycle === 'quarterly'
          ? plan.priceQuarterly
          : cycle === 'semestral'
            ? plan.priceSemestral
            : plan.priceAnnualNew;
    return this.parseMoney(raw);
  }

  private discountForCycle(plan: Plan, cycle: BillingCycle): number {
    if (cycle === 'quarterly') return plan.discountQuarterlyPercent ?? 0;
    if (cycle === 'semestral') return plan.discountSemestralPercent ?? 0;
    if (cycle === 'annual') return plan.discountAnnualPercent ?? 0;
    return 0;
  }

  private monthsForCycle(cycle: BillingCycle): number {
    if (cycle === 'quarterly') return 3;
    if (cycle === 'semestral') return 6;
    if (cycle === 'annual') return 12;
    return 1;
  }

  private parseMoney(value: string | null | undefined): number {
    if (!value) return 0;
    const parsed = Number(String(value).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
