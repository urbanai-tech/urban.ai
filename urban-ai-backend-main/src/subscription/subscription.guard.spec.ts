import { ExecutionContext, HttpException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from '../auth/roles.decorator';
import { EntitlementDecision, evaluateEntitlement } from './entitlement';
import { RequiresSubscription, SubscriptionFree } from './subscription-policy';
import { SUBSCRIPTION_REQUIRED_CODE, SubscriptionGuard } from './subscription.guard';

// Classes com os NOMES dos controllers reais exercitam o mapa central de políticas.
class PortfolioController {
  bulkAction() {}
}
class PaymentsController {
  createCheckout() {}
}
class PropriedadeController {
  getPropertiesForDropdown() {}
  getEventos() {}
}
class NovoControllerSemPolitica {
  qualquerCoisa() {}
}

class DecoratedController {
  @RequiresSubscription()
  pago() {}

  @SubscriptionFree()
  livre() {}

  @Roles('admin')
  soAdmin() {}
}

const NOW = new Date();
const day = (offset: number) => new Date(NOW.getTime() + offset * 24 * 60 * 60 * 1000);

function decisionFor(payments: Parameters<typeof evaluateEntitlement>[0]['payments'], extra = {}): EntitlementDecision {
  return evaluateEntitlement({ role: 'host', ativo: true, payments, now: NOW, graceDays: 3, ...extra });
}

function setup(decision: EntitlementDecision | null = null, user: Record<string, unknown> | null = { userId: 'u1', role: 'host' }) {
  const entitlement = { getEntitlement: jest.fn().mockResolvedValue(decision) };
  const guard = new SubscriptionGuard(new Reflector(), entitlement as any);
  const authenticate = jest.fn();
  (guard as any).authenticator = { canActivate: authenticate };

  const run = (Controller: new () => any, handler: string, preAuthenticated = false) => {
    const request: Record<string, unknown> = {};
    if (preAuthenticated && user) request.user = user;
    authenticate.mockImplementation(async () => {
      if (user) request.user = user;
      else throw new UnauthorizedException();
      return true;
    });
    const context = {
      getType: () => 'http',
      getClass: () => Controller,
      getHandler: () => Controller.prototype[handler],
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return guard.canActivate(context);
  };

  return { guard, entitlement, authenticate, run };
}

async function expect402(promise: Promise<unknown>, reason?: string) {
  const error = await promise.then(
    () => null,
    (e) => e,
  );
  expect(error).toBeInstanceOf(HttpException);
  expect((error as HttpException).getStatus()).toBe(402);
  const body = (error as HttpException).getResponse() as Record<string, unknown>;
  expect(body).toMatchObject({ statusCode: 402, code: SUBSCRIPTION_REQUIRED_CODE });
  if (reason) expect(body.reason).toBe(reason);
  return body;
}

describe('SubscriptionGuard', () => {
  it('rota paga + assinatura active: libera', async () => {
    const { run, authenticate, entitlement } = setup(decisionFor([{ status: 'active', expireDate: day(10) }]));
    await expect(run(PortfolioController, 'bulkAction')).resolves.toBe(true);
    expect(authenticate).toHaveBeenCalledTimes(1); // guard global roda antes do JwtAuthGuard da rota
    expect(entitlement.getEntitlement).toHaveBeenCalledWith('u1');
  });

  it('rota paga + trialing: libera', async () => {
    const { run } = setup(decisionFor([{ status: 'trialing', expireDate: day(5) }]));
    await expect(run(PortfolioController, 'bulkAction')).resolves.toBe(true);
  });

  it('rota paga + past_due dentro da carência: libera', async () => {
    const { run } = setup(decisionFor([{ status: 'past_due', expireDate: day(-1) }]));
    await expect(run(PortfolioController, 'bulkAction')).resolves.toBe(true);
  });

  it('rota paga + past_due após a carência: 402 SUBSCRIPTION_REQUIRED', async () => {
    const { run } = setup(decisionFor([{ status: 'past_due', expireDate: day(-10) }]));
    await expect402(run(PortfolioController, 'bulkAction'), 'past_due_grace_expired');
  });

  it('rota paga + canceled: 402', async () => {
    const { run } = setup(decisionFor([{ status: 'canceled', expireDate: day(10) }]));
    await expect402(run(PortfolioController, 'bulkAction'), 'canceled');
  });

  it('rota paga + sem assinatura: 402', async () => {
    const { run } = setup(decisionFor([]));
    await expect402(run(PortfolioController, 'bulkAction'), 'no_subscription');
  });

  it('rota paga + alpha (env): libera', async () => {
    const { run } = setup(decisionFor([], { alphaQuota: 2 }));
    await expect(run(PortfolioController, 'bulkAction')).resolves.toBe(true);
  });

  it('rota paga + alpha (Payment.status): libera', async () => {
    const { run } = setup(decisionFor([{ status: 'alpha' }]));
    await expect(run(PortfolioController, 'bulkAction')).resolves.toBe(true);
  });

  it('admin passa sem consultar assinatura', async () => {
    const { run, entitlement } = setup(null, { userId: 'adm', role: 'admin' });
    await expect(run(PortfolioController, 'bulkAction')).resolves.toBe(true);
    expect(entitlement.getEntitlement).not.toHaveBeenCalled();
  });

  it('não reautentica quando req.user já existe', async () => {
    const { run, authenticate } = setup(decisionFor([{ status: 'active' }]));
    await run(PortfolioController, 'bulkAction', true);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('rota paga sem token válido: 401 (não 402)', async () => {
    const { run } = setup(null, null);
    await expect(run(PortfolioController, 'bulkAction')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rota paga: informa graceEndsAt quando aplicável', async () => {
    const { run } = setup(decisionFor([{ status: 'past_due', expireDate: day(-3.2) }], { graceDays: 3 }));
    const body = await expect402(run(PortfolioController, 'bulkAction'));
    expect(body.graceEndsAt).toEqual(expect.any(String));
  });

  describe('rotas que não exigem assinatura', () => {
    it('rota livre (payments/checkout) passa sem autenticar nem consultar', async () => {
      const { run, authenticate, entitlement } = setup(decisionFor([]));
      await expect(run(PaymentsController, 'createCheckout')).resolves.toBe(true);
      expect(authenticate).not.toHaveBeenCalled();
      expect(entitlement.getEntitlement).not.toHaveBeenCalled();
    });

    it('onboarding pré-pagamento (propriedades/dropdown/list) passa; eventos analisados não', async () => {
      const { run } = setup(decisionFor([]));
      await expect(run(PropriedadeController, 'getPropertiesForDropdown')).resolves.toBe(true);
      await expect402(run(PropriedadeController, 'getEventos'));
    });

    it('rota com @Roles fica para o RolesGuard (sem 402 para não-admin)', async () => {
      const { run, authenticate } = setup(decisionFor([]));
      await expect(run(DecoratedController, 'soAdmin')).resolves.toBe(true);
      expect(authenticate).not.toHaveBeenCalled();
    });

    it('decorators @RequiresSubscription / @SubscriptionFree valem para código novo', async () => {
      const { run } = setup(decisionFor([]));
      await expect402(run(DecoratedController, 'pago'));
      await expect(run(DecoratedController, 'livre')).resolves.toBe(true);
    });

    it('rota sem política não é bloqueada em runtime (o CI reprova via coverage spec)', async () => {
      const { run } = setup(decisionFor([]));
      await expect(run(NovoControllerSemPolitica, 'qualquerCoisa')).resolves.toBe(true);
    });

    it('contextos não-HTTP passam', async () => {
      const { guard } = setup(decisionFor([]));
      const context = { getType: () => 'rpc' } as unknown as ExecutionContext;
      await expect(guard.canActivate(context)).resolves.toBe(true);
    });
  });
});
