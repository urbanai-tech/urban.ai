jest.mock('p-limit', () => () => (fn: () => unknown) => fn());
jest.mock('src/propriedades/propriedade.service', () => ({
  PropriedadeService: class {},
}));
jest.mock('@sentry/nestjs', () => ({
  captureMessage: jest.fn(),
}));

import { AirbnbService } from './airbnb.service';

describe('AirbnbService price extraction', () => {
  const makeService = () =>
    new AirbnbService({} as any, { get: jest.fn().mockReturnValue('test-key') } as any);
  const makeQuote = (source: 'airbnb-browser' | 'airbnb-search') => ({
    price: {
      status: true,
      message: 'ok',
      timestamp: Date.now(),
      data: {
        accommodationCost: 500,
        accommodationCostFormatted: 'R$500.00',
        accommodationCostTitle: '2 nights x R$250.00',
        details: [],
      },
    },
    propertyDetails: { bedrooms: 1, beds: 1, guestMaximum: 1 },
    checkIn: '2026-06-12',
    checkOut: '2026-06-14',
    nights: 2,
    source,
  });

  it('extracts BRL prices returned by airbnb-search display sections', () => {
    const service = makeService() as any;

    const total = service.extractTotalPrice({
      data: {
        sections: [
          {
            section: {
              structuredDisplayPrice: {
                primaryLine: {
                  price: 'R$2,100',
                  qualifier: 'for 2 nights',
                },
                explanationData: {
                  priceDetails: [
                    {
                      items: [
                        {
                          description: '2 nights x R$1,049.89',
                          priceString: 'R$2,099.77',
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        ],
      },
    });

    expect(total).toBe(2099.77);
  });

  it('handles comma decimal and dot thousands formats', () => {
    const service = makeService() as any;

    expect(service.parseMoney('R$2.099,77', 'price')).toBe(2099.77);
    expect(service.parseMoney('R$2,099.77', 'price')).toBe(2099.77);
    expect(service.parseMoney('R$2,100', 'price')).toBe(2100);
  });

  it('uses browser pricing first by default', async () => {
    const browserScraper = {
      isEnabled: jest.fn().mockReturnValue(true),
      scrapeListing: jest.fn().mockResolvedValue({
        priceTotal: 500,
        priceText: 'Total: R$500',
        captchaDetected: false,
      }),
    };
    const service = new AirbnbService(
      {} as any,
      { get: jest.fn((key: string) => (key === 'RAPIDAPI_KEY' ? 'test-key' : undefined)) } as any,
      browserScraper as any,
    );

    const result = await service.getPriceForDateWindow('123', '2026-06-12', '2026-06-14');

    expect(browserScraper.scrapeListing).toHaveBeenCalledWith('123', {
      checkIn: '2026-06-12',
      checkOut: '2026-06-14',
    });
    expect(result.source).toBe('airbnb-browser');
  });

  it('falls back to airbnb-search when browser pricing cannot read a price', async () => {
    const browserScraper = {
      isEnabled: jest.fn().mockReturnValue(true),
      scrapeListing: jest.fn().mockResolvedValue({
        priceTotal: null,
        priceText: null,
        captchaDetected: false,
        diagnosticReason: 'price_not_found',
        priceCandidateCount: 0,
      }),
    };
    const service = new AirbnbService(
      {} as any,
      { get: jest.fn((key: string) => (key === 'RAPIDAPI_KEY' ? 'test-key' : undefined)) } as any,
      browserScraper as any,
    ) as any;
    jest.spyOn(service, 'getPriceForDateWindowFromPricingApi').mockResolvedValue(makeQuote('airbnb-search'));

    const result = await service.getPriceForDateWindow('123', '2026-06-12', '2026-06-14');

    expect(result.source).toBe('airbnb-search');
    expect(service.getPriceForDateWindowFromPricingApi).toHaveBeenCalled();
  });

  it('tries multiple browser date windows before using the paid API during base-price discovery', async () => {
    const browserScraper = {
      isEnabled: jest.fn().mockReturnValue(true),
      scrapeListing: jest
        .fn()
        .mockResolvedValueOnce({
          priceTotal: null,
          priceText: null,
          captchaDetected: false,
          diagnosticReason: 'price_not_found',
          priceCandidateCount: 0,
        })
        .mockResolvedValueOnce({
          priceTotal: 720,
          priceText: 'Total: R$720',
          captchaDetected: false,
        }),
    };
    const service = new AirbnbService(
      { getPropertyDetails: jest.fn().mockResolvedValue({ bedrooms: 1, beds: 1, guestMaximum: 2 }) } as any,
      { get: jest.fn((key: string) => (key === 'RAPIDAPI_KEY' ? 'test-key' : undefined)) } as any,
      browserScraper as any,
    ) as any;
    const apiSpy = jest.spyOn(service, 'getPriceForDateWindowFromPricingApi');

    const result = await service.getFirstAvailablePrice('123');

    expect(browserScraper.scrapeListing).toHaveBeenCalledTimes(2);
    expect(apiSpy).not.toHaveBeenCalled();
    expect(result.source).toBe('airbnb-browser');
  });

  it('does not retry/fallback when headless reports systemic captcha blocking', async () => {
    const browserScraper = {
      isEnabled: jest.fn().mockReturnValue(true),
      scrapeListing: jest.fn().mockResolvedValue({
        priceTotal: null,
        priceText: null,
        captchaDetected: true,
        diagnosticReason: 'captcha_blocked',
        priceCandidateCount: 0,
      }),
    };
    const service = new AirbnbService(
      {} as any,
      { get: jest.fn((key: string) => (key === 'RAPIDAPI_KEY' ? 'test-key' : undefined)) } as any,
      browserScraper as any,
    ) as any;
    const apiSpy = jest.spyOn(service, 'getPriceForDateWindowFromPricingApi');

    await expect(service.getPriceForDateWindow('123', '2026-06-12', '2026-06-14')).rejects.toMatchObject({
      reason: 'captcha_blocked',
    });
    expect(apiSpy).not.toHaveBeenCalled();
  });
});
