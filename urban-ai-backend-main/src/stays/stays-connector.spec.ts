import axios, { AxiosError } from 'axios';
import { StaysConnector } from './stays-connector';

// Synthetic fixtures: public contract, not captured account data.
const credentials = { clientId: 'local-client', clientSecret: 'local-secret' };
const fixture = (overrides = {}) => ({
  _id: 'long-listing-1', id: 'AB01', internalName: 'Apartamento 1',
  status: 'active', _idproperty: 'building-1', deff_curr: 'BRL',
  address: { street: 'Rua Exemplo', streetNumber: '10', additional: '101', city: 'São Paulo' },
  ...overrides,
});
const day = (value = 100, overrides = {}) => ({
  date: '2026-09-15', avail: 1, closedToArrival: false, closedToDeparture: true,
  prices: [{ minStay: 3, _mcval: { BRL: value, USD: value / 5 } }], ...overrides,
});
function failure(status?: number, headers: Record<string, string> = {}) {
  return new AxiosError('sensitive provider message', undefined, {} as any, {}, status ? {
    status, statusText: 'provider error', data: {}, headers, config: {} as any,
  } : undefined);
}

describe('StaysConnector public contract (offline)', () => {
  const originalUrl = process.env.STAYS_API_BASE_URL;
  const originalWrites = process.env.STAYS_PRICE_WRITES_ENABLED;
  const originalHosts = process.env.STAYS_ALLOWED_API_HOSTS;
  let connector: StaysConnector;
  let http: { get: jest.Mock; patch: jest.Mock };
  const input = {
    listingId: 'long-listing-1', date: '2026-09-15', currency: 'BRL',
    previousPriceCents: 10000, priceCents: 12345, idempotencyKey: 'local-decision-1',
  };
  beforeEach(() => {
    process.env.STAYS_API_BASE_URL = 'https://account.invalid';
    delete process.env.STAYS_PRICE_WRITES_ENABLED;
    delete process.env.STAYS_ALLOWED_API_HOSTS;
    http = { get: jest.fn(), patch: jest.fn() };
    jest.spyOn(axios, 'create').mockReturnValue(http as any);
    connector = new StaysConnector();
    jest.spyOn(connector as any, 'sleep').mockResolvedValue(undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(() => {
    if (originalHosts === undefined) delete process.env.STAYS_ALLOWED_API_HOSTS;
    else process.env.STAYS_ALLOWED_API_HOSTS = originalHosts;
    if (originalUrl === undefined) delete process.env.STAYS_API_BASE_URL;
    else process.env.STAYS_API_BASE_URL = originalUrl;
    if (originalWrites === undefined) delete process.env.STAYS_PRICE_WRITES_ENABLED;
    else process.env.STAYS_PRICE_WRITES_ENABLED = originalWrites;
  });
  it('uses Basic auth and separates technical, display and property IDs', async () => {
    http.get.mockResolvedValue({ data: [fixture()] });
    const [listing] = await connector.listListings(credentials);
    expect(listing).toMatchObject({
      listingId: 'long-listing-1', title: 'Apartamento 1', basePriceCents: null,
      address: 'Rua Exemplo, 10, 101, São Paulo', active: true,
      providerMetadata: { shortId: 'AB01', propertyId: 'building-1', currency: 'BRL' },
    });
    expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: 'https://account.invalid/external/v1', maxRedirects: 0,
      headers: expect.objectContaining({ Authorization: 'Basic ' + Buffer.from('local-client:local-secret').toString('base64') }),
    }));
  });
  it('uses each account domain and credential pair on the same connector instance', async () => {
    delete process.env.STAYS_API_BASE_URL;
    connector = new StaysConnector();
    http.get.mockResolvedValue({ data: [] });
    for (const name of ['first', 'second']) {
      await connector.listListings({ clientId: name, clientSecret: name + '-secret', apiBaseUrl: `https://${name}.stays.net` });
    }
    expect((axios.create as jest.Mock).mock.calls.map(([config]) => [config.baseURL, config.headers.Authorization]))
      .toEqual(['first', 'second'].map((name) => [
        `https://${name}.stays.net/external/v1`,
        'Basic ' + Buffer.from(`${name}:${name}-secret`).toString('base64'),
      ]));
  });
  it.each(['https://unapproved.example', 'https://account.stays.net.attacker.example', 'https://account.stays.net:8443'])(
    'rejects an unapproved account target before sending credentials: %s', async (apiBaseUrl) => {
      await expect(connector.listListings({ ...credentials, apiBaseUrl })).rejects.toThrow();
      expect(axios.create).not.toHaveBeenCalled();
    },
  );
  it('accepts an explicitly approved custom host despite an invalid legacy fallback', async () => {
    process.env.STAYS_API_BASE_URL = 'invalid-legacy-value';
    process.env.STAYS_ALLOWED_API_HOSTS = ' custom.example ';
    connector = new StaysConnector();
    http.get.mockResolvedValue({ data: [] });
    await expect(connector.listListings({ ...credentials, apiBaseUrl: 'https://custom.example' })).resolves.toEqual([]);
    expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({ baseURL: 'https://custom.example/external/v1' }));
  });
  it('reads all pages including the final empty page for multiples of twenty', async () => {
    http.get.mockResolvedValueOnce({ data: Array.from({ length: 20 }, (_, i) => fixture({ _id: 'unit-' + i })) })
      .mockResolvedValueOnce({ data: [] });
    expect(await connector.listListings(credentials)).toHaveLength(20);
    expect(http.get).toHaveBeenNthCalledWith(2, '/content/listings', { params: { skip: 20, limit: 20 } });
  });
  it.each([{ items: [] }, null, [fixture({ _id: undefined })], [fixture({ status: 'unknown' })]])(
    'rejects incompatible payloads instead of reporting an empty account: %j', async (data) => {
      http.get.mockResolvedValue({ data });
      await expect(connector.listListings(credentials)).rejects.toThrow('Invalid Stays');
    },
  );
  it('rejects repeated pages without returning partial inventory', async () => {
    http.get.mockResolvedValue({ data: Array.from({ length: 20 }, (_, i) => fixture({ _id: 'unit-' + i })) });
    await expect(connector.listListings(credentials)).rejects.toThrow('duplicate');
    expect(http.get).toHaveBeenCalledTimes(2);
  });
  it('preserves inheritance and inactive states', async () => {
    http.get.mockResolvedValue({ data: ['draft', 'hidden', 'inactive'].map((status) => fixture({
      _id: status, status, _idproperty: undefined, _idPriceMaster: 'master-1',
    })) });
    const listings = await connector.listListings(credentials);
    expect(listings.every((listing) => !listing.active)).toBe(true);
    expect(listings[0].providerMetadata).toMatchObject({ propertyId: null, horizontalPriceMasterId: 'master-1' });
  });
  it.each(['http://account.invalid', 'https://account.invalid/other', 'https://user:secret@account.invalid', 'https://account.invalid/?token=x'])(
    'rejects invalid URL %s before sending credentials', async (url) => {
      process.env.STAYS_API_BASE_URL = url;
      connector = new StaysConnector();
      await expect(connector.listListings(credentials)).rejects.toThrow('STAYS_API_BASE_URL');
      expect(axios.create).not.toHaveBeenCalled();
    },
  );
  it('normalizes API-prefixed URL and checks auth against content', async () => {
    process.env.STAYS_API_BASE_URL = 'https://account.invalid/external/v1/';
    connector = new StaysConnector();
    http.get.mockResolvedValue({ status: 200, data: [] });
    expect(await connector.ping(credentials)).toBe(true);
    expect(http.get).toHaveBeenCalledWith('/content/listings', { params: { skip: 0, limit: 1 } });
    http.get.mockResolvedValue({ status: 200, data: '<html>login</html>' });
    expect(await connector.ping(credentials)).toBe(false);
  });
  it('does not authenticate without both credentials', async () => {
    expect(await connector.ping({ ...credentials, clientId: '' })).toBe(false);
    expect(axios.create).not.toHaveBeenCalled();
  });
  it('retries transient reads and honors Retry-After', async () => {
    http.get.mockRejectedValueOnce(failure(429, { 'retry-after': '2' })).mockResolvedValueOnce({ data: [] });
    expect(await connector.listListings(credentials)).toEqual([]);
    expect((connector as any).sleep).toHaveBeenCalledWith(2000);
  });
  it('does not retry authentication failure', async () => {
    http.get.mockRejectedValue(failure(401));
    await expect(connector.listListings(credentials)).rejects.toThrow();
    expect(http.get).toHaveBeenCalledTimes(1);
  });
  it('validates calendar dates before requesting', async () => {
    await expect(connector.readCalendar(credentials, 'unit', '2026-02-30', '2026-03-01')).rejects.toThrow('Invalid');
    expect(http.get).not.toHaveBeenCalled();
  });
  it('rejects duplicate calendar days', async () => {
    http.get.mockResolvedValue({ data: [day(), day()] });
    await expect(connector.readCalendar(credentials, 'unit', '2026-09-15', '2026-09-15')).rejects.toThrow('Invalid');
  });
  it('disables all writes by default including manual requests', async () => {
    expect(await connector.pushPrice(credentials, input)).toEqual({ ok: false, rejectedReason: 'stays_price_writes_disabled' });
    expect(axios.create).not.toHaveBeenCalled();
  });
  function prepareWrite(listing = fixture(), calendar = [day()]) {
    process.env.STAYS_PRICE_WRITES_ENABLED = 'true';
    http.get.mockResolvedValueOnce({ data: listing }).mockResolvedValueOnce({ data: [listing] }).mockResolvedValueOnce({ data: calendar })
      .mockResolvedValueOnce({ data: [day(123.45)] });
    http.patch.mockResolvedValue({ status: 200 });
  }
  it('converts centavos, preserves minStay and confirms via a fresh read', async () => {
    prepareWrite();
    expect(await connector.pushPrice(credentials, input)).toEqual({ ok: true });
    expect(http.patch).toHaveBeenCalledWith('/calendar/listing/long-listing-1/prices', [{
      from: '2026-09-15', to: '2026-09-15', prices: [{ minStay: 3, _f_val: 123.45 }],
    }]);
    expect(http.get).toHaveBeenCalledTimes(4);
  });
  it.each([{ deff_curr: 'USD' }, { _idPriceMaster: 'master' }, { status: 'draft' }])(
    'blocks incompatible currency, inherited prices or inactive inventory', async (overrides) => {
      prepareWrite(fixture(overrides));
      expect((await connector.pushPrice(credentials, input)).rejectedReason).toBe('listing_requires_pricing_mapping');
      expect(http.patch).not.toHaveBeenCalled();
    },
  );
  it('rejects stale previous price before writing', async () => {
    prepareWrite(fixture(), [day(105)]);
    expect((await connector.pushPrice(credentials, input)).rejectedReason).toBe('previous_price_changed');
    expect(http.patch).not.toHaveBeenCalled();
  });
  it.each(['_idCloneGroupMaster', '_idPriceGroupMaster', '_idPriceMaster'])(
    'blocks masters with dependent units through %s, including inactive units', async (field) => {
      process.env.STAYS_PRICE_WRITES_ENABLED = 'true';
      http.get.mockResolvedValueOnce({ data: fixture() }).mockResolvedValueOnce({ data: [
        fixture(), fixture({ _id: 'dependent-unit', status: 'inactive', [field]: input.listingId }),
      ] });
      expect((await connector.pushPrice(credentials, input)).rejectedReason).toBe('listing_requires_pricing_mapping');
      expect(http.patch).not.toHaveBeenCalled();
    },
  );
  it('blocks a target absent from the fresh inventory', async () => {
    process.env.STAYS_PRICE_WRITES_ENABLED = 'true';
    http.get.mockResolvedValueOnce({ data: fixture() }).mockResolvedValueOnce({ data: [] });
    expect((await connector.pushPrice(credentials, input)).rejectedReason).toBe('listing_requires_pricing_mapping');
    expect(http.patch).not.toHaveBeenCalled();
  });
  it('checks dependent units beyond the first inventory page before any write', async () => {
    process.env.STAYS_PRICE_WRITES_ENABLED = 'true';
    http.get.mockResolvedValueOnce({ data: fixture() })
      .mockResolvedValueOnce({ data: [fixture(), ...Array.from({ length: 19 }, (_, i) => fixture({ _id: `unit-${i}` }))] })
      .mockResolvedValueOnce({ data: [fixture({ _id: 'last-unit', _idPriceMaster: input.listingId })] });
    expect((await connector.pushPrice(credentials, input)).rejectedReason).toBe('listing_requires_pricing_mapping');
    expect(http.get).toHaveBeenLastCalledWith('/content/listings', { params: { skip: 20, limit: 20 } });
    expect(http.patch).not.toHaveBeenCalled();
  });
  it('does not replace multiple tariffs with one price', async () => {
    prepareWrite(fixture(), [day(100, { prices: [...day().prices, { minStay: 7, _mcval: { BRL: 90 } }] })]);
    expect((await connector.pushPrice(credentials, input)).rejectedReason).toBe('calendar_requires_pricing_mapping');
    expect(http.patch).not.toHaveBeenCalled();
  });
  it('never retries an uncertain write or leaks provider errors', async () => {
    prepareWrite();
    http.patch.mockRejectedValue(failure());
    await expect(connector.pushPrice(credentials, input)).rejects.toThrow('reconcile calendar');
    expect(http.patch).toHaveBeenCalledTimes(1);
    expect((connector as any).sleep).not.toHaveBeenCalled();
  });
  it('does not report success when HTTP success did not change the calendar', async () => {
    process.env.STAYS_PRICE_WRITES_ENABLED = 'true';
    http.get.mockResolvedValueOnce({ data: fixture() }).mockResolvedValueOnce({ data: [fixture()] }).mockResolvedValue({ data: [day()] });
    http.patch.mockResolvedValue({ status: 200 });
    await expect(connector.pushPrice(credentials, input)).rejects.toThrow('reconcile calendar');
  });

  it('fails without a configured account URL and does not send a request', async () => {
    delete process.env.STAYS_API_BASE_URL;
    connector = new StaysConnector();
    expect(await connector.ping(credentials)).toBe(false);
    await expect(connector.listListings(credentials)).rejects.toThrow('STAYS_API_BASE_URL is required');
    expect(axios.create).not.toHaveBeenCalled();
  });

  it('keeps authentication failures free of the Axios request and credentials', async () => {
    http.get.mockRejectedValue(failure(403));
    await expect(connector.listListings(credentials)).rejects.toEqual(new Error('Stays read failed (HTTP 403)'));
  });

  it('exhausts transient read retries without exposing transport details', async () => {
    http.get.mockRejectedValue(failure());
    await expect(connector.listListings(credentials)).rejects.toEqual(new Error('Stays read failed'));
    expect(http.get).toHaveBeenCalledTimes(3);
  });

  it.each(['', 'invalid', '-1', '99'])(
    'handles Retry-After %j while retaining a bounded read retry', async (value) => {
      http.get.mockRejectedValueOnce(failure(429, { 'retry-after': value })).mockResolvedValue({ data: [] });
      expect(await connector.listListings(credentials)).toEqual([]);
      const delay = (connector as any).sleep.mock.calls[0][0];
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(30000);
    },
  );

  it('supports HTTP-date Retry-After from accessor headers', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-05T12:00:00Z'));
    const error = failure(429);
    (error.response as any).headers = { get: () => 'Sat, 05 Sep 2026 12:00:10 GMT' };
    http.get.mockRejectedValueOnce(error).mockResolvedValue({ data: [] });
    await connector.listListings(credentials);
    expect((connector as any).sleep).toHaveBeenCalledWith(10000);
  });

  it('maps multilingual and identifier fallbacks without inventing nightly prices', async () => {
    http.get.mockResolvedValue({ data: [
      fixture({ _id: 'a', internalName: null, address: null, _mstitle: { pt_BR: 'Título' } }),
      fixture({ _id: 'b', internalName: null, address: {}, _mstitle: { en_US: 'Title' } }),
      fixture({ _id: 'c', internalName: null }),
      fixture({ _id: 'd', internalName: null, id: null }),
    ] });
    const listings = await connector.listListings(credentials);
    expect(listings.map((listing) => listing.title)).toEqual(['Título', 'Title', 'AB01', 'd']);
    expect(listings.every((listing) => listing.basePriceCents === null)).toBe(true);
  });

  it.each([
    { priceCents: 0 }, { priceCents: 12.3 }, { previousPriceCents: 0 },
    { date: '2026-02-30' }, { currency: 'brl' }, { listingId: '' },
  ])('rejects invalid monetary or date input before reading or writing', async (overrides) => {
    process.env.STAYS_PRICE_WRITES_ENABLED = 'true';
    expect((await connector.pushPrice(credentials, { ...input, ...overrides })).rejectedReason).toBe('invalid_price_input');
    expect(axios.create).not.toHaveBeenCalled();
  });

  it('sanitizes a business rejection without repeating the write', async () => {
    prepareWrite();
    http.patch.mockRejectedValue(failure(409));
    expect(await connector.pushPrice(credentials, input)).toEqual({ ok: false, rejectedReason: 'stays_http_409' });
    expect(http.patch).toHaveBeenCalledTimes(1);
  });

  it('does not interpret a non-array calendar as an empty period', async () => {
    http.get.mockResolvedValue({ data: { items: [] } });
    await expect(connector.readCalendar(credentials, 'unit', input.date, input.date)).rejects.toThrow('Invalid Stays calendar response');
  });

  it.each([
    { prices: [{ minStay: 1, _mcval: { BRL: -1 } }] },
    { prices: [{ minStay: 1, _mcval: [] }] },
    { prices: [{ minStay: 0, _mcval: { BRL: 100 } }] },
    { date: '2026-09-16' }, { avail: -1 }, { closedToArrival: null },
  ])('rejects an invalid calendar observation', async (overrides) => {
    http.get.mockResolvedValue({ data: [day(100, overrides)] });
    await expect(connector.readCalendar(credentials, 'unit', input.date, input.date)).rejects.toThrow('Invalid Stays calendar day');
  });
});
