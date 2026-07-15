import { EmailService } from './email.service';

describe('EmailService pricing digest', () => {
  function makeService() {
    const mailer = {
      sendHtmlEmail: jest.fn().mockResolvedValue({ enviado: true, status: 202 }),
    };
    const push = {
      sendToUser: jest.fn().mockResolvedValue({ enabled: true, sent: 1 }),
    };
    const pricingDigest = {
      markSent: jest.fn().mockResolvedValue(undefined),
      markSkipped: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };
    const communicationPreferences = {
      getForUser: jest.fn().mockResolvedValue({ emailPricing: false, pushPricing: false }),
    };
    const service = new EmailService({} as any, {} as any, {} as any, {} as any, {} as any, mailer as any, push as any, pricingDigest as any, communicationPreferences as any);
    return { service, mailer, push, pricingDigest, communicationPreferences };
  }

  it('rechecks preferences before flushing a claimed pricing digest', async () => {
    const { service, mailer, push, pricingDigest, communicationPreferences } = makeService();

    await (service as any).sendClaimedPricingRecommendationDigest({
      id: 'digest-1',
      userId: 'user-1',
      email: 'ana@example.com',
      name: 'Ana',
      wantsEmail: true,
      wantsPush: true,
      items: [
        {
          title: 'Sugestão pronta',
          description: 'Ajuste recomendado',
          redirectTo: '/dashboard',
          propertyTitle: 'Studio Paulista',
          reasons: ['Evento próximo'],
          createdAt: '2026-05-23T12:00:00Z',
        },
      ],
    });

    expect(communicationPreferences.getForUser).toHaveBeenCalledWith('user-1');
    expect(mailer.sendHtmlEmail).not.toHaveBeenCalled();
    expect(push.sendToUser).not.toHaveBeenCalled();
    expect(pricingDigest.markSkipped).toHaveBeenCalledWith('digest-1', 'pricing_digest_opted_out_before_flush');
    expect(pricingDigest.markSent).not.toHaveBeenCalled();
  });

  it('hydrates pricing digest items with property identity metadata', () => {
    const { service } = makeService();

    const item = (service as any).toPricingDigestItem({
      title: 'Sugestões de preço disponíveis',
      description: 'Geramos 2 sugestões de preço para a propriedade Apartamento em Perdizes.',
      redirectTo: '/dashboard?propertyId=list-1',
      metadata: {
        propertyTitle: 'Apartamento em Perdizes',
        propertyNickname: 'Perdizes 1Q',
        propertyCode: 'PER-01',
        propertyAddress: 'Rua Apiacás, 100, Perdizes, São Paulo - SP',
        currentPrice: 220,
        suggestedPrice: 286,
        liftPercent: 30,
        reasons: ['Show no Allianz a 1,4 km do imóvel.'],
      },
    });

    expect(item).toMatchObject({
      propertyTitle: 'Apartamento em Perdizes',
      propertyNickname: 'Perdizes 1Q',
      propertyCode: 'PER-01',
      propertyAddress: 'Rua Apiacás, 100, Perdizes, São Paulo - SP',
      currentPrice: 220,
      suggestedPrice: 286,
      liftPercent: 30,
      reasons: ['Show no Allianz a 1,4 km do imóvel.'],
    });
  });
});

describe('EmailService public confirmation security', () => {
  const originalEnv = process.env;

  function makeSecurityService() {
    const userRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const confirmationRepository = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((value) => ({ id: 'confirmation-1', ...value })),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const passwordResetRepository = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((value) => ({ id: 'reset-1', ...value })),
      save: jest.fn().mockImplementation(async (value) => value),
      createQueryBuilder: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      }),
    };
    const mailer = {
      sendHtmlEmail: jest.fn().mockResolvedValue({ enviado: true, status: 202 }),
    };
    const service = new EmailService({} as any, userRepository as any, confirmationRepository as any, passwordResetRepository as any, {} as any, mailer as any, {} as any, {} as any, {} as any);
    return {
      service,
      userRepository,
      confirmationRepository,
      passwordResetRepository,
      mailer,
    };
  }

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      APP_ENV: 'test',
      EMAIL_CONFIRMATION_CODE_SECRET: 'test-confirmation-secret-with-enough-entropy',
      EMAIL_PUBLIC_RESPONSE_MIN_MS: '0',
      EMAIL_PUBLIC_RESPONSE_JITTER_MS: '0',
      EMAIL_CONFIRMATION_MAX_ATTEMPTS: '5',
      EMAIL_CONFIRMATION_LOCKOUT_MINUTES: '15',
      FRONT_BASE_URL: 'https://app.example.test',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('returns the same public send response and padding path for existing and unknown accounts', async () => {
    const { service, userRepository, confirmationRepository, mailer } = makeSecurityService();
    const user = {
      id: 'user-1',
      email: 'ana@example.com',
      username: 'Ana',
      ativo: false,
    };
    userRepository.findOne.mockResolvedValueOnce(user).mockResolvedValueOnce(null);
    confirmationRepository.findOne.mockResolvedValue(null);
    const pad = jest.spyOn(service as any, 'padPublicResponse').mockResolvedValue(undefined);

    const existing = await service.enviarCodigo('ana@example.com');
    const unknown = await service.enviarCodigo('missing@example.com');

    expect(existing).toEqual({ enviado: true });
    expect(unknown).toEqual(existing);
    expect(pad).toHaveBeenCalledTimes(2);
    expect(mailer.sendHtmlEmail).toHaveBeenCalledTimes(1);
  });

  it('generates a six-digit code with crypto and persists only its versioned HMAC', async () => {
    const { service, userRepository, confirmationRepository, mailer } = makeSecurityService();
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      email: 'ana@example.com',
      username: 'Ana',
      ativo: false,
    });
    confirmationRepository.findOne.mockResolvedValue(null);

    await service.enviarCodigo('ana@example.com');

    const saved = confirmationRepository.save.mock.calls[0][0];
    const html = mailer.sendHtmlEmail.mock.calls[0][2] as string;
    const rawCode = html.match(/\b\d{6}\b/)?.[0];
    expect(rawCode).toMatch(/^\d{6}$/);
    expect(saved.code).toMatch(/^hmac:v1:[a-f0-9]{64}$/);
    expect(saved.code).not.toContain(rawCode);
    expect(saved).toMatchObject({
      purpose: 'email_confirmation',
      attemptCount: 0,
      lockedUntil: null,
    });
  });

  it('returns indistinguishable failures for unknown account, absent code and wrong code', async () => {
    const { service, userRepository, confirmationRepository } = makeSecurityService();
    const user = { id: 'user-1', email: 'ana@example.com', ativo: false };
    const stored = (service as any).hashConfirmationCode(user.id, '123456');
    userRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(user).mockResolvedValueOnce(user);
    confirmationRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'confirmation-1',
      code: stored,
      purpose: 'email_confirmation',
      expiresAt: new Date(Date.now() + 60_000),
      confirmed: false,
      attemptCount: 0,
      lockedUntil: null,
    });
    const pad = jest.spyOn(service as any, 'padPublicResponse').mockResolvedValue(undefined);

    const unknown = await service.confirmarEmail('missing@example.com', '000000');
    const absent = await service.confirmarEmail('ana@example.com', '000000');
    const wrong = await service.confirmarEmail('ana@example.com', '000000');

    expect(unknown).toEqual({
      ok: false,
      motivo: 'Código inválido ou expirado',
    });
    expect(absent).toEqual(unknown);
    expect(wrong).toEqual(unknown);
    expect(pad).toHaveBeenCalledTimes(3);
  });

  it('rejects expired codes without activating the account', async () => {
    const { service, userRepository, confirmationRepository } = makeSecurityService();
    const user = { id: 'user-1', email: 'ana@example.com', ativo: false };
    userRepository.findOne.mockResolvedValue(user);
    confirmationRepository.findOne.mockResolvedValue({
      id: 'confirmation-1',
      code: (service as any).hashConfirmationCode(user.id, '123456'),
      purpose: 'email_confirmation',
      expiresAt: new Date(Date.now() - 1),
      confirmed: false,
      attemptCount: 0,
      lockedUntil: null,
    });

    await expect(service.confirmarEmail(user.email, '123456')).resolves.toEqual({
      ok: false,
      motivo: 'Código inválido ou expirado',
    });
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('increments attempts, locks the account-purpose and rejects a correct code during lockout', async () => {
    const { service, userRepository, confirmationRepository } = makeSecurityService();
    const user = { id: 'user-1', email: 'ana@example.com', ativo: false };
    const confirmation = {
      id: 'confirmation-1',
      code: (service as any).hashConfirmationCode(user.id, '123456'),
      purpose: 'email_confirmation',
      expiresAt: new Date(Date.now() + 60_000),
      confirmed: false,
      attemptCount: 0,
      lockedUntil: null as Date | null,
    };
    userRepository.findOne.mockResolvedValue(user);
    confirmationRepository.findOne.mockResolvedValue(confirmation);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await service.confirmarEmail(user.email, '000000');
    }

    expect(confirmation.attemptCount).toBe(5);
    expect(confirmation.lockedUntil).toBeInstanceOf(Date);
    await expect(service.confirmarEmail(user.email, '123456')).resolves.toEqual({
      ok: false,
      motivo: 'Código inválido ou expirado',
    });
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('does not clear an active account-purpose lockout when a new code is requested', async () => {
    const { service, userRepository, confirmationRepository, mailer } = makeSecurityService();
    const user = {
      id: 'user-1',
      email: 'ana@example.com',
      username: 'Ana',
      ativo: false,
    };
    const confirmation = {
      id: 'confirmation-1',
      code: (service as any).hashConfirmationCode(user.id, '123456'),
      purpose: 'email_confirmation',
      expiresAt: new Date(Date.now() + 60_000),
      confirmed: false,
      attemptCount: 5,
      lockedUntil: new Date(Date.now() + 60_000),
    };
    userRepository.findOne.mockResolvedValue(user);
    confirmationRepository.findOne.mockResolvedValue(confirmation);

    await expect(service.enviarCodigo(user.email)).resolves.toEqual({
      enviado: true,
    });
    expect(confirmation.attemptCount).toBe(5);
    expect(confirmationRepository.save).not.toHaveBeenCalled();
    expect(mailer.sendHtmlEmail).not.toHaveBeenCalled();
  });

  it('supports one-time verification of legacy plaintext and activates via the loaded owner', async () => {
    const { service, userRepository, confirmationRepository } = makeSecurityService();
    const user = { id: 'user-1', email: 'ana@example.com', ativo: false };
    const confirmation = {
      id: 'legacy-1',
      code: '123456',
      purpose: 'email_confirmation',
      expiresAt: new Date(Date.now() + 60_000),
      confirmed: false,
      attemptCount: 0,
      lockedUntil: null,
    };
    userRepository.findOne.mockResolvedValue(user);
    confirmationRepository.findOne.mockResolvedValue(confirmation);

    await expect(service.confirmarEmail(user.email, '123456')).resolves.toEqual({ ok: true });
    expect(confirmation.confirmed).toBe(true);
    expect(user).toMatchObject({ ativo: true });
    expect(userRepository.save).toHaveBeenCalledWith(user);
  });

  it('keeps forgot-password responses uniform when the provider fails or the account is absent', async () => {
    const { service, userRepository, passwordResetRepository, mailer } = makeSecurityService();
    const user = { id: 'user-1', email: 'ana@example.com', username: 'Ana' };
    userRepository.findOne.mockResolvedValueOnce(user).mockResolvedValueOnce(null);
    passwordResetRepository.save.mockImplementation(async (value) => value);
    mailer.sendHtmlEmail.mockRejectedValueOnce(new Error('provider down'));
    const pad = jest.spyOn(service as any, 'padPublicResponse').mockResolvedValue(undefined);

    const providerFailure = await service.forgotPassword(user.email);
    const unknown = await service.forgotPassword('missing@example.com');

    expect(providerFailure).toEqual({ enviado: true });
    expect(unknown).toEqual(providerFailure);
    expect(pad).toHaveBeenCalledTimes(2);
  });
});
