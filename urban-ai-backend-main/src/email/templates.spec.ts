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

  it('renders pricing digest with property identity and unique reasons', () => {
    const html = EmailTemplates.getPricingRecommendationDigestTemplate({
      nome: 'Gustavo Urban',
      dashboardUrl: 'https://app.myurbanai.com/dashboard',
      items: [
        {
          propertyTitle: 'Apartamento em Perdizes',
          propertyNickname: 'Perdizes 1Q',
          propertyCode: 'PER-01',
          propertyAddress: 'Rua Apiacás, 100, Perdizes, São Paulo - SP',
          title: 'Sugestões de preço disponíveis',
          description: 'Geramos 2 sugestões de preço para a propriedade Apartamento em Perdizes.',
          redirectTo: '/dashboard?propertyId=list-1',
          currentPrice: 220,
          suggestedPrice: 286,
          liftPercent: 30,
          reasons: [
            'Principal sinal: Show no Allianz em 25 mai. (São Paulo - SP), relevância 92/100.',
            'O evento mais forte está a 1,4 km do imóvel e público estimado de 45.000 pessoas.',
          ],
        },
      ],
    });

    expect(html).toContain('1 recomendação de preço para revisar');
    expect(html).toContain('Apartamento em Perdizes');
    expect(html).toContain('Apelido');
    expect(html).toContain('Perdizes 1Q');
    expect(html).toContain('Rua Apiacás, 100');
    expect(html).toContain('Preço: atual R$ 220 | sugerido R$ 286 | +30%');
    expect(html).toContain('Show no Allianz');
    expect(html).not.toContain('Eventos futuros e demanda local perto do imóvel');
  });
});

describe('EmailTemplates - escape de HTML em valores controlados pelo usuário', () => {
  const evil = '<script>alert(1)</script>"\'';
  const expectSafe = (html: string) => {
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  };

  it('escapa nome/links em reset de senha, confirmação, boas-vindas e análise', () => {
    expectSafe(EmailTemplates.getForgotPasswordTemplate(evil, 'https://x.test/a"><script>alert(1)</script>'));
    expectSafe(EmailTemplates.getConfirmEmailTemplate(evil, '123456', 'https://x.test'));
    expectSafe(EmailTemplates.getWelcomeTemplate(evil, 'https://x.test'));
    expectSafe(EmailTemplates.getAnalysisStartedTemplate(evil, 'https://x.test'));
    expectSafe(EmailTemplates.getAnalysisFinishedTemplate(evil, 'https://x.test'));
  });

  it('escapa nome nos e-mails de ciclo de vida e onboarding', () => {
    expectSafe(
      EmailTemplates.getQuotaWarningTemplate({ nome: evil, contratados: 5, ativos: 4, upgradeUrl: 'https://x.test' }),
    );
    expectSafe(
      EmailTemplates.getOnboardingDay1Template({
        nome: evil,
        propertiesCount: 0,
        dashboardUrl: 'https://x.test',
        propertiesUrl: 'https://x.test',
      }),
    );
    expectSafe(
      EmailTemplates.getSubscriptionActiveTemplate({
        nome: 'Ana',
        planName: evil,
        billingCycle: 'monthly',
        listingsContratados: 1,
        totalAmountCents: 1000,
        nextBillingDate: '2026-01-01',
        dashboardUrl: 'https://x.test',
      }),
    );
  });

  it('escapa título, nome, descrição e url da notificação de sistema', () => {
    const html = EmailTemplates.getSystemNotificationTemplate(
      evil,
      evil,
      `${evil}\nlinha 2`,
      'https://x.test/?a="><script>',
    );
    expectSafe(html);
    expect(html).toContain('<br/>');
    expect(html).not.toContain('"><script>');
  });
});

describe('EmailTemplates - relatório do proprietário (ADR 0027)', () => {
  const evil = '<script>alert(1)</script>"\'';

  it('e-mail ao proprietário: link, validade, descadastro e aviso; tudo escapado', () => {
    const html = EmailTemplates.getOwnerMonthlyReportTemplate({
      ownerName: evil,
      preparedBy: evil,
      periodLabel: 'outubro de 2026',
      reportUrl: 'https://app.myurbanai.com/relatorio/abc.def',
      expiresLabel: '03/12/2026',
      summaryLines: ['2 imóveis no relatório.', evil],
      unsubscribeUrl: 'https://api.myurbanai.com/owner-reports/unsubscribe?token=x"><script>',
      notice: evil,
    });
    expect(html).toContain('Relatório de outubro de 2026');
    expect(html).toContain('https://app.myurbanai.com/relatorio/abc.def');
    expect(html).toContain('03/12/2026');
    expect(html).toContain('Deixar de receber estes relatórios');
    expect(html).toContain('sem dado');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('"><script>');
    expect(html).not.toContain('undefined');
  });

  it('e-mail ao proprietário sem nome do anfitrião usa texto neutro', () => {
    const html = EmailTemplates.getOwnerMonthlyReportTemplate({
      ownerName: 'Maria Souza',
      preparedBy: null,
      periodLabel: 'outubro de 2026',
      reportUrl: 'https://x.test/r',
      expiresLabel: '03/12/2026',
      summaryLines: [],
      unsubscribeUrl: 'https://x.test/u',
      notice: 'aviso',
    });
    expect(html).toContain('O responsável pela administração dos seus imóveis compartilhou');
    expect(html).toContain('Olá, <b>Maria</b>');
  });

  it('lembrete ao anfitrião: singular/plural e links escapados', () => {
    const one = EmailTemplates.getOwnerReportReminderTemplate({
      nome: 'Ana Host',
      pendingTotal: 1,
      ownerCount: 1,
      resultsUrl: 'https://app/painel',
      ownersUrl: 'https://app/proprietarios',
      settingsUrl: 'https://app/settings',
    });
    expect(one).toContain('1 preço aplicado ainda sem resultado registrado');
    expect(one).toContain('1 proprietário recebe');
    const many = EmailTemplates.getOwnerReportReminderTemplate({
      nome: evil,
      pendingTotal: 4,
      ownerCount: 2,
      resultsUrl: 'https://app/painel?a="><script>',
      ownersUrl: 'https://app/proprietarios',
      settingsUrl: 'https://app/settings',
    });
    expect(many).toContain('4 preços aplicados ainda sem resultado registrado');
    expect(many).toContain('2 proprietários recebem');
    expect(many).not.toContain('<script>');
  });
});
