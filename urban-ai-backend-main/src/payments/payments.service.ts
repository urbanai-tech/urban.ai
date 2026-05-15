import { BadRequestException, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Payment } from 'src/entities/payment.entity';
import { User } from 'src/entities/user.entity';
import { Address } from 'src/entities/addresses.entity';
import Stripe from 'stripe';
import { In, Repository } from 'typeorm';
import { PlansService } from '../plans/plans.service';
import { BillingCycle } from '../entities/plan.entity';
import { isBillingCycle, resolveStripePriceId } from './stripe-price-id.resolver';
import { MailerService } from '../mailer/mailer.service';
import { EmailTemplates } from '../email/templates';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(
    @InjectRepository(Payment) private paymentRepository: Repository<Payment>,
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Address) private addressRepository: Repository<Address>,
    private plansService: PlansService,
    @Optional() private readonly mailerService?: MailerService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_not_configured', {
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
    const alphaQuota = await this.getAlphaQuota(userId);
    if (alphaQuota) {
      const ativos = await this.addressRepository.count({
        where: { user: { id: userId } },
      });

      return {
        contratados: alphaQuota,
        ativos,
        podeAdicionar: ativos < alphaQuota,
      };
    }

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
    const alphaQuota = await this.getAlphaQuota(userId);
    if (alphaQuota) {
      return {
        active: true,
        alpha: true,
        listingsContratados: alphaQuota,
      };
    }

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
    const alphaQuota = await this.getAlphaQuota(userId);
    if (alphaQuota) {
      return {
        id: `alpha-${userId}`,
        status: 'trialing',
        currency: 'brl',
        start_date: Math.floor(Date.now() / 1000),
        metadata: {
          urbanai_plan: 'alpha',
          urbanai_quantity: String(alphaQuota),
          urbanai_billing_cycle: 'monthly',
        },
        plan: {
          id: 'alpha',
          amount: 0,
          currency: 'brl',
          interval: 'monthly',
        },
      };
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!this.isStripeConfigured()) return null;

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

  private async getAlphaQuota(userId: string): Promise<number | null> {
    const raw = process.env.ALPHA_USER_QUOTAS || '';
    if (!raw.trim()) return null;

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    const keys = new Set([
      userId.toLowerCase(),
      user?.email?.toLowerCase(),
    ].filter(Boolean));

    for (const entry of raw.split(',')) {
      const [rawKey, rawQuota] = entry.split(':').map((part) => part?.trim());
      if (!rawKey || !rawQuota) continue;
      if (!keys.has(rawKey.toLowerCase())) continue;

      const quota = Number(rawQuota);
      return Number.isFinite(quota) && quota > 0 ? Math.floor(quota) : null;
    }

    return null;
  }

  async cancelSubscription(userId: string) {
    // Primeiro, buscar o usuário
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    this.ensureStripeConfigured();

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
    // 2) Resolve plano + Price ID conforme ciclo
    const planEntity = await this.plansService.getPlanByName(
      data.plan === 'trial' ? 'profissional' : data.plan,
    );
    const billingCycle = this.resolveBillingCycle(data.billingCycle);
    const { priceId: stripePrice } = resolveStripePriceId(planEntity, billingCycle, data.plan);
    if (!stripePrice) {
      throw new ServiceUnavailableException(
        `Stripe Price ID not configured for plan=${data.plan} cycle=${billingCycle}`,
      );
    }
    this.ensureStripeConfigured();
    this.ensureCheckoutUrlsConfigured();

    // 3) Quantidade — número de imóveis contratados. Sempre ≥ 1.
    const quantity = this.resolveCheckoutQuantity(data.quantity);
    const customerId = await this.ensureStripeCustomer(user);

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

  private resolveCheckoutQuantity(quantity: unknown): number {
    const parsed = Number(quantity ?? 1);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException('Invalid checkout quantity');
    }
    return Math.max(1, Math.floor(parsed));
  }

  /**
   * Mapeia o `interval` do Stripe (month, year) para o billingCycle interno.
   * Fallback para 'monthly' quando o intervalo não bate.
   */
  private intervalToCycle(interval: string | undefined | null): 'monthly' | 'annual' {
    if (interval === 'year') return 'annual';
    return 'monthly';
  }

  private deprecatedResolveStripePriceId(
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

  private resolveBillingCycle(value: unknown): BillingCycle {
    const cycle = value || 'monthly';
    if (!isBillingCycle(cycle)) {
      throw new BadRequestException('Invalid billingCycle. Use monthly, quarterly, semestral or annual.');
    }
    return cycle;
  }

  private isStripeConfigured(): boolean {
    return !!process.env.STRIPE_SECRET_KEY?.trim();
  }

  private ensureStripeConfigured() {
    if (!this.isStripeConfigured()) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }
  }

  private ensureCheckoutUrlsConfigured() {
    if (!process.env.SUCCESS_URL?.trim() || !process.env.CANCEL_URL?.trim()) {
      throw new ServiceUnavailableException('Stripe checkout URLs are not configured');
    }
  }

  private normalizePaymentStatus(status: string | null | undefined): string {
    return status === 'peding' ? 'pending' : status || 'pending';
  }

  private subscriptionStatusToPaymentStatus(status: string, currentStatus?: string | null): string {
    switch (status) {
      case 'active':
      case 'trialing':
      case 'past_due':
      case 'canceled':
      case 'unpaid':
      case 'incomplete':
      case 'incomplete_expired':
      case 'paused':
        return status;
      default:
        return this.normalizePaymentStatus(currentStatus);
    }
  }

  private getFrontBaseUrl(): string {
    return (process.env.FRONT_BASE_URL || 'https://app.myurbanai.com').replace(/\/$/, '');
  }

  private async sendBillingEmail(
    payment: Payment | null | undefined,
    subject: string,
    html: string,
  ): Promise<void> {
    const user = payment?.user;
    await this.sendBillingEmailToUser(user, subject, html, payment?.id);
  }

  private async sendBillingEmailToUser(
    user: User | null | undefined,
    subject: string,
    html: string,
    paymentId = 'none',
  ): Promise<void> {
    if (!this.mailerService || !user?.email) return;

    try {
      await this.mailerService.sendHtmlEmail(
        { email: user.email, name: user.username || user.email },
        subject,
        html,
      );
    } catch (error: any) {
      console.warn(`Billing email failed for payment=${paymentId}: ${error?.message || error}`);
    }
  }

  async sendQuotaWarningEmail(userId: string, contratados: number, ativos: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    await this.sendBillingEmailToUser(
      user,
      'Urban AI - Voce esta perto do limite de imoveis',
      EmailTemplates.getQuotaWarningTemplate({
        nome: user?.username || user?.email || 'Usuario',
        contratados,
        ativos,
        upgradeUrl: `${this.getFrontBaseUrl()}/plans?upsell=quota`,
      }),
    );
  }

  async sendQuotaExceededEmail(userId: string, contratados: number, tentando: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    await this.sendBillingEmailToUser(
      user,
      'Urban AI - Limite de imoveis atingido',
      EmailTemplates.getQuotaExceededTemplate({
        nome: user?.username || user?.email || 'Usuario',
        contratados,
        tentando,
        upgradeUrl: `${this.getFrontBaseUrl()}/plans?upsell=quota`,
      }),
    );
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string) {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    if (!endpointSecret?.trim()) {
      return { error: new Error('STRIPE_WEBHOOK_SECRET not configured') };
    }

    if (!signature) {
      return { error: new Error('stripe-signature header missing') };
    }

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
              relations: ['user'],
            });

            if (payment) {
              payment.mode = interval ?? null;
              payment.billingCycle = urbanCycle;
              payment.listingsContratados = Math.max(1, urbanQuantity);
              if (planName) payment.planName = planName;
              payment.expireDate = cycleEnd;
              payment.subscriptionId = subscriptionId;
              payment.startDate = startCycle;

              payment.status = this.subscriptionStatusToPaymentStatus(status, payment.status);

              await this.paymentRepository.save(payment);
              await this.sendBillingEmail(
                payment,
                'Urban AI - Assinatura ativada',
                EmailTemplates.getSubscriptionActiveTemplate({
                  nome: payment.user?.username || payment.user?.email || 'Usuario',
                  planName: planName || payment.planName || 'Urban AI',
                  billingCycle: urbanCycle as BillingCycle,
                  listingsContratados: Math.max(1, urbanQuantity),
                  totalAmountCents: this.resolveSubscriptionAmountCents(item, urbanQuantity, session.amount_total),
                  nextBillingDate: cycleEnd.toISOString().slice(0, 10),
                  invoiceUrl: this.resolveHostedInvoiceUrl(session.invoice),
                  dashboardUrl: `${this.getFrontBaseUrl()}/dashboard`,
                }),
              );
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
            payment.status = this.subscriptionStatusToPaymentStatus(subscription.status, payment.status);

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
            relations: ['user'],
          });

          if (payment) {
            payment.status = 'canceled';
            await this.paymentRepository.save(payment);
            const accessEndsAt = payment.expireDate instanceof Date
              ? payment.expireDate.toISOString().slice(0, 10)
              : new Date().toISOString().slice(0, 10);
            await this.sendBillingEmail(
              payment,
              'Urban AI - Cancelamento confirmado',
              EmailTemplates.getSubscriptionCancelledTemplate({
                nome: payment.user?.username || payment.user?.email || 'Usuario',
                accessEndsAt,
                reactivateUrl: `${this.getFrontBaseUrl()}/plans?reactivate=1`,
              }),
            );
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
            relations: ['user'],
          });

          if (payment) {
            payment.status = 'past_due';
            await this.paymentRepository.save(payment);
            await this.sendBillingEmail(
              payment,
              'Urban AI - Falha no pagamento',
              EmailTemplates.getPaymentFailedTemplate({
                nome: payment.user?.username || payment.user?.email || 'Usuario',
                amountCents: invoice.amount_due || 0,
                nextRetryDate: invoice.next_payment_attempt
                  ? new Date(invoice.next_payment_attempt * 1000).toISOString().slice(0, 10)
                  : 'em breve',
                updatePaymentUrl: `${this.getFrontBaseUrl()}/plans?billing=payment_failed`,
              }),
            );
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

  private resolveSubscriptionAmountCents(
    item: Stripe.SubscriptionItem | undefined,
    quantity: number,
    sessionAmountTotal?: number | null,
  ): number {
    if (Number.isFinite(sessionAmountTotal)) return sessionAmountTotal as number;
    const unitAmount = item?.price?.unit_amount ?? item?.plan?.amount ?? 0;
    return Math.max(0, unitAmount * Math.max(1, quantity));
  }

  private resolveHostedInvoiceUrl(invoice: unknown): string | undefined {
    if (!invoice || typeof invoice !== 'object') return undefined;
    const hostedInvoiceUrl = (invoice as { hosted_invoice_url?: string | null }).hosted_invoice_url;
    return hostedInvoiceUrl || undefined;
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
