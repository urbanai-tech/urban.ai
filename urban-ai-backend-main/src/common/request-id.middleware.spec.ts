import { Logger } from '@nestjs/common';

const mockSetTag = jest.fn();
const mockSetContext = jest.fn();

jest.mock('@sentry/nestjs', () => ({
  getCurrentScope: () => ({ setTag: mockSetTag, setContext: mockSetContext }),
}));

import { requestIdMiddleware } from './request-id.middleware';

describe('requestIdMiddleware', () => {
  let finish: () => void;
  let res: any;
  let next: jest.Mock;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    finish = () => undefined;
    res = {
      statusCode: 200,
      setHeader: jest.fn(),
      once: jest.fn((event, callback) => {
        if (event === 'finish') finish = callback;
      }),
    };
    next = jest.fn();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    mockSetTag.mockClear();
    mockSetContext.mockClear();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('propagates a valid request id to request, response and Sentry scope', () => {
    const req: any = {
      headers: { 'x-request-id': 'edge-req-123' },
      method: 'GET',
      path: '/health',
    };

    requestIdMiddleware(req, res, next);

    expect(req.id).toBe('edge-req-123');
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'edge-req-123');
    expect(mockSetTag).toHaveBeenCalledWith('request_id', 'edge-req-123');
    expect(mockSetContext).toHaveBeenCalledWith('request_correlation', {
      requestId: 'edge-req-123',
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('replaces unsafe incoming ids instead of reflecting PII', () => {
    const req: any = {
      headers: { 'x-request-id': 'owner@example.com' },
      method: 'POST',
      path: '/auth/login',
    };

    requestIdMiddleware(req, res, next);

    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(req.id).not.toContain('owner@example.com');
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', req.id);
  });

  it('emits a structured completion log with correlation and no request payload', () => {
    const req: any = {
      headers: { 'x-request-id': 'req-structured-1' },
      method: 'POST',
      baseUrl: '/payments',
      path: '/raw-id-should-not-win',
      route: { path: '/create-checkout-session' },
      body: { password: 'must-not-log', email: 'owner@example.com' },
    };
    res.statusCode = 201;

    requestIdMiddleware(req, res, next);
    finish();

    const entry = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(entry).toMatchObject({
      event: 'http_request',
      requestId: 'req-structured-1',
      method: 'POST',
      route: '/payments/create-checkout-session',
      statusCode: 201,
    });
    expect(entry.environment).toEqual(expect.any(String));
    expect(entry.release).toEqual(expect.any(String));
    expect(entry.durationMs).toEqual(expect.any(Number));
    expect(JSON.stringify(entry)).not.toContain('must-not-log');
    expect(JSON.stringify(entry)).not.toContain('owner@example.com');
  });
});
