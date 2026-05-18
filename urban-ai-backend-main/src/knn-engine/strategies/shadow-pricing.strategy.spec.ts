import { ShadowPricingStrategy } from './shadow-pricing.strategy';

describe('ShadowPricingStrategy', () => {
  const input = {
    property: { id: 'property-1', lat: -23.55, lng: -46.63 },
    event: { id: 'event-1', name: 'Evento', lat: -23.55, lng: -46.63 },
    basePrice: 100,
  };

  const primarySuggestion = {
    propertyId: 'property-1',
    eventName: 'Evento',
    basePrice: 100,
    suggestedPrice: 110,
    increasePercentage: 10,
    details: { reasoning: 'primary rules', strategy: 'rules' },
  };

  const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

  it('rate-limits repeated shadow model failures', async () => {
    const primary = {
      name: 'rules',
      isReady: jest.fn().mockReturnValue(true),
      suggestPrice: jest.fn().mockResolvedValue(primarySuggestion),
    };
    const shadow = {
      name: 'xgboost',
      isReady: jest.fn().mockReturnValue(true),
      suggestPrice: jest
        .fn()
        .mockRejectedValue(new Error('dataset to predict must be an array or a matrix')),
    };
    const strategy = new ShadowPricingStrategy({ primary: primary as any, shadow: shadow as any });
    jest.spyOn((strategy as any).logger, 'warn').mockImplementation(() => undefined);

    await strategy.suggestPrice(input);
    await strategy.suggestPrice(input);
    await flushPromises();

    expect(primary.suggestPrice).toHaveBeenCalledTimes(2);
    expect(shadow.suggestPrice).toHaveBeenCalledTimes(2);
    expect((strategy as any).logger.warn).toHaveBeenCalledTimes(1);
  });
});
