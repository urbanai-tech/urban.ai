import { ExecutionContext, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { EventsIngestApiKeyGuard } from './events-ingest-api-key.guard';

function context(headers: Record<string, string | undefined> = {}): ExecutionContext {
  const req: any = { headers };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as ExecutionContext;
}

describe('EventsIngestApiKeyGuard', () => {
  const originalEnv = process.env.EVENTS_INGEST_API_KEY;

  afterEach(() => {
    if (originalEnv == null) delete process.env.EVENTS_INGEST_API_KEY;
    else process.env.EVENTS_INGEST_API_KEY = originalEnv;
  });

  it('fails closed when EVENTS_INGEST_API_KEY is missing', () => {
    delete process.env.EVENTS_INGEST_API_KEY;
    const guard = new EventsIngestApiKeyGuard();

    expect(() => guard.canActivate(context())).toThrow(ServiceUnavailableException);
  });

  it('rejects invalid keys', () => {
    process.env.EVENTS_INGEST_API_KEY = 'secret-key';
    const guard = new EventsIngestApiKeyGuard();

    expect(() => guard.canActivate(context({ 'x-urban-events-ingest-key': 'wrong' }))).toThrow(
      UnauthorizedException,
    );
  });

  it('accepts valid key and attaches collector metadata', () => {
    process.env.EVENTS_INGEST_API_KEY = 'secret-key';
    const guard = new EventsIngestApiKeyGuard();
    const ctx = context({
      'x-urban-events-ingest-key': 'secret-key',
      'x-urban-collector': 'sp-cultura',
      'x-urban-collector-version': '2026.05.22',
      'x-urban-ingest-run-id': 'run-123',
    });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(ctx.switchToHttp().getRequest().collector).toEqual({
      actor: 'sp-cultura',
      collectorVersion: '2026.05.22',
      ingestRunId: 'run-123',
    });
  });
});
