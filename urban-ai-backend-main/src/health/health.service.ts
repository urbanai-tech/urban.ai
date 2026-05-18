import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

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
    const db = await this.checkDatabase();
    const env = this.buildEnvReadiness();
    const criticalEnvReady = env.database.ready && env.auth.ready && env.server.ready;
    const dbDegraded = db.status === 'down' || db.status === 'degraded';
    const status: HealthStatus =
      dbDegraded || !criticalEnvReady ? 'degraded' : 'ok';

    return {
      status,
      app: {
        name: 'urban-ai-backend',
        version: process.env.npm_package_version ?? 'unknown',
        env: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development',
        uptimeSec: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      checks: {
        process: { status: 'ok' as const },
        db,
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
        ['MAILERSEND_API_KEY', 'EMAIL_SENDER'],
        ['SENDGRID_API_KEY', 'EMAIL_SENDER'],
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

  private isDatabaseEnvConfigured() {
    return (
      this.hasEnv('DATABASE_URL') ||
      ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME'].every((name) => this.hasEnv(name))
    );
  }
}
