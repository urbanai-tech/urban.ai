import { ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { HostPanelsService } from './host-panels.service';

describe('HostPanelsService AskUrban entitlement', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      ASK_URBAN_DAILY_QUOTA: '100',
      ASK_URBAN_DAILY_HARD_CAP: '200',
    };
    delete process.env.ASK_URBAN_ALLOWED_PLANS;
    delete process.env.ASK_URBAN_DAILY_QUOTA_PROFISSIONAL;
    delete process.env.ASK_URBAN_DAILY_HARD_CAP_PROFISSIONAL;
    delete process.env.ALPHA_USER_QUOTAS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function makeService(input: {
    used?: number;
    payments?: any[];
    user?: any;
  } = {}) {
    const askRepo = {
      count: jest.fn().mockResolvedValue(input.used ?? 0),
      create: jest.fn((entity) => entity),
      save: jest.fn(async (entity) => ({ id: entity.id ?? 'message-1', ...entity })),
    };
    const userRepo = {
      findOne: jest.fn().mockResolvedValue(input.user ?? { id: 'user-1', email: 'host@example.com' }),
    };
    const paymentRepo = {
      find: jest.fn().mockResolvedValue(input.payments ?? []),
    };
    const dataSource = {
      getRepository: jest.fn().mockReturnValue(paymentRepo),
    };

    const service = new HostPanelsService(
      {} as any,
      {} as any,
      userRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      askRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      dataSource as any,
    );

    return { service, askRepo, paymentRepo, userRepo };
  }

  it('permite AskUrban para plano profissional ativo e retorna entitlement no usage', async () => {
    const { service } = makeService({
      used: 7,
      payments: [{ status: 'active', planName: 'profissional', expireDate: null }],
    });

    await expect(service.askUsage('user-1')).resolves.toEqual({
      used: 7,
      quota: 100,
      hardCap: 200,
      canUse: true,
      plan: 'profissional',
      reason: null,
    });
  });

  it('bloqueia pergunta quando o plano ativo não é permitido', async () => {
    const { service, askRepo } = makeService({
      payments: [{ status: 'active', planName: 'starter', expireDate: null }],
    });

    try {
      await service.askQuestion('user-1', { question: 'Como está minha receita?' });
      throw new Error('expected AskUrban to be blocked');
    } catch (error: any) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.getResponse()).toMatchObject({
        message: 'Ask Urban indisponível para este plano',
        reason: 'plan_not_allowed',
        usage: {
          canUse: false,
          plan: 'starter',
          quota: 0,
          hardCap: 0,
        },
      });
    }

    expect(askRepo.save).not.toHaveBeenCalled();
  });

  it('bloqueia pergunta quando a quota diária foi atingida', async () => {
    process.env.ASK_URBAN_DAILY_QUOTA = '1';
    process.env.ASK_URBAN_DAILY_HARD_CAP = '2';
    const { service, askRepo } = makeService({
      used: 1,
      payments: [{ status: 'active', planName: 'profissional', expireDate: null }],
    });

    try {
      await service.askQuestion('user-1', { question: 'Como está minha ocupação?' });
      throw new Error('expected AskUrban quota to be blocked');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(error.getResponse()).toMatchObject({
        message: 'Limite diário do Ask Urban atingido',
        reason: 'quota_exceeded',
        usage: {
          canUse: false,
          plan: 'profissional',
          used: 1,
          quota: 1,
          hardCap: 2,
        },
      });
    }

    expect(askRepo.save).not.toHaveBeenCalled();
  });
});
