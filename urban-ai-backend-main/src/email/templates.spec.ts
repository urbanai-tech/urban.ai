import { EmailTemplates } from './templates';

describe('EmailTemplates - billing lifecycle', () => {
  it('renders subscription active receipt with plan, cycle, quantity and invoice link', () => {
    const html = EmailTemplates.getSubscriptionActiveTemplate({
      nome: 'Gustavo Urban',
      planName: 'Profissional',
      billingCycle: 'quarterly',
      listingsContratados: 5,
      totalAmountCents: 445500,
      nextBillingDate: '2026-08-15',
      invoiceUrl: 'https://billing.stripe.test/invoice/in_123',
      dashboardUrl: 'https://app.myurbanai.com/dashboard',
    });

    expect(html).toContain('Profissional');
    expect(html).toContain('trimestral');
    expect(html).toContain('5');
    expect(html).toContain('R$ 4.455,00');
    expect(html).toContain('2026-08-15');
    expect(html).toContain('https://billing.stripe.test/invoice/in_123');
    expect(html).toContain('https://app.myurbanai.com/dashboard');
    expect(html).not.toContain('undefined');
  });

  it('renders payment failed template with retry date and payment update URL', () => {
    const html = EmailTemplates.getPaymentFailedTemplate({
      nome: 'Ana Host',
      amountCents: 9700,
      nextRetryDate: '2026-05-18',
      updatePaymentUrl: 'https://app.myurbanai.com/my-plan',
    });

    expect(html).toContain('Ana');
    expect(html).toContain('R$ 97,00');
    expect(html).toContain('2026-05-18');
    expect(html).toContain('https://app.myurbanai.com/my-plan');
    expect(html).toContain('Atualizar cart');
    expect(html).not.toContain('undefined');
  });

  it('renders subscription cancelled template with access window and reactivation link', () => {
    const html = EmailTemplates.getSubscriptionCancelledTemplate({
      nome: 'Carla Host',
      accessEndsAt: '2026-06-15',
      reactivateUrl: 'https://app.myurbanai.com/plans?reactivate=1',
    });

    expect(html).toContain('Carla');
    expect(html).toContain('Cancelamento confirmado');
    expect(html).toContain('2026-06-15');
    expect(html).toContain('https://app.myurbanai.com/plans?reactivate=1');
    expect(html).toContain('Reativar assinatura');
    expect(html).not.toContain('undefined');
  });

  it('renders quota warning and exceeded messages with counts and upgrade link', () => {
    const warning = EmailTemplates.getQuotaWarningTemplate({
      nome: 'Bruno Beta',
      contratados: 10,
      ativos: 8,
      upgradeUrl: 'https://app.myurbanai.com/plans?upsell=quota',
    });
    const exceeded = EmailTemplates.getQuotaExceededTemplate({
      nome: 'Bruno Beta',
      contratados: 10,
      tentando: 11,
      upgradeUrl: 'https://app.myurbanai.com/plans?upsell=quota',
    });

    expect(warning).toContain('80%');
    expect(warning).toContain('10 im');
    expect(warning).toContain('8');
    expect(warning).toContain('https://app.myurbanai.com/plans?upsell=quota');
    expect(warning).not.toContain('undefined');

    expect(exceeded).toContain('Limite');
    expect(exceeded).toContain('11');
    expect(exceeded).toContain('10');
    expect(exceeded).toContain('https://app.myurbanai.com/plans?upsell=quota');
    expect(exceeded).not.toContain('undefined');
  });
});
