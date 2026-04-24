// Mock do Stripe SDK antes de qualquer import — o service instancia o cliente
// no constructor, então precisamos controlar os métodos.
const mockStripeConstructEvent = jest.fn();
const mockStripeSubscriptionsRetrieve = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mockStripeConstructEvent },
    subscriptions: { retrieve: mockStripeSubscriptionsRetrieve },
    customers: { list: jest.fn() },
    checkout: { sessions: { create: jest.fn() } },
  }));
});

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentsService } from './payments.service';
import { Payment } from '../entities/payment.entity';
import { User } from '../entities/user.entity';
import { PlansService } from '../plans/plans.service';

type Repo<T> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe('PaymentsService — handleStripeWebhook', () => {
  let service: PaymentsService;
  let paymentRepo: Repo<Payment>;
  let userRepo: Repo<User>;
  let plansService: { getPlanByName: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    paymentRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (x) => x),
      create: jest.fn(),
    };
    userRepo = { findOne: jest.fn() };
    plansService = { getPlanByName: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: PlansService, useValue: plansService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('signature verification', () => {
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
        items: { data: [{ plan: { interval: 'month' } }] },
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
            items: { data: [{ plan: { interval: 'year' } }] },
          },
        },
      });
      paymentRepo.findOne!.mockResolvedValue({ id: 'pay1', customerId: 'cus_abc', status: 'trialing' });

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active', mode: 'year' }),
      );
    });
  });

  describe('customer.subscription.deleted', () => {
    it('marks the Payment row as canceled', async () => {
      mockStripeConstructEvent.mockReturnValue({
        type: 'customer.subscription.deleted',
        data: { object: { customer: 'cus_abc' } },
      });
      paymentRepo.findOne!.mockResolvedValue({ id: 'pay1', customerId: 'cus_abc', status: 'active' });

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'canceled' }),
      );
    });
  });

  describe('invoice.payment_failed', () => {
    it('marks the Payment row as past_due', async () => {
      mockStripeConstructEvent.mockReturnValue({
        type: 'invoice.payment_failed',
        data: { object: { customer: 'cus_abc' } },
      });
      paymentRepo.findOne!.mockResolvedValue({ id: 'pay1', customerId: 'cus_abc', status: 'active' });

      await service.handleStripeWebhook(Buffer.from('{}'), 'sig');

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'past_due' }),
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
