import { RedisLockClient, RedisLockService } from '../common/redis-lock';
import { StaysAutoApplyService } from './stays-auto-apply.service';

/** Redis fake mínimo: SET NX PX + scripts de release/renew por token. */
function fakeRedis(options: { down?: boolean } = {}): RedisLockClient & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async set(key, value) {
      if (options.down) throw new Error('ECONNREFUSED');
      if (store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    },
    async eval(_script, _numKeys, key, token) {
      if (options.down) throw new Error('ECONNREFUSED');
      if (store.get(String(key)) !== token) return 0;
      store.delete(String(key));
      return 1;
    },
  };
}

describe('StaysAutoApplyService distributed lock (TD3)', () => {
  const build = (redis: RedisLockClient) => {
    const lock = new RedisLockService(redis, { failOpenByDefault: false });
    jest.spyOn((lock as any).logger, 'log').mockImplementation(() => undefined);
    jest.spyOn((lock as any).logger, 'error').mockImplementation(() => undefined);
    const service = new StaysAutoApplyService(
      {} as any, {} as any, {} as any, {} as any, undefined, undefined, lock,
    );
    const processBatch = jest.spyOn(service, 'processBatch').mockResolvedValue({
      processed: 0, eligible: 0, applied: 0, dryRun: 0, blocked: 0, errors: 0,
    } as any);
    return { service, processBatch };
  };

  afterEach(() => jest.restoreAllMocks());

  it('runs the batch when it gets the lock and releases it afterwards', async () => {
    const redis = fakeRedis();
    const { service, processBatch } = build(redis);
    await service.handleCron();
    expect(processBatch).toHaveBeenCalledTimes(1);
    expect(redis.store.size).toBe(0);
  });

  it('skips the tick when another replica holds the lock (no price pushed twice)', async () => {
    const redis = fakeRedis();
    redis.store.set('urban:lock:job:stays-auto-apply', 'other-replica-token');
    const { service, processBatch } = build(redis);
    await service.handleCron();
    expect(processBatch).not.toHaveBeenCalled();
    expect(redis.store.get('urban:lock:job:stays-auto-apply')).toBe('other-replica-token');
  });

  it('fails closed (skips) when Redis is down', async () => {
    const { service, processBatch } = build(fakeRedis({ down: true }));
    await expect(service.handleCron()).resolves.toBeUndefined();
    expect(processBatch).not.toHaveBeenCalled();
  });
});
