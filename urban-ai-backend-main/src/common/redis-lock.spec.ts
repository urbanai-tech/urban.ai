import {
  RELEASE_LOCK_SCRIPT,
  RENEW_LOCK_SCRIPT,
  RedisLockClient,
  RedisLockService,
  runExclusiveJob,
} from './redis-lock';

/** Redis fake em memória com semântica de SET NX PX e dos dois scripts Lua usados. */
class FakeRedis implements RedisLockClient {
  store = new Map<string, { value: string; expiresAt: number }>();
  now = 0;
  down = false;
  evalCalls: Array<{ script: string; args: Array<string | number> }> = [];

  private live(key: string) {
    const entry = this.store.get(key);
    if (entry && entry.expiresAt <= this.now) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  async set(key: string, value: string, _px: 'PX', ttlMs: number, _nx: 'NX') {
    if (this.down) throw new Error('ECONNREFUSED');
    if (this.live(key)) return null;
    this.store.set(key, { value, expiresAt: this.now + ttlMs });
    return 'OK' as const;
  }

  async eval(script: string, _numKeys: number, ...args: Array<string | number>) {
    if (this.down) throw new Error('ECONNREFUSED');
    this.evalCalls.push({ script, args });
    const [key, token, ttl] = args as [string, string, number?];
    const entry = this.live(key);
    if (!entry || entry.value !== token) return 0;
    if (script === RELEASE_LOCK_SCRIPT) {
      this.store.delete(key);
      return 1;
    }
    if (script === RENEW_LOCK_SCRIPT) {
      entry.expiresAt = this.now + Number(ttl);
      return 1;
    }
    throw new Error('unexpected script');
  }
}

describe('RedisLockService', () => {
  let redis: FakeRedis;
  let tokens: number;
  const make = (options: ConstructorParameters<typeof RedisLockService>[1] = {}) =>
    new RedisLockService(redis, { failOpenByDefault: false, tokenFactory: () => `token-${++tokens}`, ...options });

  beforeEach(() => {
    redis = new FakeRedis();
    tokens = 0;
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('lets only one replica run the job per tick: the second one skips without running', async () => {
    const replicaA = make();
    const replicaB = make();
    const order: string[] = [];
    let releaseA!: () => void;
    const aRunning = new Promise<void>((resolve) => (releaseA = resolve));

    const a = replicaA.withLock('job:x', async () => {
      order.push('A-start');
      await aRunning;
      order.push('A-end');
      return 'A';
    });
    await Promise.resolve();
    const b = await replicaB.withLock('job:x', async () => {
      order.push('B-ran');
      return 'B';
    });

    expect(b).toEqual({ status: 'skipped', reason: 'lock_held' });
    releaseA();
    await expect(a).resolves.toEqual({ status: 'ran', value: 'A' });
    expect(order).toEqual(['A-start', 'A-end']);
    expect(replicaB.stats.skippedLockHeld).toBe(1);
  });

  it('releases the lock after the job (success and error) so the next tick can run', async () => {
    const lock = make();
    await expect(lock.withLock('job:x', async () => 1)).resolves.toEqual({ status: 'ran', value: 1 });
    expect(redis.store.size).toBe(0);

    await expect(
      lock.withLock('job:x', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(redis.store.size).toBe(0);

    await expect(lock.withLock('job:x', async () => 2)).resolves.toEqual({ status: 'ran', value: 2 });
  });

  it('does not release a lock that now belongs to another token', async () => {
    const lock = make();
    const token = await lock.acquire('job:x');
    expect(token).toBe('token-1');

    // simula expiração do lock da réplica lenta e posse por outra réplica
    redis.now += 10 * 60_000;
    const other = await make().acquire('job:x');
    expect(other).toBe('token-2');

    await expect(lock.release('job:x', token!)).resolves.toBe(false);
    expect(redis.store.get('urban:lock:job:x')?.value).toBe('token-2');
    await expect(lock.renew('job:x', token!)).resolves.toBe(false);
  });

  it('releases and renews via the token-checked Lua scripts', async () => {
    const lock = make();
    const token = (await lock.acquire('job:x', 1000))!;
    await lock.renew('job:x', token, 5000);
    await lock.release('job:x', token);
    expect(redis.evalCalls.map((c) => c.script)).toEqual([RENEW_LOCK_SCRIPT, RELEASE_LOCK_SCRIPT]);
    expect(redis.evalCalls.every((c) => c.args[1] === token)).toBe(true);
    expect(RELEASE_LOCK_SCRIPT).toContain("redis.call('get', KEYS[1]) == ARGV[1]");
  });

  it('renews the lock while a long job runs', async () => {
    jest.useFakeTimers();
    try {
      const lock = make();
      let finish!: () => void;
      const gate = new Promise<void>((resolve) => (finish = resolve));
      const run = lock.withLock('job:long', () => gate, { ttlMs: 3000, renewEveryMs: 1000 });
      await jest.advanceTimersByTimeAsync(2500);
      finish();
      await run;
      const renewals = redis.evalCalls.filter((c) => c.script === RENEW_LOCK_SCRIPT);
      expect(renewals.length).toBe(2);
      expect(redis.store.size).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('fail-closed: skips the job and logs an error when Redis is down', async () => {
    const lock = make();
    const errorSpy = jest.spyOn((lock as any).logger, 'error').mockImplementation(() => undefined);
    redis.down = true;
    const fn = jest.fn(async () => 'side-effect');

    await expect(lock.withLock('job:email', fn)).resolves.toEqual({ status: 'skipped', reason: 'redis_unavailable' });
    expect(fn).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('PULADO (fail-closed)'));
    expect(lock.stats.skippedRedisUnavailable).toBe(1);
  });

  it('fail-open (explicit or local runtime): runs without a lock when Redis is down', async () => {
    const lock = make();
    jest.spyOn((lock as any).logger, 'warn').mockImplementation(() => undefined);
    redis.down = true;
    await expect(lock.withLock('job:readonly', async () => 'ok', { failOpen: true })).resolves.toEqual({
      status: 'ran',
      value: 'ok',
    });

    const local = make({ failOpenByDefault: true });
    jest.spyOn((local as any).logger, 'warn').mockImplementation(() => undefined);
    await expect(local.withLock('job:readonly', async () => 'ok')).resolves.toEqual({ status: 'ran', value: 'ok' });
  });

  it('does not fail the job when the release call fails after it ran', async () => {
    const lock = make();
    jest.spyOn((lock as any).logger, 'warn').mockImplementation(() => undefined);
    const fn = jest.fn(async () => {
      redis.down = true; // Redis cai durante o job
      return 'done';
    });
    await expect(lock.withLock('job:x', fn)).resolves.toEqual({ status: 'ran', value: 'done' });
  });

  it('runs directly when locking is disabled or no client is configured', async () => {
    const disabled = new RedisLockService(redis, { enabled: false });
    await expect(disabled.withLock('job:x', async () => 1)).resolves.toEqual({ status: 'ran', value: 1 });
    const noClient = new RedisLockService(null);
    await expect(noClient.withLock('job:x', async () => 2)).resolves.toEqual({ status: 'ran', value: 2 });
    expect(redis.store.size).toBe(0);
  });

  describe('runExclusiveJob', () => {
    it('runs the handler directly without a lock service', async () => {
      await expect(runExclusiveJob(undefined, 'job', async () => 7)).resolves.toBe(7);
    });

    it('returns undefined when another replica holds the lock', async () => {
      const lock = make();
      await make().acquire('job:daily');
      const handler = jest.fn(async () => 'x');
      await expect(runExclusiveJob(lock, 'daily', handler)).resolves.toBeUndefined();
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
