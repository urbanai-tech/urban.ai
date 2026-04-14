import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Payment } from 'src/entities/payment.entity';
import { User } from 'src/entities/user.entity';
import Stripe from 'stripe';
import { In, Repository } from 'typeorm';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(
    @InjectRepository(Payment) private paymentRepository: Repository<Payment>,
    @InjectRepository(User) private userRepository: Repository<User>,
    private plansService: PlansService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-08-27.basil',
    });
  }
  async findByUserId(userId: string): Promise<any> {
    const payment = await this.paymentRepository.find({
      where: {
        user: { id: userId },
        status: In(['trialing', 'active']),
      },
      relations: ['user'], // se precisar carregar dados do usuário
    });
    if (payment.length > 0) {
      return { active: true }
    } else {
      return { active: false }
    }
  }
  async getSubscription(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    const customers = await this.stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    if (!customers.data || customers.data.length === 0) {
      return null;
    }

    const payment = await this.paymentRepository.findOne({
      where: { customerId: customers.data[0].id },
    });

    if (!payment || !payment.subscriptionId) {
      return null;
    }

    const subscriptions = await this.stripe.subscriptions.list({
      customer: customers.data[0].id,
      status: 'all',
    });

    const subscription = subscriptions.data.find(sub => sub.id === payment.subscriptionId);
    return subscription || null;
  }

  async cancelSubscription(userId: string) {
    // Primeiro, buscar o usuário
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    // Buscar o cliente Stripe pelo email
    const customers = await this.stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      throw new Error("Cliente Stripe não encontrado");
    }

    const customerId = customers.data[0].id;

    // Buscar o pagamento que tenha o customerId
    const payment = await this.paymentRepository.findOne({
      where: { customerId },
    });

    if (!payment || !payment.subscriptionId) {
      throw new Error("Pagamento ou subscriptionId não encontrado");
    }

    // Cancelar a subscription no Stripe
    const canceledSubscription = await this.stripe.subscriptions.cancel(payment.subscriptionId);

    return canceledSubscription;
  }


  async createCheckoutSession(data: { plan: string }, userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    console.log(user)

    const customers = await this.stripe.customers.list({
      email: user.email,
      limit: 1,
    });
    let customerId: string;

    if (customers.data.length > 0) {
      // Cliente já existe
      customerId = customers.data[0].id;
      const payment = await this.paymentRepository.findOne({
        where: { user: { id: user?.id } },
      });
      payment.customerId = customerId
      await this.paymentRepository.save(payment)
    } else {
      const newCustomer = await this.stripe.customers.create({
        email: user.email,
        name: user.username,
      });

      const payment = await this.paymentRepository.findOne({
        where: { user: { id: user?.id } },
      });
      payment.customerId = newCustomer.id
      await this.paymentRepository.save(payment)
      customerId = newCustomer.id;
    }



    const planEntity = await this.plansService.getPlanByName(data.plan === 'trial' ? 'profissional' : data.plan);
    const stripePrice = planEntity?.stripePriceId || process.env.MENSAL_PLAN;
    const TRIAL_PERIOD_DAYS = process.env.TRIAL_PERIOD_DAYS

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: stripePrice,
        quantity: 1,
      }],
      ...(data?.plan === 'trial' && {
        subscription_data: {
          trial_period_days: Number(TRIAL_PERIOD_DAYS)
        }
      }),
      mode: 'subscription',
      success_url: process.env.SUCCESS_URL,
      cancel_url: process.env.CANCEL_URL,
      customer: customerId,
      allow_promotion_codes: false,
      billing_address_collection: 'auto',
    });
    return session;
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string) {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
    } catch (err) {
      console.error('⚠️ Falha na verificação de assinatura do webhook:', err.message);
      return { error: err };
    }

    console.log(`📬 Webhook recebido: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription && typeof session.subscription === 'string') {
          try {
            const subscription = await this.stripe.subscriptions.retrieve(session.subscription) as Stripe.Subscription;
            const subscriptionId = subscription?.id;
            const customerId = subscription?.customer;
            const interval = subscription?.items.data[0]?.plan?.interval;
            const startCycle = new Date(subscription?.billing_cycle_anchor * 1000);
            const status = subscription.status;

            const cycleEnd = new Date(startCycle);
            if (interval === 'month') {
              cycleEnd.setMonth(cycleEnd.getMonth() + 1);
            } else if (interval === 'year') {
              cycleEnd.setFullYear(cycleEnd.getFullYear() + 1);
            }

            const id = typeof customerId === 'string' ? customerId : customerId.id;
            const payment = await this.paymentRepository.findOne({
              where: { customerId: id },
            });

            if (payment) {
              payment.mode = interval;
              payment.expireDate = cycleEnd;
              payment.subscriptionId = subscriptionId;
              payment.startDate = startCycle;

              if (status === 'trialing') {
                payment.status = status;
              }

              await this.paymentRepository.save(payment);
              console.log(`✅ checkout.session.completed processado para customer ${id}`);
            } else {
              console.warn(`⚠️ Payment não encontrado para customer ${id}`);
            }
          } catch (err) {
            console.error('❌ Erro ao processar checkout.session.completed:', err.message);
          }
        } else {
          console.log('ℹ️ Subscription não disponível ou já populada');
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('💰 PAYMENT_INTENT.SUCCEEDED');
        if (paymentIntent?.status === 'succeeded' && paymentIntent?.customer) {
          try {
            const customerId = paymentIntent.customer;
            const id = typeof customerId === 'string' ? customerId : customerId.id;
            const payment = await this.paymentRepository.findOne({
              where: { customerId: id },
            });

            if (payment) {
              payment.status = 'active';
              await this.paymentRepository.save(payment);
              console.log(`✅ Payment ativado para customer ${id}`);
            } else {
              console.warn(`⚠️ Payment não encontrado para customer ${id}`);
            }
          } catch (err) {
            console.error('❌ Erro ao processar payment_intent.succeeded:', err.message);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        try {
          const customerId = subscription.customer;
          const id = typeof customerId === 'string' ? customerId : customerId.id;
          const payment = await this.paymentRepository.findOne({
            where: { customerId: id },
          });

          if (payment) {
            payment.status = subscription.status === 'active' ? 'active'
              : subscription.status === 'trialing' ? 'trialing'
              : subscription.status === 'past_due' ? 'past_due'
              : payment.status;

            const interval = subscription.items.data[0]?.plan?.interval;
            if (interval) {
              payment.mode = interval;
            }

            await this.paymentRepository.save(payment);
            console.log(`✅ Subscription atualizada para customer ${id} -> status: ${subscription.status}`);
          }
        } catch (err) {
          console.error('❌ Erro ao processar subscription.updated:', err.message);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        try {
          const customerId = subscription.customer;
          const id = typeof customerId === 'string' ? customerId : customerId.id;
          const payment = await this.paymentRepository.findOne({
            where: { customerId: id },
          });

          if (payment) {
            payment.status = 'canceled';
            await this.paymentRepository.save(payment);
            console.log(`🚫 Subscription cancelada para customer ${id}`);
          }
        } catch (err) {
          console.error('❌ Erro ao processar subscription.deleted:', err.message);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        try {
          const customerId = invoice.customer;
          const id = typeof customerId === 'string' ? customerId : customerId.id;
          const payment = await this.paymentRepository.findOne({
            where: { customerId: id },
          });

          if (payment) {
            payment.status = 'past_due';
            await this.paymentRepository.save(payment);
            console.log(`⚠️ Pagamento falhou para customer ${id}`);
          }
        } catch (err) {
          console.error('❌ Erro ao processar invoice.payment_failed:', err.message);
        }
        break;
      }

      default:
        console.log(`📬 Evento não tratado: ${event.type}`);
    }

    return { event };
  }


  async createPayment(user: User, data?: {
    customerId?: string;
    subscriptionId?: string;
    mode?: string;
    expireDate?: Date;
  }) {
    const payment = this.paymentRepository.create({
      user,
      customerId: data?.customerId || null,
      subscriptionId: data?.subscriptionId || null,
      mode: data?.mode || null,
      expireDate: data?.expireDate || null,
      status: "pending",
    });

    return this.paymentRepository.save(payment);
  }

}
