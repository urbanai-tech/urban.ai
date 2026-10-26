import { Global, Injectable, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';

/**
 * Lock distribuído em Redis para jobs agendados (TD3 — seguro com 2+ réplicas).
 *
 * Protocolo: `SET key token NX PX ttl` para adquirir; liberação e renovação só
 * acontecem se o valor ainda for o NOSSO token (script Lua atômico). Assim uma
 * réplica lenta cujo lock já expirou nunca apaga o lock de outra réplica.
 *
 * Política quando o Redis está indisponível (decisão por job via `failOpen`):
 *  - padrão FAIL CLOSED: o job é pulado e o erro é logado. Jobs com efeito
 *    colateral (e-mail, push, Stays, Stripe) não podem rodar em duplicidade, e
 *    perder um tick é preferível a duplicar. Os jobs de janela (`runOncePerWindow`)
 *    têm outro claim (MySQL GET_LOCK) e o próximo tick recupera o trabalho.
 *  - FAIL OPEN só em runtime local (development/test/local) ou por
 *    `failOpen: true` explícito: é o caso de dev sem Redis rodando.
 *  - `REDIS_JOB_LOCK_ENABLED=false` desliga o lock (instância única).
 */

export const RELEASE_LOCK_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
export const RENEW_LOCK_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end";

/** Subconjunto de ioredis usado pelo lock (facilita o fake nos testes). */
export interface RedisLockClient {
  set(key: string, value: string, px: 'PX', ttlMs: number, nx: 'NX'): Promise<'OK' | null>;
  eval(script: string, numKeys: number, ...args: Array<string | number>): Promise<unknown>;
  quit?(): Promise<unknown>;
}

export const REDIS_LOCK_CLIENT = 'REDIS_LOCK_CLIENT';

export type LockSkipReason = 'lock_held' | 'redis_unavailable';
export type LockOutcome<T> =
  | { status: 'ran'; value: T }
  | { status: 'skipped'; reason: LockSkipReason };

export interface LockOptions {
  /** Validade do lock; deve ser maior que o intervalo de renovação. Default 2 min. */
  ttlMs?: number;
  /** Intervalo de renovação enquanto o job roda. Default ttl/3. 0 desliga. */
  renewEveryMs?: number;
  /** true = roda sem lock se o Redis falhar. Default: só em runtime local. */
  failOpen?: boolean;
}

export const DEFAULT_LOCK_TTL_MS = 120_000;

export interface RedisLockServiceOptions {
  failOpenByDefault?: boolean;
  enabled?: boolean;
  keyPrefix?: string;
  tokenFactory?: () => string;
}

export function isLocalRuntimeEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  const runtimeEnv = env.APP_ENV || env.NODE_ENV || 'development';
  return ['development', 'dev', 'test', 'local'].includes(runtimeEnv);
}

@Injectable()
export class RedisLockService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisLockService.name);
  private readonly failOpenByDefault: boolean;
  private readonly enabled: boolean;
  private readonly keyPrefix: string;
  private readonly tokenFactory: () => string;
  readonly stats = { acquired: 0, skippedLockHeld: 0, skippedRedisUnavailable: 0, ranFailOpen: 0, lockLost: 0 };

  constructor(
    private readonly client: RedisLockClient | null,
    options: RedisLockServiceOptions = {},
  ) {
    this.failOpenByDefault = options.failOpenByDefault ?? isLocalRuntimeEnv();
    this.enabled = options.enabled ?? process.env.REDIS_JOB_LOCK_ENABLED !== 'false';
    this.keyPrefix = options.keyPrefix ?? 'urban:lock:';
    this.tokenFactory = options.tokenFactory ?? randomUUID;
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client?.quit?.();
    } catch {
      /* encerramento: nada a fazer */
    }
  }

  /** Tenta adquirir. Devolve o token (para liberar/renovar) ou null se o lock é de outro. Lança se o Redis falhar. */
  async acquire(name: string, ttlMs = DEFAULT_LOCK_TTL_MS): Promise<string | null> {
    const token = this.tokenFactory();
    const result = await this.client.set(this.keyPrefix + name, token, 'PX', ttlMs, 'NX');
    return result === 'OK' ? token : null;
  }

  /** Libera só se o token ainda for o nosso. true = liberado. */
  async release(name: string, token: string): Promise<boolean> {
    const released = await this.client.eval(RELEASE_LOCK_SCRIPT, 1, this.keyPrefix + name, token);
    return Number(released) === 1;
  }

  /** Estende o TTL só se o token ainda for o nosso. false = lock perdido. */
  async renew(name: string, token: string, ttlMs = DEFAULT_LOCK_TTL_MS): Promise<boolean> {
    const renewed = await this.client.eval(RENEW_LOCK_SCRIPT, 1, this.keyPrefix + name, token, ttlMs);
    return Number(renewed) === 1;
  }

  /**
   * Roda `fn` somente se este processo conseguir o lock `name`. Quando o lock está
   * com outra réplica (ou o Redis falha em modo fail-closed) devolve `skipped`
   * sem executar `fn`. Erros de `fn` propagam (o lock é liberado antes).
   */
  async withLock<T>(name: string, fn: () => Promise<T>, options: LockOptions = {}): Promise<LockOutcome<T>> {
    if (!this.enabled || !this.client) {
      return { status: 'ran', value: await fn() };
    }

    const ttlMs = options.ttlMs ?? DEFAULT_LOCK_TTL_MS;
    const renewEveryMs = options.renewEveryMs ?? Math.floor(ttlMs / 3);
    const failOpen = options.failOpen ?? this.failOpenByDefault;

    let token: string | null;
    try {
      token = await this.acquire(name, ttlMs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (failOpen) {
        this.stats.ranFailOpen += 1;
        this.logger.warn(`[lock:${name}] Redis indisponível (${message}); rodando SEM lock (fail-open).`);
        return { status: 'ran', value: await fn() };
      }
      this.stats.skippedRedisUnavailable += 1;
      this.logger.error(`[lock:${name}] Redis indisponível (${message}); job PULADO (fail-closed).`);
      return { status: 'skipped', reason: 'redis_unavailable' };
    }

    if (!token) {
      this.stats.skippedLockHeld += 1;
      this.logger.log(`[lock:${name}] lock em posse de outra réplica; pulando este tick.`);
      return { status: 'skipped', reason: 'lock_held' };
    }

    this.stats.acquired += 1;
    let timer: NodeJS.Timeout | undefined;
    if (renewEveryMs > 0) {
      timer = setInterval(() => {
        this.renew(name, token, ttlMs)
          .then((ok) => {
            if (!ok) {
              this.stats.lockLost += 1;
              this.logger.warn(`[lock:${name}] lock perdido durante a execução (expirou ou foi tomado).`);
              clearInterval(timer);
            }
          })
          .catch((error) =>
            this.logger.warn(
              `[lock:${name}] falha ao renovar lock: ${error instanceof Error ? error.message : String(error)}`,
            ),
          );
      }, renewEveryMs);
      timer.unref?.();
    }

    try {
      return { status: 'ran', value: await fn() };
    } finally {
      if (timer) clearInterval(timer);
      try {
        await this.release(name, token);
      } catch (error) {
        this.logger.warn(
          `[lock:${name}] falha ao liberar lock (expira sozinho em ${ttlMs}ms): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
}

/**
 * Atalho para handlers de cron: sem `RedisLockService` (testes isolados) roda direto;
 * com lock tomado/Redis fora (fail-closed) devolve `undefined` sem executar.
 */
export async function runExclusiveJob<T>(
  lock: RedisLockService | undefined,
  name: string,
  handler: () => Promise<T>,
  options?: LockOptions,
): Promise<T | undefined> {
  if (!lock) return handler();
  const outcome = await lock.withLock(`job:${name}`, handler, options);
  return outcome.status === 'ran' ? outcome.value : undefined;
}

export function createRedisLockClientFromEnv(env: NodeJS.ProcessEnv = process.env): Redis {
  const logger = new Logger('RedisLockClient');
  const client = new Redis({
    host: env.REDIS_HOST?.trim() || 'localhost',
    port: parseInt(env.REDIS_PORT ?? '', 10) || 6379,
    password: env.REDIS_PASSWORD || undefined,
    tls: env.REDIS_TLS === 'true' ? {} : undefined,
    lazyConnect: false,
    connectTimeout: 3000,
    commandTimeout: 3000,
    maxRetriesPerRequest: 1,
    // Sem fila offline: com o Redis fora o comando falha na hora (fail-fast) em vez de pendurar o cron.
    enableOfflineQueue: false,
    retryStrategy: (times) => Math.min(times * 500, 10_000),
  });
  let lastLogged = 0;
  client.on('error', (error) => {
    // ioredis emite 'error' a cada tentativa; sem listener derrubaria o processo. Loga no máx. 1x/min.
    if (Date.now() - lastLogged > 60_000) {
      lastLogged = Date.now();
      logger.warn(`Redis (locks) com erro: ${error?.message}`);
    }
  });
  return client;
}

@Global()
@Module({
  providers: [
    {
      provide: RedisLockService,
      useFactory: () => {
        if (process.env.REDIS_JOB_LOCK_ENABLED === 'false') return new RedisLockService(null, { enabled: false });
        return new RedisLockService(createRedisLockClientFromEnv() as unknown as RedisLockClient);
      },
    },
  ],
  exports: [RedisLockService],
})
export class RedisLockModule {}
