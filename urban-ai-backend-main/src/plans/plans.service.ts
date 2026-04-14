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
    // Temp: Clear table to reseed with new annual data
    await this.planRepository.clear();
    const count = await this.planRepository.count();
    if (count > 0) {
      this.logger.log('Plans already seeded, skipping.');
      return;
    }

    this.logger.log('Seeding initial plans...');

    const starter = this.planRepository.create({
      name: 'starter',
      title: 'Starter',
      price: '57',
      originalPrice: '97',
      priceAnnual: '47,50',
      originalPriceAnnual: '77',
      discountBadge: '50% OFF',
      period: '/mês',
      propertyLimit: 3,
      features: [
        'Até 3 imóveis',
        'Monitoramento de eventos em SP',
        'Recomendações de preço diárias',
        'Dashboard com histórico 30 dias',
      ],
      stripePriceId: process.env.STARTER_MENSAL_PLAN || 'price_1TM4qvEnApK9w8lLlszK4zAo',
      stripePriceIdAnnual: process.env.STARTER_ANUAL_PLAN || 'price_1TM4r4EnApK9w8lLPJR9fjI0',
    });

    const profissional = this.planRepository.create({
      name: 'profissional',
      title: 'Profissional',
      price: '87',
      originalPrice: '147',
      priceAnnual: '72,50',
      originalPriceAnnual: '127',
      highlightBadge: 'MAIS ESCOLHIDO',
      discountBadge: '50% OFF',
      period: '/mês',
      propertyLimit: 10,
      features: [
        'Até 10 imóveis',
        'Monitoramento avançado de eventos',
        'Recomendações com contexto de evento e raio',
        'Histórico completo no dashboard',
        'Notificações por e-mail + painel',
        'Suporte prioritário',
      ],
      stripePriceId: process.env.PROFISSIONAL_MENSAL_PLAN || 'price_1TM4rDEnApK9w8lLft3dgJ7o',
      stripePriceIdAnnual: process.env.PROFISSIONAL_ANUAL_PLAN || 'price_1TM4rNEnApK9w8lLkNPlE2QZ',
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
      ],
      stripePriceId: '', 
    });

    await this.planRepository.save([starter, profissional, escala]);
    this.logger.log('Plans seeded successfully!');
  }

  async getActivePlans(): Promise<Plan[]> {
    return this.planRepository.find({ where: { isActive: true }, order: { price: 'ASC' } });
  }

  async getPlanByName(name: string): Promise<Plan> {
    return this.planRepository.findOne({ where: { name } });
  }
}
