import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AdminBillingHostsService } from './admin-billing-hosts.service';

const NOW = new Date('2026-10-26T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function build(opts: { users?: any[]; payments?: any[]; user?: any; userPayments?: any[]; mailOk?: boolean } = {}) {
  const userRepo = {
    find: jest.fn().mockResolvedValue(opts.users ?? []),
    findOne: jest.fn().mockResolvedValue(opts.user ?? null),
  };
  const paymentRepo = {
    find: jest.fn().mockImplementation(async (query: any) =>
      query?.relations ? opts.payments ?? [] : opts.userPayments ?? [],
    ),
  };
  const addressRepo = { count: jest.fn().mockResolvedValue(2) };
  const payments = {
    createBillingPortalSession: jest.fn().mockResolvedValue({ url: 'https://billing.stripe.com/p/session/secret-portal' }),
    createCheckoutSession: jest.fn().mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/c/pay/secret-checkout' }),
  };
  const mailer = {
    sendHtmlEmail: jest.fn().mockResolvedValue(opts.mailOk === false ? { enviado: false, status: 500 } : { enviado: true, status: 202 }),
  };
  const service = new AdminBillingHostsService(userRepo as any, paymentRepo as any, addressRepo as any, payments as any, mailer as any);
  return { service, userRepo, paymentRepo, addressRepo, payments, mailer };
}

const host = (overrides: Record<string, unknown> = {}) => ({
  id: 'u1',
  username: 'Ana Host',
  email: 'ana@example.com',
  role: 'host',
  ativo: true,
  createdAt: new Date('2026-10-01T12:00:00Z'),
  ...overrides,
});
const pay = (userId: string, overrides: Record<string, unknown> = {}) => ({
  status: 'active',
  customerId: 'cus_1',
  planName: 'profissional',
  billingCycle: 'monthly',
  listingsContratados: 2,
  expireDate: new Date(NOW.getTime() + 20 * DAY),
  updatedAt: new Date(NOW.getTime() - DAY),
  user: { id: userId },
  ...overrides,
});

describe('AdminBillingHostsService.list', () => {
  it('lista só anfitriões (role host), cruza Payments e ordena a atenção primeiro', async () => {
    const { service, userRepo } = build({
      users: [host({ id: 'ok' }), host({ id: 'failed', email: 'f@x.com' }), host({ id: 'nopay', email: 'n@x.com' })],
      payments: [pay('ok'), pay('failed', { status: 'past_due', expireDate: new Date(NOW.getTime() - DAY) })],
    });
    const result = await service.list({}, NOW);
    expect(userRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { role: 'host' } }));
    expect(result.hosts.map((h) => [h.userId, h.status])).toEqual([
      ['failed', 'past_due'],
      ['nopay', 'none'],
      ['ok', 'active'],
    ]);
    expect(result.summary).toMatchObject({ total: 3, needsAttention: 2 });
    expect(result.truncated).toBe(false);
  });

  it('filtra por status/atenção/busca sem alterar o resumo da lista inteira', async () => {
    const { service } = build({
      users: [host({ id: 'ok' }), host({ id: 'nopay', email: 'n@x.com', username: 'Bia' })],
      payments: [pay('ok')],
    });
    const attention = await service.list({ status: 'attention' }, NOW);
    expect(attention.hosts.map((h) => h.userId)).toEqual(['nopay']);
    expect(attention.summary.total).toBe(2);
    expect((await service.list({ status: 'active' }, NOW)).hosts.map((h) => h.userId)).toEqual(['ok']);
    expect((await service.list({ search: 'bia' }, NOW)).hosts.map((h) => h.userId)).toEqual(['nopay']);
  });

  it('lista vazia não consulta Payments', async () => {
    const { service, paymentRepo } = build();
    const result = await service.list({}, NOW);
    expect(result.hosts).toEqual([]);
    expect(paymentRepo.find).not.toHaveBeenCalled();
  });
});

describe('AdminBillingHostsService.sendLink', () => {
  it('assinatura viva: manda o portal por e-mail e NÃO devolve o link na resposta', async () => {
    const { service, payments, mailer } = build({ user: host(), userPayments: [pay('u1')] });
    const result = await service.sendLink('u1', 'auto', NOW);

    expect(payments.createBillingPortalSession).toHaveBeenCalledWith('u1');
    expect(payments.createCheckoutSession).not.toHaveBeenCalled();
    expect(mailer.sendHtmlEmail).toHaveBeenCalledWith(
      { email: 'ana@example.com', name: 'Ana Host' },
      expect.stringContaining('assinatura'),
      expect.stringContaining('https://billing.stripe.com/p/session/secret-portal'),
    );
    expect(result).toEqual({ ok: true, kind: 'portal', checkoutPlan: null, sentTo: 'an***@example.com' });
    expect(JSON.stringify(result)).not.toContain('stripe.com');
  });

  it('sem nenhum Payment: checkout do trial, com a quantidade de imóveis ativos', async () => {
    const { service, payments } = build({ user: host(), userPayments: [] });
    const result = await service.sendLink('u1', 'auto', NOW);
    expect(payments.createCheckoutSession).toHaveBeenCalledWith({ plan: 'trial', billingCycle: 'monthly', quantity: 2 }, 'u1');
    expect(result).toMatchObject({ kind: 'checkout', checkoutPlan: 'trial' });
  });

  it('cancelado que já pagou plano: novo checkout no mesmo plano/ciclo/quantidade', async () => {
    const { service, payments } = build({
      user: host(),
      userPayments: [pay('u1', { status: 'canceled', planName: 'profissional', billingCycle: 'quarterly', listingsContratados: 3 })],
    });
    await service.sendLink('u1', 'auto', NOW);
    expect(payments.createCheckoutSession).toHaveBeenCalledWith({ plan: 'profissional', billingCycle: 'quarterly', quantity: 3 }, 'u1');
  });

  it('portal pedido sem cliente Stripe: 400 (não chama o Stripe)', async () => {
    const { service, payments } = build({ user: host(), userPayments: [] });
    await expect(service.sendLink('u1', 'portal', NOW)).rejects.toBeInstanceOf(BadRequestException);
    expect(payments.createBillingPortalSession).not.toHaveBeenCalled();
  });

  it('rejeita quem não é anfitrião, não existe, está desativado, é alpha ou não tem e-mail', async () => {
    await expect(build({ user: null }).service.sendLink('x')).rejects.toBeInstanceOf(NotFoundException);
    await expect(build({ user: host({ role: 'admin' }) }).service.sendLink('u1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(build({ user: host({ email: '' }) }).service.sendLink('u1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(build({ user: host({ ativo: false }) }).service.sendLink('u1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      build({ user: host(), userPayments: [pay('u1', { status: 'alpha' })] }).service.sendLink('u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('falha de e-mail vira 503 (o admin vê que não foi enviado)', async () => {
    const { service } = build({ user: host(), userPayments: [pay('u1')], mailOk: false });
    await expect(service.sendLink('u1')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('falha do Stripe vira 503 sem enviar e-mail; erros 400 do pagamento (ex.: trial já usado) propagam', async () => {
    const stripeDown = build({ user: host(), userPayments: [pay('u1')] });
    stripeDown.payments.createBillingPortalSession.mockRejectedValue(new Error('stripe offline'));
    await expect(stripeDown.service.sendLink('u1')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(stripeDown.mailer.sendHtmlEmail).not.toHaveBeenCalled();

    const trialUsed = build({ user: host(), userPayments: [] });
    trialUsed.payments.createCheckoutSession.mockRejectedValue(new BadRequestException('Você já usou o período de teste.'));
    await expect(trialUsed.service.sendLink('u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(trialUsed.mailer.sendHtmlEmail).not.toHaveBeenCalled();
  });
});
