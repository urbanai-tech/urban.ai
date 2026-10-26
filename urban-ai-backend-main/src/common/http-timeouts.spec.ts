import axios from 'axios';
import { MailerService } from '../mailer/mailer.service';
import { GeocodingClient } from '../maps/geocoding-client';
import { HTTP_TIMEOUT_MS, HttpTimeoutError, fetchWithTimeout } from './http-timeouts';

describe('HTTP_TIMEOUT_MS', () => {
  it('keeps sane, ordered per-service budgets', () => {
    const { fast, default: standard, slow, heavy, scrape, stripe } = HTTP_TIMEOUT_MS;
    expect(fast).toBeLessThan(standard);
    expect(standard).toBeLessThan(slow);
    expect(slow).toBeLessThan(heavy);
    expect(heavy).toBeLessThan(scrape);
    expect(stripe).toBeLessThanOrEqual(30_000);
  });
});

describe('fetchWithTimeout', () => {
  afterEach(() => jest.useRealTimers());

  it('aborts a hanging request and throws HttpTimeoutError without leaking the query string', async () => {
    jest.useFakeTimers();
    const hanging = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })) as unknown as typeof fetch;

    const result = fetchWithTimeout('https://example.com/path?id_token=SECRET', {}, 500, hanging);
    const assertion = expect(result).rejects.toMatchObject({
      name: 'HttpTimeoutError',
      timeoutMs: 500,
      url: 'https://example.com/path',
    });
    await jest.advanceTimersByTimeAsync(501);
    await assertion;
    await expect(result).rejects.toBeInstanceOf(HttpTimeoutError);
  });

  it('passes the response through and clears the timer on success', async () => {
    const response = { ok: true, status: 200 } as Response;
    const impl = jest.fn(async () => response) as unknown as typeof fetch;
    await expect(fetchWithTimeout('https://example.com', { method: 'POST' }, 1000, impl)).resolves.toBe(response);
    const [, init] = (impl as unknown as jest.Mock).mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('propagates non-timeout errors unchanged and honours an already-aborted upstream signal', async () => {
    const failing = jest.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    await expect(fetchWithTimeout('https://example.com', {}, 1000, failing)).rejects.toThrow('network down');

    const upstream = new AbortController();
    upstream.abort();
    const impl = jest.fn(async (_u: string, init: RequestInit) => {
      expect(init.signal.aborted).toBe(true);
      return { ok: true } as Response;
    }) as unknown as typeof fetch;
    await fetchWithTimeout('https://example.com', { signal: upstream.signal }, 1000, impl);
  });
});

describe('outbound clients carry an explicit timeout', () => {
  afterEach(() => jest.restoreAllMocks());

  it('Brevo mailer sends with the default timeout', async () => {
    process.env.BREVO_API_KEY = 'test-key';
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ status: 201, data: { messageId: 'm1' } });
    await new MailerService().sendHtmlEmail({ email: 'a@example.com' }, 'subject', '<p>x</p>');
    expect(post).toHaveBeenCalledWith(
      expect.stringContaining('/smtp/email'),
      expect.any(Object),
      expect.objectContaining({ timeout: HTTP_TIMEOUT_MS.default }),
    );
  });

  it('Google geocoding uses the default timeout and a size cap', async () => {
    const get = jest.spyOn(axios, 'get').mockResolvedValue({
      status: 200,
      data: { status: 'ZERO_RESULTS', results: [] },
    });
    await new GeocodingClient().geocode({ params: { address: 'Rua X', key: 'k' } });
    expect(get.mock.calls[0][1]).toMatchObject({ timeout: HTTP_TIMEOUT_MS.default, maxRedirects: 0 });
  });
});
