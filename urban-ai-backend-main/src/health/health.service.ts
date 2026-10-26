import { Injectable, Logger, Optional, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { promises as dnsPromises } from 'dns';
import { isIP } from 'net';
import { getQueueFailureSnapshot } from '../processos/queue-failure-stats';

/**
 * Resolve o host via c-ares (`dns.resolve4`), fora do threadpool do libuv.
 * O `dns.lookup` padrão do Node usa esse threadpool (4 threads): com o MySQL
 * fora do ar, lookups que falham devagar (~3,6 s cada no Docker) ocupam as
 * threads e o lookup do Redis fica na fila até estourar o connectTimeout,
 * marcando `redis: down` com o Redis saudável. Sem resposta a tempo (ou para
 * nomes que só existem em /etc/hosts, como `localhost`), devolve o próprio
 * host e o ioredis resolve como antes.
 */
export async function resolveHostOffThreadpool(
  host: string,
  timeoutMs = 1500,
  resolve4: (hostname: string) => Promise<string[]> = (hostname) => dnsPromises.resolve4(hostname),
): Promise<string> {
  if (isIP(host)) return host;
  let timer: NodeJS.Timeout | undefined;
  try {
    const addresses = await Promise.race([
      resolve4(host),
      new Promise<string[]>((_, reject) => {
        timer = setTimeout(() => reject(new Error('dns timeout')), timeoutMs);
      }),
    ]);
    return addresses[0] || host;
  } catch {
    return host;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Versão do app: APP_VERSION (deploy) → npm_package_version → package.json → unknown. */
function resolveAppVersion(): string {
  const fromEnv = process.env.APP_VERSION?.trim() || process.env.npm_package_version?.trim();
  if (fromEnv) return fromEnv;
  try {
    // dist/health/health.service.js → ../../package.json (raiz do backend)

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
    const protectedRuntime = this.isProtectedRuntime();
    const dbDegraded =
      db.status === 'down' ||
      db.status === 'degraded' ||
      (protectedRuntime && db.status === 'skipped');
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
        // Contadores em memória desta réplica das filas Bull (retries, falhas definitivas, travadas).
        queues: getQueueFailureSnapshot(),
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
    if (this.isTrue(process.env.HEALTH_READINESS_PUBLIC)) return;

    const protectedEnv = this.isProtectedRuntime();
    const expectedToken = (process.env.HEALTH_READINESS_TOKEN || process.env.ENTERPRISE_GATE_HEALTH_TOKEN || '').trim();

    if (!expectedToken && !protectedEnv) return;
    if (!expectedToken) {
      throw new ServiceUnavailableException('Health readiness token is not configured.');
    }

    const header = String(Array.isArray(authorization) ? authorization[0] : authorization ?? '').trim();
    const prefix = 'bearer ';
    const suppliedToken = header.slice(0, prefix.length).toLowerCase() === prefix
      ? header.slice(prefix.length).trim()
      : '';
    if (!suppliedToken || !this.safeEqual(suppliedToken, expectedToken)) {
      throw new UnauthorizedException('Invalid health readiness token.');
    }
  }

  private isProtectedRuntime(): boolean {
    const env = (process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development')
      .trim()
      .toLowerCase();
    return env === 'production' || env === 'staging';
  }

  private isTrue(value?: string): boolean {
    return value?.trim().toLowerCase() === 'true';
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
      const hostname = process.env.REDIS_HOST?.trim() || 'localhost';
      const address = await resolveHostOffThreadpool(hostname);
      const useTls = this.isTrue(process.env.REDIS_TLS);
      client = new Redis({
        host: address,
        port: parseInt(process.env.REDIS_PORT?.trim() ?? '', 10) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        // Conectando por IP, o certificado (Upstash) continua validado pelo nome original.
        tls: useTls ? (address !== hostname ? { servername: hostname } : {}) : undefined,
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
