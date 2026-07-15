import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { HealthService } from './health.service';

const mockRedisClient = {
  connect: jest.fn(),
  ping: jest.fn(),
  quit: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(() => mockRedisClient),
}));

describe('HealthService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisClient.connect.mockResolvedValue(undefined);
    mockRedisClient.ping.mockResolvedValue('PONG');
    mockRedisClient.quit.mockResolvedValue('OK');
    process.env = {
      npm_package_version: '0.0.1',
      APP_ENV: 'test',
    } as NodeJS.ProcessEnv;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns basic app status and skips DB when DataSource is not available', async () => {
    process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/app';
    process.env.JWT_SECRET = 'super-secret';
    process.env.FRONT_BASE_URL = 'https://app.test';
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.test';

    const result = await new HealthService(undefined as any).getHealth();

    expect(result).toMatchObject({
      status: 'ok',
      app: {
        name: 'urban-ai-backend',
        version: '0.0.1',
        env: 'test',
      },
      checks: {
        process: { status: 'ok' },
        db: {
          status: 'skipped',
          configured: true,
        },
      },
    });
  });

  it('prefers the explicit app version and falls back to development environment', async () => {
    process.env.APP_VERSION = ' 2026.07.15 ';
    delete process.env.npm_package_version;
    delete process.env.APP_ENV;
    delete process.env.NODE_ENV;

    const result = await new HealthService(undefined as any).getHealth();

    expect(result.app.version).toBe('2026.07.15');
    expect(result.app.env).toBe('development');
  });

  it('loads the package version when version environment variables are absent', async () => {
    delete process.env.APP_VERSION;
    delete process.env.npm_package_version;

    const result = await new HealthService(undefined as any).getHealth();

    expect(result.app.version).toBe('0.0.1');
  });

  it('checks DB with SELECT 1 when DataSource is available', async () => {
    process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/app';
    process.env.JWT_SECRET = 'super-secret';
    process.env.FRONT_BASE_URL = 'https://app.test';
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.test';
    const dataSource = { query: jest.fn().mockResolvedValue([{ ok: 1 }]) };

    const result = await new HealthService(dataSource as any).getHealth();

    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
    expect(result.status).toBe('ok');
    expect(result.checks.db.status).toBe('ok');
    expect(result.checks.db.latencyMs).toEqual(expect.any(Number));
  });

  it('reports liveness without probing dependencies', () => {
    jest.spyOn(process, 'uptime').mockReturnValue(12.9);

    expect(new HealthService(undefined as any).getLive()).toEqual({
      status: 'ok',
      uptimeSec: 12,
    });
  });

  it('degrades when DB responds slowly', async () => {
    process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/app';
    process.env.JWT_SECRET = 'super-secret';
    process.env.FRONT_BASE_URL = 'https://app.test';
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.test';
    const dataSource = { query: jest.fn().mockResolvedValue([{ ok: 1 }]) };
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValueOnce(1_000).mockReturnValueOnce(1_750);

    const result = await new HealthService(dataSource as any).getHealth();

    expect(result.status).toBe('degraded');
    expect(result.checks.db).toEqual({
      status: 'degraded',
      configured: true,
      latencyMs: 750,
    });
    now.mockRestore();
  });

  it('degrades when DB check fails without throwing', async () => {
    process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/app';
    process.env.JWT_SECRET = 'super-secret';
    process.env.FRONT_BASE_URL = 'https://app.test';
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.test';
    const dataSource = { query: jest.fn().mockRejectedValue(new Error('connection refused')) };

    const result = await new HealthService(dataSource as any).getHealth();

    expect(result.status).toBe('degraded');
    expect(result.checks.db).toEqual({
      status: 'down',
      configured: true,
    });
  });

  it('reports cron freshness rows and ignores invalid timestamps', async () => {
    process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/app';
    process.env.JWT_SECRET = 'super-secret';
    process.env.FRONT_BASE_URL = 'https://app.test';
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.test';
    const lastRunAt = new Date(Date.now() - 7_200_000);
    const dataSource = {
      query: jest.fn(async (sql: string) => sql === 'SELECT 1'
        ? [{ ok: 1 }]
        : [
          { name: 'daily-job', lastRunAt },
          { name: 'invalid-job', lastRunAt: 'not-a-date' },
        ]),
    };

    const result = await new HealthService(dataSource as any).getHealth();

    expect(result.checks.crons).toEqual({
      status: 'ok',
      jobs: [
        {
          name: 'daily-job',
          lastRunAt: lastRunAt.toISOString(),
          hoursAgo: 2,
        },
        { name: 'invalid-job', lastRunAt: null, hoursAgo: null },
      ],
    });
  });

  it('keeps cron history informational when its query fails', async () => {
    process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/app';
    process.env.JWT_SECRET = 'super-secret';
    process.env.FRONT_BASE_URL = 'https://app.test';
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.test';
    const dataSource = {
      query: jest.fn(async (sql: string) => {
        if (sql === 'SELECT 1') return [{ ok: 1 }];
        throw new Error('admin_job_runs missing');
      }),
    };

    const result = await new HealthService(dataSource as any).getHealth();

    expect(result.status).toBe('ok');
    expect(result.checks.crons).toEqual({ status: 'skipped', jobs: [] });
  });

  it('checks configured Redis and reports a healthy low-latency response', async () => {
    process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/app';
    process.env.JWT_SECRET = 'super-secret';
    process.env.FRONT_BASE_URL = 'https://app.test';
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.test';
    process.env.REDIS_HOST = 'redis.test';
    process.env.REDIS_PORT = '6380';
    process.env.REDIS_PASSWORD = 'secret';
    process.env.REDIS_TLS = 'true';
    const dataSource = { query: jest.fn().mockResolvedValue([]) };

    const result = await new HealthService(dataSource as any).getHealth();

    expect(result.status).toBe('ok');
    expect(result.checks.redis).toEqual({
      status: 'ok',
      configured: true,
      latencyMs: expect.any(Number),
    });
    expect(mockRedisClient.connect).toHaveBeenCalledTimes(1);
    expect(mockRedisClient.ping).toHaveBeenCalledTimes(1);
    expect(mockRedisClient.quit).toHaveBeenCalledTimes(1);
  });

  it('degrades when configured Redis is slow', async () => {
    process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/app';
    process.env.JWT_SECRET = 'super-secret';
    process.env.FRONT_BASE_URL = 'https://app.test';
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.test';
    process.env.REDIS_HOST = 'redis.test';
    jest.spyOn(Date, 'now').mockReturnValueOnce(100).mockReturnValueOnce(800);

    const result = await new HealthService(undefined as any).getHealth();

    expect(result.status).toBe('degraded');
    expect(result.checks.redis).toMatchObject({ status: 'degraded', latencyMs: 700 });
  });

  it('degrades when Redis fails and disconnects if graceful quit also fails', async () => {
    process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/app';
    process.env.JWT_SECRET = 'super-secret';
    process.env.FRONT_BASE_URL = 'https://app.test';
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.test';
    process.env.REDIS_PASSWORD = 'secret';
    const dataSource = { query: jest.fn().mockResolvedValue([]) };
    mockRedisClient.connect.mockRejectedValueOnce(new Error('redis unavailable'));
    mockRedisClient.quit.mockRejectedValueOnce(new Error('socket closed'));

    const result = await new HealthService(dataSource as any).getHealth();

    expect(result.status).toBe('degraded');
    expect(result.checks.redis).toEqual({ status: 'down', configured: true });
    expect(mockRedisClient.disconnect).toHaveBeenCalledTimes(1);
  });

  it('reports env readiness as booleans without exposing values', async () => {
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '3306';
    process.env.DB_USER = 'root';
    process.env.DB_NAME = 'urban';
    process.env.JWT_SECRET = 'very-sensitive';
    process.env.FRONT_BASE_URL = 'https://app.test';
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.test';
    process.env.STRIPE_SECRET_KEY = 'sk_test_secret';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_secret';
    process.env.SUCCESS_URL = 'https://app.test/success';
    process.env.CANCEL_URL = 'https://app.test/cancel';
    process.env.BREVO_API_KEY = 'brevo-secret';
    process.env.EMAIL_SENDER = 'noreply@test';

    const result = await new HealthService(undefined as any).getHealth();
    const serialized = JSON.stringify(result);

    expect(result.checks.env.database).toEqual({
      ready: true,
      required: {
        DATABASE_URL: false,
        DB_HOST: true,
        DB_PORT: true,
        DB_USER: true,
        DB_NAME: true,
      },
    });
    expect(result.checks.env.auth).toEqual({
      ready: true,
      required: { JWT_SECRET: true },
    });
    expect(result.checks.env.billing.ready).toBe(true);
    expect(result.checks.env.email.ready).toBe(true);
    expect(serialized).not.toContain('very-sensitive');
    expect(serialized).not.toContain('sk_test_secret');
    expect(serialized).not.toContain('brevo-secret');
  });

  it('keeps partially configured database and email groups unready', async () => {
    process.env.DB_HOST = 'localhost';
    process.env.BREVO_API_KEY = 'partial-email-config';

    const result = await new HealthService(undefined as any).getHealth();

    expect(result.checks.env.database).toMatchObject({ ready: false });
    expect(result.checks.env.email).toEqual({
      ready: false,
      required: { BREVO_API_KEY: true, EMAIL_SENDER: false },
    });
  });

  it('degrades when critical env groups are not ready', async () => {
    const result = await new HealthService(undefined as any).getHealth();

    expect(result.status).toBe('degraded');
    expect(result.checks.env.database.ready).toBe(false);
    expect(result.checks.env.auth.ready).toBe(false);
    expect(result.checks.env.server.ready).toBe(false);
  });

  describe('readiness access', () => {
    it('allows local/test readiness without token for developer compatibility', () => {
      expect(() => new HealthService(undefined as any).assertReadinessAccess()).not.toThrow();
    });

    it('allows explicitly public readiness regardless of runtime casing', () => {
      process.env.APP_ENV = 'PRODUCTION';
      process.env.HEALTH_READINESS_PUBLIC = ' TRUE ';

      expect(() => new HealthService(undefined as any).assertReadinessAccess()).not.toThrow();
    });

    it('fails closed in staging when the readiness token is missing', () => {
      process.env.APP_ENV = 'staging';

      expect(() => new HealthService(undefined as any).assertReadinessAccess()).toThrow(
        ServiceUnavailableException,
      );
    });

    it('fails closed when the protected runtime uses uppercase configuration', () => {
      process.env.APP_ENV = 'PRODUCTION';

      expect(() => new HealthService(undefined as any).assertReadinessAccess()).toThrow(
        ServiceUnavailableException,
      );
    });

    it('rejects invalid bearer token when readiness token is configured', () => {
      process.env.APP_ENV = 'staging';
      process.env.HEALTH_READINESS_TOKEN = 'expected-token';

      expect(() => new HealthService(undefined as any).assertReadinessAccess('Bearer wrong-token')).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects malformed and different-length bearer tokens', () => {
      process.env.APP_ENV = 'staging';
      process.env.HEALTH_READINESS_TOKEN = 'expected-token';
      const service = new HealthService(undefined as any);

      expect(() => service.assertReadinessAccess('Basic expected-token')).toThrow(
        UnauthorizedException,
      );
      expect(() => service.assertReadinessAccess(['Bearer short'])).toThrow(
        UnauthorizedException,
      );
    });

    it('accepts the enterprise fallback token supplied as a header array', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.APP_ENV;
      process.env.ENTERPRISE_GATE_HEALTH_TOKEN = 'enterprise-token';

      expect(() => new HealthService(undefined as any).assertReadinessAccess([
        'Bearer enterprise-token',
        'Bearer ignored',
      ])).not.toThrow();
    });

    it('accepts valid bearer token when readiness token is configured', () => {
      process.env.APP_ENV = 'staging';
      process.env.HEALTH_READINESS_TOKEN = 'expected-token';

      expect(() =>
        new HealthService(undefined as any).assertReadinessAccess('Bearer expected-token'),
      ).not.toThrow();
    });

    it('requires an explicitly configured token even in a developer runtime', () => {
      process.env.HEALTH_READINESS_TOKEN = 'local-protected-token';
      const service = new HealthService(undefined as any);

      expect(() => service.assertReadinessAccess()).toThrow(UnauthorizedException);
      expect(() => service.assertReadinessAccess('Bearer local-protected-token')).not.toThrow();
    });
  });

  it('degrades protected readiness when the database check cannot be executed', async () => {
    process.env.APP_ENV = 'production';
    process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/app';
    process.env.JWT_SECRET = 'super-secret';
    process.env.FRONT_BASE_URL = 'https://app.test';
    process.env.CORS_ALLOWED_ORIGINS = 'https://app.test';

    const result = await new HealthService(undefined as any).getHealth();

    expect(result.checks.db.status).toBe('skipped');
    expect(result.status).toBe('degraded');
  });
});
