import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('delegates GET /health to the service', async () => {
    const health = { status: 'ok' };
    const service = {
      assertReadinessAccess: jest.fn(),
      getHealth: jest.fn().mockReturnValue(health),
      getLive: jest.fn(),
    };
    const controller = new HealthController(service as any);

    await expect(controller.getHealth('Bearer token')).resolves.toBe(health);
    expect(service.assertReadinessAccess).toHaveBeenCalledWith('Bearer token');
    expect(service.getHealth).toHaveBeenCalled();
  });

  it('marks degraded readiness as HTTP 503 while preserving the response body', async () => {
    const health = { status: 'degraded' };
    const service = {
      assertReadinessAccess: jest.fn(),
      getHealth: jest.fn().mockResolvedValue(health),
      getLive: jest.fn(),
    };
    const response = { status: jest.fn() };
    const controller = new HealthController(service as any);

    await expect(controller.getHealth('Bearer token', response as any)).resolves.toBe(health);
    expect(response.status).toHaveBeenCalledWith(503);
  });

  it('returns degraded readiness safely when no passthrough response was injected', async () => {
    const health = { status: 'degraded' };
    const service = {
      assertReadinessAccess: jest.fn(),
      getHealth: jest.fn().mockResolvedValue(health),
      getLive: jest.fn(),
    };

    await expect(new HealthController(service as any).getHealth()).resolves.toBe(health);
  });

  it('does not probe dependencies after readiness access is rejected', async () => {
    const denied = new Error('denied');
    const service = {
      assertReadinessAccess: jest.fn(() => { throw denied; }),
      getHealth: jest.fn(),
      getLive: jest.fn(),
    };

    await expect(new HealthController(service as any).getHealth()).rejects.toBe(denied);
    expect(service.getHealth).not.toHaveBeenCalled();
  });

  it('delegates GET /health/live to the service', () => {
    const live = { status: 'ok', uptimeSec: 1 };
    const service = {
      assertReadinessAccess: jest.fn(),
      getHealth: jest.fn(),
      getLive: jest.fn().mockReturnValue(live),
    };
    const controller = new HealthController(service as any);

    expect(controller.getLive()).toBe(live);
    expect(service.getLive).toHaveBeenCalled();
  });
});
