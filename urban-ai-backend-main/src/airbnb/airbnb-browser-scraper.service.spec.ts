import { AirbnbBrowserScraperService } from './airbnb-browser-scraper.service';

describe('AirbnbBrowserScraperService parsing', () => {
  const makeService = () =>
    new AirbnbBrowserScraperService({ get: jest.fn().mockReturnValue(undefined) } as any);

  it('prefers rendered total price over nightly and fee lines', () => {
    const service = makeService() as any;

    const result = service.extractRenderedPrice(
      [
        'R$981 noite',
        '2 noites x R$981',
        'Taxa de limpeza R$120',
        'Total: R$1.962',
      ].join('\n'),
      '',
    );

    expect(result).toEqual({ value: 1962, text: 'Total: R$1.962', candidateCount: 4 });
  });

  it('extracts host id from rendered html or public profile links', () => {
    const service = makeService() as any;

    const fromHtml = service.extractHost({
      html: '{"hostId":"133792980"}',
      links: [],
      bodyText: '',
      title: '',
      metas: {},
      images: [],
    });

    const fromLink = service.extractHost({
      html: '',
      links: [
        {
          href: 'https://www.airbnb.com/users/show/133792980',
          text: 'Hosted by Ana',
          ariaLabel: '',
          image: '',
        },
      ],
      bodyText: '',
      title: '',
      metas: {},
      images: [],
    });

    expect(fromHtml.hostId).toBe('133792980');
    expect(fromLink.hostId).toBe('133792980');
    expect(fromLink.hostName).toBe('Hosted by Ana');
  });

  it('detects listing ids from room links', () => {
    const service = makeService() as any;

    expect(
      service.extractListingIds(
        'https://www.airbnb.com/rooms/1315879732817724596\nhttps://www.airbnb.com.br/rooms/45516670',
      ),
    ).toEqual(['1315879732817724596', '45516670']);
  });

  it('parses PdpAvailabilityCalendar day availability rules', () => {
    const service = makeService() as any;

    const days = service.extractAvailabilityCalendarDays([
      {
        data: {
          presentation: {
            pdpAvailabilityCalendar: {
              calendarMonths: [
                {
                  days: [
                    {
                      calendarDate: '2026-08-26',
                      available: true,
                      bookable: true,
                      availableForCheckin: true,
                      availableForCheckout: true,
                      minNights: 3,
                      maxNights: 14,
                    },
                    {
                      calendarDate: '2026-08-27',
                      available: false,
                      bookable: false,
                      availableForCheckin: false,
                      availableForCheckout: true,
                      minNights: 2,
                      maxNights: 14,
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    ]);

    expect(days).toEqual([
      {
        date: '2026-08-26',
        available: true,
        bookable: true,
        availableForCheckin: true,
        availableForCheckout: true,
        minNights: 3,
        maxNights: 14,
      },
      {
        date: '2026-08-27',
        available: false,
        bookable: false,
        availableForCheckin: false,
        availableForCheckout: true,
        minNights: 2,
        maxNights: 14,
      },
    ]);
  });

  it('classifies captcha and parser diagnostics', () => {
    const service = makeService() as any;

    expect(
      service.classifyListingDiagnostic(
        { title: 'Airbnb', bodyText: 'Verify you are human', html: '', links: [], metas: {}, images: [] },
        { value: null, candidateCount: 0 },
        true,
      ),
    ).toBe('captcha_blocked');

    expect(
      service.classifyListingDiagnostic(
        { title: 'Airbnb', bodyText: 'Total before taxes', html: '', links: [], metas: {}, images: [] },
        { value: null, candidateCount: 1 },
        false,
      ),
    ).toBe('layout_parser');
  });
});
