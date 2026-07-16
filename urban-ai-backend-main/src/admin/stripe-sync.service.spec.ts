const mockStripePricesRetrieve = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    prices: { retrieve: mockStripePricesRetrieve },
  }));
});

import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { Plan } from '../entities/plan.entity';
import { StripeSyncCheckService } from './stripe-sync.service';

type Repo<T> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('StripeSyncCheckService', () => {
  let service: StripeSyncCheckService;
  let repo: Repo<Plan>;

  beforeEach(async () => {
    jest.clearAllMocks();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.PROFISSIONAL_PRICE_QUARTERLY;

    repo = {
      find: jest.fn().mockResolvedValue([
        {
          name: 'profissional',
          isCustomPrice: false,
          stripePriceIdMonthly: 'price_monthly',
          stripePriceIdQuarterly: '',
          stripePriceIdSemestral: '',
          stripePriceIdAnnualNew: 'price_annual',
        },
        {
          name: 'escala',
          isCustomPrice: true,
        },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeSyncCheckService,
        { provide: getRepositoryToken(Plan), useValue: repo },
      ],
    }).compile();

    service = module.get<StripeSyncCheckService>(StripeSyncCheckService);
  });

  it('reports not-configured entries without calling Stripe when the API key is absent', async () => {
    const result = await service.check();

    expect(result.summary.stripeKeyConfigured).toBe(false);
    expect(result.summary.notConfigured).toBe(2);
    expect(result.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cycle: 'monthly', status: 'not-configured' }),
        expect.objectContaining({ cycle: 'annual', status: 'not-configured' }),
        expect.objectContaining({ cycle: 'quarterly', status: 'missing' }),
        expect.objectContaining({ cycle: 'semestral', status: 'missing' }),
      ]),
    );
    expect(mockStripePricesRetrieve).not.toHaveBeenCalled();
  });

  it('uses env fallback for a missing cycle Price ID', async () => {
    process.env.PROFISSIONAL_PRICE_QUARTERLY = 'price_env_quarterly';

    const result = await service.check();

    expect(result.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cycle: 'quarterly',
          priceId: 'price_env_quarterly',
          source: 'env-fallback',
          status: 'not-configured',
        }),
      ]),
    );
  });

  it('reconciles active, interval, currency and lifecycle metadata from mocked Stripe prices', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    repo.find!.mockResolvedValue([
      {
        name: 'profissional',
        isCustomPrice: false,
        stripePriceIdMonthly: 'price_monthly',
        stripePriceIdQuarterly: 'price_quarterly',
        stripePriceIdSemestral: 'price_semestral',
        stripePriceIdAnnualNew: 'price_annual',
      },
    ]);
    mockStripePricesRetrieve.mockImplementation(async (priceId: string) => {
      const base = { id: priceId, unit_amount: 29700, currency: 'brl', active: true };
      if (priceId === 'price_monthly') {
        return { ...base, recurring: { interval: 'month', interval_count: 1 } };
      }
      if (priceId === 'price_quarterly') {
        return { ...base, active: false, recurring: { interval: 'month', interval_count: 3 } };
      }
      if (priceId === 'price_semestral') {
        return { ...base, currency: 'usd', recurring: { interval: 'month', interval_count: 6 } };
      }
      return { ...base, recurring: { interval: 'month', interval_count: 12 } };
    });

    const result = await service.check();

    expect(result.summary).toMatchObject({ total: 4, ok: 1, problems: 3 });
    expect(result.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cycle: 'monthly', status: 'ok' }),
        expect.objectContaining({ cycle: 'quarterly', status: 'inactive' }),
        expect.objectContaining({ cycle: 'semestral', status: 'currency-mismatch' }),
        expect.objectContaining({ cycle: 'annual', status: 'cycle-mismatch' }),
      ]),
    );
  });

  it('maps mocked remote reconciliation failures without throwing the whole report', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    repo.find!.mockResolvedValue([
      {
        name: 'profissional',
        isCustomPrice: false,
        stripePriceIdMonthly: 'price_missing_remote',
        stripePriceIdAnnualNew: 'price_error_remote',
      },
    ]);
    mockStripePricesRetrieve.mockImplementation(async (priceId: string) => {
      if (priceId === 'price_missing_remote') {
        throw { code: 'resource_missing', message: 'No such price' };
      }
      throw new Error('temporary network failure');
    });

    const result = await service.check();

    expect(result.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cycle: 'monthly', status: 'not-found' }),
        expect.objectContaining({ cycle: 'annual', status: 'check-error' }),
      ]),
    );
    expect(result.summary.problems).toBe(2);
  });
});
