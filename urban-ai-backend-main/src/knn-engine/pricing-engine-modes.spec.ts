jest.mock('@turf/turf', () => ({
  point: jest.fn(),
  distance: jest.fn(),
}));

import { UrbanAIPricingEngine } from './pricing-engine';
import { PropertyClassifier } from './knn-classifier';
import { DisplacementCostMatrix } from './cost-matrix';
import { TravelTimeEngine } from './isochrone';
import { RuleBasedPricingStrategy } from './strategies/rule-based-pricing.strategy';

function buildEngine(score = 85, travelTime = 10) {
  const classification = { categoryId: 1, categoryName: 'Standard' };
  const classifier = {
    train: jest.fn(),
    classify: jest.fn().mockReturnValue(classification),
    classifyLegacy: jest.fn().mockReturnValue(classification),
    getCategoryName: jest.fn().mockReturnValue('Standard'),
  } as unknown as PropertyClassifier;
  const costMatrix = {
    calculateAttractivityScore: jest.fn().mockResolvedValue({
      score,
      travelTime,
      attractivityLevel: 'Alta Atratividade',
    }),
  } as unknown as DisplacementCostMatrix;
  return { engine: new UrbanAIPricingEngine({} as TravelTimeEngine, classifier, costMatrix), costMatrix };
}

const property = { id: 'p1', lat: -23.55, lng: -46.63 };
const event = { id: 'e1', name: 'Show', lat: -23.55, lng: -46.63, relevancia: 100, dataInicio: '2026-10-28' };
const ctx = { targetDate: '2026-10-28', today: '2026-09-01' };

describe('UrbanAIPricingEngine — PRICING_ENGINE_V2', () => {
  const original = process.env.PRICING_ENGINE_V2;
  afterEach(() => {
    if (original === undefined) delete process.env.PRICING_ENGINE_V2;
    else process.env.PRICING_ENGINE_V2 = original;
  });

  it('default (shadow): número do v1 inalterado + v2 anexado com drivers', async () => {
    delete process.env.PRICING_ENGINE_V2;
    const { engine } = buildEngine();
    const r: any = await engine.suggestPrice(property, event, 100, ctx);
    // v1: 1 + 0,1 + 0,5 + 0,3 + 0,5 = 2,4×
    expect(r.suggestedPrice).toBeCloseTo(240, 2);
    expect(r.details.engineVersion).toBe('pricing-engine-v1');
    expect(r.details.drivers.map((d: any) => d.key)).toEqual([
      'knn_category',
      'event_attractivity',
      'event_travel_time',
      'gemini_relevance',
    ]);
    expect(r.details.shadowV2.suggestedPrice).toBeLessThan(r.suggestedPrice);
    expect(r.details.shadowV2.drivers.length).toBeGreaterThan(0);
  });

  it('PRICING_ENGINE_V2=false: só v1, sem shadow', async () => {
    process.env.PRICING_ENGINE_V2 = 'false';
    const { engine } = buildEngine();
    const r: any = await engine.suggestPrice(property, event, 100, ctx);
    expect(r.suggestedPrice).toBeCloseTo(240, 2);
    expect(r.details.shadowV2).toBeUndefined();
  });

  it('PRICING_ENGINE_V2=true: responde o v2 com drivers e guardrail, mesmo formato externo', async () => {
    process.env.PRICING_ENGINE_V2 = 'true';
    const { engine } = buildEngine();
    const r: any = await engine.suggestPrice(property, event, 100, ctx);
    // +12% proximidade × magnitude 0,5 (porte desconhecido); relevância sem corroboração ignorada
    expect(r.suggestedPrice).toBe(106);
    expect(r.increasePercentage).toBe(6);
    expect(r.details.engineVersion).toBe('pricing-engine-v2.0');
    expect(r.details.guardrail.maxDecreasePercent).toBe(20);
    expect(Object.keys(r)).toEqual(
      expect.arrayContaining(['propertyId', 'eventName', 'basePrice', 'suggestedPrice', 'increasePercentage', 'details']),
    );
    expect(typeof r.details.reasoning).toBe('string');
  });

  it('v2 sem evento recomenda abaixo da base; v1 sem evento continua exigindo evento', async () => {
    const { engine, costMatrix } = buildEngine();
    const v2: any = await engine.suggestPrice(property, null, 200, { ...ctx, mode: 'v2' });
    // 200 × 0,95 × 0,92 = 174,80, mas o piso padrão (occupancy_floor R$180) segura em 180.
    expect(v2.suggestedPrice).toBe(180);
    expect(v2.details.guardrail.capped).toBe('occupancy_floor');
    expect(costMatrix.calculateAttractivityScore).not.toHaveBeenCalled();
    await expect(engine.suggestPrice(property, null, 200, { mode: 'v1' })).rejects.toThrow('Motor v1 exige um evento');
  });

  it('eventV2 dá sinais extras ao v2 sem alterar o v1', async () => {
    const { engine } = buildEngine(60, 40);
    const plain = { name: 'Show', lat: -23.55, lng: -46.63 };
    const r: any = await engine.suggestPrice(property, plain, 100, {
      ...ctx,
      mode: 'shadow',
      eventV2: { ...plain, relevancia: 80, venueCapacity: 40000 },
    });
    expect(r.suggestedPrice).toBeCloseTo(130, 2); // v1: Standard +10% + atratividade média +20%; não viu relevancia
    const gemini = r.details.shadowV2.drivers.find((d: any) => d.key === 'gemini_relevance');
    expect(gemini.applied).toBe(true);
    // 80/100 × 20% = 16%, × 0,5 (proximidade média) = 8%
    expect(gemini.deltaPercent).toBeCloseTo(8, 4);
  });

  it('RuleBasedPricingStrategy repassa o contexto e preserva a tag de estratégia', async () => {
    process.env.PRICING_ENGINE_V2 = 'true';
    const { engine } = buildEngine();
    const strategy = new RuleBasedPricingStrategy(engine);
    const r = await strategy.suggestPrice({ property, event, basePrice: 100, context: ctx } as any);
    expect(r.details.strategy).toBe('rules');
    expect(r.details.engineVersion).toBe('pricing-engine-v2.0');
    expect(Array.isArray(r.details.drivers)).toBe(true);
  });
});
