import { clampRadiusKm, parseEnabledSources, resolveMarketConfig } from './market-config';

describe('resolveMarketConfig', () => {
  it('padrões seguros sem nenhuma env: 3 fontes de dados, scraping desligado, mínimos 5 e 8', () => {
    const config = resolveMarketConfig({});
    expect(Array.from(config.enabledSources).sort()).toEqual(['customers', 'inside_airbnb', 'licensed_dataset']);
    expect(config.scrapingEnabled).toBe(false);
    expect(config.minHosts).toBe(5);
    expect(config.minExternalListings).toBe(8);
    expect(config.engineSignalEnabled).toBe(false);
    expect(config.defaultRadiusKm).toBe(3);
  });

  it('own_scraping em MARKET_SOURCES não liga sem MARKET_SCRAPING_ENABLED=true', () => {
    const off = resolveMarketConfig({ MARKET_SOURCES: 'customers,own_scraping' });
    expect(off.enabledSources.has('own_scraping')).toBe(false);
    const on = resolveMarketConfig({ MARKET_SOURCES: 'customers,own_scraping', MARKET_SCRAPING_ENABLED: 'true' });
    expect(on.enabledSources.has('own_scraping')).toBe(true);
    // a flag sozinha também não basta: a fonte precisa estar listada
    expect(resolveMarketConfig({ MARKET_SCRAPING_ENABLED: 'true' }).enabledSources.has('own_scraping')).toBe(false);
  });

  it('customers nunca some e ids inválidos são ignorados', () => {
    expect(Array.from(parseEnabledSources('inside_airbnb,xyz'))).toEqual(['customers', 'inside_airbnb']);
  });

  it('aplica pisos de privacidade (3 anfitriões, 5 anúncios) e aceita valores maiores', () => {
    expect(resolveMarketConfig({ MARKET_INTEL_MIN_GROUP_SIZE: '1', MARKET_EXTERNAL_MIN_LISTINGS: '2' })).toMatchObject({
      minHosts: 3,
      minExternalListings: 5,
    });
    expect(resolveMarketConfig({ MARKET_INTEL_MIN_GROUP_SIZE: '7', MARKET_EXTERNAL_MIN_LISTINGS: '20' })).toMatchObject({
      minHosts: 7,
      minExternalListings: 20,
    });
  });

  it('idade máxima inválida cai no padrão', () => {
    expect(resolveMarketConfig({ MARKET_EXTERNAL_MAX_AGE_DAYS: 'abc' }).externalMaxAgeDays).toBe(548);
    expect(resolveMarketConfig({ MARKET_EXTERNAL_MAX_AGE_DAYS: '0' }).externalMaxAgeDays).toBe(548);
    expect(resolveMarketConfig({ MARKET_EXTERNAL_MAX_AGE_DAYS: '90' }).externalMaxAgeDays).toBe(90);
  });
});

describe('clampRadiusKm', () => {
  const config = { defaultRadiusKm: 3, minRadiusKm: 1, maxRadiusKm: 5 };
  it('limita a 1–5 km e usa o padrão quando ausente ou inválido', () => {
    expect(clampRadiusKm(undefined, config)).toBe(3);
    expect(clampRadiusKm('abc', config)).toBe(3);
    expect(clampRadiusKm('0.2', config)).toBe(1);
    expect(clampRadiusKm('9', config)).toBe(5);
    expect(clampRadiusKm('2.5', config)).toBe(2.5);
    expect(clampRadiusKm(4, config)).toBe(4);
  });
});
