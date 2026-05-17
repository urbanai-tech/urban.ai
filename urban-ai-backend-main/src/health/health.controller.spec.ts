import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('delegates GET /health to the service', () => {
    const health = { status: 'ok' };
    const service = {
      getHealth: jest.fn().mockReturnValue(health),
      getLive: jest.fn(),
    };
    const controller = new HealthController(service as any);

    expect(controller.getHealth()).toBe(health);
    expect(service.getHealth).toHaveBeenCalled();
  });

  it('delegates GET /health/live to the service', () => {
    const live = { status: 'ok', uptimeSec: 1 };
    const service = {
      getHealth: jest.fn(),
      getLive: jest.fn().mockReturnValue(live),
    };
    const controller = new HealthController(service as any);

    expect(controller.getLive()).toBe(live);
    expect(service.getLive).toHaveBeenCalled();
  });
});
