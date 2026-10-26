import * as Sentry from '@sentry/nestjs';
import { ProcessosConsumer } from './processos.processor';
import { getQueueFailureSnapshot, resetQueueFailureStats } from './queue-failure-stats';

jest.mock('@sentry/nestjs', () => ({ captureException: jest.fn() }));
jest.mock('src/maps/maps.service', () => ({ MapsService: class MapsService {} }));

describe('ProcessosConsumer queue failure handling', () => {
  const consumer = new ProcessosConsumer({} as any);
  const job = (attemptsMade: number, attempts = 3) =>
    ({
      id: 'processo-u1-p1',
      name: '__default__',
      attemptsMade,
      opts: { attempts },
      data: { userId: 'u1', propertyAdressId: 'p1' },
    }) as any;

  beforeEach(() => {
    resetQueueFailureStats();
    jest.clearAllMocks();
    jest.spyOn((consumer as any).logger, 'warn').mockImplementation(() => undefined);
    jest.spyOn((consumer as any).logger, 'error').mockImplementation(() => undefined);
  });

  it('counts a retry (and does not alert) while attempts remain', () => {
    consumer.onFailed(job(1), new Error('timeout'));
    expect(getQueueFailureSnapshot().processos).toMatchObject({ retried: 1, permanentlyFailed: 0 });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('logs with context, counts and captures to Sentry on the last attempt', () => {
    const error = new Error('Gemini quota');
    consumer.onFailed(job(3), error);

    const snapshot = getQueueFailureSnapshot().processos;
    expect(snapshot.permanentlyFailed).toBe(1);
    expect(snapshot.lastPermanentFailure).toMatchObject({ queue: 'processos', jobId: 'processo-u1-p1', reason: 'Gemini quota' });
    expect((consumer as any).logger.error).toHaveBeenCalledWith(
      expect.stringContaining('"propertyAdressId":"p1"'),
      expect.any(String),
    );
    expect(Sentry.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        tags: expect.objectContaining({ component: 'bull-queue', queue: 'processos' }),
        extra: expect.objectContaining({ attemptsMade: 3, maxAttempts: 3, userId: 'u1' }),
      }),
    );
  });

  it('treats a job without explicit attempts as single-attempt (permanent on first failure)', () => {
    consumer.onFailed({ ...job(1), opts: {} }, new Error('x'));
    expect(getQueueFailureSnapshot().processos.permanentlyFailed).toBe(1);
  });

  it('counts stalled jobs', () => {
    consumer.onStalled(job(1));
    expect(getQueueFailureSnapshot().processos.stalled).toBe(1);
  });
});
