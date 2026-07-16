import { AdminStaysHealthService } from './admin-stays-health.service';

function rawQuery(rows: Array<{ status: string; count: string }>) {
  return {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  };
}

describe('AdminStaysHealthService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.STAYS_API_BASE_URL;
    delete process.env.STAYS_TOKEN_ENCRYPTION_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('preserves readiness, aggregates and the recent push projection', async () => {
    const accountQb = rawQuery([{ status: 'active', count: '1' }]);
    const pushQb = rawQuery([{ status: 'success', count: '2' }]);
    const createdAt = new Date('2026-07-15T12:00:00.000Z');
    const priceUpdateRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(pushQb),
      find: jest.fn().mockResolvedValue([
        {
          id: 'push-1',
          targetDate: '2026-07-20',
          previousPriceCents: 10000,
          newPriceCents: 12000,
          origin: 'ai_auto',
          status: 'success',
          errorMessage: null,
          createdAt,
          user: { id: 'user-1' },
          listing: { id: 'listing-1' },
        },
      ]),
    };
    const staysListingRepo = {
      count: jest.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(2).mockResolvedValueOnce(1),
    };
    const service = new AdminStaysHealthService(
      priceUpdateRepo as any,
      { createQueryBuilder: jest.fn().mockReturnValue(accountQb) } as any,
      staysListingRepo as any,
    );

    await expect(service.getHealth()).resolves.toEqual({
      readiness: {
        apiBaseConfigured: false,
        tokenEncryptionConfigured: false,
        betaPrivate: true,
        missingEnv: ['STAYS_API_BASE_URL', 'STAYS_TOKEN_ENCRYPTION_KEY'],
      },
      accountsByStatus: [{ status: 'active', count: 1 }],
      listings: { total: 3, active: 2, forcedAuto: 1 },
      pushLast30d: [{ status: 'success', count: 2 }],
      recent: [
        {
          id: 'push-1',
          targetDate: '2026-07-20',
          previousPriceCents: 10000,
          newPriceCents: 12000,
          origin: 'ai_auto',
          status: 'success',
          errorMessage: null,
          createdAt,
          userId: 'user-1',
          listingId: 'listing-1',
        },
      ],
    });

    expect(staysListingRepo.count).toHaveBeenNthCalledWith(2, {
      where: { active: true },
    });
    expect(staysListingRepo.count).toHaveBeenNthCalledWith(3, {
      where: { operationMode: 'auto' },
    });
  });
});
