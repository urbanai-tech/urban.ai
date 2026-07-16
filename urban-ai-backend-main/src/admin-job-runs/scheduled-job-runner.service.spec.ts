import {
  ScheduledJobRunnerService,
  runScheduledJob,
  runScheduledJobOncePerWindow,
} from './scheduled-job-runner.service';

describe('ScheduledJobRunnerService', () => {
  it('persists running and successful AdminJobRun states while preserving the handler result', async () => {
    const saved: any[] = [];
    const repo = {
      create: jest.fn((value) => ({ id: 'run-1', ...value })),
      save: jest.fn(async (value) => {
        const entity = { ...value };
        saved.push(entity);
        return entity;
      }),
    };
    const service = new ScheduledJobRunnerService(repo as any);

    await expect(service.run('fixture-job', async () => ({ processed: 3 }))).resolves.toEqual({ processed: 3 });
    expect(saved).toHaveLength(2);
    expect(saved[0]).toMatchObject({ name: 'fixture-job', status: 'running' });
    expect(saved[1]).toMatchObject({ name: 'fixture-job', status: 'success', result: { processed: 3 } });
  });

  it('uses the handler directly when the optional runner is absent in isolated tests', async () => {
    await expect(runScheduledJob(undefined, 'fixture-job', async () => 7)).resolves.toBe(7);
  });

  it('persists an error state and preserves the original rejection', async () => {
    const saved: any[] = [];
    const repo = {
      create: jest.fn((value) => ({ id: 'run-2', ...value })),
      save: jest.fn(async (value) => {
        saved.push({ ...value });
        return { ...value };
      }),
    };
    const service = new ScheduledJobRunnerService(repo as any);

    await expect(service.run('failing-job', async () => {
      throw new Error('boom');
    })).rejects.toThrow('boom');
    expect(saved).toHaveLength(2);
    expect(saved[1]).toMatchObject({ status: 'error', errorMessage: 'boom' });
  });

  it('runs and tracks a pending local window once', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => ({ id: 'run-window', ...value })),
      save: jest.fn(async (value) => ({ ...value })),
    };
    const service = new ScheduledJobRunnerService(repo as any);

    await expect(service.runOncePerWindow(
      'window-job',
      new Date('2026-07-15T00:00:00Z'),
      async () => ({ ok: true, processed: 1 }),
      () => ({ ok: true, processed: 0 }),
    )).resolves.toEqual({ ok: true, processed: 1 });
    expect(repo.findOne).toHaveBeenCalledTimes(1);
    expect(repo.save).toHaveBeenCalledTimes(2);
  });

  it('skips a window that already has a successful AdminJobRun', async () => {
    const handler = jest.fn();
    const repo = {
      findOne: jest.fn().mockResolvedValue({ id: 'completed-run' }),
    };
    const service = new ScheduledJobRunnerService(repo as any);

    await expect(service.runOncePerWindow(
      'window-job',
      new Date('2026-07-15T00:00:00Z'),
      handler,
      () => 'duplicate',
    )).resolves.toBe('duplicate');
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects overlapping calls for the same local window without invoking the second handler', async () => {
    let releaseLookup: (value: null) => void = () => undefined;
    const repo = {
      findOne: jest.fn().mockImplementation(() => new Promise<null>((resolve) => { releaseLookup = resolve; })),
      create: jest.fn((value) => ({ id: 'overlap-run', ...value })),
      save: jest.fn(async (value) => ({ ...value })),
    };
    const service = new ScheduledJobRunnerService(repo as any);
    const firstHandler = jest.fn().mockResolvedValue('first');
    const secondHandler = jest.fn().mockResolvedValue('second');
    const windowStart = new Date('2026-07-15T00:00:00Z');

    const first = service.runOncePerWindow('window-job', windowStart, firstHandler, () => 'duplicate');
    await Promise.resolve();
    await expect(service.runOncePerWindow('window-job', windowStart, secondHandler, () => 'duplicate'))
      .resolves.toBe('duplicate');
    releaseLookup(null);
    await expect(first).resolves.toBe('first');
    expect(firstHandler).toHaveBeenCalledTimes(1);
    expect(secondHandler).not.toHaveBeenCalled();
  });

  it('treats a denied MySQL advisory lock as an overlapping execution', async () => {
    const handler = jest.fn();
    const queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([{ acquired: 0 }]),
      release: jest.fn().mockResolvedValue(undefined),
      manager: { getRepository: jest.fn() },
    };
    const repo = {
      manager: {
        connection: {
          options: { type: 'mysql' },
          createQueryRunner: jest.fn(() => queryRunner),
        },
      },
    };
    const service = new ScheduledJobRunnerService(repo as any);

    await expect(service.runOncePerWindow(
      'window-job',
      new Date('2026-07-15T00:00:00Z'),
      handler,
      () => 'duplicate',
    )).resolves.toBe('duplicate');
    expect(handler).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it.each([
    undefined,
    [],
    [{}],
    [{ acquired: null }],
  ])('fails closed when the MySQL lock response is malformed: %p', async (rows) => {
    const handler = jest.fn();
    const queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(rows),
      release: jest.fn().mockResolvedValue(undefined),
      manager: { getRepository: jest.fn() },
    };
    const repo = {
      manager: {
        connection: {
          options: { type: 'mysql' },
          createQueryRunner: jest.fn(() => queryRunner),
        },
      },
    };

    await expect(new ScheduledJobRunnerService(repo as any).runOncePerWindow(
      'window-job',
      new Date('2026-07-15T00:00:00Z'),
      handler,
      () => 'duplicate',
    )).resolves.toBe('duplicate');
    expect(handler).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('uses a local claim when a repository manager exists without a connection', async () => {
    const repo = {
      manager: {},
      findOne: jest.fn().mockResolvedValue({ id: 'completed-run' }),
    };

    await expect(new ScheduledJobRunnerService(repo as any).runOncePerWindow(
      'window-job',
      new Date('2026-07-15T00:00:00Z'),
      jest.fn(),
      () => 'duplicate',
    )).resolves.toBe('duplicate');
  });

  it('always releases the MySQL query runner when acquiring the lock throws', async () => {
    const queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockRejectedValue(new Error('lock query failed')),
      release: jest.fn().mockResolvedValue(undefined),
      manager: { getRepository: jest.fn() },
    };
    const repo = {
      manager: {
        connection: {
          options: { type: 'mysql' },
          createQueryRunner: jest.fn(() => queryRunner),
        },
      },
    };

    await expect(new ScheduledJobRunnerService(repo as any).runOncePerWindow(
      'window-job',
      new Date('2026-07-15T00:00:00Z'),
      async () => 'processed',
      () => 'duplicate',
    )).rejects.toThrow('lock query failed');
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('tracks a claimed MySQL window and releases both lock and connection', async () => {
    const trackedRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => ({ id: 'mysql-success', ...value })),
      save: jest.fn(async (value) => ({ ...value })),
    };
    const queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn()
        .mockResolvedValueOnce([{ acquired: '1' }])
        .mockResolvedValueOnce([{ released: 1 }]),
      release: jest.fn().mockResolvedValue(undefined),
      manager: { getRepository: jest.fn(() => trackedRepo) },
    };
    const repo = {
      manager: {
        connection: {
          options: { type: 'mysql' },
          createQueryRunner: jest.fn(() => queryRunner),
        },
      },
    };
    const service = new ScheduledJobRunnerService(repo as any);

    await expect(service.runOncePerWindow(
      'window-job',
      new Date('2026-07-15T00:00:00Z'),
      async () => 'processed',
      () => 'duplicate',
    )).resolves.toBe('processed');
    expect(queryRunner.connect).toHaveBeenCalledTimes(1);
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      1,
      'SELECT GET_LOCK(?, 0) AS acquired',
      [expect.stringMatching(/^urban-cron:[a-f0-9]{48}$/)],
    );
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      2,
      'SELECT RELEASE_LOCK(?) AS released',
      [expect.stringMatching(/^urban-cron:[a-f0-9]{48}$/)],
    );
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('releases a MariaDB lock without tracking when the window is already complete', async () => {
    const handler = jest.fn();
    const trackedRepo = { findOne: jest.fn().mockResolvedValue({ id: 'already-done' }) };
    const queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn()
        .mockResolvedValueOnce([{ acquired: 1 }])
        .mockResolvedValueOnce([{ released: 1 }]),
      release: jest.fn().mockResolvedValue(undefined),
      manager: { getRepository: jest.fn(() => trackedRepo) },
    };
    const repo = {
      manager: {
        connection: {
          options: { type: 'mariadb' },
          createQueryRunner: jest.fn(() => queryRunner),
        },
      },
    };
    const service = new ScheduledJobRunnerService(repo as any);

    await expect(service.runOncePerWindow(
      'window-job',
      new Date('2026-07-15T00:00:00Z'),
      handler,
      async () => 'already-processed',
    )).resolves.toBe('already-processed');
    expect(handler).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('releases the MySQL advisory lock when the claimed handler fails', async () => {
    const trackedRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => ({ id: 'mysql-run', ...value })),
      save: jest.fn(async (value) => ({ ...value })),
    };
    const queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn()
        .mockResolvedValueOnce([{ acquired: 1 }])
        .mockResolvedValueOnce([{ released: 1 }]),
      release: jest.fn().mockResolvedValue(undefined),
      manager: { getRepository: jest.fn(() => trackedRepo) },
    };
    const repo = {
      manager: {
        connection: {
          options: { type: 'mysql' },
          createQueryRunner: jest.fn(() => queryRunner),
        },
      },
    };
    const service = new ScheduledJobRunnerService(repo as any);

    await expect(service.runOncePerWindow(
      'window-job',
      new Date('2026-07-15T00:00:00Z'),
      async () => { throw new Error('claimed failure'); },
      () => 'duplicate',
    )).rejects.toThrow('claimed failure');
    expect(queryRunner.query).toHaveBeenNthCalledWith(2, 'SELECT RELEASE_LOCK(?) AS released', [expect.any(String)]);
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
    expect(trackedRepo.save).toHaveBeenCalledTimes(2);
  });

  it('uses the handler directly for a window when the optional runner is absent', async () => {
    await expect(runScheduledJobOncePerWindow(
      undefined,
      'window-job',
      new Date('2026-07-15T00:00:00Z'),
      async () => 11,
      () => 0,
    )).resolves.toBe(11);
  });

  it('delegates helper functions to an available runner', async () => {
    const runner = {
      run: jest.fn().mockResolvedValue(13),
      runOncePerWindow: jest.fn().mockResolvedValue(17),
    };
    const handler = jest.fn().mockResolvedValue(19);
    const duplicateResult = jest.fn().mockReturnValue(0);
    const windowStart = new Date('2026-07-15T00:00:00Z');

    await expect(runScheduledJob(runner as any, 'fixture-job', handler)).resolves.toBe(13);
    await expect(runScheduledJobOncePerWindow(
      runner as any,
      'window-job',
      windowStart,
      handler,
      duplicateResult,
    )).resolves.toBe(17);
    expect(runner.run).toHaveBeenCalledWith('fixture-job', handler);
    expect(runner.runOncePerWindow).toHaveBeenCalledWith(
      'window-job', windowStart, handler, duplicateResult,
    );
  });
});
