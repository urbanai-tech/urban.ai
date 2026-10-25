import { OnboardingDripService } from './onboarding-drip.service';

describe('OnboardingDripService (preferências de comunicação)', () => {
  function make(preferences: Record<string, any>) {
    const user = { id: 'u1', email: 'a@b.com', username: 'Ana', onboardingDripLastDay: null };
    const userRepo = { find: jest.fn().mockResolvedValue([user]), save: jest.fn() };
    const mailer = { sendHtmlEmail: jest.fn().mockResolvedValue({ enviado: true, status: 201 }) };
    const prefs = { getForUser: jest.fn().mockResolvedValue(preferences) };
    const service = new OnboardingDripService(
      userRepo as any,
      {} as any,
      {} as any,
      {} as any,
      mailer as any,
      prefs as any,
    );
    jest.spyOn(service as any, 'gatherContext').mockResolvedValue({
      propertiesCount: 1,
      recommendationsCount: 0,
      appliedRecommendationsCount: 0,
      hasActiveSubscription: false,
    });
    return { service, user, userRepo, mailer };
  }

  it('não envia nem marca o dia para quem desligou o onboarding', async () => {
    const { service, user, userRepo, mailer } = make({ onboardingEmails: false });

    const result = await service.processDay(1);

    expect(mailer.sendHtmlEmail).not.toHaveBeenCalled();
    expect(userRepo.save).not.toHaveBeenCalled();
    expect(user.onboardingDripLastDay).toBeNull();
    expect(result).toEqual({ eligible: 1, sent: 0, failed: 0, skipped: 1 });
  });

  it('envia com header de descadastro para quem mantém o onboarding ligado', async () => {
    const { service, mailer } = make({ onboardingEmails: true });

    const result = await service.processDay(1);

    expect(result.sent).toBe(1);
    expect(mailer.sendHtmlEmail).toHaveBeenCalledWith(
      { email: 'a@b.com', name: 'Ana' },
      expect.any(String),
      expect.any(String),
      { unsubscribe: { userId: 'u1', category: 'onboarding' } },
    );
  });
});
