import { HealthService } from './health.service';

describe('HealthService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
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
    process.env.MAILERSEND_API_KEY = 'mailersend-secret';
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
    expect(serialized).not.toContain('mailersend-secret');
  });

  it('degrades when critical env groups are not ready', async () => {
    const result = await new HealthService(undefined as any).getHealth();

    expect(result.status).toBe('degraded');
    expect(result.checks.env.database.ready).toBe(false);
    expect(result.checks.env.auth.ready).toBe(false);
    expect(result.checks.env.server.ready).toBe(false);
  });
});
