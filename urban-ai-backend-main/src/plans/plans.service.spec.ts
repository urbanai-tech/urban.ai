import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlansService } from './plans.service';
import { Plan } from '../entities/plan.entity';

type Repo<T> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('PlansService', () => {
  let service: PlansService;
  let repo: Repo<Plan>;

  beforeEach(async () => {
    repo = {
      clear: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation(async (list) => list),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansService,
        { provide: getRepositoryToken(Plan), useValue: repo },
      ],
    }).compile();

    service = module.get<PlansService>(PlansService);
  });

  describe('seedPlans', () => {
    it('seeds the 3 expected plans on an empty table', async () => {
      await service.seedPlans();

      expect(repo.clear).not.toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalledTimes(1);
      const saved = repo.save!.mock.calls[0][0];
      const names = saved.map((p: any) => p.name);
      expect(names).toEqual(expect.arrayContaining(['starter', 'profissional', 'escala']));
    });

    it('respects env vars for Stripe price IDs over fallback literals', async () => {
      const original = { ...process.env };
      process.env.STARTER_MENSAL_PLAN = 'price_env_starter_m';
      process.env.STARTER_ANUAL_PLAN = 'price_env_starter_a';
      process.env.PROFISSIONAL_MENSAL_PLAN = 'price_env_pro_m';
      process.env.PROFISSIONAL_ANUAL_PLAN = 'price_env_pro_a';

      await service.seedPlans();

      const saved = repo.save!.mock.calls[0][0];
      const starter = saved.find((p: any) => p.name === 'starter');
      const pro = saved.find((p: any) => p.name === 'profissional');

      expect(starter.stripePriceId).toBe('price_env_starter_m');
      expect(starter.stripePriceIdAnnual).toBe('price_env_starter_a');
      expect(pro.stripePriceId).toBe('price_env_pro_m');
      expect(pro.stripePriceIdAnnual).toBe('price_env_pro_a');

      process.env = original;
    });

    it('profissional plan has the "MAIS ESCOLHIDO" highlight', async () => {
      await service.seedPlans();

      const saved = repo.save!.mock.calls[0][0];
      const pro = saved.find((p: any) => p.name === 'profissional');
      expect(pro.highlightBadge).toBe('MAIS ESCOLHIDO');
    });

    it('escala plan has custom pricing flag and unlimited properties', async () => {
      await service.seedPlans();

      const saved = repo.save!.mock.calls[0][0];
      const escala = saved.find((p: any) => p.name === 'escala');
      expect(escala.isCustomPrice).toBe(true);
      expect(escala.propertyLimit).toBeNull();
      expect(escala.price).toBe('Sob consulta');
    });

    it('does not overwrite existing DB plan configuration on boot', async () => {
      repo.findOne!.mockImplementation(async ({ where }: any) => {
        if (where.name !== 'starter') return null;
        return {
          id: 'starter-id',
          name: 'starter',
          title: 'Starter DB',
          priceMonthly: '123',
          stripePriceIdMonthly: 'price_db_monthly',
          features: ['Feature editada no admin'],
        };
      });

      await service.seedPlans();

      const saved = repo.save!.mock.calls[0][0];
      const starter = saved.find((p: any) => p.name === 'starter');
      expect(starter.title).toBe('Starter DB');
      expect(starter.priceMonthly).toBe('123');
      expect(starter.stripePriceIdMonthly).toBe('price_db_monthly');
      expect(starter.features).toEqual(['Feature editada no admin']);
      expect(starter.priceQuarterly).toBe('129');
    });
  });

  describe('getPlanByName', () => {
    it('delegates to repository.findOne with a name filter', async () => {
      const plan = { id: '1', name: 'starter' } as Plan;
      repo.findOne!.mockResolvedValue(plan);

      const result = await service.getPlanByName('starter');

      expect(repo.findOne).toHaveBeenCalledWith({ where: { name: 'starter' } });
      expect(result).toBe(plan);
    });
  });

  describe('getSelfServicePlanForQuantity', () => {
    it('selects the active self-service band for a quantity', async () => {
      repo.find!.mockResolvedValue([
        {
          name: 'starter',
          isActive: true,
          selfServiceEnabled: true,
          isCustomPrice: false,
          minProperties: 1,
          maxProperties: 3,
          maxCheckoutQuantity: 3,
        },
        {
          name: 'profissional',
          isActive: true,
          selfServiceEnabled: true,
          isCustomPrice: false,
          minProperties: 4,
          maxProperties: 500,
          maxCheckoutQuantity: 500,
        },
      ]);

      await expect(service.getSelfServicePlanForQuantity(2)).resolves.toMatchObject({ name: 'starter' });
      await expect(service.getSelfServicePlanForQuantity(50)).resolves.toMatchObject({ name: 'profissional' });
    });

    it('returns null when quantity only matches a consultive band', async () => {
      repo.find!.mockResolvedValue([
        {
          name: 'escala',
          isActive: true,
          selfServiceEnabled: false,
          isCustomPrice: true,
          minProperties: 501,
          maxProperties: null,
        },
      ]);

      await expect(service.getSelfServicePlanForQuantity(600)).resolves.toBeNull();
    });
  });

  describe('quoteSelfService', () => {
    it('returns quote totals for the selected quantity band and cycle', async () => {
      repo.find!.mockResolvedValue([
        {
          name: 'profissional',
          title: 'Profissional',
          isActive: true,
          selfServiceEnabled: true,
          isCustomPrice: false,
          minProperties: 4,
          maxProperties: 500,
          maxCheckoutQuantity: 500,
          priceAnnualNew: '67',
          discountAnnualPercent: 32,
        },
      ]);

      await expect(service.quoteSelfService(50, 'annual')).resolves.toMatchObject({
        quantity: 50,
        billingCycle: 'annual',
        selfService: true,
        planName: 'profissional',
        pricePerPropertyMonthly: 67,
        monthlyEquivalentTotal: 3350,
        cycleTotal: 40200,
        monthsInCycle: 12,
        discountPercent: 32,
      });
    });

    it('marks quote as contactRequired when no self-service band matches', async () => {
      repo.find!.mockResolvedValue([]);

      await expect(service.quoteSelfService(501, 'annual')).resolves.toMatchObject({
        quantity: 501,
        selfService: false,
        contactRequired: true,
        planTitle: 'Escala',
      });
    });
  });
});
