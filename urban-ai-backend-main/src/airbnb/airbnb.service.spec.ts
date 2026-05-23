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
  const countNights = (checkIn: string, checkOut: string) => {
    const inDate = new Date(`${checkIn}T00:00:00.000Z`);
    const outDate = new Date(`${checkOut}T00:00:00.000Z`);
    return Math.max(1, Math.round((outDate.getTime() - inDate.getTime()) / 86_400_000));
  };
  const makeQuote = (
    source: 'airbnb-browser' | 'airbnb-search',
    checkIn = '2026-06-12',
    checkOut = '2026-06-14',
    propertyDetails = { bedrooms: 1, beds: 1, guestMaximum: 1 },
  ) => {
    const nights = countNights(checkIn, checkOut);

    return {
      price: {
        status: true,
        message: 'ok',
        timestamp: Date.now(),
        data: {
          accommodationCost: 500,
          accommodationCostFormatted: 'R$500.00',
          accommodationCostTitle: `${nights} nights x R$${(500 / nights).toFixed(2)}`,
          details: [],
        },
      },
      propertyDetails,
      checkIn,
      checkOut,
      nights,
      source,
    };
  };

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

  it('records successful headless pricing attempts when a repository is available', async () => {
    const browserScraper = {
      isEnabled: jest.fn().mockReturnValue(true),
      scrapeListing: jest.fn().mockResolvedValue({
        priceTotal: 500,
        priceText: 'Total: R$500',
        captchaDetected: false,
        finalUrl: 'https://www.airbnb.com/rooms/123?check_in=2026-06-12&check_out=2026-06-14',
        priceCandidateCount: 1,
      }),
    };
    const repo = {
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => input),
    };
    const service = new AirbnbService(
      {} as any,
      { get: jest.fn((key: string) => (key === 'RAPIDAPI_KEY' ? 'test-key' : undefined)) } as any,
      browserScraper as any,
      repo as any,
    );

    await service.getPriceForDateWindow('123', '2026-06-12', '2026-06-14');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        listingId: '123',
        checkIn: '2026-06-12',
        checkOut: '2026-06-14',
        source: 'airbnb-browser',
        status: 'success',
        priceTotal: 500,
        dailyPrice: 250,
      }),
    );
    expect(repo.save).toHaveBeenCalled();
  });

  describe('availability calendar windows', () => {
    const baseDate = '2026-05-23';
    const propertyDetails = { bedrooms: 1, beds: 1, guestMaximum: 2 };
    const isoAfter = (offsetDays: number) => {
      const date = new Date(`${baseDate}T00:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() + offsetDays);
      return date.toISOString().slice(0, 10);
    };
    const calendarDay = (offsetDays: number, overrides: Record<string, unknown> = {}) => ({
      date: isoAfter(offsetDays),
      available: false,
      bookable: false,
      availableForCheckin: false,
      availableForCheckout: false,
      minNights: 2,
      maxNights: 30,
      ...overrides,
    });
    const availableDay = (offsetDays: number, overrides: Record<string, unknown> = {}) =>
      calendarDay(offsetDays, {
        available: true,
        bookable: true,
        availableForCheckin: true,
        availableForCheckout: true,
        ...overrides,
      });
    const makeCalendar = (days: any[]) => ({
      roomId: '123',
      url: 'https://www.airbnb.com/rooms/123',
      finalUrl: 'https://www.airbnb.com/rooms/123',
      source: 'PdpAvailabilityCalendar' as const,
      days,
    });
    const makeCalendarService = (calendar: any) => {
      const browserScraper = {
        isEnabled: jest.fn().mockReturnValue(true),
        scrapeAvailabilityCalendar: jest.fn().mockResolvedValue(calendar),
      };
      const service = new AirbnbService(
        { getPropertyDetails: jest.fn().mockResolvedValue(propertyDetails) } as any,
        { get: jest.fn((key: string) => (key === 'RAPIDAPI_KEY' ? 'test-key' : undefined)) } as any,
        browserScraper as any,
      ) as any;

      return { service, browserScraper };
    };
    const mockBrowserPrice = (service: any) =>
      jest.spyOn(service, 'getPriceForDateWindowFromBrowser').mockImplementation(
        async (_propertyId: string, checkIn: string, checkOut: string, details: any) =>
          makeQuote('airbnb-browser', checkIn, checkOut, details),
      );

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date(`${baseDate}T00:00:00.000Z`));
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('uses the calendar when availability starts only after 90 days', async () => {
      const days = Array.from({ length: 110 }, (_value, index) =>
        index >= 95 && index <= 98 ? availableDay(index) : calendarDay(index),
      );
      const { service } = makeCalendarService(makeCalendar(days));
      const priceSpy = mockBrowserPrice(service);

      const result = await service.getFirstAvailablePrice('123');

      expect(priceSpy).toHaveBeenCalledWith('123', isoAfter(95), isoAfter(97), propertyDetails);
      expect(result.checkIn).toBe(isoAfter(95));
      expect(result.checkOut).toBe(isoAfter(97));
    });

    it('does not try blind windows when the loaded calendar has no availability', async () => {
      const days = Array.from({ length: 120 }, (_value, index) => calendarDay(index));
      const { service } = makeCalendarService(makeCalendar(days));
      const browserPriceSpy = jest.spyOn(service, 'getPriceForDateWindowFromBrowser');
      const apiPriceSpy = jest.spyOn(service, 'getPriceForDateWindowFromPricingApi');

      await expect(service.getFirstAvailablePrice('123')).rejects.toMatchObject({
        response: {
          status: false,
          message: 'Nao foi possivel obter preco real do Airbnb nas fontes configuradas',
        },
      });
      expect(browserPriceSpy).not.toHaveBeenCalled();
      expect(apiPriceSpy).not.toHaveBeenCalled();
    });

    it('respects minNights=3 when building calendar windows', async () => {
      const days = Array.from({ length: 20 }, (_value, index) =>
        index >= 10 && index <= 14
          ? availableDay(index, index === 10 ? { minNights: 3 } : {})
          : calendarDay(index),
      );
      const { service } = makeCalendarService(makeCalendar(days));
      const priceSpy = mockBrowserPrice(service);

      await service.getFirstAvailablePrice('123');

      expect(priceSpy).toHaveBeenCalledWith('123', isoAfter(10), isoAfter(13), propertyDetails);
    });

    it('falls back to fixed windows when the calendar does not load', async () => {
      const { service, browserScraper } = makeCalendarService(null);
      const priceSpy = mockBrowserPrice(service);

      const result = await service.getFirstAvailablePrice('123');

      expect(browserScraper.scrapeAvailabilityCalendar).toHaveBeenCalledWith('123');
      expect(priceSpy).toHaveBeenCalledWith('123', isoAfter(7), isoAfter(9), propertyDetails);
      expect(result.checkIn).toBe(isoAfter(7));
      expect(result.checkOut).toBe(isoAfter(9));
    });
  });
});
