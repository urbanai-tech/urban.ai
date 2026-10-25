import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bull';
import { In, Repository } from 'typeorm';
import { hasUsableBasePrice } from '../pricing/base-price.util';
import { Address } from '../entities/addresses.entity';
import { Notification } from '../entities/notification.entity';
import { Payment } from '../entities/payment.entity';
import { User } from '../entities/user.entity';
import { MailerService } from '../mailer/mailer.service';
import { ScheduledJobRunnerService, runScheduledJob } from '../admin-job-runs/scheduled-job-runner.service';
import { EntitlementService } from './entitlement.service';

export interface QuotaReconcileResult {
  userId: string;
  skipped?: 'no_billing_history' | 'not_found';
  allowed: number | null;
  active: number;
  paused: string[];
  reactivated: string[];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

/**
 * Downgrade / fim de assinatura: mantém o número de imóveis PROCESSADOS dentro do
 * que o plano cobre.
 *
 *  - Acima da cota: pausa os imóveis adicionados mais recentemente (`ativo=false` +
 *    `quota_paused_at`), de modo que crons e análises (que só leem `ativo=true`)
 *    deixam de processá-los. Nunca apaga nada.
 *  - Cota voltou a subir (upgrade, nova assinatura, pagamento regularizado):
 *    reativa os pausados por cota, do mais antigo para o mais novo.
 *  - Sem direito de uso nenhum (assinatura encerrada/vencida): cota efetiva 0, todos
 *    pausados — mas só para quem já teve cobrança (quem nunca pagou não é tocado:
 *    nada o processa de qualquer forma e ele ainda está no onboarding).
 *  - Desativação feita pelo usuário (ativo=false SEM quota_paused_at) é respeitada.
 *
 * Idempotente: reexecutar sem mudança de cota não altera nada nem notifica de novo.
 */
@Injectable()
export class SubscriptionQuotaService {
  private readonly logger = new Logger(SubscriptionQuotaService.name);

  constructor(
    private readonly entitlement: EntitlementService,
    @InjectRepository(Address) private readonly addressRepo: Repository<Address>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Notification) private readonly notificationRepo: Repository<Notification>,
    @Optional() private readonly mailer?: MailerService,
    @Optional() private readonly scheduledJobRunner?: ScheduledJobRunnerService,
    @Optional() @InjectQueue('processos') private readonly processQueue?: Queue,
  ) {}

  async reconcileUser(
    userId: string,
    opts: { kickoffPendingAnalyses?: boolean } = {},
  ): Promise<QuotaReconcileResult> {
    this.entitlement.invalidate(userId);
    const decision = await this.entitlement.getEntitlement(userId, { fresh: true });
    const base: QuotaReconcileResult = {
      userId,
      allowed: decision.quota,
      active: 0,
      paused: [],
      reactivated: [],
    };

    if (!decision.hasBillingHistory && decision.source !== 'alpha_env' && decision.source !== 'admin') {
      return { ...base, skipped: 'no_billing_history' };
    }

    const addresses = await this.addressRepo.find({
      where: { user: { id: userId } },
      order: { created_at: 'ASC' },
    });

    const isPaused = (a: Address) => a.quotaPausedAt != null;
    const active = addresses.filter((a) => a.ativo !== false && !isPaused(a));
    const pausedByQuota = addresses.filter(isPaused);

    // admin => sem limite; sem direito => 0; senão a cota do plano.
    const allowed = decision.source === 'admin' ? Number.POSITIVE_INFINITY : decision.entitled ? (decision.quota ?? 0) : 0;
    base.allowed = Number.isFinite(allowed) ? allowed : null;
    base.active = active.length;

    if (active.length > allowed) {
      // mantém os mais antigos; pausa os adicionados por último
      const excess = [...active]
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime() || b.id.localeCompare(a.id))
        .slice(0, active.length - allowed);
      const ids = excess.map((a) => a.id);
      await this.addressRepo.update({ id: In(ids) }, { ativo: false, quotaPausedAt: new Date() });
      base.paused = ids;
      base.active = active.length - ids.length;
      await this.notifyPaused(userId, excess, decision.entitled ? (decision.quota ?? 0) : 0, decision.entitled);
    } else if (active.length < allowed && pausedByQuota.length > 0) {
      const room = allowed - active.length;
      const toReactivate = [...pausedByQuota]
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id))
        .slice(0, room);
      const ids = toReactivate.map((a) => a.id);
      await this.addressRepo.update({ id: In(ids) }, { ativo: true, quotaPausedAt: null });
      base.reactivated = ids;
      base.active = active.length + ids.length;
      await this.notifyReactivated(userId, ids.length);
    }

    if (opts.kickoffPendingAnalyses && decision.entitled && decision.source !== 'admin') {
      await this.kickoffPendingAnalyses(userId);
    }

    return base;
  }

  /**
   * Imóveis cadastrados no onboarding ANTES de pagar ficam com a análise pendente
   * (POST /processos devolve 402 sem plano). Quando o plano é ativado, enfileira
   * essas análises — mesmo job id do POST /processos, então não duplica.
   */
  async kickoffPendingAnalyses(userId: string): Promise<number> {
    if (!this.processQueue) return 0;
    try {
      const pending = await this.addressRepo.find({
        where: { user: { id: userId }, ativo: true, analisado: 'pending' },
      });
      let queued = 0;
      for (const address of pending) {
        const listId = address.list?.id;
        if (!listId || !hasUsableBasePrice(address.list)) continue;
        const jobId = `processo-${userId}-${listId}`;
        const existing = await this.processQueue.getJob(jobId);
        if (existing) {
          const state = await existing.getState();
          if (['waiting', 'active', 'delayed', 'paused'].includes(state)) continue;
          await existing.remove();
        }
        await this.processQueue.add(
          { userId, propertyAdressId: listId },
          { jobId, removeOnComplete: true, removeOnFail: false },
        );
        queued += 1;
      }
      return queued;
    } catch (error) {
      this.logger.warn(
        `Falha ao enfileirar análises pendentes user=${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }

  /** Reconcilia todos os usuários com histórico de cobrança ou com imóveis pausados. */
  async reconcileAll(): Promise<{ users: number; paused: number; reactivated: number; failed: number }> {
    const withBilling = await this.paymentRepo
      .createQueryBuilder('payment')
      .select('DISTINCT payment.user_id', 'userId')
      .where('payment.user_id IS NOT NULL')
      .getRawMany<{ userId: string }>();
    const withPaused = await this.addressRepo
      .createQueryBuilder('address')
      .select('DISTINCT address.user_id', 'userId')
      .where('address.quota_paused_at IS NOT NULL')
      .getRawMany<{ userId: string }>();

    const userIds = [...new Set([...withBilling, ...withPaused].map((row) => row.userId).filter(Boolean))];
    const summary = { users: userIds.length, paused: 0, reactivated: 0, failed: 0 };

    for (const userId of userIds) {
      try {
        const result = await this.reconcileUser(userId);
        summary.paused += result.paused.length;
        summary.reactivated += result.reactivated.length;
      } catch (error) {
        summary.failed += 1;
        this.logger.warn(
          `Falha ao reconciliar cota do user=${userId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return summary;
  }

  @Cron('15 3 * * *', {
    name: 'subscription-quota-reconcile',
    timeZone: 'America/Sao_Paulo',
    waitForCompletion: true,
  })
  async reconcileCron() {
    return runScheduledJob(this.scheduledJobRunner, 'subscription-quota-reconcile', async () => {
      const summary = await this.reconcileAll();
      this.logger.log(`[subscription-quota-reconcile] ${JSON.stringify(summary)}`);
      return summary;
    });
  }

  private frontUrl(): string {
    return (process.env.FRONT_BASE_URL || 'https://app.myurbanai.com').replace(/\/$/, '');
  }

  private async notifyPaused(userId: string, paused: Address[], quota: number, stillSubscribed: boolean) {
    const count = paused.length;
    const plural = count === 1 ? 'imóvel foi pausado' : 'imóveis foram pausados';
    const title = stillSubscribed ? 'Imóveis pausados pelo seu plano' : 'Seus imóveis foram pausados';
    const description = stillSubscribed
      ? `${count} ${plural} porque seu plano cobre ${quota} imóvel(is). Nada foi apagado: ` +
        'amplie o plano para reativá-los automaticamente.'
      : `Sua assinatura não está ativa, então ${count} ${plural}. Nada foi apagado: ` +
        'ao reativar o plano, eles voltam a ser analisados.';

    try {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      await this.notificationRepo.save(
        this.notificationRepo.create({
          title,
          description,
          titleButton: 'Ver planos',
          redirectTo: '/plans?upsell=quota',
          sent: true,
          opened: false,
          sendEmail: false,
          user: { id: userId } as User,
        }),
      );

      if (this.mailer && user?.email) {
        const html =
          `<p>Olá, ${escapeHtml(user.username || 'anfitrião')}.</p>` +
          `<p>${escapeHtml(description)}</p>` +
          `<p><a href="${escapeHtml(this.frontUrl())}/plans?upsell=quota">Ver planos</a></p>`;
        const result = await this.mailer.sendHtmlEmail(
          { email: user.email, name: user.username || user.email },
          `Urban AI - ${title}`,
          html,
        );
        if (!result?.enviado) {
          this.logger.warn(`E-mail de pausa por cota não enviado user=${userId}: ${result?.message || result?.status}`);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Falha ao notificar pausa por cota user=${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async notifyReactivated(userId: string, count: number) {
    try {
      await this.notificationRepo.save(
        this.notificationRepo.create({
          title: 'Imóveis reativados',
          description: `${count} imóvel(is) pausado(s) voltaram a ser analisados com o seu plano atual.`,
          titleButton: 'Ver imóveis',
          redirectTo: '/properties',
          sent: true,
          opened: false,
          sendEmail: false,
          user: { id: userId } as User,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Falha ao notificar reativação user=${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

