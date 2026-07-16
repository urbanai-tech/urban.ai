import {
  evaluateAdminJobOutcome,
  runAdminJobWithTracking,
  safeAdminJobErrorPayload,
  toAdminJobRunResponse,
} from './admin-job-run-tracker';

describe('admin-job-run-tracker', () => {
  const makeRun = (overrides: Record<string, unknown> = {}) => ({
    id: 'run-1',
    name: 'fixture-job',
    status: 'success',
    triggeredByUserId: null,
    startedAt: new Date('2026-07-15T12:00:00.000Z'),
    finishedAt: new Date('2026-07-15T12:00:01.000Z'),
    durationMs: 1_000,
    result: { processed: 1 },
    errorMessage: null,
    ...overrides,
  });

  it.each([undefined, null, 0, 'done'])(
    'treats non-object result %p as success',
    (result) => {
      expect(evaluateAdminJobOutcome(result)).toEqual({
        status: 'success',
        errorMessage: null,
      });
    },
  );

  it.each([
    [{ ok: false, errorMessage: 'explicit' }, 'explicit'],
    [{ ok: false, message: 'provider failed' }, 'provider failed'],
    [{ ok: false }, 'Job reported ok=false'],
    [{ attempted: 3, failed: 3, succeeded: 0 }, 'Job failed all attempted items (3/3)'],
    [{ status: 'FAILED', message: 'batch failed' }, 'batch failed'],
    [{ status: 'error', errorMessage: 'job error' }, 'job error'],
    [{ status: 'blocked_missing_source' }, 'blocked_missing_source'],
  ])('maps an operational failure result to an error run', (result, errorMessage) => {
    expect(evaluateAdminJobOutcome(result)).toEqual({ status: 'error', errorMessage });
  });

  it.each([
    { attempted: 0, failed: 0, succeeded: 0 },
    { attempted: 3, failed: 2, succeeded: 1 },
    { status: 'completed' },
    { ok: true },
  ])('preserves successful structured result %#', (result) => {
    expect(evaluateAdminJobOutcome(result)).toEqual({
      status: 'success',
      errorMessage: null,
    });
  });

  it('serializes completed and still-running entities safely', () => {
    expect(toAdminJobRunResponse(makeRun() as any)).toMatchObject({
      id: 'run-1',
      startedAt: '2026-07-15T12:00:00.000Z',
      finishedAt: '2026-07-15T12:00:01.000Z',
    });
    expect(toAdminJobRunResponse(makeRun({ status: 'running', finishedAt: null }) as any))
      .toMatchObject({ status: 'running', finishedAt: null });
  });

  it.each([
    [new Error('boom'), { message: 'boom', status: null, code: null }],
    [{ response: { statusCode: 503, code: 'UPSTREAM_DOWN' } }, {
      message: 'Job failed', status: 503, code: 'UPSTREAM_DOWN',
    }],
    [{ message: '', status: 429, code: 'RATE_LIMITED' }, {
      message: 'Job failed', status: 429, code: 'RATE_LIMITED',
    }],
  ])('sanitizes thrown job error %#', (error, expected) => {
    expect(safeAdminJobErrorPayload(error)).toEqual(expected);
  });

  it('tracks a structured ok=false outcome as an error without throwing', async () => {
    const repo = {
      create: jest.fn((value) => ({ id: 'run-structured', ...value })),
      save: jest.fn(async (value) => ({ ...value })),
    };

    const result = await runAdminJobWithTracking(
      repo as any,
      'structured-failure',
      'admin-1',
      async () => ({ ok: false, message: 'nothing processed' }),
    );

    expect(result).toMatchObject({
      status: 'error',
      triggeredByUserId: 'admin-1',
      errorMessage: 'nothing processed',
      result: { ok: false, message: 'nothing processed' },
    });
  });

  it('uses safe fallback fields when a non-Error value is thrown', async () => {
    const saved: any[] = [];
    const repo = {
      create: jest.fn((value) => ({ id: 'run-thrown', ...value })),
      save: jest.fn(async (value) => {
        saved.push({ ...value });
        return { ...value };
      }),
    };

    await expect(runAdminJobWithTracking(
      repo as any,
      'thrown-value',
      null,
      async () => { throw { code: 'BROKEN' }; },
    )).rejects.toEqual({ code: 'BROKEN' });
    expect(saved[1]).toMatchObject({
      status: 'error',
      errorMessage: 'Job failed',
      result: { message: 'Job failed', status: null, code: 'BROKEN' },
    });
  });
});
