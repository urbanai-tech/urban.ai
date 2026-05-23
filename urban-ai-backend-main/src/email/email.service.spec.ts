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
    const service = new EmailService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      mailer as any,
      push as any,
      pricingDigest as any,
      communicationPreferences as any,
    );
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
          title: 'Sugestao pronta',
          description: 'Ajuste recomendado',
          redirectTo: '/dashboard',
          propertyTitle: 'Studio Paulista',
          reasons: ['Evento proximo'],
          createdAt: '2026-05-23T12:00:00Z',
        },
      ],
    });

    expect(communicationPreferences.getForUser).toHaveBeenCalledWith('user-1');
    expect(mailer.sendHtmlEmail).not.toHaveBeenCalled();
    expect(push.sendToUser).not.toHaveBeenCalled();
    expect(pricingDigest.markSkipped).toHaveBeenCalledWith(
      'digest-1',
      'pricing_digest_opted_out_before_flush',
    );
    expect(pricingDigest.markSent).not.toHaveBeenCalled();
  });
});
