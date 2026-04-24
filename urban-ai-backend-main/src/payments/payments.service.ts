import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Payment } from 'src/entities/payment.entity';
import { User } from 'src/entities/user.entity';
import { Address } from 'src/entities/addresses.entity';
import Stripe from 'stripe';
import { In, Repository } from 'typeorm';
import { PlansService } from '../plans/plans.service';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(
    @InjectRepository(Payment) private paymentRepository: Repository<Payment>,
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Address) private addressRepository: Repository<Address>,
    private plansService: PlansService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-08-27.basil',
    });
  }
  /**
   * F6.5 — quota de imóveis contratados vs. ativos.
   *
   * `contratados` vem do Payment ativo mais recente do user. `ativos` é a
   * contagem de Address vinculados a esse user. `podeAdicionar = ativos < contratados`.
   *
   * Quando `podeAdicionar` é falso, o frontend exibe o GlobalPaywallModal
   * pedindo upgrade de quantity (PaymentCheckGuard reage a este flag).
   */
  async getListingsQuota(
    userId: string,
  ): Promise<{ contratados: number; ativos: number; podeAdicionar: boolean }> {
    const payment = await this.paymentRepository.findOne({
      where: {
        user: { id: userId },
        status: In(['active', 'trialing']),
      },
      order: { updatedAt: 'DESC' },
    });

    const contratados = Math.max(1, payment?.listingsContratados ?? 1);
    const ativos = await this.addressRepository.count({
      where: { user: { id: userId } },
    });

    return {
      contratados,
      ativos,
      podeAdicionar: ativos < contratados,
    };
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


  /**
   * Cria sessão de checkout no Stripe.
   *
   * F6.5: aceita 4 ciclos (monthly | quarterly | semestral | annual) e
   * `quantity` (número de imóveis). O Stripe cobra `price × quantity` por
   * período de cobrança.
   *
   * Compatibilidade: o caller antigo que passa `billingCycle: 'monthly'|'annual'`
   * continua funcionando — usamos os Price IDs legados (`stripePriceId`,
   * `stripePriceIdAnnual`) quando os novos não estão setados.
   */
  async createCheckoutSession(
    data: {
      plan: string;
      billingCycle?: 'monthly' | 'quarterly' | 'semestral' | 'annual';
      quantity?: number;
    },
    userId: string,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new Error('Usuário não encontrado');

    // 1) Resolve customer Stripe (cria se não existir)
    const customerId = await this.ensureStripeCustomer(user);

    // 2) Resolve plano + Price ID conforme ciclo
    const planEntity = await this.plansService.getPlanByName(
      data.plan === 'trial' ? 'profissional' : data.plan,
    );
    const billingCycle = data.billingCycle || 'monthly';
    const stripePrice = this.resolveStripePriceId(planEntity, billingCycle);
    if (!stripePrice) {
      throw new Error(
        `Stripe Price ID ausente para plano=${data.plan} ciclo=${billingCycle}. Conferir seedPlans / env vars.`,
      );
    }

    // 3) Quantidade — número de imóveis contratados. Sempre ≥ 1.
    const quantity = Math.max(1, Math.floor(data.quantity ?? 1));

    const TRIAL_PERIOD_DAYS = process.env.TRIAL_PERIOD_DAYS;

    // Metadata viaja no webhook, permite reconstruir o ciclo + quantity
    // mesmo que o Stripe não exponha exatamente nossos 4 ciclos.
    const urbanaiMeta = {
      urbanai_plan: data.plan,
      urbanai_billing_cycle: billingCycle,
      urbanai_quantity: String(quantity),
    };

    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: urbanaiMeta,
      ...(data?.plan === 'trial' && {
        trial_period_days: Number(TRIAL_PERIOD_DAYS),
      }),
    };

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePrice,
          quantity,
        },
      ],
      metadata: urbanaiMeta,
      subscription_data: subscriptionData,
      mode: 'subscription',
      success_url: process.env.SUCCESS_URL,
      cancel_url: process.env.CANCEL_URL,
      customer: customerId,
      allow_promotion_codes: false,
      billing_address_collection: 'auto',
    });
    return session;
  }

  private async ensureStripeCustomer(user: User): Promise<string> {
    const customers = await this.stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const newCustomer = await this.stripe.customers.create({
        email: user.email,
        name: user.username,
      });
      customerId = newCustomer.id;
    }

    const payment = await this.paymentRepository.findOne({
      where: { user: { id: user.id } },
    });
    if (payment) {
      payment.customerId = customerId;
      await this.paymentRepository.save(payment);
    }

    return customerId;
  }

  /**
   * Mapeia o `interval` do Stripe (month, year) para o billingCycle interno.
   * Fallback para 'monthly' quando o intervalo não bate.
   */
  private intervalToCycle(interval: string | undefined | null): 'monthly' | 'annual' {
    if (interval === 'year') return 'annual';
    return 'monthly';
  }

  private resolveStripePriceId(
    planEntity: any,
    billingCycle: 'monthly' | 'quarterly' | 'semestral' | 'annual',
  ): string {
    if (!planEntity) {
      // Fallback para env vars legadas — útil enquanto Stripe Price IDs
      // novos do F6.5 não estiverem provisionados.
      if (billingCycle === 'annual') return process.env.ANUAL_PLAN || '';
      return process.env.MENSAL_PLAN || '';
    }

    // Caminho F6.5 — preferir os IDs novos por ciclo
    switch (billingCycle) {
      case 'monthly':
        return (
          planEntity.stripePriceIdMonthly ||
          planEntity.stripePriceId ||
          process.env.MENSAL_PLAN ||
          ''
        );
      case 'quarterly':
        return planEntity.stripePriceIdQuarterly || '';
      case 'semestral':
        return planEntity.stripePriceIdSemestral || '';
      case 'annual':
        return (
          planEntity.stripePriceIdAnnualNew ||
          planEntity.stripePriceIdAnnual ||
          process.env.ANUAL_PLAN ||
          ''
        );
    }
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
            const subscription = (await this.stripe.subscriptions.retrieve(
              session.subscription,
            )) as Stripe.Subscription;
            const subscriptionId = subscription?.id;
            const customerId = subscription?.customer;
            const item = subscription?.items.data[0];
            const interval = item?.plan?.interval;
            const startCycle = new Date(subscription?.billing_cycle_anchor * 1000);
            const status = subscription.status;

            // F6.5: extrair billingCycle e quantity. Preferimos os metadados que
            // setamos no createCheckoutSession; caímos para o `interval` do Stripe
            // como fallback se o checkout veio antes desta mudança.
            const meta = (subscription.metadata || {}) as Record<string, string>;
            const sessionMeta = (session.metadata || {}) as Record<string, string>;
            const urbanCycle =
              meta.urbanai_billing_cycle ||
              sessionMeta.urbanai_billing_cycle ||
              this.intervalToCycle(interval);
            const urbanQuantity = parseInt(
              meta.urbanai_quantity || sessionMeta.urbanai_quantity || String(item?.quantity ?? 1),
              10,
            );
            const planName = meta.urbanai_plan || sessionMeta.urbanai_plan || null;

            const cycleEnd = new Date(startCycle);
            switch (urbanCycle) {
              case 'monthly':
                cycleEnd.setMonth(cycleEnd.getMonth() + 1);
                break;
              case 'quarterly':
                cycleEnd.setMonth(cycleEnd.getMonth() + 3);
                break;
              case 'semestral':
                cycleEnd.setMonth(cycleEnd.getMonth() + 6);
                break;
              case 'annual':
                cycleEnd.setFullYear(cycleEnd.getFullYear() + 1);
                break;
            }

            const id = typeof customerId === 'string' ? customerId : customerId.id;
            const payment = await this.paymentRepository.findOne({
              where: { customerId: id },
            });

            if (payment) {
              payment.mode = interval ?? null;
              payment.billingCycle = urbanCycle;
              payment.listingsContratados = Math.max(1, urbanQuantity);
              if (planName) payment.planName = planName;
              payment.expireDate = cycleEnd;
              payment.subscriptionId = subscriptionId;
              payment.startDate = startCycle;

              if (status === 'trialing') {
                payment.status = status;
              }

              await this.paymentRepository.save(payment);
              console.log(
                `✅ checkout.session.completed processado para customer ${id} ` +
                  `(cycle=${urbanCycle}, qty=${urbanQuantity})`,
              );
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

            const item = subscription.items.data[0];
            const interval = item?.plan?.interval;
            if (interval) {
              payment.mode = interval;
            }

            // F6.5: refletir mudança de quantity (upsell de imóveis) no nosso state
            const meta = (subscription.metadata || {}) as Record<string, string>;
            const newQty = parseInt(meta.urbanai_quantity || String(item?.quantity ?? 1), 10);
            if (Number.isFinite(newQty) && newQty > 0) {
              payment.listingsContratados = newQty;
            }
            if (meta.urbanai_billing_cycle) {
              payment.billingCycle = meta.urbanai_billing_cycle;
            }

            await this.paymentRepository.save(payment);
            console.log(
              `✅ Subscription atualizada para customer ${id} -> status: ${subscription.status}, qty=${payment.listingsContratados}`,
            );
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
