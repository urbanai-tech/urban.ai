import { selectBaselinePrice } from './baseline-price.util';
import { resolveUsableBaseDailyPrice } from './base-price.util';

describe('selectBaselinePrice (plano B do scraping)', () => {
  const now = new Date('2026-10-26T12:00:00.000Z');
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

  it('usa a leitura do Airbnb quando é a única origem e está fresca', () => {
    const result = selectBaselinePrice(
      { dailyPrice: 420, pricingInputSource: 'airbnb_search_checkout', pricingInputsUpdatedAt: daysAgo(2) },
      now,
    );
    expect(result).toMatchObject({ dailyPrice: 420, source: 'airbnb', stale: false, reason: 'airbnb_only' });
  });

  it('marca como velha (stale) a leitura do Airbnb fora da janela quando não há valor do anfitrião', () => {
    const result = selectBaselinePrice(
      { dailyPrice: 420, pricingInputSource: 'airbnb_checkout', pricingInputsUpdatedAt: daysAgo(40) },
      now,
    );
    expect(result).toMatchObject({ dailyPrice: 420, source: 'airbnb', stale: true });
  });

  it('trata leitura do Airbnb sem data como velha, mas ainda utilizável', () => {
    const result = selectBaselinePrice({ dailyPrice: 300, pricingInputSource: 'airbnb_checkout' }, now);
    expect(result).toMatchObject({ dailyPrice: 300, source: 'airbnb', stale: true, updatedAt: null });
  });

  it('usa o valor do anfitrião quando a leitura do Airbnb está ausente', () => {
    const hostAt = daysAgo(1);
    const result = selectBaselinePrice(
      { manualDailyPrice: 350, hostInputUpdatedAt: hostAt, pricingInputSource: 'host_input', dailyPrice: 350 },
      now,
    );
    expect(result).toMatchObject({ dailyPrice: 350, source: 'host_input', reason: 'host_input_only', updatedAt: hostAt });
  });

  it('o valor do anfitrião vence a leitura velha do Airbnb', () => {
    const result = selectBaselinePrice(
      {
        manualDailyPrice: 350,
        hostInputUpdatedAt: daysAgo(30),
        dailyPrice: 500,
        pricingInputSource: 'airbnb_checkout',
        pricingInputsUpdatedAt: daysAgo(20),
      },
      now,
    );
    expect(result).toMatchObject({ dailyPrice: 350, source: 'host_input', reason: 'host_input_airbnb_stale' });
  });

  it('o valor do anfitrião mais novo vence a leitura fresca do Airbnb', () => {
    const result = selectBaselinePrice(
      {
        manualDailyPrice: 350,
        hostInputUpdatedAt: daysAgo(1),
        dailyPrice: 500,
        pricingInputSource: 'airbnb_checkout',
        pricingInputsUpdatedAt: daysAgo(5),
      },
      now,
    );
    expect(result).toMatchObject({ dailyPrice: 350, source: 'host_input', reason: 'host_input_newer' });
  });

  it('a leitura fresca e mais nova do Airbnb vence um valor antigo do anfitrião', () => {
    const result = selectBaselinePrice(
      {
        manualDailyPrice: 350,
        hostInputUpdatedAt: daysAgo(9),
        dailyPrice: 500,
        pricingInputSource: 'airbnb_checkout',
        pricingInputsUpdatedAt: daysAgo(1),
      },
      now,
    );
    expect(result).toMatchObject({ dailyPrice: 500, source: 'airbnb', stale: false, reason: 'airbnb_fresh_newer' });
  });

  it('linha antiga com fonte manual usa pricingInputsUpdatedAt como data do anfitrião', () => {
    const result = selectBaselinePrice(
      { manualDailyPrice: 200, pricingInputSource: 'manual', pricingInputsUpdatedAt: daysAgo(3) },
      now,
    );
    expect(result).toMatchObject({ source: 'host_input', updatedAt: daysAgo(3) });
  });

  it('devolve nulo quando não há nenhuma diária utilizável (fonte provisória não conta)', () => {
    expect(selectBaselinePrice({}, now)).toMatchObject({ dailyPrice: null, source: null, reason: 'none' });
    expect(
      selectBaselinePrice({ dailyPrice: 150, pricingInputSource: 'snapshot_self_cron' }, now),
    ).toMatchObject({ dailyPrice: null, source: null });
  });

  it('resolveUsableBaseDailyPrice delega para a seleção e aceita a fonte host_input', () => {
    expect(
      resolveUsableBaseDailyPrice(
        { manualDailyPrice: 275, pricingInputSource: 'host_input', hostInputUpdatedAt: new Date() },
      ),
    ).toBe(275);
    expect(resolveUsableBaseDailyPrice({ dailyPrice: 99, pricingInputSource: 'host_input' })).toBe(99);
  });
});
