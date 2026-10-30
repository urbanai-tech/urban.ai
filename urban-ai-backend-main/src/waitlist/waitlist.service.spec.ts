import { randomInt } from 'crypto';
import { TERMS_VERSION } from '../auth/terms.constants';
import { WaitlistService, WaitlistSignupOutcome } from './waitlist.service';

jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return { ...actual, randomInt: jest.fn(actual.randomInt) };
});

describe('WaitlistService.generateUniqueReferralCode', () => {
  const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

  function build(findOne: jest.Mock) {
    return new WaitlistService({ findOne } as any, {} as any) as any;
  }

  it('gera 8 caracteres do alfabeto sem ambiguidades', async () => {
    const svc = build(jest.fn().mockResolvedValue(null));
    for (let i = 0; i < 50; i++) {
      const code: string = await svc.generateUniqueReferralCode();
      expect(code).toHaveLength(8);
      for (const ch of code) expect(ALPHABET).toContain(ch);
    }
  });

  it('usa crypto.randomInt (sem viés de módulo) com o tamanho exato do alfabeto', async () => {
    const spy = randomInt as unknown as jest.Mock;
    spy.mockClear();
    const svc = build(jest.fn().mockResolvedValue(null));
    await svc.generateUniqueReferralCode();
    expect(spy).toHaveBeenCalledTimes(8);
    for (const call of spy.mock.calls) expect(call[0]).toBe(ALPHABET.length);
  });

  it('tenta de novo quando o código já existe', async () => {
    const findOne = jest.fn().mockResolvedValueOnce({ id: 1 }).mockResolvedValue(null);
    const svc = build(findOne);
    const code: string = await svc.generateUniqueReferralCode();
    expect(code).toHaveLength(8);
    expect(findOne).toHaveBeenCalledTimes(2);
  });
});

describe('WaitlistService.signup', () => {
  const originalEnv = process.env.WAITLIST_SIGNUP_EMAIL_DISABLED;
  let repo: any;
  let mailer: any;
  let service: WaitlistService;

  beforeEach(() => {
    delete process.env.WAITLIST_SIGNUP_EMAIL_DISABLED;
    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(10),
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => ({ id: 'w1', ...v })),
      increment: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ max: 9 }),
      })),
    };
    mailer = { sendHtmlEmail: jest.fn().mockResolvedValue({ enviado: true, status: 'ok' }) };
    service = new WaitlistService(repo, mailer);
  });

  afterAll(() => {
    if (originalEnv === undefined) delete process.env.WAITLIST_SIGNUP_EMAIL_DISABLED;
    else process.env.WAITLIST_SIGNUP_EMAIL_DISABLED = originalEnv;
  });

  it('novo cadastro devolve posição e referralCode ao próprio usuário', async () => {
    const result = (await service.signup({
      email: 'Novo@Exemplo.com',
      name: 'Ana Silva',
    })) as Extract<WaitlistSignupOutcome, { alreadyRegistered: false }>;

    expect(result.alreadyRegistered).toBe(false);
    expect(result.position).toBe(10);
    expect(result.referralCode).toEqual(expect.any(String));
    expect(result.aheadOfYou).toBe(9);
    expect(result.totalSignups).toBe(10);
  });

  it('grava data e versão dos termos quando acceptedTerms é true', async () => {
    await service.signup({ email: 'novo@exemplo.com', acceptedTerms: true });

    const saved = repo.save.mock.calls[0][0];
    expect(saved.termsVersion).toBe(TERMS_VERSION);
    expect(saved.termsAcceptedAt).toBeInstanceOf(Date);
  });

  it('não grava aceite quando acceptedTerms não vem (ex.: fluxos antigos)', async () => {
    await service.signup({ email: 'novo@exemplo.com' });

    const saved = repo.save.mock.calls[0][0];
    expect(saved.termsVersion).toBeNull();
    expect(saved.termsAcceptedAt).toBeNull();
  });

  it('e-mail já cadastrado recebe resposta genérica, sem position/referralCode', async () => {
    repo.findOne.mockResolvedValueOnce({
      id: 'w0',
      email: 'ja@exemplo.com',
      position: 3,
      referralCode: 'SEGREDO1',
    });

    const result = await service.signup({ email: 'ja@exemplo.com' });

    expect(result).toEqual({ alreadyRegistered: true, totalSignups: 10 });
    expect(JSON.stringify(result)).not.toContain('SEGREDO1');
    expect(result).not.toHaveProperty('position');
    expect(result).not.toHaveProperty('referralCode');
    expect(repo.save).not.toHaveBeenCalled();
    expect(mailer.sendHtmlEmail).not.toHaveBeenCalled();
  });

  it('escapa o nome no HTML do e-mail de confirmação (sem injeção de HTML)', async () => {
    await service.signup({
      email: 'vitima@exemplo.com',
      name: '<img src=x onerror=alert(1)>Maria',
    });

    expect(mailer.sendHtmlEmail).toHaveBeenCalledTimes(1);
    const html: string = mailer.sendHtmlEmail.mock.calls[0][2];
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });
});
