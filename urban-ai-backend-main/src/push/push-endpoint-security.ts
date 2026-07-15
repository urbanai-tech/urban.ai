import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export type ResolvedAddress = { address: string; family: number };
export type PushDnsResolver = (hostname: string) => Promise<ResolvedAddress[]>;

const defaultResolver: PushDnsResolver = (hostname) =>
  lookup(hostname, { all: true, verbatim: true });

export class PushEndpointSecurity {
  constructor(private readonly resolver: PushDnsResolver = defaultResolver) {}

  async assertSafe(endpoint: string): Promise<URL> {
    let parsed: URL;
    try {
      parsed = new URL(endpoint);
    } catch {
      throw new Error('push_endpoint_invalid_url');
    }

    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
      throw new Error('push_endpoint_https_required');
    }

    const hostname = parsed.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
    if (!hostname || this.isBlockedHostname(hostname)) {
      throw new Error('push_endpoint_hostname_blocked');
    }

    if (isIP(hostname)) {
      if (!this.isPublicIp(hostname)) throw new Error('push_endpoint_ip_blocked');
      return parsed;
    }

    let addresses: ResolvedAddress[];
    try {
      addresses = await this.resolver(hostname);
    } catch {
      throw new Error('push_endpoint_dns_failed');
    }

    if (!addresses.length || addresses.some(({ address }) => !this.isPublicIp(address))) {
      throw new Error('push_endpoint_dns_blocked');
    }

    return parsed;
  }

  private isBlockedHostname(hostname: string): boolean {
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.home') ||
      hostname.endsWith('.lan')
    ) {
      return true;
    }

    return [
      'metadata',
      'metadata.google.internal',
      'metadata.google.com',
      'instance-data',
      'instance-data.ec2.internal',
    ].includes(hostname);
  }

  private isPublicIp(address: string): boolean {
    const family = isIP(address);
    if (family === 4) return this.isPublicIpv4(address);
    if (family === 6) return this.isPublicIpv6(address);
    return false;
  }

  private isPublicIpv4(address: string): boolean {
    const parts = address.split('.').map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return false;
    }
    const [a, b, c] = parts;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 192 && b === 0) return false;
    if (a === 192 && b === 88 && c === 99) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    if (a === 198 && b === 51 && c === 100) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    return true;
  }

  private isPublicIpv6(address: string): boolean {
    const bytes = this.ipv6Bytes(address);
    if (!bytes) return false;

    const allZero = bytes.every((byte) => byte === 0);
    const loopback = bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1;
    if (allZero || loopback) return false;
    if ((bytes[0] & 0xfe) === 0xfc) return false;
    if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return false;
    if (bytes[0] === 0xff) return false;
    if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) return false;
    if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0 && bytes[3] === 0) return false;

    const ipv4Mapped = bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
    const ipv4Compatible = bytes.slice(0, 12).every((byte) => byte === 0);
    if (ipv4Mapped || ipv4Compatible) {
      return this.isPublicIpv4(bytes.slice(12).join('.'));
    }

    // 6to4 and the well-known NAT64 prefix embed an IPv4 address.
    if (bytes[0] === 0x20 && bytes[1] === 0x02) {
      return this.isPublicIpv4(bytes.slice(2, 6).join('.'));
    }
    const nat64 = bytes[0] === 0 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b &&
      bytes.slice(4, 12).every((byte) => byte === 0);
    if (nat64) return this.isPublicIpv4(bytes.slice(12).join('.'));

    return true;
  }

  private ipv6Bytes(address: string): number[] | null {
    const normalized = address.toLowerCase().split('%')[0];
    const halves = normalized.split('::');
    if (halves.length > 2) return null;

    const parseHalf = (half: string): number[] | null => {
      if (!half) return [];
      const words: number[] = [];
      for (const part of half.split(':')) {
        if (part.includes('.')) {
          const ipv4 = part.split('.').map(Number);
          if (ipv4.length !== 4 || ipv4.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return null;
          words.push((ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]);
          continue;
        }
        if (!/^[a-f0-9]{1,4}$/.test(part)) return null;
        words.push(parseInt(part, 16));
      }
      return words;
    };

    const left = parseHalf(halves[0]);
    const right = parseHalf(halves[1] ?? '');
    if (!left || !right) return null;
    const missing = 8 - left.length - right.length;
    if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
    const words = [...left, ...Array(missing).fill(0), ...right];
    if (words.length !== 8) return null;
    return words.flatMap((word) => [(word >> 8) & 0xff, word & 0xff]);
  }
}
