import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminFinanceService } from './finance.service';
import { PlatformCost } from '../entities/platform-cost.entity';
import { Payment } from '../entities/payment.entity';
import { Plan } from '../entities/plan.entity';
import { Address } from '../entities/addresses.entity';

/**
 * Tests para AdminFinanceService.
 *
 * Cobertura focada nos cálculos críticos para o pricing:
 *  - estimatedMrrCents: agregação correta com matriz F6.5 (4 ciclos × quantity)
 *  - totalMonthlyCostsCents: soma fixos + percentual sobre receita
 *  - overview: composição final (margem, por imóvel, etc.)
 *  - seedDefaultCosts: idempotência (não duplica)
 *
 * Não toca DB real — repositórios mockados.
 */

type MockRepo<T> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const mockRepoFactory = <T>(): MockRepo<T> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
  save: jest.fn((row) => Promise.resolve(row)),
  create: jest.fn((row) => row),
  remove: jest.fn(),
});

describe('AdminFinanceService', () => {
  let service: AdminFinanceService;
  let costRepo: MockRepo<PlatformCost>;
  let paymentRepo: MockRepo<Payment>;
  let planRepo: MockRepo<Plan>;
  let addressRepo: MockRepo<Address>;

  beforeEach(async () => {
    costRepo = mockRepoFactory<PlatformCost>();
    paymentRepo = mockRepoFactory<Payment>();
    planRepo = mockRepoFactory<Plan>();
    addressRepo = mockRepoFactory<Address>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminFinanceService,
        { provide: getRepositoryToken(PlatformCost), useValue: costRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(Plan), useValue: planRepo },
        { provide: getRepositoryToken(Address), useValue: addressRepo },
      ],
    }).compile();

    service = module.get(AdminFinanceService);
  });

  describe('estimatedMrrCents', () => {
    it('soma corretamente Payments × billingCycle × listingsContratados × matriz F6.5', async () => {
      const starter = {
        name: 'starter',
        priceMonthly: '149,00',
        priceQuarterly: '129,00',
        priceSemestral: '109,00',
        priceAnnualNew: '97,00',
        priceAnnual: '97,00',
        price: '149,00',
      };
      const profissional = {
        name: 'profissional',
        priceMonthly: '99,00',
        priceQuarterly: '85,00',
        priceSemestral: '72,00',
        priceAnnualNew: '67,00',
        priceAnnual: '67,00',
        price: '99,00',
      };

      planRepo.find!.mockResolvedValue([starter, profissional]);
      paymentRepo.find!.mockResolvedValue([
        // 2 imóveis × R$149/mês mensal = R$298 = 29800 cents
        { planName: 'starter', billingCycle: 'monthly', listingsContratados: 2, status: 'active' },
        // 5 imóveis × R$67/mês equivalente anual = R$335 = 33500 cents
        { planName: 'profissional', billingCycle: 'annual', listingsContratados: 5, status: 'active' },
        // trialing também conta
        { planName: 'starter', billingCycle: 'quarterly', listingsContratados: 1, status: 'trialing' },
      ]);

      const r = await service.estimatedMrrCents();

      expect(r.activePayments).toBe(3);
      // 29800 (starter monthly 2x) + 33500 (prof annual 5x) + 12900 (starter quarterly 1x) = 76200
      expect(r.mrrCents).toBe(29800 + 33500 + 12900);
      expect(r.byPlan).toHaveLength(2);
      const starterAgg = r.byPlan.find((p) => p.planName === 'starter');
      expect(starterAgg?.count).toBe(2);
    });

    it('cai no plano "profissional" quando planName é desconhecido', async () => {
      const profissional = {
        name: 'profissional',
        priceMonthly: '99,00',
        priceAnnualNew: '67,00',
      };
      planRepo.find!.mockResolvedValue([profissional]);
      paymentRepo.find!.mockResolvedValue([
        { planName: null, billingCycle: 'monthly', listingsContratados: 1, status: 'active' },
      ]);

      const r = await service.estimatedMrrCents();
      expect(r.mrrCents).toBe(9900);
    });

    it('retorna zero quando não há Payments ativos', async () => {
      planRepo.find!.mockResolvedValue([]);
      paymentRepo.find!.mockResolvedValue([]);

      const r = await service.estimatedMrrCents();
      expect(r.mrrCents).toBe(0);
      expect(r.activePayments).toBe(0);
      expect(r.byPlan).toHaveLength(0);
    });

    it('default quantity=1 quando listingsContratados é null', async () => {
      planRepo.find!.mockResolvedValue([
        { name: 'starter', priceMonthly: '149,00' },
      ]);
      paymentRepo.find!.mockResolvedValue([
        { planName: 'starter', billingCycle: 'monthly', listingsContratados: null, status: 'active' },
      ]);

      const r = await service.estimatedMrrCents();
      expect(r.mrrCents).toBe(14900);
    });
  });

  describe('totalMonthlyCostsCents', () => {
    it('soma fixos + percentual sobre MRR', async () => {
      costRepo.find!.mockResolvedValue([
        { recurrence: 'monthly', monthlyCostCents: 5000_00, category: 'infra', percentOfRevenue: null },
        { recurrence: 'monthly', monthlyCostCents: 1000_00, category: 'apis', percentOfRevenue: null },
        { recurrence: 'percentual', monthlyCostCents: 0, category: 'payments', percentOfRevenue: 5 },
      ]);

      const r = await service.totalMonthlyCostsCents(100_000_00); // MRR R$100k

      // Fixos: 600000 cents
      // Percentual: 5% de 10000000 = 500000 cents
      expect(r.fixedCents).toBe(6000_00);
      expect(r.percentualCents).toBe(5000_00);
      expect(r.totalCents).toBe(11000_00);

      // byCategory ordenado por valor desc
      expect(r.byCategory[0].category).toBe('infra');
    });

    it('retorna zero quando não há custos cadastrados', async () => {
      costRepo.find!.mockResolvedValue([]);
      const r = await service.totalMonthlyCostsCents(0);
      expect(r.totalCents).toBe(0);
      expect(r.byCategory).toHaveLength(0);
    });
  });

  describe('overview', () => {
    it('compõe receita, custos, margem e por-imóvel', async () => {
      planRepo.find!.mockResolvedValue([
        { name: 'starter', priceMonthly: '149,00', priceAnnualNew: '97,00' },
      ]);
      paymentRepo.find!.mockResolvedValue([
        { planName: 'starter', billingCycle: 'monthly', listingsContratados: 10, status: 'active' },
      ]);
      // MRR: 10 × 14900 = 149000 cents

      costRepo.find!.mockResolvedValue([
        { recurrence: 'monthly', monthlyCostCents: 50_00, category: 'infra', percentOfRevenue: null },
      ]);
      // Custos: 5000 cents

      addressRepo.count!.mockResolvedValue(10);

      const r = await service.overview();

      expect(r.activeListings).toBe(10);
      expect(r.revenue.mrrCents).toBe(149000);
      expect(r.costs.totalCents).toBe(5000);
      expect(r.margin.absoluteCents).toBe(144000);
      expect(r.margin.percent).toBeCloseTo(96.64, 1);

      // perListing: 149000/10 receita, 5000/10 custo, 14400 margem
      expect(r.perListing.revenueCents).toBe(14900);
      expect(r.perListing.costCents).toBe(500);
      expect(r.perListing.marginCents).toBe(14400);
    });

    it('zera por-imóvel quando não há listings', async () => {
      planRepo.find!.mockResolvedValue([]);
      paymentRepo.find!.mockResolvedValue([]);
      costRepo.find!.mockResolvedValue([]);
      addressRepo.count!.mockResolvedValue(0);

      const r = await service.overview();
      expect(r.activeListings).toBe(0);
      expect(r.perListing.revenueCents).toBe(0);
      expect(r.perListing.costCents).toBe(0);
      expect(r.perListing.marginCents).toBe(0);
    });
  });

  describe('seedDefaultCosts', () => {
    it('cria todos quando tabela está vazia', async () => {
      costRepo.findOne!.mockResolvedValue(null);

      const r = await service.seedDefaultCosts();

      expect(r.created).toBeGreaterThan(0);
      expect(r.skipped).toBe(0);
      expect(r.updated).toBe(0);
      expect(costRepo.save).toHaveBeenCalled();
    });

    it('é idempotente — pula custos já existentes (overwrite=false default)', async () => {
      // Simula que TODO custo já existe
      costRepo.findOne!.mockResolvedValue({ id: 'x', name: 'existing' });

      const r = await service.seedDefaultCosts(false);

      expect(r.created).toBe(0);
      expect(r.skipped).toBeGreaterThan(0);
      expect(r.updated).toBe(0);
    });

    it('overwrite=true atualiza valores existentes', async () => {
      costRepo.findOne!.mockResolvedValue({ id: 'x', name: 'existing', monthlyCostCents: 0 });

      const r = await service.seedDefaultCosts(true);

      expect(r.updated).toBeGreaterThan(0);
      expect(r.created).toBe(0);
    });
  });
});
