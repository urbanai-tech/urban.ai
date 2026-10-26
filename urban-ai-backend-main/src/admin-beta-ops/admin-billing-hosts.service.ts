import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Address } from '../entities/addresses.entity';
import { Payment } from '../entities/payment.entity';
import { User } from '../entities/user.entity';
import { EmailTemplates } from '../email/templates';
import { MailerService } from '../mailer/mailer.service';
import { PaymentsService } from '../payments/payments.service';
import {
  BillingHostPaymentInput,
  BillingHostRow,
  BillingHostStatus,
  BillingHostsSummary,
  latestPayment,
  mapBillingHostRow,
  maskEmail,
  sortBillingHostRows,
  summarizeBillingHosts,
} from './billing-hosts';

export type BillingLinkKind = 'auto' | 'portal' | 'checkout';

export type BillingHostsListResult = {
  generatedAt: string;
  summary: BillingHostsSummary;
  hosts: BillingHostRow[];
  /** true quando a lista foi cortada em `limit`. */
  truncated: boolean;
};

export type SendBillingLinkResult = {
  ok: true;
  kind: 'portal' | 'checkout';
  /** Para o checkout: se foi o trial ou um plano pago. */
  checkoutPlan: string | null;
  sentTo: string;
};

const MAX_HOSTS = 500;

/**
 * Cobrança assistida do beta: lista os anfitriões com o estado da assinatura e reenvia, por
 * e-mail, o link de checkout/portal que o sistema já gera (PaymentsService). Nenhum produto
 * ou preço novo no Stripe. O link NUNCA volta na resposta HTTP nem vai para o log de auditoria:
 * ele é uma credencial de curta duração e só segue para o e-mail do próprio anfitrião.
 */
@Injectable()
export class AdminBillingHostsService {
  private readonly logger = new Logger(AdminBillingHostsService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Address) private readonly addressRepo: Repository<Address>,
    private readonly payments: PaymentsService,
    private readonly mailer: MailerService,
  ) {}

  async list(
    filters: { status?: BillingHostStatus | 'attention' | 'all'; search?: string } = {},
    now = new Date(),
  ): Promise<BillingHostsListResult> {
    const users = await this.userRepo.find({
      where: { role: 'host' },
      select: ['id', 'username', 'email', 'role', 'ativo', 'createdAt'],
      order: { createdAt: 'DESC' },
      take: MAX_HOSTS + 1,
    });
    const truncated = users.length > MAX_HOSTS;
    const hostUsers = users.slice(0, MAX_HOSTS);

    const ids = hostUsers.map((user) => user.id);
    const payments = ids.length
      ? await this.paymentRepo.find({ where: { user: { id: In(ids) } }, relations: ['user'] })
      : [];
    const byUser = new Map<string, BillingHostPaymentInput[]>();
    for (const payment of payments) {
      const owner = payment.user?.id;
      if (!owner) continue;
      const list = byUser.get(owner) ?? [];
      list.push(payment);
      byUser.set(owner, list);
    }

    const alphaQuotasRaw = process.env.ALPHA_USER_QUOTAS;
    let rows = hostUsers.map((user) => mapBillingHostRow(user, byUser.get(user.id) ?? [], { now, alphaQuotasRaw }));
    // O resumo olha para a lista inteira; o filtro só afeta as linhas devolvidas.
    const summary = summarizeBillingHosts(rows);

    const search = filters.search?.trim().toLowerCase();
    if (search) {
      rows = rows.filter((row) => row.email.toLowerCase().includes(search) || row.name.toLowerCase().includes(search));
    }
    if (filters.status === 'attention') rows = rows.filter((row) => row.needsAttention);
    else if (filters.status && filters.status !== 'all') rows = rows.filter((row) => row.status === filters.status);

    return { generatedAt: now.toISOString(), summary, hosts: sortBillingHostRows(rows), truncated };
  }

  async sendLink(userId: string, requested: BillingLinkKind = 'auto', now = new Date()): Promise<SendBillingLinkResult> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || user.role !== 'host') throw new NotFoundException('Anfitrião não encontrado.');
    if (!user.email) throw new BadRequestException('O anfitrião não tem e-mail cadastrado.');
    if (user.ativo === false) throw new BadRequestException('A conta do anfitrião está desativada.');

    const userPayments = await this.paymentRepo.find({ where: { user: { id: user.id } } });
    const row = mapBillingHostRow(user, userPayments, { now, alphaQuotasRaw: process.env.ALPHA_USER_QUOTAS });
    if (row.status === 'alpha') {
      throw new BadRequestException('Este anfitrião tem acesso alpha: não há cobrança para reenviar.');
    }

    const kind: 'portal' | 'checkout' = requested === 'auto' ? row.suggestedLink : requested;
    if (kind === 'portal' && !row.hasStripeCustomer) {
      throw new BadRequestException('Este anfitrião ainda não tem cadastro no Stripe: use o link de checkout.');
    }

    let url: string | null;
    let checkoutPlan: string | null = null;
    try {
      if (kind === 'portal') {
        url = (await this.payments.createBillingPortalSession(user.id)).url;
      } else {
        const latest = latestPayment(userPayments);
        const usedTrial = userPayments.some((payment) => Boolean((payment as Payment).trialUsedAt));
        const hadPaidPlan = Boolean(latest?.planName) && latest?.planName !== 'trial';
        checkoutPlan = !usedTrial && !hadPaidPlan ? 'trial' : latest?.planName && latest.planName !== 'trial' ? latest.planName : 'auto';
        const quantity = latest?.listingsContratados ?? (await this.countActiveProperties(user.id));
        const session = await this.payments.createCheckoutSession(
          {
            plan: checkoutPlan,
            billingCycle: (latest?.billingCycle as any) || 'monthly',
            quantity: Math.max(1, Number(quantity) || 1),
          },
          user.id,
        );
        url = session.url ?? null;
      }
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[billing-link] falha ao gerar link user=${user.id} kind=${kind}: ${message}`);
      throw new ServiceUnavailableException(`Não foi possível gerar o link no Stripe: ${message}`);
    }

    if (!url) throw new ServiceUnavailableException('O Stripe não devolveu um link.');

    const html = EmailTemplates.getBillingLinkTemplate({ nome: user.username || 'Usuário', kind, url });
    const result = await this.mailer.sendHtmlEmail(
      { email: user.email, name: user.username || undefined },
      kind === 'portal' ? 'Gerencie a sua assinatura - Urban AI' : 'Conclua a sua assinatura - Urban AI',
      html,
    );
    if (!result?.enviado) {
      throw new ServiceUnavailableException(
        `O e-mail não foi enviado: ${result?.message || `status ${result?.status ?? 'desconhecido'}`}`,
      );
    }

    return { ok: true, kind, checkoutPlan, sentTo: maskEmail(user.email) };
  }

  private async countActiveProperties(userId: string): Promise<number> {
    try {
      return await this.addressRepo.count({ where: { user: { id: userId }, ativo: true } });
    } catch {
      return 1;
    }
  }
}
