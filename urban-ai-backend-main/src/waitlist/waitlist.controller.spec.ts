import { ADMIN_AUDIT_EXPLICIT_KEY } from '../admin-audit/admin-audit.decorator';
import { WaitlistController } from './waitlist.controller';

describe('WaitlistController', () => {
  it('grava o IP real (req.ip) em signupIp e ignora X-Forwarded-For forjado', async () => {
    const waitlist = { signup: jest.fn().mockResolvedValue({ alreadyRegistered: true, totalSignups: 1 }) };
    const turnstile = { verify: jest.fn().mockResolvedValue(undefined) };
    const controller = new WaitlistController(waitlist as any, {} as any, turnstile as any);

    await controller.signup(
      { email: 'a@b.com', acceptedTerms: true } as any,
      { ip: '198.51.100.7', headers: { 'x-forwarded-for': '6.6.6.6, 1.1.1.1', 'user-agent': 'jest' } } as any,
    );

    expect(waitlist.signup).toHaveBeenCalledWith(
      expect.objectContaining({ signupIp: '198.51.100.7', userAgent: 'jest' }),
    );
  });

  it('repassa o aceite dos termos ao serviço', async () => {
    const waitlist = { signup: jest.fn().mockResolvedValue({ alreadyRegistered: true, totalSignups: 1 }) };
    const turnstile = { verify: jest.fn().mockResolvedValue(undefined) };
    const controller = new WaitlistController(waitlist as any, {} as any, turnstile as any);

    await controller.signup({ email: 'a@b.com', acceptedTerms: true } as any, { ip: '198.51.100.7', headers: {} } as any);

    expect(waitlist.signup).toHaveBeenCalledWith(expect.objectContaining({ acceptedTerms: true }));
  });

  it('verifica o captcha com o token e o IP real antes de inscrever', async () => {
    const order: string[] = [];
    const waitlist = {
      signup: jest.fn().mockImplementation(async () => {
        order.push('signup');
        return { alreadyRegistered: true, totalSignups: 1 };
      }),
    };
    const turnstile = {
      verify: jest.fn().mockImplementation(async () => {
        order.push('verify');
      }),
    };
    const controller = new WaitlistController(waitlist as any, {} as any, turnstile as any);

    await controller.signup(
      { email: 'a@b.com', acceptedTerms: true, captchaToken: 'tok' } as any,
      { ip: '198.51.100.7', headers: { 'x-forwarded-for': '6.6.6.6' } } as any,
    );

    expect(turnstile.verify).toHaveBeenCalledWith('tok', '198.51.100.7');
    expect(order).toEqual(['verify', 'signup']);
  });

  it('não inscreve quando o captcha é recusado', async () => {
    const waitlist = { signup: jest.fn() };
    const turnstile = { verify: jest.fn().mockRejectedValue(new Error('captcha')) };
    const controller = new WaitlistController(waitlist as any, {} as any, turnstile as any);

    await expect(
      controller.signup({ email: 'a@b.com', acceptedTerms: true } as any, { ip: '198.51.100.7', headers: {} } as any),
    ).rejects.toThrow('captcha');
    expect(waitlist.signup).not.toHaveBeenCalled();
  });

  it.each(['invite', 'updateNotes', 'remove'])(
    'rota admin %s registra a própria auditoria (@AdminAuditedInHandler)',
    (name) => {
      const handler = (WaitlistController.prototype as any)[name];
      expect(Reflect.getMetadata(ADMIN_AUDIT_EXPLICIT_KEY, handler)).toBe(true);
    },
  );
});
