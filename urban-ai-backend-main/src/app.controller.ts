import { Controller, Get, HttpCode, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';

/**
 * AppController — endpoints públicos de saúde + utilidades.
 *
 * `/health` é o endpoint que UptimeRobot, load balancer e Railway batem.
 * Tem que ser:
 *   - rápido (< 100ms)
 *   - tolerante a falha parcial (retornar status do que está degradado, não 500 total)
 *   - sem dependência externa cara (não bate Stripe nem LLM)
 *
 * Para diagnóstico mais profundo (Stripe, Redis, dataset, AI tier), use
 * `/admin/overview` (autenticado).
 */
@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
  private readonly bootedAt = Date.now();

  constructor(
    private readonly appService: AppService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Get('health')
  async health() {
    const result = {
      status: 'ok' as 'ok' | 'degraded' | 'down',
      version: process.env.npm_package_version ?? 'unknown',
      env: process.env.NODE_ENV ?? 'development',
      uptimeSec: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: {
        process: 'ok' as const,
        db: 'unknown' as 'ok' | 'down' | 'unknown',
      },
    };

    try {
      const t0 = Date.now();
      // SELECT 1 — leve, ~5ms; valida que pool está ok e DB responde.
      await this.dataSource.query('SELECT 1');
      const elapsed = Date.now() - t0;
      result.checks.db = 'ok';
      // Se DB demorou > 500ms, marca degraded mas ainda 200 (UptimeRobot
      // não derruba serviço, só nos avisa).
      if (elapsed > 500) {
        result.status = 'degraded';
        (result as any).dbLatencyMs = elapsed;
      }
    } catch (err: any) {
      this.logger.error('Health check DB falhou', err?.message);
      result.status = 'degraded';
      result.checks.db = 'down';
    }

    return result;
  }

  /**
   * Health "live" — só responde 200. Usado por liveness probe do Railway que
   * só quer saber se o processo NestJS está vivo, sem se importar com DB.
   * Se o app responde aqui mas /health volta degraded, o load balancer não
   * mata; só o monitoring alerta.
   */
  @Get('health/live')
  @HttpCode(200)
  live() {
    return { status: 'ok', uptimeSec: Math.floor(process.uptime()) };
  }

  @Get('debug/sentry-test')
  sentryTest() {
    throw new InternalServerErrorException(
      'Sentry test error — triggered by /debug/sentry-test',
    );
  }
}
