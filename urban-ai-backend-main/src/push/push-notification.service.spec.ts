import * as crypto from 'crypto';
import { PushNotificationService } from './push-notification.service';
import { PushEndpointSecurity } from './push-endpoint-security';

describe('PushNotificationService', () => {
  const makeService = (endpointSecurity = {
    assertSafe: jest.fn(async (endpoint: string) => new URL(endpoint)),
  }) => {
    const subscriptionRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((entity) => entity),
      save: jest.fn(async (entity) => ({ id: entity.id || 'sub-1', ...entity })),
    };
    const deliveryRepo = {
      find: jest.fn(),
      create: jest.fn((entity) => entity),
      save: jest.fn(async (entity) => entity),
    };
    const userRepo = {
      findOne: jest.fn(),
    };
    const communicationLog = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const service = new PushNotificationService(
      subscriptionRepo as any,
      deliveryRepo as any,
      userRepo as any,
      communicationLog as any,
      endpointSecurity as PushEndpointSecurity,
    );

    return { service, subscriptionRepo, deliveryRepo, userRepo, communicationLog, endpointSecurity };
  };

  afterEach(() => {
    delete process.env.WEB_PUSH_PUBLIC_KEY;
    delete process.env.WEB_PUSH_PRIVATE_KEY;
    delete process.env.WEB_PUSH_SUBJECT;
    jest.restoreAllMocks();
  });

  it('skips sends when VAPID keys are not configured', async () => {
    const { service, communicationLog } = makeService();

    await expect(service.sendToUser('user-1', { title: 'Urban AI' })).resolves.toMatchObject({
      enabled: false,
      attempted: 0,
      skippedReason: 'missing_vapid_keys',
    });
    expect(communicationLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        channel: 'push',
        status: 'skipped',
        failureReason: 'missing_vapid_keys',
      }),
    );
  });

  it('upserts an active browser subscription and returns a device secret once', async () => {
    process.env.WEB_PUSH_PUBLIC_KEY = 'public-key';
    process.env.WEB_PUSH_PRIVATE_KEY = 'private-key';
    const { service, subscriptionRepo, userRepo } = makeService();
    userRepo.findOne.mockResolvedValue({ id: 'user-1', ativo: true });
    subscriptionRepo.findOne.mockResolvedValue(null);

    const result = await service.upsertSubscription('user-1', {
      endpoint: 'https://push.example.test/device',
      keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
      platform: 'Win32',
    });

    expect(result).toMatchObject({ ok: true, enabled: true, deviceId: expect.any(String), secret: expect.any(String) });
    expect(subscriptionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        endpoint: 'https://push.example.test/device',
        endpointHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        deviceSecretHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        active: true,
      }),
    );
  });

  it('returns pending delivery payloads only when the device secret matches', async () => {
    process.env.WEB_PUSH_PUBLIC_KEY = 'public-key';
    process.env.WEB_PUSH_PRIVATE_KEY = 'private-key';
    const { service, subscriptionRepo, deliveryRepo } = makeService();
    const delivery = {
      id: 'delivery-1',
      payloadJson: JSON.stringify({ title: 'Sugestões de preço disponíveis', url: '/dashboard' }),
      deliveredAt: null,
    };
    subscriptionRepo.findOne.mockResolvedValue({
      id: 'sub-1',
      deviceId: 'device-1',
      deviceSecretHash: crypto.createHash('sha256').update('secret').digest('hex'),
      active: true,
    });
    deliveryRepo.find.mockResolvedValue([delivery]);

    const result = await service.getPendingDeliveries('device-1', 'secret');

    expect(result.notifications).toEqual([
      expect.objectContaining({
        deliveryId: 'delivery-1',
        title: 'Sugestões de preço disponíveis',
        url: '/dashboard',
      }),
    ]);
    expect(delivery.deliveredAt).toBeInstanceOf(Date);
    expect(deliveryRepo.save).toHaveBeenCalledWith([delivery]);
  });

  it('validates at registration and revalidates immediately before sending', async () => {
    process.env.WEB_PUSH_PUBLIC_KEY = 'public-key';
    process.env.WEB_PUSH_PRIVATE_KEY = 'private-key';
    const endpointSecurity = { assertSafe: jest.fn(async (endpoint: string) => new URL(endpoint)) };
    const { service, subscriptionRepo, userRepo } = makeService(endpointSecurity);
    userRepo.findOne.mockResolvedValue({ id: 'user-1', ativo: true });
    subscriptionRepo.findOne.mockResolvedValue(null);
    await service.upsertSubscription('user-1', {
      endpoint: 'https://fcm.googleapis.com/push/device',
      keys: { p256dh: 'key', auth: 'auth' },
    });

    jest.spyOn(service as any, 'createVapidJwt').mockReturnValue('jwt');
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 201 } as Response);
    await (service as any).sendWakePush({ endpoint: 'https://fcm.googleapis.com/push/device' });

    expect(endpointSecurity.assertSafe).toHaveBeenCalledTimes(2);
  });

  it('blocks redirects instead of following a provider-controlled Location', async () => {
    const { service } = makeService();
    jest.spyOn(service as any, 'createVapidJwt').mockReturnValue('jwt');
    const request = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 307,
      headers: new Headers({ location: 'http://169.254.169.254/latest/meta-data' }),
      text: jest.fn().mockResolvedValue(''),
    } as unknown as Response);

    await expect((service as any).sendWakePush({ endpoint: 'https://push.example.com/device' }))
      .rejects.toThrow('push_redirect_blocked');
    expect(request).toHaveBeenCalledWith('https://push.example.com/device', expect.objectContaining({
      redirect: 'manual',
    }));
  });

  it('fails before request when DNS re-resolution becomes unsafe', async () => {
    process.env.WEB_PUSH_PUBLIC_KEY = 'public-key';
    process.env.WEB_PUSH_PRIVATE_KEY = 'private-key';
    const endpointSecurity = {
      assertSafe: jest.fn()
        .mockResolvedValueOnce(new URL('https://push.example.com/device'))
        .mockRejectedValueOnce(new Error('push_endpoint_dns_blocked')),
    };
    const { service, subscriptionRepo, userRepo } = makeService(endpointSecurity);
    userRepo.findOne.mockResolvedValue({ id: 'user-1', ativo: true });
    subscriptionRepo.findOne.mockResolvedValue(null);
    await service.upsertSubscription('user-1', {
      endpoint: 'https://push.example.com/device', keys: { p256dh: 'key', auth: 'auth' },
    });
    const request = jest.spyOn(global, 'fetch');

    await expect((service as any).sendWakePush({ endpoint: 'https://push.example.com/device' }))
      .rejects.toThrow('push_endpoint_dns_blocked');
    expect(request).not.toHaveBeenCalled();
  });
});
