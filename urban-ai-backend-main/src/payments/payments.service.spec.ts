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
  let plansService: { getPlanByName: jest.Mock };
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
    plansService = { getPlanByName: jest.fn() };
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

    await expect(service.createBillingPortalSession('u1')).rejects.toThrow('Stripe is not configured');
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

    await expect(service.cancelSubscription('u1')).rejects.toThrow('Stripe is not configured');
    expect(mockStripeCustomersList).not.toHaveBeenCalled();
  });
});

describe('PaymentsService — createCheckoutSession', () => {
  let service: PaymentsService;
  let paymentRepo: Repo<Payment>;
  let userRepo: Repo<User>;
  let plansService: { getPlanByName: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    process.env.SUCCESS_URL = 'https://urban.test/success';
    process.env.CANCEL_URL = 'https://urban.test/cancel';
    paymentRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (x) => x),
    };
    userRepo = { findOne: jest.fn() };
    plansService = { getPlanByName: jest.fn() };

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
      'Stripe is not configured',
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
    ).rejects.toThrow('Invalid billingCycle');
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
    ).rejects.toThrow('Invalid checkout quantity');

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
      'Urban AI - Voce esta perto do limite de imoveis',
      expect.stringContaining('https://app.myurbanai.com/plans?upsell=quota'),
    );
  });

  it('sends a quota exceeded email with the attempted total', async () => {
    userRepo.findOne!.mockResolvedValue({ id: 'u1', email: 'host@test.com', username: 'Carla Host' });

    await service.sendQuotaExceededEmail('u1', 10, 11);

    expect(mailerService.sendHtmlEmail).toHaveBeenCalledWith(
      { email: 'host@test.com', name: 'Carla Host' },
      'Urban AI - Limite de imoveis atingido',
      expect.stringContaining('11'),
    );
  });
});
