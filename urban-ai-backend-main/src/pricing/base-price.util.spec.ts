import { hasUsableBasePrice, resolveUsableBaseDailyPrice } from './base-price.util';

describe('base-price.util', () => {
  it('accepts manual base prices regardless of automatic source', () => {
    const list = {
      manualDailyPrice: 150,
      dailyPrice: 999,
      pricingInputSource: 'snapshot_self_cron',
    };

    expect(hasUsableBasePrice(list)).toBe(true);
    expect(resolveUsableBaseDailyPrice(list)).toBe(150);
  });

  it('accepts trusted Airbnb observations', () => {
    const list = {
      manualDailyPrice: null,
      dailyPrice: 435.5,
      pricingInputSource: 'airbnb_headless_observation',
    };

    expect(hasUsableBasePrice(list)).toBe(true);
    expect(resolveUsableBaseDailyPrice(list)).toBe(435.5);
  });

  it('rejects provisional snapshot prices', () => {
    const list = {
      manualDailyPrice: null,
      dailyPrice: 150,
      raw: 150,
      pricingInputSource: 'snapshot_self_cron',
    };

    expect(hasUsableBasePrice(list)).toBe(false);
    expect(resolveUsableBaseDailyPrice(list)).toBeNull();
  });
});
