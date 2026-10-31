jest.mock('@turf/turf', () => ({
  point: jest.fn(),
  distance: jest.fn(),
}));

import { MarketSignalV2 } from '../market-data/market-signal';
import { DisplacementCostMatrix } from './cost-matrix';
import { TravelTimeEngine } from './isochrone';
import { PropertyClassifier } from './knn-classifier';
import { UrbanAIPricingEngine } from './pricing-engine';
import { computePriceV2 } from './pricing-engine-v2';

const market: MarketSignalV2 = {
  version: 1,
  percentile: 30,
  medianAdr: 340,
  p25Adr: 280,
  p75Adr: 400,
  priceVsMedian: 0.88,
  sampleSize: 21,
  radiusKm: 3,
  sources: [
    { source: 'customers', listings: 5, latestCollectedAt: '2026-10-20' },
    { source: 'licensed_dataset', listings: 16, latestCollectedAt: '2026-10-01' },
  ],
  medianOccupancy: 0.7,
  trend30dPercentilePoints: -4,
  trend30dMedianAdrChangePct: 3.5,
  eventUpliftPct: 18,
  generatedAt: '2026-10-31T12:00:00.000Z',
};

const event = { name: 'Show', lat: -23.55, lng: -46.63, relevancia: 100, dataInicio: '2026-10-28' };
const attractivity = { score: 85, travelTime: 10 };
const baseContext = { targetDate: '2026-10-28', today: '2026-09-01' };

describe('insumo de mercado no motor v2 (somente em sombra, ADR 0028)', () => {
  it('o sinal vira um driver informativo (peso 0) e NÃO altera o preço do v2', () => {
    const without = computePriceV2({ basePrice: 300, event, attractivity, context: baseContext });
    const withMarket = computePriceV2({ basePrice: 300, event, attractivity, context: { ...baseContext, market } });

    expect(withMarket.suggestedPrice).toBe(without.suggestedPrice);
    expect(withMarket.multiplier).toBe(without.multiplier);
    const driver = withMarket.drivers.find((d) => d.key === 'market_position');
    expect(driver).toMatchObject({ source: 'market', weight: 0, deltaPercent: 0, applied: false });
    expect(driver?.label).toContain('percentil 30');
    expect(driver?.explanation).toContain('R$340');
    expect(driver?.explanation).toContain('21 anúncios');
    expect(driver?.explanation).toMatch(/Não altera o preço/);
    expect(without.drivers.some((d) => d.key === 'market_position')).toBe(false);
  });

  describe('UrbanAIPricingEngine', () => {
    function buildEngine() {
      const classification = { categoryId: 1, categoryName: 'Standard' };
      const classifier = {
        train: jest.fn(),
        classify: jest.fn().mockReturnValue(classification),
        classifyLegacy: jest.fn().mockReturnValue(classification),
        getCategoryName: jest.fn().mockReturnValue('Standard'),
      } as unknown as PropertyClassifier;
      const costMatrix = {
        calculateAttractivityScore: jest.fn().mockResolvedValue({ score: 85, travelTime: 10, attractivityLevel: 'Alta' }),
      } as unknown as DisplacementCostMatrix;
      return new UrbanAIPricingEngine({} as TravelTimeEngine, classifier, costMatrix);
    }
    const property = { id: 'p1', lat: -23.55, lng: -46.63 };
    const ev = { id: 'e1', name: 'Show', lat: -23.55, lng: -46.63, relevancia: 100, dataInicio: '2026-10-28' };

    it('em shadow: v1 idêntico com ou sem sinal; o sinal aparece só em details.shadowV2.market', async () => {
      const engine = buildEngine();
      const plain: any = await engine.suggestPrice(property, ev, 100, { ...baseContext, mode: 'shadow' });
      const withMarket: any = await engine.suggestPrice(property, ev, 100, { ...baseContext, mode: 'shadow', market });

      expect(withMarket.suggestedPrice).toBe(plain.suggestedPrice);
      expect(withMarket.details.drivers).toEqual(plain.details.drivers); // drivers do v1 intactos
      expect(withMarket.details.shadowV2.suggestedPrice).toBe(plain.details.shadowV2.suggestedPrice);
      expect(withMarket.details.shadowV2.market).toEqual(market);
      expect(plain.details.shadowV2.market).toBeUndefined();
    });

    it('no modo v1 o sinal é ignorado por completo', async () => {
      const engine = buildEngine();
      const r: any = await engine.suggestPrice(property, ev, 100, { ...baseContext, mode: 'v1', market });
      expect(r.details.shadowV2).toBeUndefined();
      expect(JSON.stringify(r)).not.toContain('market_position');
    });
  });
});
