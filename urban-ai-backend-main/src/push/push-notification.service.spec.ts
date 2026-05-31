import * as crypto from 'crypto';
import { PushNotificationService } from './push-notification.service';

describe('PushNotificationService', () => {
  const makeService = () => {
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
    );

    return { service, subscriptionRepo, deliveryRepo, userRepo, communicationLog };
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
});
