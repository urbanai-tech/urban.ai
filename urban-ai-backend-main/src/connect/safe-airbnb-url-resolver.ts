import { lookup as nodeLookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

export const AIRBNB_ALLOWED_HOSTNAMES = new Set([
  'airbnb.com',
  'www.airbnb.com',
  'airbnb.com.br',
  'www.airbnb.com.br',
]);

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const NON_PUBLIC_ADDRESSES = new BlockList();

[
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
].forEach(([network, prefix]) =>
  NON_PUBLIC_ADDRESSES.addSubnet(network as string, prefix as number, 'ipv4'),
);

[
  ['::', 128],
  ['::1', 128],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001:db8::', 32],
  ['2001:10::', 28],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
].forEach(([network, prefix]) =>
  NON_PUBLIC_ADDRESSES.addSubnet(network as string, prefix as number, 'ipv6'),
);

export type DnsLookup = (
  hostname: string,
) => Promise<Array<{ address: string; family: number }>>;

export interface FetchResponseLike {
  status: number;
  headers: { get(name: string): string | null };
  body?: { cancel(): Promise<void> } | null;
}

export type FetchLike = (
  url: string,
  init: { redirect: 'manual'; signal: AbortSignal },
) => Promise<FetchResponseLike>;

export type SafeAirbnbUrlResolverOptions = {
  fetchImpl?: FetchLike;
  lookupImpl?: DnsLookup;
  timeoutMs?: number;
  maxRedirects?: number;
  maxResponseBytes?: number;
};

export class SafeUrlResolutionError extends Error {
  constructor(
    public readonly code:
      | 'invalid_url'
      | 'invalid_protocol'
      | 'credentials_not_allowed'
      | 'invalid_port'
      | 'host_not_allowed'
      | 'non_public_address'
      | 'dns_failed'
      | 'redirect_invalid'
      | 'too_many_redirects'
      | 'response_too_large'
      | 'timeout'
      | 'upstream_failed',
    message: string,
  ) {
    super(message);
    this.name = 'SafeUrlResolutionError';
  }
}

export function isPublicIpAddress(address: string): boolean {
  const mappedDottedIpv4 = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mappedDottedIpv4) return isPublicIpAddress(mappedDottedIpv4[1]);

  const mappedHexIpv4 = address.match(
    /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i,
  );
  if (mappedHexIpv4) {
    const high = Number.parseInt(mappedHexIpv4[1], 16);
    const low = Number.parseInt(mappedHexIpv4[2], 16);
    return isPublicIpAddress(
      `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`,
    );
  }

  const family = isIP(address);
  if (family === 0) return false;
  return !NON_PUBLIC_ADDRESSES.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

function parseAllowedAirbnbUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SafeUrlResolutionError('invalid_url', 'URL Airbnb inválida');
  }

  if (url.protocol !== 'https:') {
    throw new SafeUrlResolutionError(
      'invalid_protocol',
      'A URL Airbnb deve usar HTTPS',
    );
  }

  if (url.username || url.password) {
    throw new SafeUrlResolutionError(
      'credentials_not_allowed',
      'Credenciais não são permitidas na URL',
    );
  }

  if (url.port && url.port !== '443') {
    throw new SafeUrlResolutionError(
      'invalid_port',
      'A URL Airbnb deve usar a porta HTTPS padrão',
    );
  }

  const hostname = url.hostname.toLowerCase();
  if (!AIRBNB_ALLOWED_HOSTNAMES.has(hostname)) {
    throw new SafeUrlResolutionError(
      'host_not_allowed',
      'Host Airbnb não permitido',
    );
  }

  return url;
}

async function assertPublicDns(
  hostname: string,
  lookupImpl: DnsLookup,
  deadline: number,
) {
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) {
    throw new SafeUrlResolutionError(
      'timeout',
      'Tempo limite ao resolver a URL Airbnb',
    );
  }

  let addresses: Array<{ address: string; family: number }>;
  let timeout: ReturnType<typeof setTimeout>;
  try {
    addresses = await Promise.race([
      lookupImpl(hostname),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () =>
            reject(
              new SafeUrlResolutionError(
                'timeout',
                'Tempo limite ao resolver a URL Airbnb',
              ),
            ),
          remainingMs,
        );
      }),
    ]);
  } catch (error) {
    if (error instanceof SafeUrlResolutionError) throw error;
    throw new SafeUrlResolutionError(
      'dns_failed',
      'Não foi possível validar o DNS do Airbnb',
    );
  } finally {
    clearTimeout(timeout);
  }

  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => !isPublicIpAddress(address))
  ) {
    throw new SafeUrlResolutionError(
      'non_public_address',
      'O destino resolvido não possui endereço público permitido',
    );
  }
}

async function cancelBody(response: FetchResponseLike) {
  try {
    await response.body?.cancel();
  } catch {
    // O corpo nunca é consumido. Uma falha ao cancelar não altera a URL resolvida.
  }
}

export async function resolveSafeAirbnbUrl(
  input: string,
  options: SafeAirbnbUrlResolverOptions = {},
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
  const lookupImpl: DnsLookup =
    options.lookupImpl ??
    ((hostname) => nodeLookup(hostname, { all: true, verbatim: true }));
  const timeoutMs = options.timeoutMs ?? 5_000;
  const maxRedirects = options.maxRedirects ?? 5;
  const maxResponseBytes = options.maxResponseBytes ?? 1_000_000;
  const deadline = Date.now() + timeoutMs;
  let currentUrl = parseAllowedAirbnbUrl(input);

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    await assertPublicDns(currentUrl.hostname, lookupImpl, deadline);

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new SafeUrlResolutionError(
        'timeout',
        'Tempo limite ao resolver a URL Airbnb',
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), remainingMs);
    let response: FetchResponseLike;

    try {
      response = await fetchImpl(currentUrl.toString(), {
        redirect: 'manual',
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted || Date.now() >= deadline) {
        throw new SafeUrlResolutionError(
          'timeout',
          'Tempo limite ao resolver a URL Airbnb',
        );
      }
      throw new SafeUrlResolutionError(
        'upstream_failed',
        'Falha ao consultar a URL Airbnb',
      );
    } finally {
      clearTimeout(timeout);
    }

    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) {
      await cancelBody(response);
      throw new SafeUrlResolutionError(
        'response_too_large',
        'Resposta Airbnb excede o limite permitido',
      );
    }

    if (!REDIRECT_STATUSES.has(response.status)) {
      await cancelBody(response);
      return currentUrl.toString();
    }

    const location = response.headers.get('location');
    await cancelBody(response);
    if (!location) {
      throw new SafeUrlResolutionError(
        'redirect_invalid',
        'Redirecionamento Airbnb sem destino válido',
      );
    }

    if (hop === maxRedirects) {
      throw new SafeUrlResolutionError(
        'too_many_redirects',
        'A URL Airbnb excedeu o limite de redirecionamentos',
      );
    }

    let redirectedUrl: URL;
    try {
      redirectedUrl = new URL(location, currentUrl);
    } catch {
      throw new SafeUrlResolutionError(
        'redirect_invalid',
        'Destino de redirecionamento Airbnb inválido',
      );
    }
    currentUrl = parseAllowedAirbnbUrl(redirectedUrl.toString());
  }

  throw new SafeUrlResolutionError(
    'too_many_redirects',
    'A URL Airbnb excedeu o limite de redirecionamentos',
  );
}
