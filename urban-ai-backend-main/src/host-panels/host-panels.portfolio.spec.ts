import { BadRequestException } from '@nestjs/common';
import { HostPanelsService } from './host-panels.service';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeQueryBuilder(result: unknown[] = []) {
  return {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(result),
  };
}

function makeService(input: {
  addresses?: any[];
  analyses?: any[];
  user?: any;
} = {}) {
  const queryBuilder = makeQueryBuilder(input.analyses ?? []);
  const addressRepo = {
    find: jest.fn().mockResolvedValue(input.addresses ?? []),
  };
  const listRepo = {
    save: jest.fn(async (entity) => entity),
  };
  const userRepo = {
    findOne: jest.fn().mockResolvedValue(input.user ?? { id: 'user-1', pricingStrategy: 'balanced' }),
    save: jest.fn(async (entity) => entity),
  };
  const portfolioSettingRepo = {
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((entity) => ({ id: 'setting-1', metadata: null, ...entity })),
    save: jest.fn(async (entity) => entity),
  };
  const portfolioOverrideRepo = {
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((entity) => ({ id: 'override-1', metadata: null, ...entity })),
    save: jest.fn(async (entity) => entity),
  };
  const portfolioRunRepo = {
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((entity) => ({ id: '11111111-1111-4111-8111-111111111111', ...entity })),
    save: jest.fn(async (entity) => entity),
  };
  const portfolioItemRepo = {
    create: jest.fn((entity) => entity),
    save: jest.fn(async (entities) => entities),
  };
  const analiseRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    save: jest.fn(async (entities) => entities),
  };

  const service = new HostPanelsService(
    addressRepo as any,
    listRepo as any,
    userRepo as any,
    {} as any,
    analiseRepo as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    portfolioSettingRepo as any,
    portfolioOverrideRepo as any,
    portfolioRunRepo as any,
    portfolioItemRepo as any,
    {} as any,
  );

  return {
    service,
    listRepo,
    userRepo,
    portfolioSettingRepo,
    portfolioOverrideRepo,
    portfolioRunRepo,
    portfolioItemRepo,
    queryBuilder,
  };
}

describe('HostPanelsService portfolio cockpit contracts', () => {
  it('limits portfolio calendar to the 360-day cockpit window and keeps the day shape stable', async () => {
    const address = {
      id: 'address-1',
      list: {
        id: 'listing-1',
        titulo: 'Studio Vila Mariana',
        pictureUrl: 'https://example.com/studio.jpg',
        manualDailyPrice: 320,
      },
    };
    const event = {
      id: 'event-1',
      nome: 'Grande Premio de Sao Paulo',
      dataInicio: new Date('2026-06-12T20:00:00.000Z'),
      relevancia: 92,
      expectedAttendance: 65000,
    };
    const analysis = {
      endereco: address,
      evento: event,
      precoSugerido: 850.49,
      criadoEm: new Date('2026-05-20T12:00:00.000Z'),
    };
    const { service, queryBuilder } = makeService({
      addresses: [address],
      analyses: [analysis],
    });

    const result = await service.portfolioCalendar('user-1', {
      from: '2026-01-01',
      to: '2026-12-31',
    });

    expect(result.range).toEqual({ from: '2026-01-01', to: '2026-12-26', days: 360 });
    expect(result.properties).toHaveLength(1);
    expect(result.properties[0]).toMatchObject({
      propertyId: 'address-1',
      name: 'Studio Vila Mariana',
      thumbnail: 'https://example.com/studio.jpg',
      strategy: 'balanced',
      strategyMetadata: {
        strategy: 'balanced',
        source: 'user_default',
        adjustmentPercent: 0,
        multiplier: 1,
      },
    });
    expect(result.properties[0].days).toHaveLength(360);
    expect(result.properties[0].days[0]).toMatchObject({
      date: '2026-01-01',
      sugestao: null,
      sugestaoOriginal: null,
      atual: 320,
      base: 320,
      override: null,
      lift: 0,
      risk: 'baixa',
      confidence: 'baixa',
      evento: null,
    });
    expect(result.properties[0].days.find((day) => day.date === '2026-06-12')).toMatchObject({
      date: '2026-06-12',
      sugestao: 850,
      sugestaoOriginal: 850,
      atual: 320,
      base: 320,
      override: null,
      lift: 530,
      risk: 'alta',
      confidence: 'alta',
      strategyApplied: {
        strategy: 'balanced',
        source: 'user_default',
        originalPrice: 850,
        adjustedPrice: 850,
      },
      evento: {
        id: 'event-1',
        nome: 'Grande Premio de Sao Paulo',
        impacto: 'alta',
      },
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('address.id IN (:...addressIds)', {
      addressIds: ['address-1'],
    });
  });

  it('simulates set-date-price as a preview without persisting an action run', async () => {
    const address = {
      id: 'address-1',
      list: { id: 'listing-1', titulo: 'Studio Vila Mariana', manualDailyPrice: 320 },
    };
    const { service, portfolioRunRepo, portfolioItemRepo } = makeService({ addresses: [address] });

    const result = await service.simulatePortfolioAction('user-1', {
      propertyIds: ['address-1'],
      action: 'set-date-price',
      payload: { price: 410 },
      dates: ['2026-06-12', '2026-06-13'],
    });

    expect(result.simulated).toBe(true);
    expect(result.action).toBe('set-date-price');
    expect(result.items).toHaveLength(2);
    expect(result.summary).toMatchObject({
      applied: 2,
      failed: 0,
      affectedProperties: 1,
      affectedDates: 2,
      estimatedLift: 180,
    });
    expect(portfolioRunRepo.save).not.toHaveBeenCalled();
    expect(portfolioItemRepo.save).not.toHaveBeenCalled();
  });

  it('normalizes apply-strategy bulk action and returns an auditable action run id', async () => {
    const user = { id: 'user-1', pricingStrategy: 'balanced' };
    const address = {
      id: 'address-1',
      list: { id: 'listing-1', titulo: 'Studio Vila Mariana' },
    };
    const { service, portfolioSettingRepo, portfolioRunRepo, portfolioItemRepo } = makeService({
      addresses: [address],
      user,
    });

    const result = await service.portfolioBulkAction('user-1', {
      propertyIds: ['address-1', 'listing-1', 'address-1'],
      action: 'apply-strategy',
      payload: { strategy: 'agressiva' },
    });

    expect(portfolioSettingRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        strategy: 'aggressive',
        user,
        address,
      }),
    );
    expect(portfolioRunRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        completedAt: expect.any(Date),
      }),
    );
    expect(portfolioItemRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId: 'address-1',
        action: 'apply-strategy',
        status: 'applied',
        after: expect.objectContaining({ strategy: 'aggressive' }),
      }),
    );
    expect(result).toMatchObject({
      applied: 1,
      failed: [],
      auditLogId: '11111111-1111-4111-8111-111111111111',
      summary: {
        applied: 1,
        failed: 0,
        affectedProperties: 1,
        affectedDates: 0,
        estimatedLift: 0,
      },
    });
    expect(result.auditLogId).toMatch(uuidPattern);
  });

  it('rejects invalid bulk actions before mutating portfolio state', async () => {
    const address = {
      id: 'address-1',
      list: { id: 'listing-1', titulo: 'Studio Vila Mariana' },
    };
    const { service, portfolioSettingRepo, portfolioRunRepo } = makeService({ addresses: [address] });

    await expect(
      service.portfolioBulkAction('user-1', {
        propertyIds: ['address-1'],
        action: 'apply-strategy',
        payload: { strategy: 'turbo' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(portfolioSettingRepo.save).not.toHaveBeenCalled();
    expect(portfolioRunRepo.save).not.toHaveBeenCalled();
  });

  it('uses explicit property/date targets without expanding to a property-date matrix', async () => {
    const addressA = {
      id: 'address-1',
      list: { id: 'listing-1', titulo: 'Studio Vila Mariana', manualDailyPrice: 320 },
    };
    const addressB = {
      id: 'address-2',
      list: { id: 'listing-2', titulo: 'Loft Pinheiros', manualDailyPrice: 410 },
    };
    const { service, portfolioOverrideRepo } = makeService({ addresses: [addressA, addressB] });

    const result = await service.portfolioBulkAction('user-1', {
      propertyIds: ['address-1', 'address-2'],
      action: 'set-date-price',
      payload: {
        price: 520,
        targets: [
          { propertyId: 'address-1', date: '2026-06-12' },
          { propertyId: 'address-2', date: '2026-06-14' },
        ],
      },
      dates: ['2026-06-12', '2026-06-14'],
    });

    expect(portfolioOverrideRepo.save).toHaveBeenCalledTimes(2);
    expect(portfolioOverrideRepo.save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        address: addressA,
        targetDate: '2026-06-12',
        price: 520,
      }),
    );
    expect(portfolioOverrideRepo.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        address: addressB,
        targetDate: '2026-06-14',
        price: 520,
      }),
    );
    expect(result.summary).toMatchObject({
      applied: 2,
      affectedProperties: 2,
      affectedDates: 2,
    });
  });

  it('surfaces action-run counters from persisted summaries', async () => {
    const { service, portfolioRunRepo } = makeService();
    portfolioRunRepo.find.mockResolvedValue([
      {
        id: 'run-1',
        action: 'set-date-price',
        status: 'completed',
        selectedPropertyIds: ['address-1'],
        targetDates: ['2026-06-12'],
        payload: {},
        summary: {
          applied: 2,
          failed: 1,
          items: 3,
          affectedProperties: 1,
          affectedDates: 2,
          estimatedLift: 180,
        },
        createdAt: new Date('2026-05-24T12:00:00.000Z'),
        completedAt: new Date('2026-05-24T12:01:00.000Z'),
      },
    ]);

    const result = await service.portfolioActionRuns('user-1', { limit: 8 });

    expect(result.runs[0]).toMatchObject({
      id: 'run-1',
      auditLogId: 'run-1',
      actionRunId: 'run-1',
      applied: 2,
      failed: 1,
    });
  });
});
