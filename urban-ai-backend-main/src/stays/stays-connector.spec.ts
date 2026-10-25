import axios, { AxiosError } from 'axios';
import {
  StaysConnector,
  StaysConnectorError,
  isStaysAuthError,
  isStaysTransientError,
  resolveStaysApiBaseUrl,
  sanitizeStaysAccountSlug,
  slugFromLegacyStaysUrl,
} from './stays-connector';

// Fixtures sintéticos: contrato público, nada capturado de conta real.
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
  const error = new AxiosError('sensitive provider message', status ? undefined : 'ECONNABORTED', {
    headers: { Authorization: 'Basic c2VjcmV0' },
  } as any, {}, status ? {
    status, statusText: 'provider error', data: { message: 'provider internals' }, headers, config: {} as any,
  } : undefined);
  return error;
}

describe('StaysConnector public contract (offline)', () => {
  const saved = {
    url: process.env.STAYS_API_BASE_URL,
    writes: process.env.STAYS_PRICE_WRITES_ENABLED,
    hosts: process.env.STAYS_ALLOWED_API_HOSTS,
    ttl: process.env.STAYS_INVENTORY_CACHE_TTL_MS,
  };
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
    delete process.env.STAYS_INVENTORY_CACHE_TTL_MS;
    http = { get: jest.fn(), patch: jest.fn() };
    jest.spyOn(axios, 'create').mockReturnValue(http as any);
    connector = new StaysConnector();
    jest.spyOn(connector as any, 'sleep').mockResolvedValue(undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(() => {
    const restore = (name: string, value?: string) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore('STAYS_API_BASE_URL', saved.url);
    restore('STAYS_PRICE_WRITES_ENABLED', saved.writes);
    restore('STAYS_ALLOWED_API_HOSTS', saved.hosts);
    restore('STAYS_INVENTORY_CACHE_TTL_MS', saved.ttl);
  });

  // ---------- Fix 1: SSRF — só slug, host constante ----------
  describe('account target (slug only)', () => {
    it('builds https://<slug>.stays.net/external/v1 with Basic auth and no redirects', async () => {
      http.get.mockResolvedValue({ data: [] });
      await connector.listListings({ ...credentials, accountSlug: 'minha-conta' });
      expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({
        baseURL: 'https://minha-conta.stays.net/external/v1', maxRedirects: 0, timeout: 15000,
        headers: expect.objectContaining({ Authorization: 'Basic ' + Buffer.from('local-client:local-secret').toString('base64') }),
      }));
    });

    it.each([
      'Evil', 'evil.com', 'a.b', 'a/b', 'conta@attacker', 'conta:443', '-conta', 'conta-', 'x'.repeat(64),
      'https://conta.stays.net', 'conta.stays.net.attacker.example', ' conta', 'conta\n', '%2e%2e',
    ])('rejects identifier %j before any request or credential use', async (accountSlug) => {
      await expect(connector.listListings({ ...credentials, accountSlug })).rejects.toThrow('Invalid Stays account identifier');
      expect(await connector.ping({ ...credentials, accountSlug })).toBe(false);
      expect(axios.create).not.toHaveBeenCalled();
    });

    it('rebuilds the slug from a constant alphabet', () => {
      expect(sanitizeStaysAccountSlug('abc-123')).toBe('abc-123');
      expect(() => sanitizeStaysAccountSlug(42 as any)).toThrow(StaysConnectorError);
    });

    it('maps an allowlisted sandbox host only through STAYS_ALLOWED_API_HOSTS', () => {
      process.env.STAYS_ALLOWED_API_HOSTS = 'piloto=sandbox.example.test, bad entry, x=http://evil';
      expect(resolveStaysApiBaseUrl('piloto')).toBe('https://sandbox.example.test/external/v1');
      expect(resolveStaysApiBaseUrl('x')).toBe('https://x.stays.net/external/v1');
      expect(resolveStaysApiBaseUrl('outra')).toBe('https://outra.stays.net/external/v1');
    });

    it('uses each account slug and credential pair on the same connector instance', async () => {
      delete process.env.STAYS_API_BASE_URL;
      http.get.mockResolvedValue({ data: [] });
      for (const name of ['first', 'second']) {
        await connector.listListings({ clientId: name, clientSecret: name + '-secret', accountSlug: name });
      }
      expect((axios.create as jest.Mock).mock.calls.map(([config]) => [config.baseURL, config.headers.Authorization]))
        .toEqual(['first', 'second'].map((name) => [
          `https://${name}.stays.net/external/v1`,
          'Basic ' + Buffer.from(`${name}:${name}-secret`).toString('base64'),
        ]));
    });

    it.each([
      ['https://acme.stays.net', 'acme'],
      ['https://acme.stays.net/', 'acme'],
      ['https://acme.stays.net/external/v1/', 'acme'],
      ['https://ACME.stays.net', 'acme'],
      ['https://acme.stays.net.attacker.example', null],
      ['https://custom.example', null],
      ['http://acme.stays.net', null],
      ['https://acme.stays.net:8443', null],
      ['https://u:p@acme.stays.net', null],
      ['https://acme.stays.net/other', null],
      ['https://acme.stays.net/?x=1', null],
      ['https://a.b.stays.net', null],
      ['not a url', null],
      ['', null],
    ])('converts legacy base URL %j to slug %j (ambiguous -> null)', (value, slug) => {
      expect(slugFromLegacyStaysUrl(value)).toBe(slug);
    });

    it.each(['http://account.invalid', 'https://account.invalid/other', 'https://user:secret@account.invalid', 'https://account.invalid/?token=x', 'not-a-url'])(
      'rejects invalid environment URL %s before sending credentials', async (url) => {
        process.env.STAYS_API_BASE_URL = url;
        await expect(connector.listListings(credentials)).rejects.toThrow('STAYS_API_BASE_URL');
        expect(axios.create).not.toHaveBeenCalled();
      },
    );

    it('fails without slug nor environment URL and does not send a request', async () => {
      delete process.env.STAYS_API_BASE_URL;
      expect(await connector.ping(credentials)).toBe(false);
      await expect(connector.listListings(credentials)).rejects.toThrow('STAYS_API_BASE_URL is required');
      expect(axios.create).not.toHaveBeenCalled();
    });
  });

  it('separates technical, display and property IDs', async () => {
    http.get.mockResolvedValue({ data: [fixture()] });
    const [listing] = await connector.listListings(credentials);
    expect(listing).toMatchObject({
      listingId: 'long-listing-1', title: 'Apartamento 1', basePriceCents: null,
      address: 'Rua Exemplo, 10, 101, São Paulo', active: true,
      providerMetadata: { shortId: 'AB01', propertyId: 'building-1', currency: 'BRL' },
    });
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
  it('normalizes API-prefixed environment URL and checks auth against content', async () => {
    process.env.STAYS_API_BASE_URL = 'https://account.invalid/external/v1/';
    http.get.mockResolvedValue({ status: 200, data: [] });
    expect(await connector.ping(credentials)).toBe(true);
    expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({ baseURL: 'https://account.invalid/external/v1' }));
    expect(http.get).toHaveBeenCalledWith('/content/listings', { params: { skip: 0, limit: 1 } });
    http.get.mockResolvedValue({ status: 200, data: '<html>login</html>' });
    expect(await connector.ping(credentials)).toBe(false);
  });
  it('does not authenticate without both credentials', async () => {
    expect(await connector.ping({ ...credentials, clientId: '' })).toBe(false);
    expect(await connector.ping({ ...credentials, clientId: 'a:b' })).toBe(false);
    expect(axios.create).not.toHaveBeenCalled();
  });

  // ---------- Fix 6: classificação de erro ----------
  describe('error classification (auth vs transient)', () => {
    it('does not retry authentication failure and classifies it as auth, without leaking', async () => {
      http.get.mockRejectedValue(failure(401));
      const error = await connector.listListings(credentials).catch((e) => e);
      expect(http.get).toHaveBeenCalledTimes(1);
      expect(isStaysAuthError(error)).toBe(true);
      expect(error).toEqual(new Error('Stays authentication failed (HTTP 401)'));
      expect(JSON.stringify(error)).not.toMatch(/c2VjcmV0|provider internals|sensitive/);
      expect((error as any).cause).toBeUndefined();
    });
    it('classifies 403 as auth', async () => {
      http.get.mockRejectedValue(failure(403));
      const error = await connector.readCalendar(credentials, 'unit', '2026-09-15', '2026-09-15').catch((e) => e);
      expect(isStaysAuthError(error)).toBe(true);
    });
    it('exhausts transient read retries (timeouts) and classifies them as transient', async () => {
      http.get.mockRejectedValue(failure());
      const error = await connector.listListings(credentials).catch((e) => e);
      expect(error).toEqual(new Error('Stays read failed'));
      expect(isStaysTransientError(error)).toBe(true);
      expect(isStaysAuthError(error)).toBe(false);
      expect(http.get).toHaveBeenCalledTimes(3);
    });
    it('classifies 5xx as transient and 404 as contract', async () => {
      http.get.mockRejectedValue(failure(503));
      expect(isStaysTransientError(await connector.listListings(credentials).catch((e) => e))).toBe(true);
      http.get.mockReset().mockRejectedValue(failure(404));
      const notFound = await connector.listListings(credentials).catch((e) => e);
      expect(notFound).toMatchObject({ kind: 'contract', httpStatus: 404 });
    });
    it('retries transient reads and honors Retry-After', async () => {
      http.get.mockRejectedValueOnce(failure(429, { 'retry-after': '2' })).mockResolvedValueOnce({ data: [] });
      expect(await connector.listListings(credentials)).toEqual([]);
      expect((connector as any).sleep).toHaveBeenCalledWith(2000);
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
  });

  it('validates calendar dates before requesting', async () => {
    await expect(connector.readCalendar(credentials, 'unit', '2026-02-30', '2026-03-01')).rejects.toThrow('Invalid');
    expect(http.get).not.toHaveBeenCalled();
  });
  it('rejects duplicate calendar days', async () => {
    http.get.mockResolvedValue({ data: [day(), day()] });
    await expect(connector.readCalendar(credentials, 'unit', '2026-09-15', '2026-09-15')).rejects.toThrow('Invalid');
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

  // ---------- Fix 2: baseline do calendário ----------
  describe('readCurrentPriceCents (live baseline)', () => {
    it('returns the single tariff in centavos for the requested currency', async () => {
      http.get.mockResolvedValue({ data: [day(123.45)] });
      expect(await connector.readCurrentPriceCents(credentials, 'unit', input.date, 'BRL')).toBe(12345);
      expect(http.get).toHaveBeenCalledWith('/calendar/listing/unit', { params: { from: input.date, to: input.date } });
    });
    it.each([
      ['no day', []],
      ['multiple tariffs', [day(100, { prices: [...day().prices, { minStay: 7, _mcval: { BRL: 90 } }] })]],
      ['other currency only', [day(100, { prices: [{ minStay: 1, _mcval: { USD: 20 } }] })]],
      ['zero price', [day(0)]],
    ])('returns null when the calendar has %s', async (_label, data) => {
      http.get.mockResolvedValue({ data });
      expect(await connector.readCurrentPriceCents(credentials, 'unit', input.date, 'BRL')).toBeNull();
    });
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
  it('blocks a target absent from the inventory', async () => {
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
  it('never retries an uncertain write (timeout) and classifies it as transient without leaking', async () => {
    prepareWrite();
    http.patch.mockRejectedValue(failure());
    const error = await connector.pushPrice(credentials, input).catch((e) => e);
    expect(error.message).toContain('reconcile calendar');
    expect(isStaysTransientError(error)).toBe(true);
    expect(JSON.stringify(error)).not.toMatch(/c2VjcmV0|sensitive/);
    expect(http.patch).toHaveBeenCalledTimes(1);
    expect((connector as any).sleep).not.toHaveBeenCalled();
  });
  it('surfaces 401 on write as auth error', async () => {
    prepareWrite();
    http.patch.mockRejectedValue(failure(401));
    expect(isStaysAuthError(await connector.pushPrice(credentials, input).catch((e) => e))).toBe(true);
  });
  it('does not report success when HTTP success did not change the calendar', async () => {
    process.env.STAYS_PRICE_WRITES_ENABLED = 'true';
    http.get.mockResolvedValueOnce({ data: fixture() }).mockResolvedValueOnce({ data: [fixture()] }).mockResolvedValue({ data: [day()] });
    http.patch.mockResolvedValue({ status: 200 });
    await expect(connector.pushPrice(credentials, input)).rejects.toThrow('could not be reconciled');
  });
  it('sanitizes a business rejection without repeating the write', async () => {
    prepareWrite();
    http.patch.mockRejectedValue(failure(409));
    expect(await connector.pushPrice(credentials, input)).toEqual({ ok: false, rejectedReason: 'stays_http_409' });
    expect(http.patch).toHaveBeenCalledTimes(1);
  });
  it.each([
    { priceCents: 0 }, { priceCents: 12.3 }, { previousPriceCents: 0 },
    { date: '2026-02-30' }, { currency: 'brl' }, { listingId: '' },
  ])('rejects invalid monetary or date input before reading or writing', async (overrides) => {
    process.env.STAYS_PRICE_WRITES_ENABLED = 'true';
    expect((await connector.pushPrice(credentials, { ...input, ...overrides })).rejectedReason).toBe('invalid_price_input');
    expect(axios.create).not.toHaveBeenCalled();
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

  // ---------- Fix 5: cache do inventário ----------
  describe('inventory cache per account', () => {
    function queueSecondWrite() {
      // 2º push: só listing + calendário antes/depois (inventário vem do cache)
      http.get.mockResolvedValueOnce({ data: fixture() })
        .mockResolvedValueOnce({ data: [day(123.45)] })
        .mockResolvedValueOnce({ data: [day(150)] });
    }
    it('reuses the paginated inventory across pushes within the TTL', async () => {
      prepareWrite();
      await connector.pushPrice(credentials, input);
      queueSecondWrite();
      expect(await connector.pushPrice(credentials, { ...input, previousPriceCents: 12345, priceCents: 15000 })).toEqual({ ok: true });
      const inventoryCalls = http.get.mock.calls.filter(([path]) => path === '/content/listings');
      expect(inventoryCalls).toHaveLength(1);
      expect(http.get).toHaveBeenCalledTimes(7);
    });
    it('isolates the cache per account and refreshes it after the TTL', async () => {
      const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
      http.get.mockResolvedValue({ data: [fixture()] });
      await connector.getInventory(credentials);
      await connector.getInventory(credentials);
      await connector.getInventory({ ...credentials, accountSlug: 'outra' });
      expect(http.get).toHaveBeenCalledTimes(2);
      now.mockReturnValue(1_000_000 + 5 * 60_000 + 1);
      await connector.getInventory(credentials);
      expect(http.get).toHaveBeenCalledTimes(3);
    });
    it('honors STAYS_INVENTORY_CACHE_TTL_MS=0 and explicit invalidation', async () => {
      process.env.STAYS_INVENTORY_CACHE_TTL_MS = '0';
      http.get.mockResolvedValue({ data: [fixture()] });
      await connector.getInventory(credentials);
      await connector.getInventory(credentials);
      expect(http.get).toHaveBeenCalledTimes(2);
      delete process.env.STAYS_INVENTORY_CACHE_TTL_MS;
      await connector.getInventory(credentials);
      connector.invalidateInventory(credentials);
      await connector.getInventory(credentials);
      expect(http.get).toHaveBeenCalledTimes(4);
    });
    it('fetches only the single target listing fresh on every push', async () => {
      prepareWrite();
      await connector.pushPrice(credentials, input);
      queueSecondWrite();
      await connector.pushPrice(credentials, { ...input, previousPriceCents: 12345, priceCents: 15000 });
      const single = http.get.mock.calls.filter(([path]) => path === '/content/listings/long-listing-1');
      expect(single).toHaveLength(2);
    });
  });
});
