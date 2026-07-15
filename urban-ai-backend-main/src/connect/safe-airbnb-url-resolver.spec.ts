import {
  FetchLike,
  isPublicIpAddress,
  resolveSafeAirbnbUrl,
  SafeUrlResolutionError,
} from './safe-airbnb-url-resolver';

function response(status: number, headers: Record<string, string> = {}) {
  const normalized = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    status,
    headers: { get: (name: string) => normalized.get(name.toLowerCase()) ?? null },
    body: { cancel: jest.fn().mockResolvedValue(undefined) },
  };
}

const publicDns = jest.fn().mockResolvedValue([
  { address: '8.8.8.8', family: 4 },
  { address: '2606:4700:4700::1111', family: 6 },
]);

describe('resolveSafeAirbnbUrl', () => {
  beforeEach(() => {
    publicDns.mockClear();
  });

  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.20',
    '169.254.169.254',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ])('classifies private, loopback or link-local IP as non-public: %s', (ip) => {
    expect(isPublicIpAddress(ip)).toBe(false);
  });

  it.each(['8.8.8.8', '2606:4700:4700::1111'])(
    'classifies a globally routable IP as public: %s',
    (ip) => {
      expect(isPublicIpAddress(ip)).toBe(true);
    },
  );

  it.each([
    'https://localhost/internal',
    'https://10.0.0.1/internal',
    'https://192.168.1.20/internal',
    'https://169.254.169.254/latest/meta-data',
    'https://[::1]/internal',
    'https://www.airbnb.com.evil.test/rooms/123',
  ])('rejects a non-Airbnb or private destination: %s', async (url) => {
    const fetchImpl = jest.fn() as unknown as FetchLike;

    await expect(
      resolveSafeAirbnbUrl(url, { fetchImpl, lookupImpl: publicDns }),
    ).rejects.toBeInstanceOf(SafeUrlResolutionError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects HTTP even for an allowed Airbnb hostname', async () => {
    const fetchImpl = jest.fn() as unknown as FetchLike;

    await expect(
      resolveSafeAirbnbUrl('http://www.airbnb.com/l/abc', {
        fetchImpl,
        lookupImpl: publicDns,
      }),
    ).rejects.toMatchObject({ code: 'invalid_protocol' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects an allowed hostname when DNS resolves to a private address', async () => {
    const privateDns = jest
      .fn()
      .mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    const fetchImpl = jest.fn() as unknown as FetchLike;

    await expect(
      resolveSafeAirbnbUrl('https://www.airbnb.com/l/abc', {
        fetchImpl,
        lookupImpl: privateDns,
      }),
    ).rejects.toMatchObject({ code: 'non_public_address' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('validates every redirect and blocks a public-to-private redirect', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        response(302, { location: 'https://169.254.169.254/latest/meta-data' }),
      ) as unknown as FetchLike;

    await expect(
      resolveSafeAirbnbUrl('https://www.airbnb.com/l/abc', {
        fetchImpl,
        lookupImpl: publicDns,
      }),
    ).rejects.toMatchObject({ code: 'host_not_allowed' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('resolves a valid Airbnb URL with manually validated redirects', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        response(302, {
          location: 'https://www.airbnb.com.br/rooms/123?source=share',
        }),
      )
      .mockResolvedValueOnce(
        response(200, { 'content-length': '2000' }),
      ) as unknown as FetchLike;

    await expect(
      resolveSafeAirbnbUrl('https://www.airbnb.com/l/abc', {
        fetchImpl,
        lookupImpl: publicDns,
      }),
    ).resolves.toBe('https://www.airbnb.com.br/rooms/123?source=share');

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://www.airbnb.com/l/abc',
      expect.objectContaining({ redirect: 'manual' }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://www.airbnb.com.br/rooms/123?source=share',
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it('rejects a response whose declared size exceeds the limit', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        response(200, { 'content-length': '101' }),
      ) as unknown as FetchLike;

    await expect(
      resolveSafeAirbnbUrl('https://www.airbnb.com/rooms/123', {
        fetchImpl,
        lookupImpl: publicDns,
        maxResponseBytes: 100,
      }),
    ).rejects.toMatchObject({ code: 'response_too_large' });
  });

  it('aborts an upstream request at the configured timeout', async () => {
    const fetchImpl: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('aborted')));
      });

    await expect(
      resolveSafeAirbnbUrl('https://www.airbnb.com/l/slow', {
        fetchImpl,
        lookupImpl: publicDns,
        timeoutMs: 5,
      }),
    ).rejects.toMatchObject({ code: 'timeout' });
  });
});
