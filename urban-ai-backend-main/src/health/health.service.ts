import { Injectable, Logger, Optional, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';

/** Versão do app: APP_VERSION (deploy) → npm_package_version → package.json → unknown. */
function resolveAppVersion(): string {
  const fromEnv = process.env.APP_VERSION?.trim() || process.env.npm_package_version?.trim();
  if (fromEnv) return fromEnv;
  try {
    // dist/health/health.service.js → ../../package.json (raiz do backend)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('../../package.json');
    if (pkg?.version) return String(pkg.version);
  } catch {
    /* ignore */
  }
  return 'unknown';
}

type HealthStatus = 'ok' | 'degraded' | 'down';
type CheckStatus = 'ok' | 'degraded' | 'down' | 'skipped';

type EnvGroup = {
  ready: boolean;
  required: Record<string, boolean>;
};

type EnvReadiness = {
  database: EnvGroup;
  auth: EnvGroup;
  server: EnvGroup;
  billing: EnvGroup;
  email: EnvGroup;
  integrations: EnvGroup;
};

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @Optional()
    @InjectDataSource()
    private readonly dataSource?: DataSource,
  ) {}

  async getHealth() {
    const [db, redis, crons] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkCrons(),
    ]);
    const env = this.buildEnvReadiness();
    const criticalEnvReady = env.database.ready && env.auth.ready && env.server.ready;
    const dbDegraded = db.status === 'down' || db.status === 'degraded';
    const redisDegraded = redis.status === 'down' || redis.status === 'degraded';
    const status: HealthStatus =
      dbDegraded || redisDegraded || !criticalEnvReady ? 'degraded' : 'ok';

    return {
      status,
      app: {
        name: 'urban-ai-backend',
        version: resolveAppVersion(),
        env: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development',
        uptimeSec: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      checks: {
        process: { status: 'ok' as const },
        db,
        redis,
        crons,
        env,
      },
    };
  }

  getLive() {
    return {
      status: 'ok' as const,
      uptimeSec: Math.floor(process.uptime()),
    };
  }

  assertReadinessAccess(authorization?: string | string[] | null): void {
    if (process.env.HEALTH_READINESS_PUBLIC === 'true') return;

    const env = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
    const protectedEnv = env === 'production' || env === 'staging';
    const expectedToken = (process.env.HEALTH_READINESS_TOKEN || process.env.ENTERPRISE_GATE_HEALTH_TOKEN || '').trim();

    if (!expectedToken && !protectedEnv) return;
    if (!expectedToken) {
      throw new ServiceUnavailableException('Health readiness token is not configured.');
    }

    const header = Array.isArray(authorization) ? authorization[0] : authorization;
    const match = /^Bearer\s+(.+)$/i.exec(String(header || '').trim());
    if (!match || !this.safeEqual(match[1], expectedToken)) {
      throw new UnauthorizedException('Invalid health readiness token.');
    }
  }

  private async checkDatabase(): Promise<{
    status: CheckStatus;
    configured: boolean;
    latencyMs?: number;
  }> {
    if (!this.dataSource) {
      return {
        status: 'skipped',
        configured: this.isDatabaseEnvConfigured(),
      };
    }

    const configured = this.isDatabaseEnvConfigured();

    try {
      const startedAt = Date.now();
      await this.dataSource.query('SELECT 1');
      const latencyMs = Date.now() - startedAt;

      return {
        status: latencyMs > 500 ? 'degraded' : 'ok',
        configured,
        latencyMs,
      };
    } catch (error: any) {
      this.logger.error('Health check DB falhou', error?.message);

      return {
        status: 'down',
        configured,
      };
    }
  }

  private async checkRedis(): Promise<{
    status: CheckStatus;
    configured: boolean;
    latencyMs?: number;
  }> {
    // Só checa se o Redis foi configurado (Upstash em prod). Em dev sem Redis,
    // retorna 'skipped' para não falsear o health.
    const configured = this.hasEnv('REDIS_HOST') || this.hasEnv('REDIS_PASSWORD');
    if (!configured) {
      return { status: 'skipped', configured: false };
    }

    let client: Redis | undefined;
    try {
      client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '', 10) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
        connectTimeout: 2000,
        commandTimeout: 2000,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        retryStrategy: () => null,
      });

      const startedAt = Date.now();
      await client.connect();
      await client.ping();
      const latencyMs = Date.now() - startedAt;

      return {
        status: latencyMs > 500 ? 'degraded' : 'ok',
        configured: true,
        latencyMs,
      };
    } catch (error: any) {
      this.logger.error('Health check Redis falhou', error?.message);
      return { status: 'down', configured: true };
    } finally {
      try {
        await client?.quit();
      } catch {
        client?.disconnect();
      }
    }
  }

  /**
   * OBS-1 — frescura dos crons (dead-man's switch).
   *
   * Expõe a última execução por job registrado em `admin_job_runs` para um
   * monitor externo alertar quando um cron parar de rodar. INFORMATIVO: não
   * altera o status geral do /health (cadências diferem — diário/horário/semanal
   * — então evitamos falso alarme com threshold hardcoded aqui).
   */
  private async checkCrons(): Promise<{
    status: CheckStatus;
    jobs: Array<{ name: string; lastRunAt: string | null; hoursAgo: number | null }>;
  }> {
    if (!this.dataSource) return { status: 'skipped', jobs: [] };
    try {
      const rows: Array<{ name: string; lastRunAt: Date | string }> =
        await this.dataSource.query(
          'SELECT name, MAX(startedAt) AS lastRunAt FROM admin_job_runs GROUP BY name',
        );
      const now = Date.now();
      const jobs = rows.map((r) => {
        const t = r.lastRunAt ? new Date(r.lastRunAt).getTime() : NaN;
        return {
          name: r.name,
          lastRunAt: Number.isFinite(t) ? new Date(t).toISOString() : null,
          hoursAgo: Number.isFinite(t) ? Math.round(((now - t) / 3_600_000) * 10) / 10 : null,
        };
      });
      return { status: 'ok', jobs };
    } catch (error: any) {
      // Tabela ausente (base nova) ou erro de query — não quebra o health.
      this.logger.warn(`Health check crons falhou: ${error?.message}`);
      return { status: 'skipped', jobs: [] };
    }
  }

  private buildEnvReadiness(): EnvReadiness {
    const databaseUrlConfigured = this.hasEnv('DATABASE_URL');
    const databaseParts = this.presence(['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME']);
    const database = {
      DATABASE_URL: databaseUrlConfigured,
      ...databaseParts,
    };

    return {
      database: {
        ready: databaseUrlConfigured || Object.values(databaseParts).every(Boolean),
        required: database,
      },
      auth: this.requiredGroup(['JWT_SECRET']),
      server: this.requiredGroup(['FRONT_BASE_URL', 'CORS_ALLOWED_ORIGINS']),
      billing: this.requiredGroup([
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'SUCCESS_URL',
        'CANCEL_URL',
      ]),
      email: this.anyGroup([
        ['BREVO_API_KEY', 'EMAIL_SENDER'],
      ]),
      integrations: this.requiredGroup([
        'GOOGLE_MAPS_API_KEY',
        'GEMINI_API_KEY',
        'STAYS_API_BASE_URL',
        'STAYS_TOKEN_ENCRYPTION_KEY',
      ]),
    };
  }

  private requiredGroup(names: string[]): EnvGroup {
    const required = this.presence(names);

    return {
      ready: Object.values(required).every(Boolean),
      required,
    };
  }

  private anyGroup(groups: string[][]): EnvGroup {
    const names = [...new Set(groups.flat())];
    const required = this.presence(names);

    return {
      ready: groups.some((group) => group.every((name) => required[name])),
      required,
    };
  }

  private presence(names: string[]) {
    return names.reduce<Record<string, boolean>>((acc, name) => {
      acc[name] = this.hasEnv(name);
      return acc;
    }, {});
  }

  private hasEnv(name: string) {
    return Boolean(process.env[name]?.trim());
  }

  private safeEqual(actual: string, expected: string) {
    const actualBuffer = Buffer.from(actual);
    const expectedBuffer = Buffer.from(expected);
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
  }

  private isDatabaseEnvConfigured() {
    return (
      this.hasEnv('DATABASE_URL') ||
      ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME'].every((name) => this.hasEnv(name))
    );
  }
}
