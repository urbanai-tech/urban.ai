import { AirbnbPricingAttemptLogService } from './airbnb-pricing-attempt-log.service';

function chain(overrides: Record<string, any> = {}) {
  return {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    ...overrides,
  };
}

describe('AirbnbPricingAttemptLogService', () => {
  it('records attempts with normalized defaults and optional relation ids', async () => {
    const repo = {
      create: jest.fn((input) => ({ id: 'attempt-1', ...input })),
      save: jest.fn(async (input) => input),
    };
    const service = new AirbnbPricingAttemptLogService(repo as any);

    const result = await service.recordAttempt({
      listingId: '123',
      userId: 'user-1',
      listId: 'list-1',
      addressId: 'address-1',
      checkIn: '2026-06-01',
      checkOut: '2026-06-03',
      status: 'success',
      durationMs: 1200.4,
      priceTotal: '900.50',
      dailyPrice: 450.25,
      finalUrl: 'https://www.airbnb.com/rooms/123',
      metadata: { nights: 2 },
      startedAt: null,
      finishedAt: null,
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        listingId: '123',
        userId: 'user-1',
        listId: 'list-1',
        addressId: 'address-1',
        source: 'airbnb_headless',
        status: 'success',
        durationMs: 1200,
        priceTotal: 900.5,
        dailyPrice: 450.25,
        currency: 'BRL',
        metadata: { nights: 2 },
      }),
    );
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'attempt-1' }));
    expect(result.id).toBe('attempt-1');
  });

  it('summarizes health by success, failures by reason, duration and pending attempts', async () => {
    const summaryQb = chain({
      getRawOne: jest.fn().mockResolvedValue({
        total: '5',
        successes: '3',
        failures: '1',
        pending: '1',
        avgDurationMs: '1020.6',
        latestAttemptAt: '2026-05-23T10:00:00.000Z',
      }),
    });
    const failuresQb = chain({
      getRawMany: jest.fn().mockResolvedValue([
        {
          reason: 'captcha',
          count: '1',
          avgDurationMs: '2300.2',
          lastSeenAt: '2026-05-23T09:00:00.000Z',
        },
      ]),
    });
    const sourcesQb = chain({
      getRawMany: jest.fn().mockResolvedValue([
        {
          source: 'airbnb_headless',
          total: '5',
          successes: '3',
          failures: '1',
          pending: '1',
          avgDurationMs: '1020.6',
          latestAttemptAt: '2026-05-23T10:00:00.000Z',
        },
      ]),
    });
    const repo = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(summaryQb)
        .mockReturnValueOnce(failuresQb)
        .mockReturnValueOnce(sourcesQb),
      count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
      find: jest.fn().mockResolvedValue([
        {
          id: 'attempt-1',
          listingId: '123',
          userId: null,
          listId: 'list-1',
          addressId: null,
          checkIn: '2026-06-01',
          checkOut: '2026-06-03',
          source: 'airbnb_headless',
          status: 'success',
          reason: null,
          durationMs: 800,
          priceTotal: 900.5,
          dailyPrice: 450.25,
          currency: 'BRL',
          finalUrl: 'https://www.airbnb.com/rooms/123',
          metadata: { nights: 2 },
          startedAt: new Date('2026-05-23T10:00:00.000Z'),
          finishedAt: new Date('2026-05-23T10:00:01.000Z'),
        },
      ]),
    };
    const service = new AirbnbPricingAttemptLogService(repo as any);

    const result = await service.health(12);

    expect(result.windowHours).toBe(12);
    expect(result.health).toBe('amber');
    expect(result.summary).toMatchObject({
      total: 5,
      successes: 3,
      failures: 1,
      pending: 1,
      openPending: 1,
      stalePending: 0,
      avgDurationMs: 1021,
      latestAttemptAt: '2026-05-23T10:00:00.000Z',
    });
    expect(result.failuresByReason).toEqual([
      {
        reason: 'captcha',
        count: 1,
        avgDurationMs: 2300,
        lastSeenAt: '2026-05-23T09:00:00.000Z',
      },
    ]);
    expect(result.sources[0]).toMatchObject({
      source: 'airbnb_headless',
      total: 5,
      successes: 3,
      failures: 1,
      pending: 1,
    });
    expect(result.recent[0]).toMatchObject({
      id: 'attempt-1',
      listingId: '123',
      listId: 'list-1',
      priceTotal: 900.5,
      dailyPrice: 450.25,
      startedAt: '2026-05-23T10:00:00.000Z',
    });
  });
});
