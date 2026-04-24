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
});
