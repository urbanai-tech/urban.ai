import {
  mapBillingHostRow,
  maskEmail,
  sortBillingHostRows,
  summarizeBillingHosts,
} from './billing-hosts';

const NOW = new Date('2026-10-26T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const user = (overrides: Record<string, unknown> = {}) => ({
  id: 'u1',
  username: 'Ana Host',
  email: 'ana@example.com',
  role: 'host',
  ativo: true,
  createdAt: new Date('2026-10-01T12:00:00Z'),
  ...overrides,
});
const payment = (overrides: Record<string, unknown> = {}) => ({
  status: 'active',
  customerId: 'cus_1',
  planName: 'profissional',
  billingCycle: 'monthly',
  listingsContratados: 2,
  startDate: new Date(NOW.getTime() - 10 * DAY),
  expireDate: new Date(NOW.getTime() + 20 * DAY),
  updatedAt: new Date(NOW.getTime() - 1 * DAY),
  ...overrides,
});
const map = (u: any, payments: any[], extra: any = {}) =>
  mapBillingHostRow(u, payments, { now: NOW, alphaQuotasRaw: '', graceDays: 3, ...extra });

describe('mapBillingHostRow', () => {
  it('trial: mostra quantos dias faltam (arredondado para cima) e marca atenção só nos últimos 3', () => {
    const early = map(user(), [payment({ status: 'trialing', expireDate: new Date(NOW.getTime() + 9.2 * DAY) })]);
    expect(early).toMatchObject({ status: 'trialing', trialDaysLeft: 10, needsAttention: false, suggestedLink: 'portal' });

    const ending = map(user(), [payment({ status: 'trialing', expireDate: new Date(NOW.getTime() + 2.5 * DAY) })]);
    expect(ending).toMatchObject({ status: 'trialing', trialDaysLeft: 3, needsAttention: true });
    expect(ending.attentionReason).toBe('Trial termina em 3 dias.');

    const today = map(user(), [payment({ status: 'trialing', expireDate: new Date(NOW.getTime() + 0.2 * DAY) })]);
    expect(today.trialDaysLeft).toBe(1);
  });

  it('trial vencido (fora da carência) vira "trial_expired" e sugere novo checkout', () => {
    const row = map(user(), [payment({ status: 'trialing', expireDate: new Date(NOW.getTime() - 10 * DAY) })]);
    expect(row).toMatchObject({ status: 'trial_expired', entitled: false, needsAttention: true, suggestedLink: 'checkout' });
    expect(row.trialDaysLeft).toBeNull();
  });

  it('assinatura ativa em dia: sem atenção, link sugerido = portal, expõe plano e imóveis contratados', () => {
    const row = map(user(), [payment()]);
    expect(row).toMatchObject({
      status: 'active',
      entitled: true,
      needsAttention: false,
      attentionReason: null,
      suggestedLink: 'portal',
      planName: 'profissional',
      billingCycle: 'monthly',
      listingsContratados: 2,
      hasStripeCustomer: true,
    });
    expect(row.periodStart).toBe(new Date(NOW.getTime() - 10 * DAY).toISOString());
    expect(row.lastBillingEventAt).toBe(new Date(NOW.getTime() - 1 * DAY).toISOString());
  });

  it('past_due dentro da carência segue com acesso, mas pede atenção; portal para atualizar cartão', () => {
    const row = map(user(), [payment({ status: 'past_due', expireDate: new Date(NOW.getTime() - 1 * DAY) })]);
    expect(row).toMatchObject({ status: 'past_due', entitled: true, entitlementReason: 'past_due_in_grace', needsAttention: true, suggestedLink: 'portal' });
    expect(row.graceEndsAt).not.toBeNull();
  });

  it('past_due com carência esgotada: sem acesso', () => {
    const row = map(user(), [payment({ status: 'past_due', expireDate: new Date(NOW.getTime() - 10 * DAY) })]);
    expect(row).toMatchObject({ status: 'past_due', entitled: false, entitlementReason: 'past_due_grace_expired', needsAttention: true });
  });

  it('cancelado: sem acesso, sugere checkout (portal não reativa)', () => {
    const row = map(user(), [payment({ status: 'canceled' })]);
    expect(row).toMatchObject({ status: 'canceled', entitled: false, suggestedLink: 'checkout' });
  });

  it('sem Payment: status "none", atenção, checkout; checkout pendente: "incomplete"', () => {
    expect(map(user(), [])).toMatchObject({ status: 'none', needsAttention: true, suggestedLink: 'checkout', hasStripeCustomer: false });
    expect(map(user(), [payment({ status: 'pending' })])).toMatchObject({ status: 'incomplete', needsAttention: true });
  });

  it('período pago vencido sem renovar: "expired"', () => {
    const row = map(user(), [payment({ status: 'active', expireDate: new Date(NOW.getTime() - 30 * DAY) })]);
    expect(row.status).toBe('expired');
  });

  it('alpha (env ou Payment alpha) não cobra e não precisa de atenção', () => {
    expect(map(user(), [], { alphaQuotasRaw: 'ana@example.com:3' })).toMatchObject({ status: 'alpha', needsAttention: false });
    expect(map(user(), [payment({ status: 'alpha' })])).toMatchObject({ status: 'alpha' });
  });

  it('conta desativada tem prioridade', () => {
    expect(map(user({ ativo: false }), [payment()])).toMatchObject({ status: 'inactive', entitled: false });
  });

  it('usa o Payment mais recente quando há mais de um', () => {
    const row = map(user(), [
      payment({ status: 'canceled', updatedAt: new Date(NOW.getTime() - 40 * DAY), planName: 'starter' }),
      payment({ status: 'active', updatedAt: new Date(NOW.getTime() - 1 * DAY), planName: 'profissional' }),
    ]);
    expect(row).toMatchObject({ status: 'active', planName: 'profissional' });
  });

  it('campos sem dado ficam null (nada inventado)', () => {
    const row = map(user({ createdAt: null }), [payment({ startDate: null, planName: null, billingCycle: null, listingsContratados: null })]);
    expect(row.periodStart).toBeNull();
    expect(row.planName).toBeNull();
    expect(row.listingsContratados).toBeNull();
    expect(row.createdAt).toBeNull();
  });
});

describe('sortBillingHostRows / summarizeBillingHosts / maskEmail', () => {
  it('ordena atenção primeiro e, no trial, quem vence antes', () => {
    const rows = [
      map(user({ id: 'a', email: 'a@x.com' }), [payment()]),
      map(user({ id: 'b', email: 'b@x.com' }), [payment({ status: 'trialing', expireDate: new Date(NOW.getTime() + 2 * DAY) })]),
      map(user({ id: 'c', email: 'c@x.com' }), [payment({ status: 'past_due', expireDate: new Date(NOW.getTime() - 1 * DAY) })]),
      map(user({ id: 'd', email: 'd@x.com' }), [payment({ status: 'trialing', expireDate: new Date(NOW.getTime() + 1 * DAY) })]),
    ];
    expect(sortBillingHostRows(rows).map((row) => row.userId)).toEqual(['c', 'd', 'b', 'a']);
  });

  it('resume por status', () => {
    const rows = [map(user({ id: 'a' }), [payment()]), map(user({ id: 'b' }), []), map(user({ id: 'c' }), [])];
    const summary = summarizeBillingHosts(rows);
    expect(summary.total).toBe(3);
    expect(summary.needsAttention).toBe(2);
    expect(summary.byStatus.none).toBe(2);
    expect(summary.byStatus.active).toBe(1);
    expect(summary.byStatus.past_due).toBe(0);
  });

  it('mascara o e-mail', () => {
    expect(maskEmail('ana.souza@example.com')).toBe('an***@example.com');
    expect(maskEmail('invalido')).toBe('***');
  });
});
