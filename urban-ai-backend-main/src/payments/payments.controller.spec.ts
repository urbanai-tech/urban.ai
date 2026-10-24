const captureMessage = jest.fn();
const captureException = jest.fn();

jest.mock('@sentry/nestjs', () => ({ captureMessage, captureException }));

import { PaymentsController } from './payments.controller';

describe('PaymentsController - Stripe webhook raw-body contract', () => {
  beforeEach(() => jest.clearAllMocks());

  it('forwards the exact Buffer and signature without parsing or cloning the body', async () => {
    const rawBody = Buffer.from('{"type":"checkout.session.completed","data":{"object":{}}}');
    const event = { id: 'evt_raw', type: 'checkout.session.completed' };
    const paymentsService = {
      handleStripeWebhook: jest.fn().mockResolvedValue({ event }),
    };
    const controller = new PaymentsController(paymentsService as any);
    const response = {
      send: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };

    await controller.handleWebhook(
      { body: rawBody } as any,
      response as any,
      'stripe-signature',
    );

    expect(paymentsService.handleStripeWebhook).toHaveBeenCalledWith(
      rawBody,
      'stripe-signature',
    );
    expect(response.send).toHaveBeenCalledWith({ received: true });
  });

  it('keeps the existing 400 response for an invalid signature', async () => {
    const error = new Error('Invalid signature');
    const paymentsService = {
      handleStripeWebhook: jest.fn().mockResolvedValue({ error }),
    };
    const controller = new PaymentsController(paymentsService as any);
    const response = {
      send: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };

    await controller.handleWebhook(
      { body: Buffer.from('{}') } as any,
      response as any,
      'bad-signature',
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith('Webhook Error: Invalid signature');
    expect(captureMessage).toHaveBeenCalledWith(
      'Stripe webhook rejected',
      expect.objectContaining({ tags: expect.objectContaining({ component: 'stripe-webhook' }) }),
    );
  });

  it('returns 500 (so Stripe retries) when webhook processing throws', async () => {
    const paymentsService = {
      handleStripeWebhook: jest.fn().mockRejectedValue(new Error('db down')),
    };
    const controller = new PaymentsController(paymentsService as any);
    const response = {
      send: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };

    await controller.handleWebhook({ body: Buffer.from('{}') } as any, response as any, 'sig');

    expect(response.status).toHaveBeenCalledWith(500);
    expect(captureException).toHaveBeenCalled();
  });
});

describe('PaymentsController - create-checkout-session response', () => {
  it('returns sessionId (compat) and the hosted checkout url', async () => {
    const paymentsService = {
      createCheckoutSession: jest.fn().mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/c/pay/cs_1' }),
    };
    const controller = new PaymentsController(paymentsService as any);

    const result = await controller.createCheckout({ plan: 'profissional' } as any, { user: { userId: 'u1' } });

    expect(result).toEqual({ sessionId: 'cs_1', url: 'https://checkout.stripe.com/c/pay/cs_1' });
  });
});
