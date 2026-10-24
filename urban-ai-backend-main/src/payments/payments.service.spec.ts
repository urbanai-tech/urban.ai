// Mock do Stripe SDK antes de qualquer import — o service instancia o cliente
// no constructor, então precisamos controlar os métodos.
const mockStripeConstructEvent = jest.fn();
const mockStripeSubscriptionsRetrieve = jest.fn();
const mockStripeSubscriptionsCancel = jest.fn();
const mockStripeSubscriptionsList = jest.fn();
const mockStripeCustomersList = jest.fn();
const mockStripeCustomersCreate = jest.fn();
const mockStripeCheckoutSessionsCreate = jest.fn();
const mockStripeBillingPortalSessionsCreate = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mockStripeConstructEvent },
    subscriptions: {
      retrieve: mockStripeSubscriptionsRetrieve,
      cancel: mockStripeSubscriptionsCancel,
      list: mockStripeSubscriptionsList,
    },
    customers: {
      list: mockStripeCustomersList,
      create: mockStripeCustomersCreate,
    },
    checkout: { sessions: { create: mockStripeCheckoutSessionsCreate } },
    billingPortal: { sessions: { create: mockStripeBillingPortalSessionsCreate } },
  }));
});

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PaymentsService } from './payments.service';
import { Payment } from '../entities/payment.entity';
import { User } from '../entities/user.entity';
import { Address } from '../entities/addresses.entity';
import { PlansService } from '../plans/plans.service';
import { MailerService } from '../mailer/mailer.service';

const stubAddressRepo = () => ({ count: jest.fn().mockResolvedValue(0) });

type Repo<T> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('PaymentsService — handleStripeWebhook', () => {
  let service: PaymentsService;
  let paymentRepo: Repo<Payment>;
  let userRepo: Repo<User>;
  let plansService: { getPlanByName: jest.Mock; getSelfServicePlanForQuantity: jest.Mock };
  let mailerService: { sendHtmlEmail: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.SUCCESS_URL = 'https://urban.test/success';
    process.env.CANCEL_URL = 'https://urban.test/cancel';

    paymentRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (x) => x),
      create: jest.fn(),
    };
    userRepo = { findOne: jest.fn() };
    plansService = { getPlanByName: jest.fn(), getSelfServicePlanForQuantity: jest.fn().mockResolvedValue(null) };
    mailerService = { sendHtmlEmail: jest.fn().mockResolvedValue({ enviado: true, status: 202 }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Address), useValue: stubAddressRepo() },
        { provide: PlansService, useValue: plansService },
        { provide: MailerService, useValue: mailerService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('signature verification', () => {
    it('returns { error } when webhook secret is not configured', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;

      const result = await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(result).toEqual({ error: expect.any(Error) });
      expect(mockStripeConstructEvent).not.toHaveBeenCalled();
      expect(paymentRepo.save).not.toHaveBeenCalled();
    });

    it('returns { error } when the signature is invalid (no DB side effects)', async () => {
      mockStripeConstructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const result = await service.handleStripeWebhook(
        Buffer.from('{}'),
        'sig_bad',
      );

      expect(result).toEqual({ error: expect.any(Error) });
      expect(paymentRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a missing signature without invoking Stripe', async () => {
      const result = await service.handleStripeWebhook(Buffer.from('{}'), '');

      expect(result).toEqual({ error: expect.any(Error) });
      expect(mockStripeConstructEvent).not.toHaveBeenCalled();
      expect(paymentRepo.save).not.toHaveBeenCalled();
    });

    it('passes the exact raw body buffer to Stripe signature verification', async () => {
      const rawBody = Buffer.from('{"amount":100,"nested":{"ok":true}}');
      const event = { id: 'evt_raw', created: 100, type: 'charge.dispute.created', data: { object: {} } };
      mockStripeConstructEvent.mockReturnValue(event);

      await service.handleStripeWebhook(rawBody, 'sig_raw');

      expect(mockStripeConstructEvent).toHaveBeenCalledWith(rawBody, 'sig_raw', 'whsec_test');
    });
  });

  describe('idempotency and event ordering', () => {
    it('does not save a duplicated Stripe event twice', async () => {
      const event = {
        id: 'evt_duplicate',
        created: 200,
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_abc',
            status: 'active',
            items: { data: [{ plan: { interval: 'month' }, quantity: 4 }] },
            metadata: {},
          },
        },
      };
      const payment: any = { id: 'pay1', customerId: 'cus_abc', status: 'trialing' };
      mockStripeConstructEvent.mockReturnValue(event);
      paymentRepo.findOne!.mockResolvedValue(payment);

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');
      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(paymentRepo.save).toHaveBeenCalledTimes(1);
      expect(payment.recentStripeEventIds).toEqual(['evt_duplicate']);
      expect(payment.lastStripeEventCreated).toBe('200');
    });

    it('ignores an older event instead of overwriting a newer local projection', async () => {
      const payment: any = {
        id: 'pay1',
        customerId: 'cus_abc',
        status: 'canceled',
        lastStripeEventCreated: '300',
        recentStripeEventIds: ['evt_newer'],
      };
      mockStripeConstructEvent.mockReturnValue({
        id: 'evt_older',
        created: 200,
        type: 'payment_intent.succeeded',
        data: { object: { status: 'succeeded', customer: 'cus_abc' } },
      });
      paymentRepo.findOne!.mockResolvedValue(payment);

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(payment.status).toBe('canceled');
      expect(paymentRepo.save).not.toHaveBeenCalled();
    });

    it('applies a newer event and advances the ordering watermark', async () => {
      const payment: any = {
        id: 'pay1',
        customerId: 'cus_abc',
        status: 'past_due',
        lastStripeEventCreated: '200',
        recentStripeEventIds: ['evt_older'],
      };
      mockStripeConstructEvent.mockReturnValue({
        id: 'evt_newer',
        created: 300,
        type: 'payment_intent.succeeded',
        data: { object: { status: 'succeeded', customer: 'cus_abc' } },
      });
      paymentRepo.findOne!.mockResolvedValue(payment);

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          lastStripeEventCreated: '300',
          recentStripeEventIds: ['evt_older', 'evt_newer'],
        }),
      );
    });
  });

  describe('checkout.session.completed', () => {
    it('updates the Payment row with subscriptionId, mode, expireDate', async () => {
      const subscriptionId = 'sub_123';
      const customerId = 'cus_abc';
      const anchorEpoch = 1_700_000_000; // seconds
      mockStripeConstructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            subscription: subscriptionId,
          },
        },
      });
      mockStripeSubscriptionsRetrieve.mockResolvedValue({
        id: subscriptionId,
        customer: customerId,
        status: 'trialing',
        billing_cycle_anchor: anchorEpoch,
        items: { data: [{ plan: { interval: 'month' }, quantity: 1 }] },
        metadata: {},
      });
      paymentRepo.findOne!.mockResolvedValue({ id: 'pay1', customerId, status: 'pending' });

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      const saved = paymentRepo.save!.mock.calls[0][0];
      expect(saved).toMatchObject({
        subscriptionId,
        mode: 'month',
        status: 'trialing',
      });
      expect(saved.expireDate).toBeInstanceOf(Date);
      expect(saved.startDate).toBeInstanceOf(Date);
    });

    it('persists listingsContratados and billingCycle from F6.5 metadata', async () => {
      mockStripeConstructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: { subscription: 'sub_meta', amount_total: 148500, invoice: 'in_123' } },
      });
      mockStripeSubscriptionsRetrieve.mockResolvedValue({
        id: 'sub_meta',
        customer: 'cus_abc',
        status: 'active',
        billing_cycle_anchor: 1_700_000_000,
        items: { data: [{ plan: { interval: 'month', amount: 29700 }, quantity: 5 }] },
        metadata: {
          urbanai_plan: 'profissional',
          urbanai_billing_cycle: 'quarterly',
          urbanai_quantity: '5',
        },
      });
      paymentRepo.findOne!.mockResolvedValue({
        id: 'pay1',
        customerId: 'cus_abc',
        user: { email: 'host@test.com', username: 'Carla Host' },
      });

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      const saved = paymentRepo.save!.mock.calls[0][0];
      expect(saved.status).toBe('active');
      expect(saved.billingCycle).toBe('quarterly');
      expect(saved.listingsContratados).toBe(5);
      expect(saved.planName).toBe('profissional');
      expect(mailerService.sendHtmlEmail).toHaveBeenCalledWith(
        { email: 'host@test.com', name: 'Carla Host' },
        'Urban AI - Assinatura ativada',
        expect.stringContaining('Assinatura ativada'),
      );
    });

    it('falls back safely when webhook quantity and billing-cycle metadata are invalid', async () => {
      mockStripeConstructEvent.mockReturnValue({
        id: 'evt_bad_metadata',
        created: 400,
        type: 'checkout.session.completed',
        data: { object: { subscription: 'sub_bad_metadata' } },
      });
      mockStripeSubscriptionsRetrieve.mockResolvedValue({
        id: 'sub_bad_metadata',
        customer: 'cus_abc',
        status: 'active',
        billing_cycle_anchor: 1_700_000_000,
        items: { data: [{ plan: { interval: 'month' }, quantity: 6 }] },
        metadata: {
          urbanai_billing_cycle: 'weekly',
          urbanai_quantity: 'not-a-number',
        },
      });
      paymentRepo.findOne!.mockResolvedValue({ id: 'pay1', customerId: 'cus_abc' });

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ billingCycle: 'monthly', listingsContratados: 6 }),
      );
    });

    it('no-ops when Payment does not exist for the customer', async () => {
      mockStripeConstructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: { subscription: 'sub_x' } },
      });
      mockStripeSubscriptionsRetrieve.mockResolvedValue({
        id: 'sub_x',
        customer: 'cus_missing',
        status: 'active',
        billing_cycle_anchor: 1_700_000_000,
        items: { data: [{ plan: { interval: 'month' } }] },
      });
      paymentRepo.findOne!.mockResolvedValue(null);

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(paymentRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('payment_intent.succeeded', () => {
    it('activates the Payment row for the given customer', async () => {
      mockStripeConstructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            status: 'succeeded',
            customer: 'cus_abc',
          },
        },
      });
      paymentRepo.findOne!.mockResolvedValue({ id: 'pay1', customerId: 'cus_abc', status: 'pending' });

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' }),
      );
    });
  });

  describe('customer.subscription.updated', () => {
    it('mirrors subscription.status and interval onto the Payment row', async () => {
      mockStripeConstructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_abc',
            status: 'active',
            items: { data: [{ plan: { interval: 'year' }, quantity: 1 }] },
            metadata: {},
          },
        },
      });
      paymentRepo.findOne!.mockResolvedValue({ id: 'pay1', customerId: 'cus_abc', status: 'trialing' });

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active', mode: 'year' }),
      );
    });

    it('updates listingsContratados when quantity changes (upsell)', async () => {
      mockStripeConstructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_abc',
            status: 'active',
            items: { data: [{ plan: { interval: 'month' }, quantity: 8 }] },
            metadata: {
              urbanai_quantity: '8',
              urbanai_billing_cycle: 'monthly',
            },
          },
        },
      });
      paymentRepo.findOne!.mockResolvedValue({
        id: 'pay1',
        customerId: 'cus_abc',
        listingsContratados: 3,
      });

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ listingsContratados: 8, billingCycle: 'monthly' }),
      );
    });

    it.each([
      'active',
      'trialing',
      'past_due',
      'canceled',
      'unpaid',
      'incomplete',
      'incomplete_expired',
      'paused',
    ])('maps Stripe subscription status %s without coercion', async (status) => {
      mockStripeConstructEvent.mockReturnValue({
        id: `evt_status_${status}`,
        created: 500,
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_abc',
            status,
            items: { data: [{ plan: { interval: 'month' }, quantity: 1 }] },
            metadata: {},
          },
        },
      });
      paymentRepo.findOne!.mockResolvedValue({ id: 'pay1', customerId: 'cus_abc', status: 'pending' });

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(paymentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status }));
    });

    it('preserves the current normalized status for an unknown Stripe status', async () => {
      mockStripeConstructEvent.mockReturnValue({
        id: 'evt_unknown_status',
        created: 501,
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_abc',
            status: 'future_status',
            items: { data: [{ plan: { interval: 'month' }, quantity: 1 }] },
            metadata: {},
          },
        },
      });
      paymentRepo.findOne!.mockResolvedValue({ id: 'pay1', customerId: 'cus_abc', status: 'peding' });

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(paymentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
    });
  });

  describe('customer.subscription.deleted', () => {
    it('marks the Payment row as canceled', async () => {
      mockStripeConstructEvent.mockReturnValue({
        type: 'customer.subscription.deleted',
        data: { object: { customer: 'cus_abc' } },
      });
      paymentRepo.findOne!.mockResolvedValue({
        id: 'pay1',
        customerId: 'cus_abc',
        status: 'active',
        expireDate: new Date('2026-06-15T00:00:00.000Z'),
        user: { email: 'host@test.com', username: 'Carla Host' },
      });

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'canceled' }),
      );
      expect(mailerService.sendHtmlEmail).toHaveBeenCalledWith(
        { email: 'host@test.com', name: 'Carla Host' },
        'Urban AI - Cancelamento confirmado',
        expect.stringContaining('2026-06-15'),
      );
    });
  });

  describe('invoice.payment_failed', () => {
    it('marks the Payment row as past_due', async () => {
      mockStripeConstructEvent.mockReturnValue({
        type: 'invoice.payment_failed',
        data: { object: { customer: 'cus_abc', amount_due: 9700, next_payment_attempt: 1_780_000_000 } },
      });
      paymentRepo.findOne!.mockResolvedValue({
        id: 'pay1',
        customerId: 'cus_abc',
        status: 'active',
        user: { email: 'host@test.com', username: 'Carla Host' },
      });

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'past_due' }),
      );
      expect(mailerService.sendHtmlEmail).toHaveBeenCalledWith(
        { email: 'host@test.com', name: 'Carla Host' },
        'Urban AI - Falha no pagamento',
        expect.stringContaining('R$ 97,00'),
      );
    });
  });

  describe('unknown event type', () => {
    it('is a no-op (no DB writes) but still returns the event for auditing', async () => {
      const event = { type: 'charge.dispute.created', data: { object: {} } };
      mockStripeConstructEvent.mockReturnValue(event);

      const result = await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(paymentRepo.save).not.toHaveBeenCalled();
      expect(result).toEqual({ event });
    });
  });
});

describe('PaymentsService - createBillingPortalSession', () => {
  let service: PaymentsService;
  let paymentRepo: Repo<Payment>;
  let userRepo: Repo<User>;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    process.env.FRONT_BASE_URL = 'https://app.myurbanai.com';
    delete process.env.BILLING_PORTAL_RETURN_URL;
    paymentRepo = { findOne: jest.fn() };
    userRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Address), useValue: stubAddressRepo() },
        { provide: PlansService, useValue: { getPlanByName: jest.fn() } },
      ],
    }).compile();
    service = module.get<PaymentsService>(PaymentsService);
  });

  it('creates a Stripe Billing Portal session for the stored customerId', async () => {
    userRepo.findOne!.mockResolvedValue({ id: 'u1', email: 'host@test.com' });
    paymentRepo.findOne!.mockResolvedValue({ id: 'pay1', customerId: 'cus_abc' });
    mockStripeBillingPortalSessionsCreate.mockResolvedValue({ url: 'https://billing.stripe.test/session' });

    const result = await service.createBillingPortalSession('u1');

    expect(mockStripeCustomersList).not.toHaveBeenCalled();
    expect(mockStripeBillingPortalSessionsCreate).toHaveBeenCalledWith({
      customer: 'cus_abc',
      return_url: 'https://app.myurbanai.com/my-plan',
    });
    expect(result).toEqual({ url: 'https://billing.stripe.test/session' });
  });

  it('falls back to the Stripe customer lookup by email when Payment has no customerId', async () => {
    process.env.BILLING_PORTAL_RETURN_URL = 'https://app.myurbanai.com/plans';
    userRepo.findOne!.mockResolvedValue({ id: 'u1', email: 'host@test.com' });
    paymentRepo.findOne!.mockResolvedValue(null);
    mockStripeCustomersList.mockResolvedValue({ data: [{ id: 'cus_from_email' }] });
    mockStripeBillingPortalSessionsCreate.mockResolvedValue({ url: 'https://billing.stripe.test/session' });

    await service.createBillingPortalSession('u1');

    expect(mockStripeCustomersList).toHaveBeenCalledWith({ email: 'host@test.com', limit: 1 });
    expect(mockStripeBillingPortalSessionsCreate).toHaveBeenCalledWith({
      customer: 'cus_from_email',
      return_url: 'https://app.myurbanai.com/plans',
    });
  });

  it('reports not configured before creating portal sessions when key is absent', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    userRepo.findOne!.mockResolvedValue({ id: 'u1', email: 'host@test.com' });

    await expect(service.createBillingPortalSession('u1')).rejects.toThrow(
      'Pagamento temporariamente indisponível',
    );
    expect(mockStripeBillingPortalSessionsCreate).not.toHaveBeenCalled();
  });
});

describe('PaymentsService — cancelSubscription', () => {
  let service: PaymentsService;
  let paymentRepo: Repo<Payment>;
  let userRepo: Repo<User>;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    paymentRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };
    userRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Address), useValue: stubAddressRepo() },
        { provide: PlansService, useValue: { getPlanByName: jest.fn() } },
      ],
    }).compile();
    service = module.get<PaymentsService>(PaymentsService);
  });

  it('throws when the user does not exist', async () => {
    userRepo.findOne!.mockResolvedValue(null);

    await expect(service.cancelSubscription('missing-user')).rejects.toThrow('Usuário não encontrado');
  });

  it('throws when no Stripe customer matches the user email', async () => {
    userRepo.findOne!.mockResolvedValue({ id: 'u1', email: 'u@test.com' });
    mockStripeCustomersList.mockResolvedValue({ data: [] });

    await expect(service.cancelSubscription('u1')).rejects.toThrow('Cliente Stripe não encontrado');
  });

  it('throws when Payment row has no subscriptionId', async () => {
    userRepo.findOne!.mockResolvedValue({ id: 'u1', email: 'u@test.com' });
    mockStripeCustomersList.mockResolvedValue({ data: [{ id: 'cus_abc' }] });
    paymentRepo.findOne!.mockResolvedValue({ customerId: 'cus_abc', subscriptionId: null });

    await expect(service.cancelSubscription('u1')).rejects.toThrow('Pagamento ou subscriptionId não encontrado');
    expect(mockStripeSubscriptionsCancel).not.toHaveBeenCalled();
  });

  it('cancels the subscription at Stripe on happy path', async () => {
    userRepo.findOne!.mockResolvedValue({ id: 'u1', email: 'u@test.com' });
    mockStripeCustomersList.mockResolvedValue({ data: [{ id: 'cus_abc' }] });
    paymentRepo.findOne!.mockResolvedValue({ customerId: 'cus_abc', subscriptionId: 'sub_xyz' });
    mockStripeSubscriptionsCancel.mockResolvedValue({ id: 'sub_xyz', status: 'canceled' });

    const result = await service.cancelSubscription('u1');

    expect(mockStripeSubscriptionsCancel).toHaveBeenCalledWith('sub_xyz');
    expect(result).toEqual({ id: 'sub_xyz', status: 'canceled' });
  });

  it('reports not configured before calling Stripe when key is absent', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    userRepo.findOne!.mockResolvedValue({ id: 'u1', email: 'u@test.com' });

    await expect(service.cancelSubscription('u1')).rejects.toThrow(
      'Pagamento temporariamente indisponível',
    );
    expect(mockStripeCustomersList).not.toHaveBeenCalled();
  });
});

describe('PaymentsService — createCheckoutSession', () => {
  let service: PaymentsService;
  let paymentRepo: Repo<Payment>;
  let userRepo: Repo<User>;
  let plansService: { getPlanByName: jest.Mock; getSelfServicePlanForQuantity: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    process.env.SUCCESS_URL = 'https://urban.test/success';
    process.env.CANCEL_URL = 'https://urban.test/cancel';
    paymentRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (x) => x),
    };
    userRepo = { findOne: jest.fn() };
    mockStripeSubscriptionsList.mockReset();
    mockStripeSubscriptionsList.mockResolvedValue({ data: [] });
    plansService = { getPlanByName: jest.fn(), getSelfServicePlanForQuantity: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Address), useValue: stubAddressRepo() },
        { provide: PlansService, useValue: plansService },
      ],
    }).compile();
    service = module.get<PaymentsService>(PaymentsService);
  });

  it('uses monthly stripePriceId when billingCycle is monthly (or omitted)', async () => {
    userRepo.findOne!.mockResolvedValue({ id: 'u1', email: 'u@test.com', username: 'U' });
    mockStripeCustomersList.mockResolvedValue({ data: [{ id: 'cus_abc' }] });
    paymentRepo.findOne!.mockResolvedValue({ id: 'pay1', customerId: null });
    plansService.getPlanByName.mockResolvedValue({
      name: 'profissional',
      stripePriceId: 'price_m_pro',
      stripePriceIdAnnual: 'price_a_pro',
    });
    mockStripeCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_1' });

    await service.createCheckoutSession({ plan: 'profissional' }, 'u1');

    const createArgs = mockStripeCheckoutSessionsCreate.mock.calls[0][0];
    expect(createArgs.line_items[0].price).toBe('price_m_pro');
    expect(createArgs.mode).toBe('subscription');
  });

  it('auto-selects the self-service plan by quantity', async () => {
    userRepo.findOne!.mockResolvedValue({ id: 'u1', email: 'u@test.com', username: 'U' });
    mockStripeCustomersList.mockResolvedValue({ data: [{ id: 'cus_abc' }] });
    paymentRepo.findOne!.mockResolvedValue({ id: 'pay1', customerId: null });
    plansService.getSelfServicePlanForQuantity.mockResolvedValue({
      name: 'profissional',
      title: 'Profissional',
      selfServiceEnabled: true,
      isCustomPrice: false,
      stripePriceIdAnnualNew: 'price_a_pro_new',
    });
    mockStripeCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_1' });

    await service.createCheckoutSession({ plan: 'auto', billingCycle: 'annual', quantity: 50 }, 'u1');

    expect(plansService.getSelfServicePlanForQuantity).toHaveBeenCalledWith(50);
    const createArgs = mockStripeCheckoutSessionsCreate.mock.calls[0][0];
    expect(createArgs.line_items[0].price).toBe('price_a_pro_new');
    expect(createArgs.line_items[0].quantity).toBe(50);
    expect(createArgs.metadata.urbanai_plan).toBe('profissional');
  });

  it('switches to annual priceId when billingCycle=annual', async () => {
    userRepo.findOne!.mockResolvedValue({ id: 'u1', email: 'u@test.com', username: 'U' });
    mockStripeCustomersList.mockResolvedValue({ data: [{ id: 'cus_abc' }] });
    paymentRepo.findOne!.mockResolvedValue({ id: 'pay1', customerId: null });
    plansService.getPlanByName.mockResolvedValue({
      name: 'profissional',
      stripePriceId: 'price_m_pro',
      stripePriceIdAnnual: 'price_a_pro',
    });
    mockStripeCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_1' });

    await service.createCheckoutSession({ plan: 'profissional', billingCycle: 'annual' }, 'u1');

    const createArgs = mockStripeCheckoutSessionsCreate.mock.calls[0][0];
    expect(createArgs.line_items[0].price).toBe('price_a_pro');
  });

  it('uses the F6.5 quarterly priceId when billingCycle=quarterly', async () => {
    userRepo.findOne!.mockResolvedValue({ id: 'u1', email: 'u@test.com', username: 'U' });
    mockStripeCustomersList.mockResolvedValue({ data: [{ id: 'cus_abc' }] });
    paymentRepo.findOne!.mockResolvedValue({ id: 'pay1', customerId: null });
    plansService.getPlanByName.mockResolvedValue({
      name: 'profissional',
      stripePriceIdMonthly: 'price_m_pro_new',
      stripePriceIdQuarterly: 'price_q_pro',
      stripePriceIdSemestral: 'price_s_pro',
      stripePriceIdAnnualNew: 'price_a_pro_new',
    });
    mockStripeCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_1' });

    await service.createCheckoutSession({ plan: 'profissional', billingCycle: 'quarterly' }, 'u1');

    const createArgs = mockStripeCheckoutSessionsCreate.mock.calls[0][0];
    expect(createArgs.line_items[0].price).toBe('price_q_pro');
  });

  it('uses env fallback when the plan row has no Price ID', async () => {
    process.env.PROFISSIONAL_PRICE_QUARTERLY = 'price_env_q_pro';
    userRepo.findOne!.mockResolvedValue({ id: 'u1', email: 'u@test.com', username: 'U' });
    mockStripeCustomersList.mockResolvedValue({ data: [{ id: 'cus_abc' }] });
    paymentRepo.findOne!.mockResolvedValue({ id: 'pay1', customerId: null });
    plansService.getPlanByName.mockResolvedValue({ name: 'profissional' });
    mockStripeCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_1' });

    await service.createCheckoutSession({ plan: 'profissional', billingCycle: 'quarterly' }, 'u1');

    const createArgs = mockStripeCheckoutSessionsCreate.mock.calls[0][0];
    expect(createArgs.line_items[0].price).toBe('price_env_q_pro');
    delete process.env.PROFISSIONAL_PRICE_QUARTERLY;
  });

  it('reports not configured without calling Stripe when key is absent', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    userRepo.findOne!.mockResolvedValue({ id: 'u1', email: 'u@test.com', username: 'U' });
    plansService.getPlanByName.mockResolvedValue({
      name: 'profissional',
      stripePriceIdMonthly: 'price_m_pro',
    });

    await expect(service.createCheckoutSession({ plan: 'profissional' }, 'u1')).rejects.toThrow(
      'Pagamento temporariamente indisponível',
    );
    expect(mockStripeCustomersList).not.toHaveBeenCalled();
    expect(mockStripeCheckoutSessionsCreate).not.toHaveBeenCalled();
  });

  it('rejects invalid billingCycle before calling Stripe', async () => {
    userRepo.findOne!.mockResolvedValue({ id: 'u1', email: 'u@test.com', username: 'U' });
    plansService.getPlanByName.mockResolvedValue({
      name: 'profissional',
      stripePriceIdMonthly: 'price_m_pro',
    });

    await expect(
      service.createCheckoutSession({ plan: 'profissional', billingCycle: 'weekly' as any }, 'u1'),
    ).rejects.toThrow('Escolha um ciclo de cobrança válido');
    expect(mockStripeCustomersList).not.toHaveBeenCalled();
  });

  it('forwards quantity to Stripe line_items (cobrança por imóvel)', async () => {
    userRepo.findOne!.mockResolvedValue({ id: 'u1', email: 'u@test.com', username: 'U' });
    mockStripeCustomersList.mockResolvedValue({ data: [{ id: 'cus_abc' }] });
    paymentRepo.findOne!.mockResolvedValue({ id: 'pay1', customerId: null });
    plansService.getPlanByName.mockResolvedValue({
      name: 'profissional',
      stripePriceIdMonthly: 'price_m_pro',
    });
    mockStripeCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_1' });

    await service.createCheckoutSession(
      { plan: 'profissional', billingCycle: 'monthly', quantity: 5 },
      'u1',
    );

    const createArgs = mockStripeCheckoutSessionsCreate.mock.calls[0][0];
    expect(createArgs.line_items[0].quantity).toBe(5);
    expect(createArgs.metadata.urbanai_quantity).toBe('5');
    expect(createArgs.metadata.urbanai_billing_cycle).toBe('monthly');
  });

  it('clamps quantity to >=1', async () => {
    userRepo.findOne!.mockResolvedValue({ id: 'u1', email: 'u@test.com', username: 'U' });
    mockStripeCustomersList.mockResolvedValue({ data: [{ id: 'cus_abc' }] });
    paymentRepo.findOne!.mockResolvedValue({ id: 'pay1', customerId: null });
    plansService.getPlanByName.mockResolvedValue({
      name: 'profissional',
      stripePriceIdMonthly: 'price_m_pro',
    });
    mockStripeCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_1' });

    await service.createCheckoutSession(
      { plan: 'profissional', billingCycle: 'monthly', quantity: 0 },
      'u1',
    );

    const createArgs = mockStripeCheckoutSessionsCreate.mock.calls[0][0];
    expect(createArgs.line_items[0].quantity).toBe(1);
  });

  it('rejects non-numeric quantity before calling Stripe checkout', async () => {
    userRepo.findOne!.mockResolvedValue({ id: 'u1', email: 'u@test.com', username: 'U' });
    plansService.getPlanByName.mockResolvedValue({
      name: 'profissional',
      stripePriceIdMonthly: 'price_m_pro',
    });

    await expect(
      service.createCheckoutSession(
        { plan: 'profissional', billingCycle: 'monthly', quantity: 'abc' as any },
        'u1',
      ),
    ).rejects.toThrow('Escolha uma quantidade válida de imóveis');

    expect(mockStripeCustomersList).not.toHaveBeenCalled();
    expect(mockStripeCheckoutSessionsCreate).not.toHaveBeenCalled();
  });

  it('adds subscription_data.trial_period_days when plan=trial', async () => {
    process.env.TRIAL_PERIOD_DAYS = '10';
    userRepo.findOne!.mockResolvedValue({ id: 'u1', email: 'u@test.com', username: 'U' });
    mockStripeCustomersList.mockResolvedValue({ data: [{ id: 'cus_abc' }] });
    paymentRepo.findOne!.mockResolvedValue({ id: 'pay1', customerId: null });
    plansService.getPlanByName.mockResolvedValue({
      name: 'profissional',
      stripePriceId: 'price_m_pro',
    });
    mockStripeCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_1' });

    await service.createCheckoutSession({ plan: 'trial' }, 'u1');

    const createArgs = mockStripeCheckoutSessionsCreate.mock.calls[0][0];
    expect(createArgs.subscription_data.trial_period_days).toBe(10);
    expect(createArgs.subscription_data.metadata.urbanai_plan).toBe('trial');
  });

  it('creates a new Stripe customer when none exists and persists customerId on Payment', async () => {
    userRepo.findOne!.mockResolvedValue({ id: 'u1', email: 'u@test.com', username: 'U' });
    mockStripeCustomersList.mockResolvedValue({ data: [] });
    mockStripeCustomersCreate.mockResolvedValue({ id: 'cus_new' });
    paymentRepo.findOne!.mockResolvedValue({ id: 'pay1', customerId: null });
    plansService.getPlanByName.mockResolvedValue({
      name: 'starter',
      stripePriceId: 'price_starter',
    });
    mockStripeCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_1' });

    await service.createCheckoutSession({ plan: 'starter' }, 'u1');

    expect(mockStripeCustomersCreate).toHaveBeenCalledWith({
      email: 'u@test.com',
      name: 'U',
    });
    const saved = paymentRepo.save!.mock.calls[0][0];
    expect(saved.customerId).toBe('cus_new');
  });
});

describe('PaymentsService — getListingsQuota (F6.5)', () => {
  let service: PaymentsService;
  let paymentRepo: Repo<Payment>;
  let addressRepo: { count: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    paymentRepo = { findOne: jest.fn() };
    addressRepo = { count: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Address), useValue: addressRepo },
        { provide: PlansService, useValue: { getPlanByName: jest.fn() } },
      ],
    }).compile();
    service = module.get<PaymentsService>(PaymentsService);
  });

  it('returns podeAdicionar=true when ativos < contratados', async () => {
    paymentRepo.findOne!.mockResolvedValue({ listingsContratados: 5 });
    addressRepo.count.mockResolvedValue(3);

    const quota = await service.getListingsQuota('u1');

    expect(quota).toEqual({ contratados: 5, ativos: 3, podeAdicionar: true });
  });

  it('returns podeAdicionar=false when ativos === contratados', async () => {
    paymentRepo.findOne!.mockResolvedValue({ listingsContratados: 3 });
    addressRepo.count.mockResolvedValue(3);

    const quota = await service.getListingsQuota('u1');

    expect(quota).toEqual({ contratados: 3, ativos: 3, podeAdicionar: false });
  });

  it('defaults contratados to 1 when no active Payment exists', async () => {
    paymentRepo.findOne!.mockResolvedValue(null);
    addressRepo.count.mockResolvedValue(0);

    const quota = await service.getListingsQuota('u1');

    expect(quota.contratados).toBe(1);
    expect(quota.podeAdicionar).toBe(true);
  });
});

describe('PaymentsService — getSubscription alpha access', () => {
  let service: PaymentsService;
  let paymentRepo: Repo<Payment>;

  beforeEach(async () => {
    jest.clearAllMocks();
    delete process.env.ALPHA_USER_QUOTAS;
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';

    paymentRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Address), useValue: stubAddressRepo() },
        { provide: PlansService, useValue: { getPlanByName: jest.fn() } },
      ],
    }).compile();
    service = module.get<PaymentsService>(PaymentsService);
  });

  it('returns a zero-price alpha subscription from a local alpha payment without calling Stripe', async () => {
    const startDate = new Date('2026-05-20T00:00:00.000Z');
    const expireDate = new Date('2027-05-20T00:00:00.000Z');
    paymentRepo.findOne!.mockResolvedValue({
      status: 'trialing',
      planName: 'alpha',
      listingsContratados: 20,
      startDate,
      expireDate,
    });

    const subscription = await service.getSubscription('user-1');

    expect(subscription).toMatchObject({
      id: 'alpha-user-1',
      status: 'trialing',
      metadata: {
        urbanai_plan: 'alpha',
        urbanai_quantity: '20',
      },
      plan: {
        id: 'alpha',
        amount: 0,
      },
    });
    expect(mockStripeCustomersList).not.toHaveBeenCalled();
  });
});

describe('PaymentsService — quota billing emails', () => {
  let service: PaymentsService;
  let userRepo: Repo<User>;
  let mailerService: { sendHtmlEmail: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    process.env.FRONT_BASE_URL = 'https://app.myurbanai.com';
    userRepo = { findOne: jest.fn() };
    mailerService = { sendHtmlEmail: jest.fn().mockResolvedValue({ enviado: true, status: 202 }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Address), useValue: stubAddressRepo() },
        { provide: PlansService, useValue: { getPlanByName: jest.fn() } },
        { provide: MailerService, useValue: mailerService },
      ],
    }).compile();
    service = module.get<PaymentsService>(PaymentsService);
  });

  it('sends a quota warning email with the upgrade link', async () => {
    userRepo.findOne!.mockResolvedValue({ id: 'u1', email: 'host@test.com', username: 'Carla Host' });

    await service.sendQuotaWarningEmail('u1', 10, 8);

    expect(mailerService.sendHtmlEmail).toHaveBeenCalledWith(
      { email: 'host@test.com', name: 'Carla Host' },
      'Urban AI - Você está perto do limite de imóveis',
      expect.stringContaining('https://app.myurbanai.com/plans?upsell=quota'),
    );
  });

  it('sends a quota exceeded email with the attempted total', async () => {
    userRepo.findOne!.mockResolvedValue({ id: 'u1', email: 'host@test.com', username: 'Carla Host' });

    await service.sendQuotaExceededEmail('u1', 10, 11);

    expect(mailerService.sendHtmlEmail).toHaveBeenCalledWith(
      { email: 'host@test.com', name: 'Carla Host' },
      'Urban AI - Limite de imóveis atingido',
      expect.stringContaining('11'),
    );
  });
});

describe('PaymentsService — billing reliability (webhook retries, renewals, ordering)', () => {
  let service: PaymentsService;
  let paymentRepo: Repo<Payment>;
  let db: any;

  const subscriptionWith = (overrides: Record<string, any> = {}) => ({
    id: 'sub_1',
    customer: 'cus_abc',
    status: 'active',
    billing_cycle_anchor: 1_700_000_000,
    items: { data: [{ plan: { interval: 'month' }, quantity: 3, current_period_end: 1_705_000_000 }] },
    metadata: { urbanai_plan: 'profissional', urbanai_billing_cycle: 'monthly', urbanai_quantity: '3' },
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockStripeConstructEvent.mockReset();
    mockStripeSubscriptionsRetrieve.mockReset();
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

    // "Banco" em memória: findOne devolve cópia nova (como o TypeORM) e só um
    // save bem-sucedido persiste — assim falhas de save não "vazam" estado.
    db = { id: 'pay1', customerId: 'cus_abc', status: 'pending', user: { email: 'h@test.com', username: 'H' } };
    paymentRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockImplementation(async () => ({ ...db })),
      save: jest.fn().mockImplementation(async (x) => {
        db = { ...x };
        return x;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Address), useValue: stubAddressRepo() },
        { provide: PlansService, useValue: { getPlanByName: jest.fn(), getSelfServicePlanForQuantity: jest.fn() } },
        { provide: MailerService, useValue: { sendHtmlEmail: jest.fn().mockResolvedValue({ enviado: true }) } },
      ],
    }).compile();
    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('failures surface so Stripe retries', () => {
    it('rejects (-> HTTP 500) when the DB save fails while processing subscription.updated', async () => {
      mockStripeConstructEvent.mockReturnValue({
        id: 'evt_fail',
        created: 100,
        type: 'customer.subscription.updated',
        data: { object: subscriptionWith() },
      });
      paymentRepo.save!.mockRejectedValueOnce(new Error('db down'));

      await expect(service.handleStripeWebhook(Buffer.from('{}'), 'sig')).rejects.toThrow('db down');
    });

    it('rejects when the Stripe subscription lookup fails on checkout.session.completed', async () => {
      mockStripeConstructEvent.mockReturnValue({
        id: 'evt_fail2',
        created: 100,
        type: 'checkout.session.completed',
        data: { object: { subscription: 'sub_1' } },
      });
      mockStripeSubscriptionsRetrieve.mockRejectedValue(new Error('stripe 503'));

      await expect(service.handleStripeWebhook(Buffer.from('{}'), 'sig')).rejects.toThrow('stripe 503');
      expect(paymentRepo.save).not.toHaveBeenCalled();
    });

    it('rejects when the payment lookup fails on invoice.payment_failed and customer.subscription.deleted', async () => {
      paymentRepo.findOne!.mockRejectedValue(new Error('db timeout'));
      for (const type of ['invoice.payment_failed', 'customer.subscription.deleted', 'payment_intent.succeeded']) {
        mockStripeConstructEvent.mockReturnValue({
          id: `evt_${type}`,
          created: 100,
          type,
          data: { object: { customer: 'cus_abc', status: 'succeeded' } },
        });
        await expect(service.handleStripeWebhook(Buffer.from('{}'), 'sig')).rejects.toThrow('db timeout');
      }
    });

    it('still returns { error } (400) for an invalid signature and { event } (200) for unknown events', async () => {
      mockStripeConstructEvent.mockImplementationOnce(() => {
        throw new Error('bad sig');
      });
      await expect(service.handleStripeWebhook(Buffer.from('{}'), 'bad')).resolves.toEqual({
        error: expect.any(Error),
      });

      const event = { id: 'evt_x', created: 1, type: 'charge.refunded', data: { object: {} } };
      mockStripeConstructEvent.mockReturnValue(event);
      await expect(service.handleStripeWebhook(Buffer.from('{}'), 'sig')).resolves.toEqual({ event });
    });
  });

  describe('idempotent retries', () => {
    it('applies the event on retry after a failed save and ignores the next duplicate', async () => {
      mockStripeConstructEvent.mockReturnValue({
        id: 'evt_retry',
        created: 100,
        type: 'customer.subscription.updated',
        data: { object: subscriptionWith({ status: 'active' }) },
      });
      paymentRepo.save!.mockRejectedValueOnce(new Error('transient'));

      await expect(service.handleStripeWebhook(Buffer.from('{}'), 'sig')).rejects.toThrow('transient');
      expect(db.status).toBe('pending');

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig'); // retry do Stripe
      expect(db.status).toBe('active');
      expect(db.listingsContratados).toBe(3);
      expect(db.recentStripeEventIds).toEqual(['evt_retry']);

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig'); // duplicado
      expect(paymentRepo.save).toHaveBeenCalledTimes(2); // 1 falha + 1 sucesso, duplicado não grava
    });
  });

  describe('invoice.paid (renewals)', () => {
    it('extends expireDate from the subscription current period end (basil: parent.subscription_details)', async () => {
      db.expireDate = new Date(1_700_000_000 * 1000);
      db.status = 'active';
      mockStripeConstructEvent.mockReturnValue({
        id: 'evt_paid',
        created: 200,
        type: 'invoice.paid',
        data: {
          object: { customer: 'cus_abc', parent: { subscription_details: { subscription: 'sub_1' } } },
        },
      });
      mockStripeSubscriptionsRetrieve.mockResolvedValue(
        subscriptionWith({
          items: { data: [{ plan: { interval: 'month' }, quantity: 3, current_period_end: 1_707_000_000 }] },
        }),
      );

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(mockStripeSubscriptionsRetrieve).toHaveBeenCalledWith('sub_1');
      expect(db.expireDate).toEqual(new Date(1_707_000_000 * 1000));
      expect(db.status).toBe('active');
    });

    it('re-activates a past_due payment and supports legacy invoice.subscription + subscription.current_period_end', async () => {
      db.status = 'past_due';
      mockStripeConstructEvent.mockReturnValue({
        id: 'evt_paid2',
        created: 200,
        type: 'invoice.paid',
        data: { object: { customer: 'cus_abc', subscription: 'sub_1' } },
      });
      mockStripeSubscriptionsRetrieve.mockResolvedValue(
        subscriptionWith({
          current_period_end: 1_708_000_000,
          items: { data: [{ plan: { interval: 'month' }, quantity: 3 }] },
        }),
      );

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(db.status).toBe('active');
      expect(db.expireDate).toEqual(new Date(1_708_000_000 * 1000));
    });

    it('ignores invoices without a subscription', async () => {
      mockStripeConstructEvent.mockReturnValue({
        id: 'evt_paid3',
        created: 200,
        type: 'invoice.paid',
        data: { object: { customer: 'cus_abc' } },
      });

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(mockStripeSubscriptionsRetrieve).not.toHaveBeenCalled();
      expect(paymentRepo.save).not.toHaveBeenCalled();
    });

    it('customer.subscription.updated also refreshes expireDate and past_due/canceled/unpaid status', async () => {
      for (const status of ['past_due', 'canceled', 'unpaid']) {
        mockStripeConstructEvent.mockReturnValue({
          id: `evt_${status}`,
          created: 300,
          type: 'customer.subscription.updated',
          data: { object: subscriptionWith({ status }) },
        });
        await service.handleStripeWebhook(Buffer.from('{}'), 'sig');
        expect(db.status).toBe(status);
        expect(db.expireDate).toEqual(new Date(1_705_000_000 * 1000));
      }
    });
  });

  describe('out-of-order events', () => {
    it('does not drop an older checkout.session.completed after a newer subscription.updated', async () => {
      db.lastStripeEventCreated = '500';
      db.recentStripeEventIds = ['evt_sub_updated'];
      db.status = 'active';
      mockStripeConstructEvent.mockReturnValue({
        id: 'evt_checkout_old',
        created: 100,
        type: 'checkout.session.completed',
        data: { object: { subscription: 'sub_1', metadata: {} } },
      });
      mockStripeSubscriptionsRetrieve.mockResolvedValue(subscriptionWith());

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(db.planName).toBe('profissional');
      expect(db.subscriptionId).toBe('sub_1');
      expect(db.expireDate).toEqual(new Date(1_705_000_000 * 1000));
      expect(db.lastStripeEventCreated).toBe('500'); // watermark nunca regride
      expect(db.recentStripeEventIds).toEqual(['evt_sub_updated', 'evt_checkout_old']);
    });

    it('rebuilds state from Stripe for a stale subscription.updated instead of dropping it', async () => {
      db.lastStripeEventCreated = '500';
      mockStripeConstructEvent.mockReturnValue({
        id: 'evt_sub_stale',
        created: 100,
        type: 'customer.subscription.updated',
        data: { object: subscriptionWith({ items: { data: [{ plan: { interval: 'month' }, quantity: 2 }] }, metadata: {} }) },
      });
      mockStripeSubscriptionsRetrieve.mockResolvedValue(
        subscriptionWith({ items: { data: [{ plan: { interval: 'month' }, quantity: 7, current_period_end: 1_709_000_000 }] }, metadata: {} }),
      );

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(mockStripeSubscriptionsRetrieve).toHaveBeenCalledWith('sub_1');
      expect(db.listingsContratados).toBe(7);
      expect(db.expireDate).toEqual(new Date(1_709_000_000 * 1000));
    });

    it('still drops stale payload-only events (payment_failed older than the watermark)', async () => {
      db.lastStripeEventCreated = '500';
      db.status = 'active';
      mockStripeConstructEvent.mockReturnValue({
        id: 'evt_failed_old',
        created: 100,
        type: 'invoice.payment_failed',
        data: { object: { customer: 'cus_abc' } },
      });

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(paymentRepo.save).not.toHaveBeenCalled();
      expect(db.status).toBe('active');
    });

    it('ignores subscription.deleted for an old subscription when a newer one is stored', async () => {
      db.status = 'active';
      db.subscriptionId = 'sub_new';
      mockStripeConstructEvent.mockReturnValue({
        id: 'evt_del_old',
        created: 600,
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_old', customer: 'cus_abc' } },
      });

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(db.status).toBe('active');
    });
  });

  describe('trial bookkeeping', () => {
    it('stamps trialUsedAt when a trialing subscription is projected', async () => {
      mockStripeConstructEvent.mockReturnValue({
        id: 'evt_trial',
        created: 100,
        type: 'checkout.session.completed',
        data: { object: { subscription: 'sub_1' } },
      });
      mockStripeSubscriptionsRetrieve.mockResolvedValue(subscriptionWith({ status: 'trialing', trial_start: 1_700_000_000 }));

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(db.trialUsedAt).toBeInstanceOf(Date);
      expect(db.status).toBe('trialing');
    });
  });
});

describe('PaymentsService — createCheckoutSession trial rules', () => {
  let service: PaymentsService;
  let paymentRepo: Repo<Payment>;
  let plansService: { getPlanByName: jest.Mock; getSelfServicePlanForQuantity: jest.Mock };

  const proPlan = (extra: Record<string, any> = {}) => ({
    name: 'profissional',
    stripePriceId: 'price_m_pro',
    minProperties: 1,
    maxProperties: 10,
    maxCheckoutQuantity: 10,
    ...extra,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    process.env.SUCCESS_URL = 'https://urban.test/success';
    process.env.CANCEL_URL = 'https://urban.test/cancel';
    process.env.TRIAL_PERIOD_DAYS = '14';
    paymentRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'pay1', customerId: null }),
      save: jest.fn().mockImplementation(async (x) => x),
    };
    const userRepo = { findOne: jest.fn().mockResolvedValue({ id: 'u1', email: 'u@test.com', username: 'U' }) };
    plansService = {
      getPlanByName: jest.fn().mockResolvedValue(proPlan()),
      getSelfServicePlanForQuantity: jest.fn().mockResolvedValue(null),
    };
    mockStripeCustomersList.mockResolvedValue({ data: [{ id: 'cus_abc' }] });
    mockStripeSubscriptionsList.mockReset();
    mockStripeSubscriptionsList.mockResolvedValue({ data: [] });
    mockStripeCheckoutSessionsCreate.mockReset();
    mockStripeCheckoutSessionsCreate.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.test/cs_1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Address), useValue: stubAddressRepo() },
        { provide: PlansService, useValue: plansService },
      ],
    }).compile();
    service = module.get<PaymentsService>(PaymentsService);
  });

  afterAll(() => {
    delete process.env.TRIAL_PERIOD_DAYS;
  });

  it('returns the Stripe session including the hosted checkout url', async () => {
    const session = await service.createCheckoutSession({ plan: 'trial' }, 'u1');
    expect(session.url).toBe('https://checkout.stripe.test/cs_1');
    expect(mockStripeCheckoutSessionsCreate.mock.calls[0][0].subscription_data.trial_period_days).toBe(14);
  });

  it.each([undefined, '', '   ', 'abc', '0', '-3', '1.5', '9999'])(
    'disables trial with a 400 when TRIAL_PERIOD_DAYS=%p (never sends NaN to Stripe)',
    async (value) => {
      if (value === undefined) delete process.env.TRIAL_PERIOD_DAYS;
      else process.env.TRIAL_PERIOD_DAYS = value;

      await expect(service.createCheckoutSession({ plan: 'trial' }, 'u1')).rejects.toBeInstanceOf(BadRequestException);
      expect(mockStripeCheckoutSessionsCreate).not.toHaveBeenCalled();
      expect(mockStripeCustomersList).not.toHaveBeenCalled();
    },
  );

  it('does not affect paid checkout when TRIAL_PERIOD_DAYS is unset', async () => {
    delete process.env.TRIAL_PERIOD_DAYS;
    await service.createCheckoutSession({ plan: 'profissional' }, 'u1');
    const args = mockStripeCheckoutSessionsCreate.mock.calls[0][0];
    expect(args.subscription_data.trial_period_days).toBeUndefined();
  });

  it('rejects trial when the user already used one (trialUsedAt)', async () => {
    paymentRepo.find!.mockResolvedValue([{ id: 'pay1', status: 'canceled', trialUsedAt: new Date() }]);
    await expect(service.createCheckoutSession({ plan: 'trial' }, 'u1')).rejects.toThrow(/já foi utilizado/);
    expect(mockStripeCheckoutSessionsCreate).not.toHaveBeenCalled();
  });

  it('rejects trial when Stripe shows a previous trial on the customer', async () => {
    mockStripeSubscriptionsList.mockResolvedValue({ data: [{ id: 'sub_old', status: 'canceled', trial_start: 1_600_000_000 }] });
    await expect(service.createCheckoutSession({ plan: 'trial' }, 'u1')).rejects.toThrow(/já foi utilizado/);
    expect(mockStripeCheckoutSessionsCreate).not.toHaveBeenCalled();
  });

  it('rejects trial when there is already an active/trialing subscription (local or Stripe)', async () => {
    paymentRepo.find!.mockResolvedValue([{ id: 'pay1', status: 'active', subscriptionId: 'sub_1' }]);
    await expect(service.createCheckoutSession({ plan: 'trial' }, 'u1')).rejects.toThrow(/assinatura ativa/);

    paymentRepo.find!.mockResolvedValue([]);
    mockStripeSubscriptionsList.mockResolvedValue({ data: [{ id: 'sub_2', status: 'active' }] });
    await expect(service.createCheckoutSession({ plan: 'trial' }, 'u1')).rejects.toThrow(/assinatura ativa/);
    expect(mockStripeCheckoutSessionsCreate).not.toHaveBeenCalled();
  });

  it('caps trial quantity by the same self-service rules as paid checkout', async () => {
    await expect(service.createCheckoutSession({ plan: 'trial', quantity: 11 }, 'u1')).rejects.toThrow(/11 imóveis/);
    expect(mockStripeCheckoutSessionsCreate).not.toHaveBeenCalled();

    await service.createCheckoutSession({ plan: 'trial', quantity: 10 }, 'u1');
    expect(mockStripeCheckoutSessionsCreate.mock.calls[0][0].line_items[0].quantity).toBe(10);
  });

  it('rejects trial when the profissional plan is not self-service', async () => {
    plansService.getPlanByName.mockResolvedValue(proPlan({ selfServiceEnabled: false }));
    await expect(service.createCheckoutSession({ plan: 'trial' }, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(mockStripeCheckoutSessionsCreate).not.toHaveBeenCalled();
  });
});
