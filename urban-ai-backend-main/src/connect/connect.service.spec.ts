import { BadRequestException, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosError, AxiosHeaders } from 'axios';

// Dependências pesadas (p-limit ESM, Puppeteer etc.) não participam destes caminhos.
jest.mock('src/propriedades/propriedade.service', () => ({ PropriedadeService: class {} }));
jest.mock('src/airbnb/airbnb.service', () => ({ AirbnbService: class {} }));
jest.mock('src/email/email.service', () => ({ EmailService: class {} }));

import { ConnectService } from './connect.service';

/**
 * Caminhos críticos do onboarding (ConnectService) com HTTP e scraping mockados:
 * listagem do anfitrião, CEP, slots de cota, persistência e cadastro de endereços.
 */
type Deps = {
  listRepo?: any;
  addressRepo?: any;
  propriedadeService?: any;
  airbnbService?: any;
  emailService?: any;
  userRepository?: any;
};

function makeService(deps: Deps = {}) {
  const service = new ConnectService(
    (deps.listRepo ?? {}) as any,
    (deps.addressRepo ?? {}) as any,
    {} as any,
    { get: jest.fn().mockReturnValue('test-rapidapi-key') } as any,
    (deps.propriedadeService ?? {}) as any,
    (deps.airbnbService ?? {}) as any,
    (deps.emailService ?? { enviarNotification: jest.fn().mockResolvedValue({ enviado: true }) }) as any,
    (deps.userRepository ?? { findOne: jest.fn().mockResolvedValue({ id: 'u1', emailVerifiedAt: new Date() }) }) as any,
  );
  (service as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return service;
}

function axiosHttpError(status: number) {
  const config = { headers: new AxiosHeaders() } as any;
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, {
    status,
    statusText: String(status),
    data: { message: 'erro' },
    headers: {},
    config,
  });
}

function scrapedListing(overrides: Record<string, unknown> = {}) {
  return {
    roomId: 'room-1',
    title: 'Studio Paulista',
    pictureUrl: 'https://example.com/p.jpg',
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    guestCapacity: 2,
    propertyType: 'Apartamento',
    rating: 4.9,
    amenitiesCount: 10,
    neighborhood: 'Bela Vista',
    reviewCount: 12,
    city: 'São Paulo',
    state: 'São Paulo',
    zipCode: '01310-100',
    street: 'Av. Paulista',
    latitude: -23.56,
    longitude: -46.65,
    ...overrides,
  };
}

afterEach(() => jest.restoreAllMocks());

describe('ConnectService.getUserManagedListings', () => {
  it('enriches every host listing with the individual scrape', async () => {
    const propriedadeService = {
      scrapeHostListings: jest.fn().mockResolvedValue([{ roomId: 'room-1', title: 'Perfil', pictureUrl: 'p' }]),
      scrapeAirbnbListing: jest.fn().mockResolvedValue(scrapedListing()),
    };
    const service = makeService({ propriedadeService });

    const [listing] = (await service.getUserManagedListings('host-1')) as any[];

    expect(listing).toMatchObject({
      id_do_anuncio: 'room-1',
      titulo: 'Studio Paulista',
      ativo: false,
      user: { id: 'host-1' },
      guests: 2,
      latitude: -23.56,
    });
  });

  it('falls back to the profile data when the individual scrape fails', async () => {
    const propriedadeService = {
      scrapeHostListings: jest.fn().mockResolvedValue([{ roomId: 'room-9', title: '', pictureUrl: '' }]),
      scrapeAirbnbListing: jest.fn().mockRejectedValue(new Error('timeout')),
    };
    const service = makeService({ propriedadeService });

    await expect(service.getUserManagedListings('host-1')).resolves.toEqual([
      {
        id: 'room-9',
        id_do_anuncio: 'room-9',
        titulo: 'Imóvel room-9',
        pictureUrl: '',
        ativo: false,
        user: { id: 'host-1' },
      },
    ]);
  });

  it('returns an empty list (never throws) when the host scrape fails or finds nothing', async () => {
    const empty = makeService({ propriedadeService: { scrapeHostListings: jest.fn().mockResolvedValue([]) } });
    const failing = makeService({
      propriedadeService: { scrapeHostListings: jest.fn().mockRejectedValue(new Error('GraphQL hash expirado')) },
    });

    await expect(empty.getUserManagedListings('host-1')).resolves.toEqual([]);
    await expect(failing.getUserManagedListings('host-1')).resolves.toEqual([]);
  });
});

describe('ConnectService.getAddressByCep', () => {
  it('rejects malformed CEPs with 400 before any HTTP call', async () => {
    const get = jest.spyOn(axios, 'get');

    const error = await makeService().getAddressByCep('123').catch((e) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(get).not.toHaveBeenCalled();
  });

  it('normalizes the CEP into the BrasilAPI path and returns the payload', async () => {
    const get = jest.spyOn(axios, 'get').mockResolvedValue({ status: 200, data: { city: 'São Paulo' } });

    await expect(makeService().getAddressByCep('01310-100')).resolves.toEqual({ city: 'São Paulo' });
    expect(get).toHaveBeenCalledWith(
      'https://brasilapi.com.br/api/cep/v2/01310100',
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  it('maps a BrasilAPI 404 to 404', async () => {
    jest.spyOn(axios, 'get').mockRejectedValue(axiosHttpError(404));

    const error = await makeService().getAddressByCep('01310100').catch((e) => e);

    expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
  });

  it('maps any other upstream failure to 502 without leaking details', async () => {
    jest.spyOn(axios, 'get').mockRejectedValue(axiosHttpError(500));

    const error = await makeService().getAddressByCep('01310100').catch((e) => e);

    expect(error.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect(error.message).not.toContain('erro');
  });
});

describe('ConnectService.getListingTotalPriceBRLForNext3Days', () => {
  const originalProvider = process.env.AIRBNB_PRICE_PROVIDER;
  afterEach(() => {
    if (originalProvider === undefined) delete process.env.AIRBNB_PRICE_PROVIDER;
    else process.env.AIRBNB_PRICE_PROVIDER = originalProvider;
  });

  it('uses the airbnb-search quote and derives the daily price', async () => {
    delete process.env.AIRBNB_PRICE_PROVIDER;
    const airbnbService = {
      getPriceForDateWindow: jest.fn().mockResolvedValue({
        price: { data: { accommodationCost: 900 } },
        nights: 3,
        source: 'airbnb-search',
      }),
    };

    const result = await makeService({ airbnbService }).getListingTotalPriceBRLForNext3Days('room-1');

    expect(result).toMatchObject({ total: 900, currency: 'BRL', breakdown: { dailyPrice: 300, nights: 3 } });
  });

  it('maps an airbnb-search failure to 502', async () => {
    delete process.env.AIRBNB_PRICE_PROVIDER;
    const airbnbService = { getPriceForDateWindow: jest.fn().mockRejectedValue(new Error('quota')) };

    const error = await makeService({ airbnbService }).getListingTotalPriceBRLForNext3Days('room-1').catch((e) => e);

    expect(error.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
  });

  it('legacy provider: parses the RapidAPI payload and maps 403/404', async () => {
    process.env.AIRBNB_PRICE_PROVIDER = 'legacy-connect';
    const get = jest
      .spyOn(axios, 'get')
      .mockResolvedValueOnce({ status: 200, data: { data: { price: { total: '450' } } } })
      .mockRejectedValueOnce(axiosHttpError(403))
      .mockRejectedValueOnce(axiosHttpError(404))
      .mockResolvedValueOnce({ status: 200, data: { unexpected: true } });
    const service = makeService();

    await expect(service.getListingTotalPriceBRLForNext3Days('room-1')).resolves.toMatchObject({
      total: 450,
      breakdown: { total: '450' },
    });
    expect(get.mock.calls[0][1]).toMatchObject({
      headers: { 'X-RapidAPI-Key': 'test-rapidapi-key' },
      params: { id: 'room-1', currency: 'BRL' },
    });
    expect((await service.getListingTotalPriceBRLForNext3Days('room-1').catch((e) => e)).getStatus()).toBe(403);
    expect((await service.getListingTotalPriceBRLForNext3Days('room-1').catch((e) => e)).getStatus()).toBe(404);
    expect((await service.getListingTotalPriceBRLForNext3Days('room-1').catch((e) => e)).getStatus()).toBe(502);
  });
});

describe('ConnectService address quota slots', () => {
  function addressRepoWith(existing: string[]) {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(existing.map((id_do_anuncio) => ({ id_do_anuncio }))),
    };
    return { createQueryBuilder: jest.fn(() => qb), qb };
  }

  it('counts only distinct listings that are not yet addresses of this user', async () => {
    const addressRepo = addressRepoWith(['a']);
    const service = makeService({ addressRepo });

    await expect(
      service.countNewAddressSlotsForProperties(
        [{ id_do_anuncio: 'a' }, { id_do_anuncio: 'b' }, { id_do_anuncio: 'b' }, { id_do_anuncio: '' }] as any,
        'u1',
      ),
    ).resolves.toBe(1);
    expect(addressRepo.qb.where).toHaveBeenCalledWith('address.user_id = :userId', { userId: 'u1' });
    expect(addressRepo.qb.andWhere).toHaveBeenCalledWith('list.id_do_anuncio IN (:...listingIds)', {
      listingIds: ['a', 'b'],
    });
  });

  it('skips the query when there is nothing to count', async () => {
    const addressRepo = addressRepoWith([]);
    const service = makeService({ addressRepo });

    await expect(service.countNewAddressSlotsForAddresses([{ list: null }], 'u1')).resolves.toBe(0);
    await expect(service.countNewAddressSlotsForProperties(undefined as any, 'u1')).resolves.toBe(0);
    expect(addressRepo.createQueryBuilder).not.toHaveBeenCalled();
  });
});

describe('ConnectService.saveProperties', () => {
  it('updates owned listings and creates new ones scoped to the user', async () => {
    const existing = { id: 'l1', id_do_anuncio: 'a', titulo: 'old', user: { id: 'u1' } };
    const listRepo = {
      findOne: jest.fn().mockResolvedValueOnce(existing).mockResolvedValueOnce(null),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const service = makeService({ listRepo });

    const saved = await service.saveProperties(
      [
        { id_do_anuncio: 'a', titulo: 'novo', pictureUrl: 'p1', ativo: true },
        { id_do_anuncio: 'b', titulo: 'outro', pictureUrl: 'p2', ativo: false },
      ] as any,
      'u1',
    );

    expect(listRepo.findOne).toHaveBeenNthCalledWith(1, { where: { id_do_anuncio: 'a', user: { id: 'u1' } } });
    expect(saved[0]).toMatchObject({ id: 'l1', titulo: 'novo', pictureUrl: 'p1', ativo: true });
    expect(listRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ id_do_anuncio: 'b', user: { id: 'u1' } }),
    );
  });

  it('wraps persistence errors in a 500 without the raw cause', async () => {
    const listRepo = { findOne: jest.fn().mockRejectedValue(new Error('ER_LOCK_DEADLOCK')) };
    const error = await makeService({ listRepo })
      .saveProperties([{ id_do_anuncio: 'a' }] as any, 'u1')
      .catch((e) => e);

    expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(error.message).toBe('Erro ao salvar propriedades');
  });

  it('requires a verified e-mail before touching listings', async () => {
    const listRepo = { findOne: jest.fn() };
    const userRepository = { findOne: jest.fn().mockResolvedValue({ id: 'u1', emailVerifiedAt: null }) };

    await expect(makeService({ listRepo, userRepository }).saveProperties([], 'u1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(listRepo.findOne).not.toHaveBeenCalled();
  });
});

describe('ConnectService.getUserListingsByUserId', () => {
  it('turns "no listings" into a generic 500 (current contract)', async () => {
    const listRepo = { find: jest.fn().mockResolvedValue([]) };

    const error = await makeService({ listRepo }).getUserListingsByUserId('u1').catch((e) => e);

    expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});

describe('ConnectService address normalization helpers', () => {
  const service = makeService() as any;

  it('normalizes UF codes and full state names, rejecting placeholders', () => {
    expect(service.normalizeBrazilianState('sp')).toBe('SP');
    expect(service.normalizeBrazilianState('São Paulo')).toBe('SP');
    expect(service.normalizeBrazilianState('rio grande do sul')).toBe('RS');
    expect(service.normalizeBrazilianState('A definir')).toBeNull();
    expect(service.normalizeBrazilianState('XX')).toBeNull();
    expect(service.normalizeBrazilianState(42)).toBeNull();
  });

  it('extracts the daily price from both quote shapes', () => {
    expect(
      service.extractDailyPriceFromQuote({
        price: { data: { accommodationCost: 300, accommodationCostTitle: '2 nights x R$150' } },
      }),
    ).toBe(150);
    expect(service.extractDailyPriceFromQuote({ price: { data: { accommodationCost: 500 } }, nights: 4 })).toBe(125);
    expect(service.extractDailyPriceFromQuote({})).toBeNull();
  });

  it('flattens HttpException messages for the public failure list', () => {
    expect(service.publicErrorMessage(new BadRequestException(['a', 'b']))).toBe('a; b');
    expect(service.publicErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('summarizes long title lists', () => {
    expect(service.humanList(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C e mais 2');
  });
});

describe('ConnectService.createMultipleAddresses', () => {
  function onboardingDeps(scraped: Record<string, unknown>, quote: unknown = new Error('sem cotação')) {
    const list = { id: 'list-1', id_do_anuncio: 'room-1', titulo: 'Studio', user: { id: 'u1' } };
    return {
      list,
      listRepo: { findOne: jest.fn().mockResolvedValue(list), update: jest.fn() },
      addressRepo: { findOne: jest.fn().mockResolvedValue(null), save: jest.fn(async (value) => ({ id: 'addr-1', ...value })) },
      propriedadeService: { scrapeAirbnbListing: jest.fn().mockResolvedValue(scrapedListing(scraped)) },
      airbnbService: {
        getFirstAvailablePrice:
          quote instanceof Error ? jest.fn().mockRejectedValue(quote) : jest.fn().mockResolvedValue(quote),
      },
      emailService: { enviarNotification: jest.fn().mockResolvedValue({ enviado: true }) },
    };
  }

  it('saves the address from scraped data, normalizes the UF and strips user data from the response', async () => {
    const deps = onboardingDeps({});
    const service = makeService(deps);

    const [saved] = await service.createMultipleAddresses([{ list: { id: 'room-1' }, cidade: 'A definir' }], 'u1');

    expect(deps.addressRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        cidade: 'São Paulo',
        estado: 'SP',
        cep: '01310-100',
        numero: 'S/N',
        latitude: -23.56,
        longitude: -46.65,
        idAlertAirb: 'scraping_direct',
      }),
    );
    expect(saved).not.toHaveProperty('user');
    expect(saved.list).not.toHaveProperty('user');
    // Sem diária base: avisa o anfitrião para informar o preço.
    expect(deps.emailService.enviarNotification).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ pushType: 'base_price_pending_batch', sendEmail: true }),
    );
  });

  it('persists the Airbnb base price when the quote is valid', async () => {
    const deps = onboardingDeps(
      {},
      { price: { data: { accommodationCost: 400 } }, nights: 2, source: 'airbnb-browser', checkIn: '2026-11-01' },
    );
    const service = makeService(deps);

    await service.createMultipleAddresses([{ list: { id: 'room-1' } }], 'u1');

    expect(deps.listRepo.update).toHaveBeenCalledWith(
      'list-1',
      expect.objectContaining({
        dailyPrice: 200,
        raw: 400,
        pricingInputSource: 'airbnb_headless_checkout',
        status: 'preco_base_airbnb',
      }),
    );
  });

  it('does not overwrite listing data with an empty scrape snapshot', async () => {
    const deps = onboardingDeps({
      latitude: null,
      longitude: null,
      propertyType: 'desconhecido',
      bedrooms: 0,
      guestCapacity: 0,
    });
    const service = makeService(deps);

    await service
      .createMultipleAddresses([{ list: { id: 'room-1' }, cidade: 'São Paulo', estado: 'SP' }], 'u1')
      .catch(() => undefined);
    const patch = deps.listRepo.update.mock.calls[0][1];
    expect(patch).not.toHaveProperty('titulo');
    expect(patch).not.toHaveProperty('quartos');
    expect(patch).not.toHaveProperty('lastScrapedAt');
  });

  it('keeps essentials informed by the host (essentialsSource=host_input)', async () => {
    const deps = onboardingDeps({ bedrooms: 5 });
    (deps.list as any).essentialsSource = 'host_input';
    const service = makeService(deps);

    await service.createMultipleAddresses([{ list: { id: 'room-1' } }], 'u1');

    const patch = deps.listRepo.update.mock.calls[0][1];
    expect(patch).toMatchObject({ titulo: 'Studio Paulista' });
    expect(patch).not.toHaveProperty('quartos');
    expect(patch).not.toHaveProperty('essentialsSource');
  });

  it('reports per-listing failures with a 400 that carries the saved/failed counts', async () => {
    const deps = onboardingDeps({ latitude: undefined });
    const service = makeService(deps);

    const error = await service
      .createMultipleAddresses([{ list: { id: 'room-1' } }, { list: null }], 'u1')
      .catch((e) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse()).toMatchObject({
      message: 'Não conseguimos concluir o cadastro dos imóveis selecionados.',
      savedCount: 0,
      failedCount: 2,
      failures: [
        { listingId: 'room-1', reason: expect.stringContaining('latitude/longitude') },
        { listingId: null, reason: 'Informe o ID do imóvel do Airbnb para concluir o cadastro.' },
      ],
    });
    expect(deps.addressRepo.save).not.toHaveBeenCalled();
  });

  it.each([
    ['null', { latitude: null, longitude: null }],
    ['0,0', { latitude: 0, longitude: 0 }],
    ['strings vazias', { latitude: '', longitude: '' }],
    ['fora de faixa', { latitude: 91, longitude: -46.65 }],
  ])('nunca grava o endereço em 0,0 nem fora de faixa quando o scrape traz coordenadas inválidas (%s)', async (_label, coords) => {
    const deps = onboardingDeps(coords);
    const service = makeService(deps);

    const error = await service
      .createMultipleAddresses([{ list: { id: 'room-1' }, cidade: 'São Paulo', estado: 'SP' }], 'u1')
      .catch((e) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse().failures[0].reason).toContain('latitude/longitude');
    expect(deps.addressRepo.save).not.toHaveBeenCalled();
  });

  it('rejects a listing that is not owned by the user', async () => {
    const deps = onboardingDeps({});
    deps.listRepo.findOne.mockResolvedValue(null);
    const service = makeService(deps);

    const error = await service.createMultipleAddresses([{ list: { id: 'room-x' } }], 'u1').catch((e) => e);

    expect(deps.listRepo.findOne).toHaveBeenCalledWith({ where: { id_do_anuncio: 'room-x', user: { id: 'u1' } } });
    expect(error.getResponse().failures[0].reason).toContain('Não encontramos esse imóvel');
    expect(deps.propriedadeService.scrapeAirbnbListing).not.toHaveBeenCalled();
  });
});

describe('ConnectService.resolveUrl', () => {
  it('turns unsafe URLs into a 400', async () => {
    await expect(makeService().resolveUrl('http://169.254.169.254/latest')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
