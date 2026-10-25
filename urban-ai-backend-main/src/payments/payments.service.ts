import { BadRequestException, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Payment } from 'src/entities/payment.entity';
import { User } from 'src/entities/user.entity';
import { Address } from 'src/entities/addresses.entity';
import Stripe from 'stripe';
import { In, IsNull, Repository } from 'typeorm';
import { SubscriptionQuotaService } from '../subscription/subscription-quota.service';
import { resolveAlphaQuota } from '../subscription/entitlement';
import { PlansService } from '../plans/plans.service';
import { BillingCycle } from '../entities/plan.entity';
import { isBillingCycle, resolveStripePriceId } from './stripe-price-id.resolver';
import { MailerService } from '../mailer/mailer.service';
import { EmailTemplates } from '../email/templates';

const LOCAL_ACCESS_STATUSES = ['active', 'trialing', 'alpha'];

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(
    @InjectRepository(Payment) private paymentRepository: Repository<Payment>,
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Address) private addressRepository: Repository<Address>,
    private plansService: PlansService,
    @Optional() private readonly mailerService?: MailerService,
    @Optional() private readonly quotaService?: SubscriptionQuotaService,
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
      const ativos = await this.countUnpausedAddresses(userId);

      return {
        contratados: alphaQuota,
        ativos,
        podeAdicionar: ativos < alphaQuota,
      };
    }

    const payment = await this.paymentRepository.findOne({
      where: {
        user: { id: userId },
        status: In(LOCAL_ACCESS_STATUSES),
      },
      order: { updatedAt: 'DESC' },
    });

    // `contratados` mínimo 1 é só o piso do onboarding (cadastrar o 1º imóvel antes
    // de pagar). NÃO libera uso do produto: o acesso pago é decidido pelo
    // SubscriptionGuard / EntitlementService (src/subscription).
    const contratados = Math.max(1, payment?.listingsContratados ?? 1);
    const ativos = await this.countUnpausedAddresses(userId);

    return {
      contratados,
      ativos,
      podeAdicionar: ativos < contratados,
    };
  }

  /** Imóveis que contam na cota: os pausados por cota (downgrade) ficam de fora. */
  private async countUnpausedAddresses(userId: string): Promise<number> {
    return this.addressRepository.count({
      where: { user: { id: userId }, quotaPausedAt: IsNull() },
    });
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
        status: In(LOCAL_ACCESS_STATUSES),
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
      return this.buildAlphaSubscription(userId, alphaQuota);
    }

    const alphaPayment = await this.paymentRepository.findOne({
      where: {
        user: { id: userId },
        status: In(LOCAL_ACCESS_STATUSES),
        planName: 'alpha',
      },
      order: { updatedAt: 'DESC' },
    });
    if (alphaPayment) {
      return this.buildAlphaSubscription(
        userId,
        Math.max(1, alphaPayment.listingsContratados ?? 1),
        alphaPayment.startDate,
        alphaPayment.expireDate,
      );
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

  private buildAlphaSubscription(
    userId: string,
    quota: number,
    startDate?: Date | null,
    expireDate?: Date | null,
  ) {
    return {
      id: `alpha-${userId}`,
      status: 'trialing',
      currency: 'brl',
      start_date: Math.floor((startDate?.getTime() ?? Date.now()) / 1000),
      trial_end: expireDate ? Math.floor(expireDate.getTime() / 1000) : null,
      metadata: {
        urbanai_plan: 'alpha',
        urbanai_quantity: String(quota),
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

  private async getAlphaQuota(userId: string): Promise<number | null> {
    const raw = process.env.ALPHA_USER_QUOTAS || '';
    if (!raw.trim()) return null;

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    // Mesma regra do EntitlementService (src/subscription/entitlement.ts).
    return resolveAlphaQuota(raw, userId, user?.email);
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
      plan?: string;
      billingCycle?: 'monthly' | 'quarterly' | 'semestral' | 'annual';
      quantity?: number;
    },
    userId: string,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new Error('Usuário não encontrado');

    // 1) Resolve customer Stripe (cria se não existir)
    // 2) Resolve plano + Price ID conforme ciclo
    const quantity = this.resolveCheckoutQuantity(data.quantity);
    const requestedPlan = String(data.plan ?? '').trim();
    const isTrialCheckout = requestedPlan === 'trial';
    // Trial desabilitado (variável ausente/inválida) falha antes de qualquer chamada ao Stripe.
    const trialPeriodDays = isTrialCheckout ? this.resolveTrialPeriodDays() : null;
    // Trial usa o plano profissional, mas obedece às mesmas faixas self-service
    // (min/max/maxCheckoutQuantity) do checkout pago.
    const planEntity = isTrialCheckout
      ? await this.resolveTrialPlan(quantity)
      : await this.resolveCheckoutPlan(requestedPlan, quantity);

    if (!planEntity) {
      throw new BadRequestException(
        `Não há faixa self-service configurada para ${quantity} imóveis.`,
      );
    }

    if (planEntity.isCustomPrice || planEntity.selfServiceEnabled === false) {
      throw new BadRequestException(
        `A faixa ${planEntity.title || planEntity.name} exige atendimento comercial.`,
      );
    }
    const billingCycle = this.resolveBillingCycle(data.billingCycle);
    const { priceId: stripePrice } = resolveStripePriceId(planEntity, billingCycle, planEntity.name);
    if (!stripePrice) {
      throw new ServiceUnavailableException(
        `Stripe Price ID not configured for plan=${planEntity.name} cycle=${billingCycle}`,
      );
    }
    this.ensureStripeConfigured();
    this.ensureCheckoutUrlsConfigured();

    // 3) Quantidade — número de imóveis contratados. Sempre ≥ 1.
    const customerId = await this.ensureStripeCustomer(user);

    if (isTrialCheckout) {
      await this.assertTrialEligible(user.id, customerId);
    }

    // Metadata viaja no webhook, permite reconstruir o ciclo + quantity
    // mesmo que o Stripe não exponha exatamente nossos 4 ciclos.
    const urbanaiMeta = {
      urbanai_plan: isTrialCheckout ? 'trial' : planEntity.name,
      urbanai_billing_cycle: billingCycle,
      urbanai_quantity: String(quantity),
    };

    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: urbanaiMeta,
      ...(isTrialCheckout && {
        trial_period_days: trialPeriodDays as number,
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

  /**
   * Dias de trial a partir de TRIAL_PERIOD_DAYS. Sem valor inteiro positivo
   * (<= 730, limite do Stripe) o trial fica desabilitado, em vez de enviar NaN.
   */
  private resolveTrialPeriodDays(): number {
    const raw = process.env.TRIAL_PERIOD_DAYS?.trim();
    const days = raw ? Number(raw) : NaN;
    if (!Number.isInteger(days) || days < 1 || days > 730) {
      throw new BadRequestException('O período de teste gratuito não está disponível no momento.');
    }
    return days;
  }

  private async resolveTrialPlan(quantity: number) {
    const plan = await this.plansService.getPlanByName('profissional');
    if (!plan) return null;
    if (plan.isCustomPrice || plan.selfServiceEnabled === false) {
      throw new BadRequestException('O teste gratuito não está disponível para este plano.');
    }
    const min = plan.minProperties ?? 1;
    const max = plan.maxProperties ?? plan.propertyLimit ?? null;
    const checkoutMax = plan.maxCheckoutQuantity ?? max ?? null;
    const inRange =
      quantity >= min &&
      (max === null || quantity <= max) &&
      (checkoutMax === null || quantity <= checkoutMax);
    if (!inRange) {
      throw new BadRequestException(
        `O teste gratuito não está disponível para ${quantity} imóveis.`,
      );
    }
    return plan;
  }

  /**
   * Rejeita o trial se o usuário já usou um (trialUsedAt local ou trial_start em
   * qualquer subscription do customer no Stripe) ou se já tem assinatura
   * vigente (evita assinaturas paralelas).
   */
  private async assertTrialEligible(userId: string, customerId: string): Promise<void> {
    const payments = (await this.paymentRepository.find({ where: { user: { id: userId } } })) ?? [];
    if (payments.some((p) => p.trialUsedAt)) {
      throw new BadRequestException('O teste gratuito já foi utilizado nesta conta.');
    }
    if (payments.some((p) => p.subscriptionId && ['active', 'trialing', 'past_due'].includes(p.status))) {
      throw new BadRequestException('Você já possui uma assinatura ativa.');
    }

    const subs = await this.stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
    const items = subs?.data ?? [];
    if (items.some((s) => s.trial_start || s.trial_end)) {
      throw new BadRequestException('O teste gratuito já foi utilizado nesta conta.');
    }
    if (items.some((s) => ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'].includes(s.status))) {
      throw new BadRequestException('Você já possui uma assinatura ativa.');
    }
  }

  async createBillingPortalSession(userId: string): Promise<{ url: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new Error('Usuário não encontrado');

    this.ensureStripeConfigured();

    const payment = await this.paymentRepository.findOne({
      where: { user: { id: userId } },
      order: { updatedAt: 'DESC' },
    });
    let customerId = payment?.customerId;

    if (!customerId) {
      const customers = await this.stripe.customers.list({
        email: user.email,
        limit: 1,
      });
      customerId = customers.data[0]?.id;
    }

    if (!customerId) {
      throw new Error('Cliente Stripe não encontrado');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: this.getBillingPortalReturnUrl(),
    });

    return { url: session.url };
  }

  private async resolveCheckoutPlan(requestedPlan: string, quantity: number) {
    const quantityPlan =
      typeof this.plansService.getSelfServicePlanForQuantity === 'function'
        ? await this.plansService.getSelfServicePlanForQuantity(quantity)
        : null;
    if (!requestedPlan || requestedPlan === 'auto') return quantityPlan;

    const explicitPlan = await this.plansService.getPlanByName(requestedPlan);
    if (!explicitPlan) return quantityPlan;

    if (explicitPlan.isCustomPrice || explicitPlan.selfServiceEnabled === false) {
      return quantityPlan ?? explicitPlan;
    }

    const min = explicitPlan.minProperties ?? 1;
    const max = explicitPlan.maxProperties ?? explicitPlan.propertyLimit ?? null;
    const checkoutMax = explicitPlan.maxCheckoutQuantity ?? max ?? null;
    const inRange =
      quantity >= min &&
      (max === null || quantity <= max) &&
      (checkoutMax === null || quantity <= checkoutMax);

    return inRange ? explicitPlan : quantityPlan;
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
      throw new BadRequestException('Escolha uma quantidade válida de imóveis para continuar.');
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
      throw new BadRequestException('Escolha um ciclo de cobrança válido para continuar.');
    }
    return cycle;
  }

  private isStripeConfigured(): boolean {
    return !!process.env.STRIPE_SECRET_KEY?.trim();
  }

  private ensureStripeConfigured() {
    if (!this.isStripeConfigured()) {
      throw new ServiceUnavailableException('Pagamento temporariamente indisponível. Tente novamente mais tarde.');
    }
  }

  private ensureCheckoutUrlsConfigured() {
    if (!process.env.SUCCESS_URL?.trim() || !process.env.CANCEL_URL?.trim()) {
      throw new ServiceUnavailableException('Não foi possível abrir o pagamento agora. Tente novamente mais tarde.');
    }
  }

  private normalizePaymentStatus(status: string | null | undefined): string {
    return status === 'peding' ? 'pending' : status || 'pending';
  }

  private resolveWebhookQuantity(...candidates: unknown[]): number {
    for (const candidate of candidates) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
    }
    return 1;
  }

  private resolveWebhookBillingCycle(
    candidates: unknown[],
    interval: string | undefined | null,
  ): BillingCycle {
    const configured = candidates.find((candidate) => isBillingCycle(candidate));
    return isBillingCycle(configured) ? configured : this.intervalToCycle(interval);
  }

  private isStaleStripeEvent(payment: Payment, event: Stripe.Event): boolean {
    const incomingCreated = Number(event.created);
    const lastCreated = Number(payment.lastStripeEventCreated);
    return (
      Number.isFinite(incomingCreated) &&
      Number.isFinite(lastCreated) &&
      incomingCreated < lastCreated
    );
  }

  /**
   * Duplicados (mesmo event.id) são sempre descartados. A regra de ordem
   * (evento mais antigo que o último aplicado) só vale para eventos cujo payload
   * é o próprio estado; eventos que releem a subscription no Stripe
   * (`enforceOrdering: false`) nunca são descartados por ordem.
   */
  private shouldApplyStripeEvent(
    payment: Payment,
    event: Stripe.Event,
    opts: { enforceOrdering?: boolean } = {},
  ): boolean {
    const recentIds = Array.isArray(payment.recentStripeEventIds)
      ? payment.recentStripeEventIds
      : [];
    if (event.id && recentIds.includes(event.id)) {
      console.log(`Stripe webhook duplicado ignorado: ${event.id}`);
      return false;
    }

    if (opts.enforceOrdering !== false && this.isStaleStripeEvent(payment, event)) {
      console.log(
        `Stripe webhook fora de ordem ignorado: ${event.id || event.type} ` +
          `(created=${Number(event.created)}, last=${Number(payment.lastStripeEventCreated)})`,
      );
      return false;
    }
    return true;
  }

  private rememberStripeEvent(payment: Payment, event: Stripe.Event): void {
    const incomingCreated = Number(event.created);
    const lastCreated = Number(payment.lastStripeEventCreated);
    if (Number.isFinite(incomingCreated)) {
      payment.lastStripeEventCreated = String(
        Number.isFinite(lastCreated) ? Math.max(lastCreated, incomingCreated) : incomingCreated,
      );
    }

    if (event.id) {
      const recentIds = Array.isArray(payment.recentStripeEventIds)
        ? payment.recentStripeEventIds.filter((id) => id !== event.id)
        : [];
      payment.recentStripeEventIds = [...recentIds, event.id].slice(-50);
    }
  }

  private async saveStripeProjection(payment: Payment, event: Stripe.Event): Promise<Payment> {
    this.rememberStripeEvent(payment, event);
    const saved = await this.paymentRepository.save(payment);
    await this.syncPropertyQuota(payment);
    return saved;
  }

  /**
   * Após qualquer mudança de estado da cobrança (quantidade menor no
   * subscription.updated, cancelamento, falha de pagamento, upgrade...), pausa
   * os imóveis acima da cota — ou reativa os pausados se a cota subiu. Uma falha
   * aqui NUNCA derruba o webhook (o cron diário subscription-quota-reconcile cobre).
   */
  private async syncPropertyQuota(payment: Payment): Promise<void> {
    if (!this.quotaService) return;
    try {
      let userId = payment?.user?.id;
      if (!userId && payment?.id) {
        const full = await this.paymentRepository.findOne({
          where: { id: payment.id },
          relations: ['user'],
        });
        userId = full?.user?.id;
      }
      if (userId) await this.quotaService.reconcileUser(userId, { kickoffPendingAnalyses: true });
    } catch (error: any) {
      console.warn(`Reconciliação de cota após webhook falhou: ${error?.message || error}`);
    }
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

  private getBillingPortalReturnUrl(): string {
    return (
      process.env.BILLING_PORTAL_RETURN_URL ||
      `${this.getFrontBaseUrl()}/my-plan`
    );
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
      const result = await this.mailerService.sendHtmlEmail(
        { email: user.email, name: user.username || user.email },
        subject,
        html,
      );
      if (!result?.enviado) {
        console.warn(
          `Billing email rejected for payment=${paymentId}: ${result?.message || result?.status || 'unknown'}`,
        );
      }
    } catch (error: any) {
      console.warn(`Billing email failed for payment=${paymentId}: ${error?.message || error}`);
    }
  }

  async sendQuotaWarningEmail(userId: string, contratados: number, ativos: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    await this.sendBillingEmailToUser(
      user,
      'Urban AI - Você está perto do limite de imóveis',
      EmailTemplates.getQuotaWarningTemplate({
        nome: user?.username || user?.email || 'Usuário',
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
      'Urban AI - Limite de imóveis atingido',
      EmailTemplates.getQuotaExceededTemplate({
        nome: user?.username || user?.email || 'Usuário',
        contratados,
        tentando,
        upgradeUrl: `${this.getFrontBaseUrl()}/plans?upsell=quota`,
      }),
    );
  }

  /**
   * Processa um webhook do Stripe.
   *
   * Contrato de status HTTP (ver PaymentsController.handleWebhook):
   * - assinatura ausente/inválida/segredo ausente -> `{ error }` -> 400;
   * - evento ignorado/desconhecido, duplicado ou sem Payment local -> 200;
   * - falha de processamento (DB, Stripe API) -> a exceção PROPAGA -> 500, para
   *   o Stripe reenviar o evento. Os handlers são idempotentes: o id do evento só
   *   é gravado junto com a projeção (saveStripeProjection) e o estado é sempre
   *   atribuído (nunca incrementado), então reprocessar é seguro.
   */
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
          // Estado vem da subscription atual no Stripe (não do payload do evento),
          // por isso este evento não é descartado por ordem: só por duplicidade.
          const subscription = (await this.stripe.subscriptions.retrieve(
            session.subscription,
          )) as Stripe.Subscription;
          const id = this.customerIdOf(subscription?.customer);
          const payment = await this.paymentRepository.findOne({
            where: { customerId: id },
            relations: ['user'],
          });

          if (payment) {
            if (!this.shouldApplyStripeEvent(payment, event, { enforceOrdering: false })) break;
            const projection = this.applySubscriptionState(payment, subscription, {
              session,
              isCheckout: true,
            });
            await this.saveStripeProjection(payment, event);
            const item = subscription.items?.data?.[0];
            await this.sendBillingEmail(
              payment,
              'Urban AI - Assinatura ativada',
              EmailTemplates.getSubscriptionActiveTemplate({
                nome: payment.user?.username || payment.user?.email || 'Usuário',
                planName: projection.planName || payment.planName || 'Urban AI',
                billingCycle: projection.billingCycle as BillingCycle,
                listingsContratados: Math.max(1, projection.quantity),
                totalAmountCents: this.resolveSubscriptionAmountCents(item, projection.quantity, session.amount_total),
                nextBillingDate: (payment.expireDate ?? new Date()).toISOString().slice(0, 10),
                invoiceUrl: this.resolveHostedInvoiceUrl(session.invoice),
                dashboardUrl: `${this.getFrontBaseUrl()}/dashboard`,
              }),
            );
            console.log(
              `✅ checkout.session.completed processado para customer ${id} ` +
                `(cycle=${projection.billingCycle}, qty=${projection.quantity})`,
            );
          } else {
            console.warn(`⚠️ Payment não encontrado para customer ${id}`);
          }
        } else {
          console.log('ℹ️ Subscription não disponível ou já populada');
        }
        break;
      }

      case 'invoice.paid': {
        // Renovações: estende expireDate a partir do fim do período vigente.
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = this.invoiceSubscriptionId(invoice);
        if (!subscriptionId) {
          console.log('ℹ️ invoice.paid sem subscription (cobrança avulsa) ignorado');
          break;
        }
        const id = this.customerIdOf(invoice.customer);
        const payment = await this.paymentRepository.findOne({
          where: { customerId: id },
        });
        if (!payment) {
          console.warn(`⚠️ Payment não encontrado para customer ${id}`);
          break;
        }
        if (!this.shouldApplyStripeEvent(payment, event, { enforceOrdering: false })) break;
        const subscription = (await this.stripe.subscriptions.retrieve(
          subscriptionId,
        )) as Stripe.Subscription;
        this.applySubscriptionState(payment, subscription, {});
        await this.saveStripeProjection(payment, event);
        console.log(
          `✅ invoice.paid processado para customer ${id} (expireDate=${payment.expireDate?.toISOString?.()})`,
        );
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('💰 PAYMENT_INTENT.SUCCEEDED');
        if (paymentIntent?.status === 'succeeded' && paymentIntent?.customer) {
          const id = this.customerIdOf(paymentIntent.customer);
          const payment = await this.paymentRepository.findOne({
            where: { customerId: id },
          });

          if (payment) {
            if (!this.shouldApplyStripeEvent(payment, event)) break;
            payment.status = 'active';
            await this.saveStripeProjection(payment, event);
            console.log(`✅ Payment ativado para customer ${id}`);
          } else {
            console.warn(`⚠️ Payment não encontrado para customer ${id}`);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        let subscription = event.data.object as Stripe.Subscription;
        const id = this.customerIdOf(subscription.customer);
        const payment = await this.paymentRepository.findOne({
          where: { customerId: id },
        });

        if (payment) {
          if (!this.shouldApplyStripeEvent(payment, event, { enforceOrdering: false })) break;
          if (this.isStaleStripeEvent(payment, event) && subscription.id) {
            // Evento antigo chegou depois de um mais novo: em vez de descartar (e
            // perder plano/quantidade/expireDate), reconstrói o estado atual.
            subscription = (await this.stripe.subscriptions.retrieve(
              subscription.id,
            )) as Stripe.Subscription;
          }
          this.applySubscriptionState(payment, subscription, {});
          await this.saveStripeProjection(payment, event);
          console.log(
            `✅ Subscription atualizada para customer ${id} -> status: ${subscription.status}, qty=${payment.listingsContratados}`,
          );
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const id = this.customerIdOf(subscription.customer);
        const payment = await this.paymentRepository.findOne({
          where: { customerId: id },
          relations: ['user'],
        });

        if (payment) {
          if (!this.shouldApplyStripeEvent(payment, event)) break;
          if (payment.subscriptionId && subscription.id && payment.subscriptionId !== subscription.id) {
            console.log(
              `Stripe subscription.deleted de assinatura antiga ignorado (${subscription.id} != ${payment.subscriptionId})`,
            );
            break;
          }
          payment.status = 'canceled';
          await this.saveStripeProjection(payment, event);
          const accessEndsAt = payment.expireDate instanceof Date
            ? payment.expireDate.toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10);
          await this.sendBillingEmail(
            payment,
            'Urban AI - Cancelamento confirmado',
            EmailTemplates.getSubscriptionCancelledTemplate({
              nome: payment.user?.username || payment.user?.email || 'Usuário',
              accessEndsAt,
              reactivateUrl: `${this.getFrontBaseUrl()}/plans?reactivate=1`,
            }),
          );
          console.log(`🚫 Subscription cancelada para customer ${id}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const id = this.customerIdOf(invoice.customer);
        const payment = await this.paymentRepository.findOne({
          where: { customerId: id },
          relations: ['user'],
        });

        if (payment) {
          if (!this.shouldApplyStripeEvent(payment, event)) break;
          payment.status = 'past_due';
          await this.saveStripeProjection(payment, event);
          await this.sendBillingEmail(
            payment,
            'Urban AI - Falha no pagamento',
            EmailTemplates.getPaymentFailedTemplate({
              nome: payment.user?.username || payment.user?.email || 'Usuário',
              amountCents: invoice.amount_due || 0,
              nextRetryDate: invoice.next_payment_attempt
                ? new Date(invoice.next_payment_attempt * 1000).toISOString().slice(0, 10)
                : 'em breve',
              updatePaymentUrl: `${this.getFrontBaseUrl()}/plans?billing=payment_failed`,
            }),
          );
          console.log(`⚠️ Pagamento falhou para customer ${id}`);
        }
        break;
      }

      default:
        console.log(`📬 Evento não tratado: ${event.type}`);
    }

    return { event };
  }

  private customerIdOf(customer: string | { id: string } | null | undefined): string {
    return typeof customer === 'string' ? customer : customer?.id;
  }

  /** Stripe basil moveu `invoice.subscription` para `invoice.parent.subscription_details.subscription`. */
  private invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
    const legacy = (invoice as any)?.subscription;
    const parent = (invoice as any)?.parent?.subscription_details?.subscription;
    const raw = legacy ?? parent;
    if (!raw) return null;
    return typeof raw === 'string' ? raw : raw.id ?? null;
  }

  /** Fim do período vigente (basil: no item; versões antigas: na subscription). */
  private resolveSubscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
    const sub = subscription as any;
    const item = sub?.items?.data?.[0];
    const candidates = [sub?.current_period_end, item?.current_period_end];
    if (sub?.status === 'trialing') candidates.push(sub?.trial_end);
    for (const candidate of candidates) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed) && parsed > 0) return new Date(parsed * 1000);
    }
    return null;
  }

  /**
   * Projeta o estado da subscription Stripe no Payment local. Sempre atribui
   * (nunca incrementa), logo é idempotente. Usado por checkout.session.completed,
   * invoice.paid e customer.subscription.updated.
   */
  private applySubscriptionState(
    payment: Payment,
    subscription: Stripe.Subscription,
    opts: { session?: Stripe.Checkout.Session; isCheckout?: boolean },
  ): { quantity: number; billingCycle: BillingCycle; planName: string | null } {
    const item = subscription.items?.data?.[0];
    const interval = item?.plan?.interval;
    const meta = (subscription.metadata || {}) as Record<string, string>;
    const sessionMeta = (opts.session?.metadata || {}) as Record<string, string>;

    payment.status = this.subscriptionStatusToPaymentStatus(subscription.status, payment.status);
    if (interval) payment.mode = interval;
    if (subscription.id) payment.subscriptionId = subscription.id;

    const quantity = this.resolveWebhookQuantity(
      meta.urbanai_quantity,
      sessionMeta.urbanai_quantity,
      item?.quantity,
      payment.listingsContratados,
    );
    payment.listingsContratados = Math.max(1, quantity);

    const metaCycle = [meta.urbanai_billing_cycle, sessionMeta.urbanai_billing_cycle].find((c) =>
      isBillingCycle(c),
    );
    if (isBillingCycle(metaCycle)) {
      payment.billingCycle = metaCycle;
    } else if (opts.isCheckout || (!payment.billingCycle && interval)) {
      payment.billingCycle = this.intervalToCycle(interval);
    }
    const billingCycle = (payment.billingCycle || 'monthly') as BillingCycle;

    const planName = meta.urbanai_plan || sessionMeta.urbanai_plan || null;
    if (planName) payment.planName = planName;

    const anchor = Number(subscription.billing_cycle_anchor);
    const startCycle = Number.isFinite(anchor) && anchor > 0 ? new Date(anchor * 1000) : null;
    if (startCycle && (opts.isCheckout || !payment.startDate)) payment.startDate = startCycle;

    const periodEnd = this.resolveSubscriptionPeriodEnd(subscription);
    if (periodEnd) {
      payment.expireDate = periodEnd;
    } else if (opts.isCheckout && startCycle) {
      // Fallback para payloads sem current_period_end: âncora + ciclo contratado.
      const cycleEnd = new Date(startCycle);
      switch (billingCycle) {
        case 'quarterly':
          cycleEnd.setMonth(cycleEnd.getMonth() + 3);
          break;
        case 'semestral':
          cycleEnd.setMonth(cycleEnd.getMonth() + 6);
          break;
        case 'annual':
          cycleEnd.setFullYear(cycleEnd.getFullYear() + 1);
          break;
        default:
          cycleEnd.setMonth(cycleEnd.getMonth() + 1);
      }
      payment.expireDate = cycleEnd;
    }

    if (!payment.trialUsedAt && (subscription.status === 'trialing' || subscription.trial_start || planName === 'trial')) {
      payment.trialUsedAt = new Date();
    }

    return { quantity: payment.listingsContratados, billingCycle, planName };
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
