import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { ROLES_KEY } from '../auth/roles.decorator';
import { ADMIN_AUDIT_EXPLICIT_KEY } from './admin-audit.decorator';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { maskEmail, redactForAudit } from './admin-audit.redact';

class FakeAdminController {
  send() {}
}

describe('AdminAuditInterceptor', () => {
  function setup(opts: { method?: string; roles?: string[]; explicit?: boolean } = {}) {
    const handler = FakeAdminController.prototype.send;
    if (opts.roles) Reflect.defineMetadata(ROLES_KEY, opts.roles, handler);
    else Reflect.deleteMetadata(ROLES_KEY, handler);
    if (opts.explicit) Reflect.defineMetadata(ADMIN_AUDIT_EXPLICIT_KEY, true, handler);
    else Reflect.deleteMetadata(ADMIN_AUDIT_EXPLICIT_KEY, handler);

    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const interceptor = new AdminAuditInterceptor(new Reflector(), audit as any);
    const req = {
      method: opts.method ?? 'POST',
      route: { path: '/mailer/send' },
      params: { id: 'target-1' },
      query: { dryRun: '1' },
      body: { to: 'cliente@exemplo.com', subject: 'Oi', html: '<p>corpo secreto</p>', password: 'x' },
      user: { userId: 'admin-1' },
      ip: '10.0.0.1',
    };
    const context: any = {
      getType: () => 'http',
      getHandler: () => handler,
      getClass: () => FakeAdminController,
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({ statusCode: 201 }) }),
    };
    return { interceptor, audit, context };
  }

  it('registra quem, o quê e o alvo de uma mutação admin, com corpo redigido', async () => {
    const { interceptor, audit, context } = setup({ roles: ['admin'] });

    await lastValueFrom(interceptor.intercept(context, { handle: () => of('ok') }));

    expect(audit.record).toHaveBeenCalledTimes(1);
    const entry = audit.record.mock.calls[0][0];
    expect(entry).toEqual(
      expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'POST /mailer/send',
        entityType: 'FakeAdmin',
        entityId: 'target-1',
      }),
    );
    expect(entry.after).toEqual({
      to: 'c***@exemplo.com',
      subject: 'Oi',
      html: '[omitted:20 chars]',
      password: '[REDACTED]',
    });
    expect(entry.metadata).toEqual(expect.objectContaining({ outcome: 'success', statusCode: 201 }));
    expect(JSON.stringify(entry)).not.toContain('corpo secreto');
  });

  it('registra também a tentativa que falhou', async () => {
    const { interceptor, audit, context } = setup({ roles: ['admin'] });

    await expect(
      lastValueFrom(interceptor.intercept(context, { handle: () => throwError(() => Object.assign(new Error('boom'), { status: 400 })) })),
    ).rejects.toThrow('boom');

    expect(audit.record.mock.calls[0][0].metadata).toEqual(
      expect.objectContaining({ outcome: 'failed', statusCode: 400, error: 'boom' }),
    );
  });

  it.each([
    ['GET', ['admin'], false],
    ['POST', undefined, false],
    ['POST', ['host'], false],
    ['POST', ['admin'], true],
  ])('não duplica/ignora: método %s, roles %j, explícito %s', async (method, roles, explicit) => {
    const { interceptor, audit, context } = setup({ method, roles, explicit });

    await lastValueFrom(interceptor.intercept(context, { handle: () => of('ok') }));

    expect(audit.record).not.toHaveBeenCalled();
  });
});

describe('redactForAudit', () => {
  it('mascara e-mails, oculta segredos e trunca textos longos', () => {
    expect(maskEmail('ana@x.com')).toBe('a***@x.com');
    expect(
      redactForAudit({
        email: 'ana@x.com',
        token: 'abc',
        nested: { apiKey: 'k', note: 'n'.repeat(250) },
        list: Array.from({ length: 25 }, (_, i) => i),
      }),
    ).toEqual({
      email: 'a***@x.com',
      token: '[REDACTED]',
      nested: { apiKey: '[REDACTED]', note: `${'n'.repeat(200)}...[+50]` },
      list: [...Array.from({ length: 20 }, (_, i) => i), '[+5 items]'],
    });
  });
});
