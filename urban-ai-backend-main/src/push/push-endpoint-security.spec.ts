import { PushDnsResolver, PushEndpointSecurity } from './push-endpoint-security';

describe('PushEndpointSecurity', () => {
  const resolver = (addresses: string[]): jest.MockedFunction<PushDnsResolver> =>
    jest.fn().mockResolvedValue(addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })));

  it.each([
    'http://push.example.com/device',
    'https://user:password@push.example.com/device',
    'https://localhost/device',
    'https://metadata.google.internal/computeMetadata/v1',
  ])('rejects unsafe URL or hostname %s without DNS', async (endpoint) => {
    const dns = resolver(['8.8.8.8']);
    await expect(new PushEndpointSecurity(dns).assertSafe(endpoint)).rejects.toThrow(/push_endpoint_/);
    expect(dns).not.toHaveBeenCalled();
  });

  it.each([
    '127.0.0.1', '10.0.0.1', '100.64.0.1', '169.254.169.254', '172.16.0.1', '192.168.1.1',
  ])('rejects direct private, loopback, carrier and metadata IPv4 %s', async (address) => {
    await expect(new PushEndpointSecurity().assertSafe(`https://${address}/push`))
      .rejects.toThrow('push_endpoint_ip_blocked');
  });

  it.each([
    '::1', 'fc00::1', 'fd12::1', 'fe80::1', '::ffff:7f00:1', '2001:db8::1',
    '2002:7f00:1::', '64:ff9b::7f00:1',
  ])('rejects private, mapped and transition IPv6 %s', async (address) => {
    await expect(new PushEndpointSecurity().assertSafe(`https://[${address}]/push`))
      .rejects.toThrow('push_endpoint_ip_blocked');
  });

  it('fails closed for deceptive and mixed DNS answers', async () => {
    const deceptive = resolver(['127.0.0.1']);
    await expect(new PushEndpointSecurity(deceptive).assertSafe('https://push.services.mozilla.com.attacker.test/push'))
      .rejects.toThrow('push_endpoint_dns_blocked');

    const mixed = resolver(['8.8.8.8', '169.254.169.254']);
    await expect(new PushEndpointSecurity(mixed).assertSafe('https://fcm.googleapis.com/push'))
      .rejects.toThrow('push_endpoint_dns_blocked');
  });

  it.each([
    'https://fcm.googleapis.com/push/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/Q123/abc',
  ])('allows any HTTPS provider whose complete DNS set is public', async (endpoint) => {
    const dns = resolver(['8.8.8.8', '2606:4700:4700::1111']);
    await expect(new PushEndpointSecurity(dns).assertSafe(endpoint)).resolves.toEqual(new URL(endpoint));
  });

  it('fails closed on DNS error or empty answers', async () => {
    await expect(new PushEndpointSecurity(jest.fn().mockRejectedValue(new Error('dns down')))
      .assertSafe('https://push.example.com/device')).rejects.toThrow('push_endpoint_dns_failed');
    await expect(new PushEndpointSecurity(resolver([])).assertSafe('https://push.example.com/device'))
      .rejects.toThrow('push_endpoint_dns_blocked');
  });
});
