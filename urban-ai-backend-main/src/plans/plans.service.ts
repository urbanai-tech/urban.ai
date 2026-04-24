import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from '../entities/plan.entity';

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
    // Temp: Clear table to reseed with new pricing matrix.
    // ⚠️ Esse comportamento sobrescreve dados a cada boot. Migrar para
    //    migration idempotente antes do go-live (D3 em RELEASE_NOTES_SPRINT_2026-04-21).
    await this.planRepository.clear();

    this.logger.log('Seeding initial plans (com matriz F6.5)...');

    // Tabela F6.5 — preço POR IMÓVEL, POR MÊS equivalente.
    // Mensal é "caro" (ancora); demais ciclos têm desconto progressivo.
    const starter = this.planRepository.create({
      name: 'starter',
      title: 'Starter',
      // Legados (compat F5B):
      price: '57',
      originalPrice: '97',
      priceAnnual: '47,50',
      originalPriceAnnual: '77',
      stripePriceId: process.env.STARTER_MENSAL_PLAN || 'price_1TM4wUEnApK9w8lLLF4jxc1p',
      stripePriceIdAnnual: process.env.STARTER_ANUAL_PLAN || 'price_1TM4whEnApK9w8lLtwtBP6QX',
      // Matriz F6.5 (por imóvel/mês equivalente):
      priceMonthly: '97',
      priceQuarterly: '82',     // -15%
      priceSemestral: '73',     // -25%
      priceAnnualNew: '58',     // -40%
      originalPriceMonthly: '97',
      originalPriceQuarterly: '97',
      originalPriceSemestral: '97',
      originalPriceAnnualNew: '97',
      stripePriceIdMonthly: process.env.STARTER_PRICE_MONTHLY || '',
      stripePriceIdQuarterly: process.env.STARTER_PRICE_QUARTERLY || '',
      stripePriceIdSemestral: process.env.STARTER_PRICE_SEMESTRAL || '',
      stripePriceIdAnnualNew: process.env.STARTER_PRICE_ANNUAL || '',
      discountQuarterlyPercent: 15,
      discountSemestralPercent: 25,
      discountAnnualPercent: 40,
      // Display:
      discountBadge: '40% OFF anual',
      period: '/imóvel/mês',
      propertyLimit: 3,
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
      price: '248',
      originalPrice: '497',
      priceAnnual: '199',
      originalPriceAnnual: '399',
      stripePriceId: process.env.PROFISSIONAL_MENSAL_PLAN || 'price_1TM4wqEnApK9w8lLZy8iPqFl',
      stripePriceIdAnnual: process.env.PROFISSIONAL_ANUAL_PLAN || 'price_1TM4wzEnApK9w8lLd8kchkNY',
      priceMonthly: '197',
      priceQuarterly: '167',    // -15%
      priceSemestral: '148',    // -25%
      priceAnnualNew: '118',    // -40%
      originalPriceMonthly: '197',
      originalPriceQuarterly: '197',
      originalPriceSemestral: '197',
      originalPriceAnnualNew: '197',
      stripePriceIdMonthly: process.env.PROFISSIONAL_PRICE_MONTHLY || '',
      stripePriceIdQuarterly: process.env.PROFISSIONAL_PRICE_QUARTERLY || '',
      stripePriceIdSemestral: process.env.PROFISSIONAL_PRICE_SEMESTRAL || '',
      stripePriceIdAnnualNew: process.env.PROFISSIONAL_PRICE_ANNUAL || '',
      discountQuarterlyPercent: 15,
      discountSemestralPercent: 25,
      discountAnnualPercent: 40,
      highlightBadge: 'MAIS ESCOLHIDO',
      discountBadge: '40% OFF anual',
      period: '/imóvel/mês',
      propertyLimit: 10,
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
      features: [
        'Imóveis Ilimitados',
        'Comercial dedicado',
        'SLA personalizado',
      ],
      stripePriceId: '',
    });

    await this.planRepository.save([starter, profissional, escala]);
    this.logger.log('Plans seeded successfully (com matriz F6.5).');
  }

  async getActivePlans(): Promise<Plan[]> {
    return this.planRepository.find({ where: { isActive: true }, order: { price: 'ASC' } });
  }

  async getPlanByName(name: string): Promise<Plan> {
    return this.planRepository.findOne({ where: { name } });
  }
}
