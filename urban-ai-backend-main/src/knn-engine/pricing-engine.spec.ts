// Mock @turf/turf antes de qualquer import transitivo — turf puxa kdbush (ESM)
// que o ts-jest não transforma por default.
jest.mock('@turf/turf', () => ({
  point: jest.fn(),
  distance: jest.fn(),
}));

import { UrbanAIPricingEngine } from './pricing-engine';
import { TravelTimeEngine } from './isochrone';
import { PropertyClassifier } from './knn-classifier';
import { DisplacementCostMatrix } from './cost-matrix';

/**
 * Testes unitários dos multiplicadores de preço. Mockamos classifier e
 * costMatrix para validar o comportamento matemático do engine em isolamento,
 * sem envolver ml-knn ou turf.
 */
describe('UrbanAIPricingEngine — suggestPrice', () => {
  const baseProperty = { id: 'p1', lat: -23.55, lng: -46.63 };
  const baseEvent = { id: 'e1', name: 'Show de teste', lat: -23.55, lng: -46.63 };
  const basePrice = 100;

  function buildEngine(overrides: {
    categoryId?: number;
    attractivityScore?: number;
    travelTime?: number;
    attractivityLevel?: string;
  }) {
    const classifier = {
      train: jest.fn(),
      classify: jest.fn().mockReturnValue({
        categoryId: overrides.categoryId ?? 1,
        categoryName: ['Econômico', 'Standard', 'Premium'][overrides.categoryId ?? 1],
      }),
      getCategoryName: jest.fn(),
    } as unknown as PropertyClassifier;

    const costMatrix = {
      calculateAttractivityScore: jest.fn().mockResolvedValue({
        score: overrides.attractivityScore ?? 40,
        travelTime: overrides.travelTime ?? 30,
        attractivityLevel: overrides.attractivityLevel ?? 'Média',
      }),
    } as unknown as DisplacementCostMatrix;

    const travelEngine = {} as TravelTimeEngine;
    return new UrbanAIPricingEngine(travelEngine, classifier, costMatrix);
  }

  it('baseline (Standard, low attractivity, long travel) keeps price near base', async () => {
    const engine = buildEngine({ categoryId: 1, attractivityScore: 40, travelTime: 30 });

    const result = await engine.suggestPrice(baseProperty, baseEvent, basePrice);

    // Standard (+10%), no attractivity boost, no travel boost, no relevancia = 1.10×
    expect(result.suggestedPrice).toBeCloseTo(110, 1);
    expect(result.increasePercentage).toBe(10);
  });

  it('Premium category adds +20%', async () => {
    const engine = buildEngine({ categoryId: 2, attractivityScore: 40, travelTime: 30 });

    const result = await engine.suggestPrice(baseProperty, baseEvent, basePrice);

    expect(result.suggestedPrice).toBeCloseTo(120, 1);
    expect(result.details.classification).toBe('Premium');
  });

  it('Econômico category adds no category boost (category 0 gets 0)', async () => {
    const engine = buildEngine({ categoryId: 0, attractivityScore: 40, travelTime: 30 });

    const result = await engine.suggestPrice(baseProperty, baseEvent, basePrice);

    expect(result.suggestedPrice).toBeCloseTo(100, 1);
  });

  it('high attractivity (>80) adds +50%', async () => {
    const engine = buildEngine({ categoryId: 1, attractivityScore: 85, travelTime: 30 });

    const result = await engine.suggestPrice(baseProperty, baseEvent, basePrice);

    // 1.0 (base) + 0.1 (Standard) + 0.5 (atratividade alta) = 1.6×
    expect(result.suggestedPrice).toBeCloseTo(160, 1);
  });

  it('medium attractivity (51-80) adds +20%', async () => {
    const engine = buildEngine({ categoryId: 1, attractivityScore: 60, travelTime: 30 });

    const result = await engine.suggestPrice(baseProperty, baseEvent, basePrice);

    // 1.0 + 0.1 + 0.2 = 1.3×
    expect(result.suggestedPrice).toBeCloseTo(130, 1);
  });

  it('short travel time (<=15min) adds +30% on top of other boosts', async () => {
    const engine = buildEngine({ categoryId: 1, attractivityScore: 40, travelTime: 10 });

    const result = await engine.suggestPrice(baseProperty, baseEvent, basePrice);

    // 1.0 + 0.1 (Standard) + 0 (atratividade baixa) + 0.3 (travel curto) = 1.4×
    expect(result.suggestedPrice).toBeCloseTo(140, 1);
  });

  it('event.relevancia adds up to +50% (relevancia=100 → +0.50)', async () => {
    const engine = buildEngine({ categoryId: 1, attractivityScore: 40, travelTime: 30 });
    const megaEvent = { ...baseEvent, relevancia: 100 };

    const result = await engine.suggestPrice(baseProperty, megaEvent, basePrice);

    // 1.0 + 0.1 + 0 + 0 + 0.5 (relevancia/200 = 100/200 = 0.5) = 1.6×
    expect(result.suggestedPrice).toBeCloseTo(160, 1);
    expect(result.details.eventAIRelevance).toBe(100);
  });

  it('all boosts combined cap at the real multiplier sum (no double counting)', async () => {
    const engine = buildEngine({ categoryId: 2, attractivityScore: 90, travelTime: 10 });
    const megaEvent = { ...baseEvent, relevancia: 100 };

    const result = await engine.suggestPrice(baseProperty, megaEvent, basePrice);

    // 1.0 + 0.2 (Premium) + 0.5 (atratividade alta) + 0.3 (travel curto) + 0.5 (relevancia) = 2.5×
    expect(result.suggestedPrice).toBeCloseTo(250, 1);
    expect(result.increasePercentage).toBe(150);
  });

  it('returns a human-readable reasoning in details', async () => {
    const engine = buildEngine({
      categoryId: 2,
      attractivityScore: 90,
      travelTime: 10,
      attractivityLevel: 'Alta',
    });

    const result = await engine.suggestPrice(baseProperty, baseEvent, basePrice);

    expect(result.details.reasoning).toContain('Premium');
    expect(result.details.reasoning).toContain('10 min');
    expect(result.details.reasoning).toContain('Alta');
  });
});
