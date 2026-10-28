import { ADMIN_AUDIT_EXPLICIT_KEY } from '../admin-audit/admin-audit.decorator';
import { WaitlistController } from './waitlist.controller';

describe('WaitlistController', () => {
  it('grava o IP real (req.ip) em signupIp e ignora X-Forwarded-For forjado', async () => {
    const waitlist = { signup: jest.fn().mockResolvedValue({ alreadyRegistered: true, totalSignups: 1 }) };
    const controller = new WaitlistController(waitlist as any, {} as any);

    await controller.signup(
      { email: 'a@b.com' } as any,
      { ip: '198.51.100.7', headers: { 'x-forwarded-for': '6.6.6.6, 1.1.1.1', 'user-agent': 'jest' } } as any,
    );

    expect(waitlist.signup).toHaveBeenCalledWith(
      expect.objectContaining({ signupIp: '198.51.100.7', userAgent: 'jest' }),
    );
  });

  it.each(['invite', 'updateNotes', 'remove'])(
    'rota admin %s registra a própria auditoria (@AdminAuditedInHandler)',
    (name) => {
      const handler = (WaitlistController.prototype as any)[name];
      expect(Reflect.getMetadata(ADMIN_AUDIT_EXPLICIT_KEY, handler)).toBe(true);
    },
  );
});
