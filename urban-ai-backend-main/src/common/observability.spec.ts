import {
  normalizeRequestId,
  redactObservabilityData,
  resolveObservabilityRuntime,
  safeRouteTemplate,
} from './observability';

describe('observability safeguards', () => {
  it('resolves environment and release with deterministic deployment fallbacks', () => {
    expect(
      resolveObservabilityRuntime({ APP_ENV: 'staging', SENTRY_RELEASE: 'api@abc123' }),
    ).toEqual({ environment: 'staging', release: 'api@abc123' });
    expect(
      resolveObservabilityRuntime({ NODE_ENV: 'production', RAILWAY_GIT_COMMIT_SHA: 'def456' }),
    ).toEqual({ environment: 'production', release: 'def456' });
    expect(resolveObservabilityRuntime({})).toEqual({
      environment: 'development',
      release: 'unknown',
    });
  });

  it('preserves bounded opaque request ids and rejects PII/token-like values', () => {
    expect(normalizeRequestId('edge-req_123', () => 'fallback')).toBe('edge-req_123');
    expect(normalizeRequestId('owner@example.com', () => 'fallback')).toBe('fallback');
    expect(normalizeRequestId('Bearer-real-token', () => 'fallback')).toBe('fallback');
    expect(normalizeRequestId(`Bearer-${'x'.repeat(200)}`, () => 'fallback')).toBe('fallback');
  });

  it('redacts secrets and PII recursively without dropping safe diagnostics', () => {
    const sanitized = redactObservabilityData({
      requestId: 'req-1',
      email: 'owner@example.com',
      nested: {
        authorization: 'Bearer real-token',
        message: 'login owner@example.com token?token=abc123 password=raw cookie: session-id',
        database: 'mysql://root:secret@db.internal:3306/app',
        stripe: 'sk_live_supersecret',
      },
    });

    expect(sanitized).toEqual({
      requestId: 'req-1',
      email: '[REDACTED]',
      nested: {
        authorization: '[REDACTED]',
        message: 'login [REDACTED_EMAIL] token?token=[REDACTED] password=[REDACTED] cookie: [REDACTED]',
        database: 'mysql://[REDACTED]:[REDACTED]@db.internal:3306/app',
        stripe: '[REDACTED_KEY]',
      },
    });
  });

  it('logs route templates without query strings or embedded email addresses', () => {
    expect(
      safeRouteTemplate({ baseUrl: '/auth', route: { path: '/user/:id' }, path: '/ignored' }),
    ).toBe('/auth/user/:id');
    expect(safeRouteTemplate({ path: '/lookup/owner@example.com?token=abc' })).toBe(
      '/lookup/[REDACTED_EMAIL]',
    );
  });
});
