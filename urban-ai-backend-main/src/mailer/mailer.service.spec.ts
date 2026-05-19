import { MailerService } from './mailer.service';

describe('MailerService diagnostics', () => {
  it('formats SDK object errors without leaking secrets', () => {
    const service = new MailerService();

    const diagnostic = (service as any).formatMailerError({
      statusCode: 401,
      body: {
        message: 'Invalid api key: xkeysib-secret-value',
      },
    });

    expect(diagnostic).toContain('status=401');
    expect(diagnostic).toContain('api key=[redacted]');
    expect(diagnostic).not.toContain('xkeysib-secret-value');
    expect(diagnostic).not.toContain('[object Object]');
  });

  it('extracts Brevo validation errors from arrays', () => {
    const service = new MailerService();

    const diagnostic = (service as any).formatMailerError({
      response: {
        status: 422,
        data: {
          errors: [{ message: 'The to.0.email must be a valid email address.' }],
        },
      },
    });

    expect(diagnostic).toBe(
      'status=422 message=The to.0.email must be a valid email address.',
    );
  });
});
