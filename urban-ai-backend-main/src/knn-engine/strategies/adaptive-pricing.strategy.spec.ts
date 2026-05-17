jest.mock('@turf/turf', () => ({
  point: jest.fn(),
  distance: jest.fn(),
}));

import { AdaptivePricingStrategy } from './adaptive-pricing.strategy';

describe('AdaptivePricingStrategy', () => {
  const input = {
    property: { id: 'property-1', lat: -23.55, lng: -46.63 },
    event: { id: 'event-1', name: 'Evento', lat: -23.55, lng: -46.63 },
    basePrice: 100,
  };

  const ruleSuggestion = {
    propertyId: 'property-1',
    eventName: 'Evento',
    basePrice: 100,
    suggestedPrice: 120,
    increasePercentage: 20,
    details: { reasoning: 'fallback rules', strategy: 'rules' },
  };

  function buildStrategy() {
    const rules = {
      name: 'rules',
      isReady: jest.fn().mockReturnValue(true),
      suggestPrice: jest.fn().mockResolvedValue(ruleSuggestion),
    };
    const xgboost = {
      name: 'xgboost',
      isReady: jest.fn().mockReturnValue(true),
      suggestPrice: jest
        .fn()
        .mockRejectedValue(new Error('dataset to predict must be an array or a matrix')),
    };
    const collector = {
      datasetSize: jest.fn().mockResolvedValue({ distinctListings: 600, distinctDays: 31 }),
    };
    const strategy = new AdaptivePricingStrategy(rules as any, xgboost as any, collector as any);
    jest.spyOn((strategy as any).logger, 'warn').mockImplementation(() => undefined);
    return { strategy, rules, xgboost };
  }

  it('falls back to rules when the selected ML strategy throws', async () => {
    const { strategy, rules, xgboost } = buildStrategy();

    const result = await strategy.suggestPrice(input);

    expect(xgboost.suggestPrice).toHaveBeenCalledTimes(1);
    expect(rules.suggestPrice).toHaveBeenCalledTimes(1);
    expect(result.suggestedPrice).toBe(120);
    expect(result.details.strategy).toBe('adaptive/tier-2/rules');
    expect((result.details as any).degradedFrom).toBe('xgboost');
    expect((strategy as any).logger.warn).toHaveBeenCalledTimes(1);
  });

  it('rate-limits repeated fallback warnings', async () => {
    const { strategy } = buildStrategy();

    await strategy.suggestPrice(input);
    await strategy.suggestPrice(input);

    expect((strategy as any).logger.warn).toHaveBeenCalledTimes(1);
  });
});
