import { entitlementDouble } from 'src/subscription/entitlement.testing';

jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => (handler: () => unknown) => handler(),
}));
jest.mock('src/util', () => ({
  aproximadamenteOuMenor: jest.fn(() => true),
  calculateDistance: jest.fn().mockResolvedValue(1),
  calculateDistanceHere: jest.fn().mockResolvedValue({ length: 1000, baseDuration: 600 }),
}));
jest.mock('src/propriedades/propriedade.service', () => ({ PropriedadeService: class PropriedadeService {} }));
jest.mock('src/process/process.service', () => ({ ProcessService: class ProcessService {} }));
jest.mock('src/email/email.service', () => ({ EmailService: class EmailService {} }));

import { MapsService } from './maps.service';

/**
 * Caminhos críticos do geocoding e do reprocessamento alpha, com o cliente HTTP
 * do Google Maps mockado (nenhuma chamada de rede).
 */
function geocodeResult(lat: number, lng: number) {
  return { data: { results: [{ geometry: { location: { lat, lng } } }] } };
}

function googleError(status: number, googleStatus?: string) {
  return Object.assign(new Error('Request failed'), {
    response: { status, data: googleStatus ? { status: googleStatus } : {} },
  });
}

function pendingEventsQuery(events: any[]) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(events),
  };
}

function makeService(
  deps: { eventRepo?: any; addressRepo?: any; userRepo?: any; geocode?: jest.Mock; apiKey?: string | undefined } = {},
) {
  const service = new MapsService(
    (deps.eventRepo ?? {}) as any,
    (deps.addressRepo ?? {}) as any,
    (deps.userRepo ?? {}) as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    entitlementDouble() as any,
  );
  // apiKey/client são campos inicializados na construção; o teste injeta dublês.
  (service as any).apiKey = 'apiKey' in deps ? deps.apiKey : 'test-maps-key';
  (service as any).client = { geocode: deps.geocode ?? jest.fn() };
  (service as any).logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return service;
}

describe('MapsService geocoding readiness', () => {
  it('reports missing_api_key when GOOGLE_MAPS_API_KEY is blank', () => {
    expect(makeService({ apiKey: '   ' }).getGeocodingReadiness()).toMatchObject({
      configured: false,
      status: 'missing_api_key',
    });
  });

  it('reports configured when the key is present', () => {
    expect(makeService().getGeocodingReadiness()).toMatchObject({ configured: true, status: 'configured' });
  });
});

describe('MapsService.updateLatLngByEventId', () => {
  it('returns not found without calling Google when the event does not exist', async () => {
    const geocode = jest.fn();
    const service = makeService({ eventRepo: { findOne: jest.fn().mockResolvedValue(null) }, geocode });

    await expect(service.updateLatLngByEventId('missing')).resolves.toEqual({
      ok: false,
      message: 'Evento não encontrado.',
    });
    expect(geocode).not.toHaveBeenCalled();
  });

  it('rejects events without address and does not call Google', async () => {
    const geocode = jest.fn();
    const service = makeService({
      eventRepo: { findOne: jest.fn().mockResolvedValue({ id: 'ev-1', enderecoCompleto: '  ' }) },
      geocode,
    });

    await expect(service.updateLatLngByEventId('ev-1')).resolves.toEqual({
      ok: false,
      message: 'Evento não possui endereço.',
    });
    expect(geocode).not.toHaveBeenCalled();
  });

  it('fails closed when the server-side key is missing', async () => {
    const geocode = jest.fn();
    const service = makeService({
      eventRepo: { findOne: jest.fn().mockResolvedValue({ id: 'ev-1', enderecoCompleto: 'Av. Paulista, 1000' }) },
      geocode,
      apiKey: undefined,
    });

    const result = await service.updateLatLngByEventId('ev-1');

    expect(result).toMatchObject({ ok: false });
    expect(result.message).toContain('GOOGLE_MAPS_API_KEY');
    expect(geocode).not.toHaveBeenCalled();
  });

  it('geocodes with the São Paulo suffix and persists the coordinates', async () => {
    const event = { id: 'ev-1', enderecoCompleto: ' Av. Paulista, 1000 ' };
    const eventRepo = { findOne: jest.fn().mockResolvedValue(event), save: jest.fn() };
    const geocode = jest.fn().mockResolvedValue(geocodeResult(-23.56, -46.65));
    const service = makeService({ eventRepo, geocode });

    await expect(service.updateLatLngByEventId('ev-1')).resolves.toEqual({ ok: true, lat: -23.56, lng: -46.65 });
    expect(geocode).toHaveBeenCalledWith({
      params: { address: 'Av. Paulista, 1000, São Paulo, SP, Brasil', key: 'test-maps-key' },
    });
    expect(eventRepo.save).toHaveBeenCalledWith(expect.objectContaining({ latitude: -23.56, longitude: -46.65 }));
  });

  it('does not persist anything when Google returns no result', async () => {
    const eventRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'ev-1', enderecoCompleto: 'Lugar nenhum' }),
      save: jest.fn(),
    };
    const service = makeService({ eventRepo, geocode: jest.fn().mockResolvedValue({ data: { results: [] } }) });

    await expect(service.updateLatLngByEventId('ev-1')).resolves.toEqual({
      ok: false,
      message: 'Não foi possível obter coordenadas.',
    });
    expect(eventRepo.save).not.toHaveBeenCalled();
  });

  it('summarizes Google HTTP errors instead of throwing', async () => {
    const eventRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'ev-1', enderecoCompleto: 'Av. Paulista, 1000' }),
      save: jest.fn(),
    };
    const service = makeService({ eventRepo, geocode: jest.fn().mockRejectedValue(googleError(403, 'REQUEST_DENIED')) });

    const result = await service.updateLatLngByEventId('ev-1');

    expect(result.ok).toBe(false);
    expect(result.message).toContain('HTTP 403, REQUEST_DENIED');
    expect(eventRepo.save).not.toHaveBeenCalled();
  });
});

describe('MapsService.updatePendingEventsLatLngBatch', () => {
  it('returns an empty summary when nothing is pending', async () => {
    const query = pendingEventsQuery([]);
    const service = makeService({ eventRepo: { createQueryBuilder: jest.fn(() => query) } });

    await expect(service.updatePendingEventsLatLngBatch(10, 20)).resolves.toEqual({
      ok: true,
      updated: 0,
      failed: 0,
      total: 0,
    });
    expect(query.skip).toHaveBeenCalledWith(20);
    expect(query.take).toHaveBeenCalledWith(10);
  });

  it('counts events without address and without results as failures', async () => {
    const events = [
      { id: 'no-address', enderecoCompleto: '' },
      { id: 'no-result', enderecoCompleto: 'Rua X' },
    ];
    const eventRepo = { createQueryBuilder: jest.fn(() => pendingEventsQuery(events)), save: jest.fn() };
    const service = makeService({ eventRepo, geocode: jest.fn().mockResolvedValue({ data: { results: [] } }) });

    const result = await service.updatePendingEventsLatLngBatch();

    expect(result).toMatchObject({ ok: true, updated: 0, failed: 2, total: 2 });
    expect(result.results).toEqual([
      { id: 'no-address', ok: false, reason: 'Sem endereço' },
      { id: 'no-result', ok: false, reason: 'Não encontrou coordenada' },
    ]);
    expect(eventRepo.save).not.toHaveBeenCalled();
  });

  it('stops the batch on a Google configuration error (403) instead of burning quota', async () => {
    const events = [
      { id: 'ev-1', enderecoCompleto: 'Rua A' },
      { id: 'ev-2', enderecoCompleto: 'Rua B' },
    ];
    const geocode = jest.fn().mockRejectedValue(googleError(403));
    const service = makeService({ eventRepo: { createQueryBuilder: jest.fn(() => pendingEventsQuery(events)) }, geocode });

    const result = await service.updatePendingEventsLatLngBatch();

    expect(geocode).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ updated: 0, failed: 1, total: 2 });
    expect(result.results[0].reason).toContain('HTTP 403');
  });

  it('keeps going after a transient error and saves the next event', async () => {
    const events = [
      { id: 'ev-1', enderecoCompleto: 'Rua A' },
      { id: 'ev-2', enderecoCompleto: 'Rua B' },
    ];
    const eventRepo = { createQueryBuilder: jest.fn(() => pendingEventsQuery(events)), save: jest.fn() };
    const geocode = jest
      .fn()
      .mockRejectedValueOnce(googleError(500))
      .mockResolvedValueOnce(geocodeResult(-23.5, -46.6));
    const service = makeService({ eventRepo, geocode });

    const result = await service.updatePendingEventsLatLngBatch();

    expect(geocode).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ updated: 1, failed: 1, total: 2 });
    expect(result.results[1]).toEqual({ id: 'ev-2', ok: true, lat: -23.5, lng: -46.6 });
    expect(eventRepo.save).toHaveBeenCalledTimes(1);
  });
});

describe('MapsService.updateAllEventsLatLng', () => {
  it('breaks the loop on REQUEST_DENIED and reports the error detail', async () => {
    const events = [
      { id: 'ev-1', enderecoCompleto: 'Rua A' },
      { id: 'ev-2', enderecoCompleto: 'Rua B' },
    ];
    const geocode = jest.fn().mockRejectedValue(googleError(200, 'REQUEST_DENIED'));
    const service = makeService({ eventRepo: { createQueryBuilder: jest.fn(() => pendingEventsQuery(events)) }, geocode });

    const result: any = await service.updateAllEventsLatLng();

    expect(geocode).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: true, total: 2, sucesso: 0, erros: 1 });
    expect(result.detalhesErros[0]).toMatchObject({ id: 'ev-1' });
  });
});

describe('MapsService.reprocessAlphaPricing', () => {
  const originalQuotas = process.env.ALPHA_USER_QUOTAS;

  afterEach(() => {
    if (originalQuotas === undefined) delete process.env.ALPHA_USER_QUOTAS;
    else process.env.ALPHA_USER_QUOTAS = originalQuotas;
  });

  it('skips without touching the database when no alpha e-mail is configured', async () => {
    delete process.env.ALPHA_USER_QUOTAS;
    const userRepo = { find: jest.fn() };
    const service = makeService({ userRepo });

    await expect(service.reprocessAlphaPricing()).resolves.toEqual({
      ok: true,
      users: 0,
      properties: 0,
      processed: 0,
      failed: 0,
      results: [],
    });
    expect(userRepo.find).not.toHaveBeenCalled();
  });

  it('parses ALPHA_USER_QUOTAS, dedupes by listing and isolates per-property failures', async () => {
    process.env.ALPHA_USER_QUOTAS = ' Alpha@Example.com :5, beta@example.com:3 ';
    const user = { id: 'u1', email: 'alpha@example.com' };
    const userRepo = { find: jest.fn().mockResolvedValue([user]) };
    const addressRepo = {
      find: jest.fn().mockResolvedValue([
        { user, list: { id: 'list-1', titulo: 'Casa 1' } },
        { user, list: { id: 'list-1', titulo: 'Casa 1 (dup)' } },
        { user, list: { id: 'list-2', titulo: 'Casa 2' } },
        { user, list: null },
      ]),
    };
    const service = makeService({ userRepo, addressRepo });
    const processSpy = jest
      .spyOn(service, 'processarAnalisesByProperty')
      .mockResolvedValueOnce({ ok: true } as any)
      .mockRejectedValueOnce(new Error('falhou'));

    const result = await service.reprocessAlphaPricing();

    const where = userRepo.find.mock.calls[0][0].where;
    expect(where.ativo).toBe(true);
    expect(where.email.value).toEqual(['alpha@example.com', 'beta@example.com']);
    expect(processSpy).toHaveBeenCalledTimes(2);
    expect(processSpy).toHaveBeenNthCalledWith(1, 'u1', 'list-1');
    expect(processSpy).toHaveBeenNthCalledWith(2, 'u1', 'list-2');
    expect(result).toMatchObject({ ok: false, users: 1, properties: 2, processed: 1, failed: 1 });
    expect(result.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ listId: 'list-1', result: { ok: true } }),
        expect.objectContaining({ listId: 'list-2', error: 'falhou' }),
      ]),
    );
  });

  it('uses the explicit e-mail (normalized) instead of the env list', async () => {
    process.env.ALPHA_USER_QUOTAS = 'other@example.com:1';
    const userRepo = { find: jest.fn().mockResolvedValue([]) };
    const service = makeService({ userRepo });

    await expect(service.reprocessAlphaPricing('  Host@Example.COM ')).resolves.toMatchObject({ ok: true, users: 0 });
    expect(userRepo.find.mock.calls[0][0].where.email.value).toEqual(['host@example.com']);
  });
});
