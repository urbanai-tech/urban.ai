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
    const count = await this.planRepository.count();
    if (count > 0) {
      this.logger.log('Plans already seeded, skipping.');
      return;
    }

    this.logger.log('Seeding initial plans...');

    const starter = this.planRepository.create({
      name: 'starter',
      title: 'Starter',
      price: '124',
      originalPrice: '247',
      discountBadge: '50% OFF',
      period: '/mês',
      propertyLimit: 3,
      features: [
        'Até 3 imóveis',
        'Monitoramento de eventos em SP',
        'Recomendações de preço diárias',
        'Dashboard com histórico 30 dias',
      ],
      stripePriceId: process.env.MENSAL_PLAN || '',
    });

    const profissional = this.planRepository.create({
      name: 'profissional',
      title: 'Profissional',
      price: '248',
      originalPrice: '497',
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
      stripePriceId: process.env.ANUAL_PLAN || '', // Mapping to what exists until new price is added
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
        'Integração via API com seu Channel Manager',
        'Gerente de Sucesso Dedicado',
        'Precificação com base em ocupação e mercado inteiro',
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
