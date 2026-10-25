import {
  DEFAULT_SUBSCRIPTION_GRACE_DAYS,
  evaluateEntitlement,
  resolveAlphaQuota,
  resolveGraceDays,
} from './entitlement';

const NOW = new Date('2026-10-25T12:00:00.000Z');
const day = (offset: number) => new Date(NOW.getTime() + offset * 24 * 60 * 60 * 1000);

describe('evaluateEntitlement', () => {
  const base = { role: 'host', ativo: true, now: NOW, graceDays: 3 };

  it('libera assinatura active dentro do período e usa a quantidade contratada como cota', () => {
    const decision = evaluateEntitlement({
      ...base,
      payments: [{ status: 'active', expireDate: day(10), listingsContratados: 5, updatedAt: day(-1) }],
    });
    expect(decision).toMatchObject({ entitled: true, reason: 'active', source: 'subscription', quota: 5 });
  });

  it('libera trialing', () => {
    const decision = evaluateEntitlement({
      ...base,
      payments: [{ status: 'trialing', expireDate: day(7), listingsContratados: 2 }],
    });
    expect(decision).toMatchObject({ entitled: true, reason: 'trialing', quota: 2 });
  });

  it('cota mínima 1 quando o Payment não traz quantidade', () => {
    const decision = evaluateEntitlement({
      ...base,
      payments: [{ status: 'active', expireDate: day(3), listingsContratados: null }],
    });
    expect(decision.quota).toBe(1);
  });

  it('active sem expireDate vale (sem prazo conhecido)', () => {
    expect(evaluateEntitlement({ ...base, payments: [{ status: 'active' }] }).entitled).toBe(true);
  });

  it('active com período vencido além da carência perde o acesso (webhook perdido)', () => {
    const decision = evaluateEntitlement({
      ...base,
      payments: [{ status: 'active', expireDate: day(-4) }],
    });
    expect(decision).toMatchObject({ entitled: false, reason: 'period_expired', quota: 0 });
  });

  it('active vencido há menos que a carência ainda vale', () => {
    expect(evaluateEntitlement({ ...base, payments: [{ status: 'active', expireDate: day(-2) }] }).entitled).toBe(true);
  });

  describe('past_due', () => {
    it('dentro da carência: libera e informa o fim da carência', () => {
      const decision = evaluateEntitlement({
        ...base,
        payments: [{ status: 'past_due', expireDate: day(-2), listingsContratados: 3 }],
      });
      expect(decision).toMatchObject({ entitled: true, reason: 'past_due_in_grace', quota: 3 });
      expect(decision.graceEndsAt?.toISOString()).toBe(day(1).toISOString());
    });

    it('após a carência: bloqueia', () => {
      const decision = evaluateEntitlement({
        ...base,
        payments: [{ status: 'past_due', expireDate: day(-3.5) }],
      });
      expect(decision).toMatchObject({ entitled: false, reason: 'past_due_grace_expired', quota: 0 });
    });

    it('sem expireDate usa updatedAt como base da carência', () => {
      expect(
        evaluateEntitlement({ ...base, payments: [{ status: 'past_due', updatedAt: day(-1) }] }).entitled,
      ).toBe(true);
      expect(
        evaluateEntitlement({ ...base, payments: [{ status: 'past_due', updatedAt: day(-10) }] }).entitled,
      ).toBe(false);
    });

    it('graceDays = 0 desliga a carência', () => {
      const decision = evaluateEntitlement({
        ...base,
        graceDays: 0,
        payments: [{ status: 'past_due', expireDate: day(-0.1) }],
      });
      expect(decision.entitled).toBe(false);
    });

    it('respeita carência maior configurada', () => {
      const decision = evaluateEntitlement({
        ...base,
        graceDays: 10,
        payments: [{ status: 'past_due', expireDate: day(-8) }],
      });
      expect(decision.entitled).toBe(true);
    });
  });

  it.each(['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', 'pending'])(
    'bloqueia status %s',
    (status) => {
      const decision = evaluateEntitlement({
        ...base,
        payments: [{ status, expireDate: day(20), listingsContratados: 9 }],
      });
      expect(decision.entitled).toBe(false);
      expect(decision.quota).toBe(0);
      expect(decision.hasBillingHistory).toBe(true);
    },
  );

  it('canceled explica o motivo', () => {
    expect(evaluateEntitlement({ ...base, payments: [{ status: 'canceled' }] }).reason).toBe('canceled');
  });

  it('sem nenhum Payment: bloqueia e marca que nunca houve cobrança', () => {
    const decision = evaluateEntitlement({ ...base, payments: [] });
    expect(decision).toMatchObject({ entitled: false, reason: 'no_subscription', hasBillingHistory: false });
  });

  describe('alpha / gratuidade explícita', () => {
    it('alpha por ALPHA_USER_QUOTAS libera mesmo sem Payment e define a cota', () => {
      const decision = evaluateEntitlement({ ...base, alphaQuota: 4, payments: [] });
      expect(decision).toMatchObject({ entitled: true, reason: 'alpha_env', source: 'alpha_env', quota: 4 });
    });

    it('Payment com status alpha libera (sem expireDate = sem prazo)', () => {
      const decision = evaluateEntitlement({
        ...base,
        payments: [{ status: 'alpha', listingsContratados: 6 }],
      });
      expect(decision).toMatchObject({ entitled: true, reason: 'alpha_payment', source: 'alpha_payment', quota: 6 });
    });

    it('alpha com prazo vencido deixa de valer', () => {
      expect(
        evaluateEntitlement({ ...base, payments: [{ status: 'alpha', expireDate: day(-30) }] }).entitled,
      ).toBe(false);
    });
  });

  describe('admin e conta inativa', () => {
    it('admin sempre passa, sem cota', () => {
      const decision = evaluateEntitlement({ ...base, role: 'admin', payments: [] });
      expect(decision).toMatchObject({ entitled: true, reason: 'admin', source: 'admin', quota: null });
    });

    it('admin com assinatura cancelada continua passando', () => {
      expect(
        evaluateEntitlement({ ...base, role: 'admin', payments: [{ status: 'canceled' }] }).entitled,
      ).toBe(true);
    });

    it('support NÃO ganha acesso pago por papel', () => {
      expect(evaluateEntitlement({ ...base, role: 'support', payments: [] }).entitled).toBe(false);
    });

    it('conta desativada nunca passa, nem admin', () => {
      expect(evaluateEntitlement({ ...base, role: 'admin', ativo: false, payments: [] }).reason).toBe('user_inactive');
      expect(
        evaluateEntitlement({ ...base, ativo: false, payments: [{ status: 'active' }] }).entitled,
      ).toBe(false);
    });
  });

  describe('vários Payments', () => {
    it('qualquer um com direito libera; vale a cota do mais recente entre os válidos', () => {
      const decision = evaluateEntitlement({
        ...base,
        payments: [
          { status: 'canceled', listingsContratados: 20, updatedAt: day(-1) },
          { status: 'active', expireDate: day(5), listingsContratados: 3, updatedAt: day(-20) },
          { status: 'active', expireDate: day(5), listingsContratados: 7, updatedAt: day(-10) },
        ],
      });
      expect(decision).toMatchObject({ entitled: true, quota: 7 });
    });

    it('sem nenhum válido, explica pelo mais recente', () => {
      const decision = evaluateEntitlement({
        ...base,
        payments: [
          { status: 'pending', updatedAt: day(-30) },
          { status: 'canceled', updatedAt: day(-1) },
        ],
      });
      expect(decision).toMatchObject({ entitled: false, reason: 'canceled' });
    });
  });
});

describe('resolveGraceDays', () => {
  it('usa o padrão (3) sem env ou com valor inválido', () => {
    expect(DEFAULT_SUBSCRIPTION_GRACE_DAYS).toBe(3);
    expect(resolveGraceDays(undefined)).toBe(3);
    expect(resolveGraceDays('')).toBe(3);
    expect(resolveGraceDays('abc')).toBe(3);
    expect(resolveGraceDays('-2')).toBe(3);
  });

  it('aceita 0 e valores válidos, com teto', () => {
    expect(resolveGraceDays('0')).toBe(0);
    expect(resolveGraceDays('7')).toBe(7);
    expect(resolveGraceDays('9999')).toBe(60);
  });

  it('lê SUBSCRIPTION_GRACE_DAYS do ambiente por padrão', () => {
    const previous = process.env.SUBSCRIPTION_GRACE_DAYS;
    process.env.SUBSCRIPTION_GRACE_DAYS = '5';
    try {
      expect(resolveGraceDays()).toBe(5);
      const decision = evaluateEntitlement({
        role: 'host',
        now: NOW,
        payments: [{ status: 'past_due', expireDate: day(-4.5) }],
      });
      expect(decision.entitled).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.SUBSCRIPTION_GRACE_DAYS;
      else process.env.SUBSCRIPTION_GRACE_DAYS = previous;
    }
  });
});

describe('resolveAlphaQuota', () => {
  it('casa por e-mail ou id, sem diferenciar maiúsculas', () => {
    const raw = 'Host@Example.com:3, 11111111-aaaa:2';
    expect(resolveAlphaQuota(raw, 'x', 'host@example.com')).toBe(3);
    expect(resolveAlphaQuota(raw, '11111111-AAAA', null)).toBe(2);
  });

  it('ignora usuários fora da lista, cotas inválidas e env vazio', () => {
    expect(resolveAlphaQuota('a@b.com:3', 'x', 'c@d.com')).toBeNull();
    expect(resolveAlphaQuota('a@b.com:zero', 'x', 'a@b.com')).toBeNull();
    expect(resolveAlphaQuota('a@b.com:0', 'x', 'a@b.com')).toBeNull();
    expect(resolveAlphaQuota('', 'x', 'a@b.com')).toBeNull();
    expect(resolveAlphaQuota(undefined, 'x', 'a@b.com')).toBeNull();
  });
});
