import {
  getEnvKeys,
  getEnvPriceId,
  isBillingCycle,
  resolveStripePriceId,
} from './stripe-price-id.resolver';

describe('stripe-price-id.resolver', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('recognizes the supported Urban AI billing cycles', () => {
    expect(isBillingCycle('monthly')).toBe(true);
    expect(isBillingCycle('quarterly')).toBe(true);
    expect(isBillingCycle('semestral')).toBe(true);
    expect(isBillingCycle('annual')).toBe(true);
    expect(isBillingCycle('weekly')).toBe(false);
    expect(isBillingCycle(null)).toBe(false);
  });

  it('prefers Price IDs stored on the Plan entity over env fallbacks', () => {
    process.env.PROFISSIONAL_PRICE_QUARTERLY = 'price_env_quarterly';

    const result = resolveStripePriceId(
      {
        name: 'profissional',
        stripePriceIdQuarterly: 'price_plan_quarterly',
      },
      'quarterly',
    );

    expect(result).toEqual({
      priceId: 'price_plan_quarterly',
      source: 'plan-entity',
    });
  });

  it('falls back to plan-scoped env keys when the Plan row is not fully configured', () => {
    process.env.PROFISSIONAL_PRICE_SEMESTRAL = 'price_env_semestral';

    expect(resolveStripePriceId({ name: 'profissional' }, 'semestral')).toEqual({
      priceId: 'price_env_semestral',
      source: 'env-fallback',
    });
  });

  it('supports legacy monthly and annual env keys for old checkout configuration', () => {
    process.env.MENSAL_PLAN = 'price_legacy_monthly';
    process.env.ANUAL_PLAN = 'price_legacy_annual';

    expect(resolveStripePriceId(null, 'monthly')).toEqual({
      priceId: 'price_legacy_monthly',
      source: 'env-fallback',
    });
    expect(resolveStripePriceId(undefined, 'annual')).toEqual({
      priceId: 'price_legacy_annual',
      source: 'env-fallback',
    });
  });

  it('normalizes plan names before looking up plan-scoped env keys', () => {
    process.env.PROFISSIONAL_PLUS_PRICE_MONTHLY = 'price_env_plus';

    expect(getEnvKeys('Profissional Plus!', 'monthly')).toEqual([
      'PROFISSIONAL_PLUS_PRICE_MONTHLY',
      'PROFISSIONAL_PLUS_MENSAL_PLAN',
      'MENSAL_PLAN',
    ]);
    expect(getEnvPriceId('Profissional Plus!', 'monthly')).toBe('price_env_plus');
  });

  it('reports missing when no entity or env Price ID exists', () => {
    delete process.env.STARTER_PRICE_QUARTERLY;

    expect(resolveStripePriceId({ name: 'starter' }, 'quarterly')).toEqual({
      priceId: null,
      source: 'missing',
    });
  });

  it('maps every entity field, including legacy monthly and annual fallbacks', () => {
    expect(resolveStripePriceId({ stripePriceId: ' price_monthly_legacy ' }, 'monthly')).toEqual({
      priceId: 'price_monthly_legacy',
      source: 'plan-entity',
    });
    expect(resolveStripePriceId({ stripePriceIdQuarterly: 'price_quarterly' }, 'quarterly')).toEqual({
      priceId: 'price_quarterly',
      source: 'plan-entity',
    });
    expect(resolveStripePriceId({ stripePriceIdSemestral: 'price_semestral' }, 'semestral')).toEqual({
      priceId: 'price_semestral',
      source: 'plan-entity',
    });
    expect(resolveStripePriceId({ stripePriceIdAnnual: 'price_annual_legacy' }, 'annual')).toEqual({
      priceId: 'price_annual_legacy',
      source: 'plan-entity',
    });
  });

  it('builds scoped and legacy key lists for every cycle and blank plan names', () => {
    expect(getEnvKeys('Starter', 'quarterly')).toEqual(['STARTER_PRICE_QUARTERLY']);
    expect(getEnvKeys('Starter', 'semestral')).toEqual(['STARTER_PRICE_SEMESTRAL']);
    expect(getEnvKeys('Starter', 'annual')).toEqual([
      'STARTER_PRICE_ANNUAL',
      'STARTER_ANUAL_PLAN',
      'ANUAL_PLAN',
    ]);
    expect(getEnvKeys(' --- ', 'monthly')).toEqual(['MENSAL_PLAN']);
  });

  it('skips blank environment values before selecting the next configured key', () => {
    process.env.STARTER_PRICE_ANNUAL = '   ';
    process.env.STARTER_ANUAL_PLAN = ' price_scoped_annual ';

    expect(getEnvPriceId('starter', 'annual')).toBe('price_scoped_annual');
  });
});
