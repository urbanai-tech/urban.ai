import { ConflictException, Injectable, Logger, Optional, ServiceUnavailableException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, Not, Repository } from 'typeorm';
import { ScheduledJobRunnerService, runScheduledJob, runScheduledJobOncePerWindow } from '../admin-job-runs/scheduled-job-runner.service';
import { addDaysToDateKey, saoPauloDayBounds, toSaoPauloDateKey, tryToSaoPauloDateKey } from '../common/sp-date';
import { CommunicationPreferencesService } from '../communication-preferences/communication-preferences.service';
import { AnalisePreco } from '../entities/AnalisePreco';
import { OwnerReportLink } from '../entities/owner-report-link.entity';
import { OwnerReport } from '../entities/owner-report.entity';
import { PropertyOwnerProperty } from '../entities/property-owner-property.entity';
import { PropertyOwner } from '../entities/property-owner.entity';
import { User } from '../entities/user.entity';
import { isOutcomePending } from '../email/weekly-host-report';
import { EmailTemplates } from '../email/templates';
import { MailerService } from '../mailer/mailer.service';
import { EntitlementService } from '../subscription/entitlement.service';
import { OwnerReportPayload, summarizeForEmail } from './owner-report.builder';
import {
  OWNER_NOTICE_TEXT,
  OWNER_REPORT_LINK_PURGE_GRACE_DAYS,
  OWNER_REPORT_RETENTION_MONTHS_DEFAULT,
} from './owner-report.constants';
import { PropertyOwnersService } from './property-owners.service';
import { OwnerReportsService, ownerFrontUrl, ownerReportFeatureEnabled } from './owner-reports.service';
import { signOwnerToken } from './owner-report-token';
import {
  businessDayIndexInMonth,
  currentPeriodKey,
  isValidPeriodKey,
  lastDayOfMonthKey,
  parseSkipDates,
  periodBounds,
  previousPeriodKey,
  shiftPeriodKey,
} from './report-period';

/** Tentativas automáticas por proprietário/mês antes de desistir (a manual do anfitrião ignora o teto). */
export const OWNER_REPORT_MAX_AUTO_ATTEMPTS = 3;
/** Linha em "sending" há mais que isto é de um processo que morreu: volta a ser tentável. */
export const OWNER_REPORT_STALE_SENDING_MS = 30 * 60 * 1000;

export type OwnerDeliveryOutcome = 'sent' | 'already_sent' | 'failed' | 'skipped' | 'not_claimed';

export type OwnerReportDailySummary = {
  ok: true;
  date: string;
  purged: { reports: number; links: number } | null;
  send: { period: string; owners: number; sent: number; skipped: number; failed: number } | null;
  reminder: { hosts: number; sent: number; skipped: number; failed: number } | null;
};

/** Envio de e-mail a terceiros: desligado por padrão, exige ligar explicitamente (ADR 0027). */
export function ownerReportEmailEnabled(): boolean {
  return process.env.OWNER_REPORT_EMAIL_ENABLED === 'true';
}

export function ownerReportReminderEnabled(): boolean {
  return process.env.OWNER_REPORT_REMINDER_ENABLED !== 'false';
}

export function resolveRetentionMonths(): number {
  const parsed = Number(process.env.OWNER_REPORT_RETENTION_MONTHS);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.min(Math.floor(parsed), 60) : OWNER_REPORT_RETENTION_MONTHS_DEFAULT;
}

/** Quantos dias úteis, a partir do primeiro, ainda tentam enviar/reenviar (padrão 3, de 1 a 10). */
export function resolveSendWindowBusinessDays(): number {
  const parsed = Number(process.env.OWNER_REPORT_SEND_WINDOW_BUSINESS_DAYS);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.min(Math.floor(parsed), 10) : 3;
}

@Injectable()
export class OwnerReportDeliveryService {
  private readonly logger = new Logger(OwnerReportDeliveryService.name);

  constructor(
    @InjectRepository(PropertyOwner) private readonly ownerRepo: Repository<PropertyOwner>,
    @InjectRepository(OwnerReport) private readonly reportRepo: Repository<OwnerReport>,
    @InjectRepository(OwnerReportLink) private readonly linkRepo: Repository<OwnerReportLink>,
    @InjectRepository(PropertyOwnerProperty) private readonly ownerPropertyRepo: Repository<PropertyOwnerProperty>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(AnalisePreco) private readonly analiseRepo: Repository<AnalisePreco>,
    private readonly reports: OwnerReportsService,
    private readonly owners: PropertyOwnersService,
    private readonly mailer: MailerService,
    private readonly preferences: CommunicationPreferencesService,
    private readonly entitlement: EntitlementService,
    @Optional() private readonly scheduledJobRunner?: ScheduledJobRunnerService,
  ) {}

  /**
   * Job diário (09:00 SP). Faz, nesta ordem e cada fase isolada das outras:
   *  1. retenção (relatórios, links vencidos/revogados);
   *  2. envio do mês anterior nos primeiros dias úteis (o ledger `owner_reports` garante um e-mail
   *     por proprietário/mês; os dias seguintes só reenviam o que falhou);
   *  3. lembrete ao anfitrião, 2 dias antes do fim do mês, uma vez por janela.
   */
  @Cron('0 0 9 * * *', {
    name: 'owner-report-monthly',
    timeZone: 'America/Sao_Paulo',
    waitForCompletion: true,
  })
  async runDailyCron(): Promise<OwnerReportDailySummary> {
    if (!ownerReportFeatureEnabled()) {
      this.logger.log('[owner-report-monthly] skipped by env');
      return this.emptySummary(new Date());
    }
    const now = new Date();
    const summary = await runScheduledJob(this.scheduledJobRunner, 'owner-report-monthly', () => this.processDaily(now));
    return summary ?? this.emptySummary(now);
  }

  async processDaily(now = new Date()): Promise<OwnerReportDailySummary> {
    const todayKey = toSaoPauloDateKey(now);
    const summary = this.emptySummary(now);

    try {
      summary.purged = await this.purgeExpired(now);
    } catch (error) {
      this.logger.warn(`[owner-report-monthly] retenção falhou: ${(error as Error)?.message}`);
    }

    if (ownerReportEmailEnabled()) {
      const skipDates = parseSkipDates(process.env.OWNER_REPORT_SKIP_DATES);
      const businessIndex = businessDayIndexInMonth(todayKey, skipDates);
      if (businessIndex !== null && businessIndex <= resolveSendWindowBusinessDays()) {
        try {
          summary.send = await this.sendMonthlyReports(previousPeriodKey(now), now);
        } catch (error) {
          this.logger.warn(`[owner-report-monthly] envio falhou: ${(error as Error)?.message}`);
        }
      }
    }

    if (ownerReportReminderEnabled() && todayKey === this.reminderDayKey(todayKey)) {
      try {
        summary.reminder = await runScheduledJobOncePerWindow(
          this.scheduledJobRunner,
          'owner-report-reminder',
          saoPauloDayBounds(todayKey).start,
          () => this.sendMonthEndReminders(now),
          () => null,
        );
      } catch (error) {
        this.logger.warn(`[owner-report-monthly] lembrete falhou: ${(error as Error)?.message}`);
      }
    }
    return summary;
  }

  /** Dia do lembrete: 2 dias antes do último dia do mês. */
  reminderDayKey(dateKey: string): string {
    return addDaysToDateKey(lastDayOfMonthKey(dateKey), -2);
  }

  // ----------------------------------------------------------------- envio

  async sendMonthlyReports(periodKey: string, now = new Date()) {
    const summary = { period: periodKey, owners: 0, sent: 0, skipped: 0, failed: 0 };
    const candidates = await this.ownerRepo.find({
      where: { monthlyReportEnabled: true, unsubscribedAt: IsNull() },
      order: { createdAt: 'ASC' },
      take: 5000,
    });
    summary.owners = candidates.length;
    if (!candidates.length) return summary;

    const hostIds = Array.from(new Set(candidates.map((owner) => owner.userId)));
    const hosts = await this.userRepo.find({ where: { id: In(hostIds), ativo: true } });
    const entitled = await this.entitlement.filterEntitledUserIds(hosts.map((host) => host.id));
    const hostById = new Map(hosts.filter((host) => entitled.has(host.id)).map((host) => [host.id, host]));
    const hostWantsReports = new Map<string, boolean>();

    for (const owner of candidates) {
      const host = hostById.get(owner.userId);
      if (!host) {
        summary.skipped += 1;
        continue;
      }
      if (!hostWantsReports.has(host.id)) {
        const prefs = await this.preferences.getForUser(host.id);
        hostWantsReports.set(host.id, prefs.ownerReports !== false);
      }
      if (!hostWantsReports.get(host.id)) {
        summary.skipped += 1;
        continue;
      }
      try {
        const outcome = await this.deliver(owner, host, periodKey, now, { respectAttemptCap: true });
        if (outcome === 'sent') summary.sent += 1;
        else if (outcome === 'failed') summary.failed += 1;
        else summary.skipped += 1;
      } catch (error) {
        summary.failed += 1;
        this.logger.warn(`[owner-report] falha owner=${owner.id} period=${periodKey}: ${(error as Error)?.message}`);
      }
    }
    return summary;
  }

  /** Envio manual do anfitrião (botão "Enviar agora"): mesma trava de idempotência, sem o teto de tentativas. */
  async sendNowForHost(hostUserId: string, ownerId: string, period: string, now = new Date()) {
    if (!ownerReportFeatureEnabled() || !ownerReportEmailEnabled()) {
      throw new ServiceUnavailableException({
        code: 'OWNER_REPORT_EMAIL_DISABLED',
        message: 'O envio por e-mail ao proprietário ainda não está ativo neste ambiente. Copie o link e envie você mesmo.',
      });
    }
    if (!isValidPeriodKey(period) || period > currentPeriodKey(now)) {
      throw new ConflictException('Período inválido.');
    }
    const owner = await this.owners.findOwned(hostUserId, ownerId);
    if (owner.unsubscribedAt) {
      throw new ConflictException('Este proprietário pediu para não receber o relatório.');
    }
    const host = await this.userRepo.findOne({ where: { id: hostUserId } });
    if (!host) throw new ConflictException('Usuário não encontrado.');
    const outcome = await this.deliver(owner, host, period, now, { respectAttemptCap: false });
    return { status: outcome };
  }

  /**
   * Entrega um relatório. Idempotente: a linha `owner_reports` (único por proprietário+mês) só passa
   * de pending/failed para sending por UPDATE condicional; quem não consegue "pegar" a linha não envia.
   */
  async deliver(
    owner: PropertyOwner,
    host: User,
    periodKey: string,
    now: Date,
    options: { respectAttemptCap: boolean },
  ): Promise<OwnerDeliveryOutcome> {
    if (!owner.email || owner.unsubscribedAt) return 'skipped';

    const report = await this.reports.generate(owner, periodKey, now, { preserveSent: true });
    if (report.emailStatus === 'sent') return 'already_sent';
    const payload = JSON.parse(report.payloadJson) as OwnerReportPayload;
    if (!payload.summary.propertyCount) return 'skipped';

    const claimed = await this.claimDelivery(report, now, options.respectAttemptCap);
    if (!claimed) return 'not_claimed';

    let linkId: string | null = null;
    try {
      const apiBase = (process.env.API_URL || '').trim().replace(/\/$/, '');
      const unsubscribeToken = signOwnerToken('unsub', owner.unsubscribeRef);
      if (!apiBase || !unsubscribeToken) {
        throw new Error('descadastro indisponível (API_URL ou segredo de assinatura ausente)');
      }
      const { link, url } = await this.reports.createLink(report, 'email', undefined, now);
      linkId = link.id;
      const unsubscribeUrl = `${apiBase}/owner-reports/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
      const html = EmailTemplates.getOwnerMonthlyReportTemplate({
        ownerName: owner.name,
        preparedBy: host.username || null,
        periodLabel: periodBounds(periodKey).label,
        reportUrl: url,
        expiresLabel: this.formatDate(link.expiresAt),
        summaryLines: summarizeForEmail(payload),
        unsubscribeUrl,
        notice: OWNER_NOTICE_TEXT,
      });
      const result = await this.mailer.sendHtmlEmail(
        { email: owner.email, name: owner.name },
        `Relatório de ${periodBounds(periodKey).label} dos seus imóveis - My Urban`,
        html,
        {
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        },
      );
      if (!result?.enviado) {
        throw new Error(result?.message || `provedor recusou (status=${result?.status ?? 'desconhecido'})`);
      }
      await this.reportRepo.update(
        { id: report.id },
        { emailStatus: 'sent', emailSentAt: now, emailAttempts: (report.emailAttempts ?? 0) + 1, emailFailureReason: null },
      );
      return 'sent';
    } catch (error) {
      const reason = this.safeReason(error);
      // Link emitido e nunca entregue não pode ficar válido por aí.
      if (linkId) await this.linkRepo.update({ id: linkId }, { revokedAt: now });
      await this.reportRepo.update(
        { id: report.id },
        { emailStatus: 'failed', emailAttempts: (report.emailAttempts ?? 0) + 1, emailFailureReason: reason },
      );
      this.logger.warn(`[owner-report] envio falhou owner=${owner.id} period=${periodKey}: ${reason}`);
      return 'failed';
    }
  }

  /** pending/failed -> sending, de forma atômica. false = outro processo pegou, já enviado ou teto atingido. */
  async claimDelivery(report: OwnerReport, now: Date, respectAttemptCap: boolean): Promise<boolean> {
    // Processo que morreu no meio do envio deixa "sending" para sempre: devolve a linha ao jogo.
    await this.reportRepo.update(
      { id: report.id, emailStatus: 'sending', updatedAt: LessThan(new Date(now.getTime() - OWNER_REPORT_STALE_SENDING_MS)) },
      { emailStatus: 'failed' },
    );
    const where: Record<string, unknown> = { id: report.id, emailStatus: In(['pending', 'failed']) };
    if (respectAttemptCap) where.emailAttempts = LessThan(OWNER_REPORT_MAX_AUTO_ATTEMPTS);
    const result = await this.reportRepo.update(where as any, { emailStatus: 'sending' });
    return (result?.affected ?? 0) === 1;
  }

  // -------------------------------------------------------------- lembrete

  /**
   * Lembrete de fim de mês ao anfitrião: só quem tem proprietário com envio ligado E aplicações
   * do mês ainda sem resultado registrado. Sem pendência, não incomoda.
   */
  async sendMonthEndReminders(now = new Date()) {
    const summary = { hosts: 0, sent: 0, skipped: 0, failed: 0 };
    const owners = await this.ownerRepo.find({
      where: { monthlyReportEnabled: true, unsubscribedAt: IsNull() },
      take: 5000,
    });
    if (!owners.length) return summary;

    const hostIds = Array.from(new Set(owners.map((owner) => owner.userId)));
    summary.hosts = hostIds.length;
    const hosts = await this.userRepo.find({ where: { id: In(hostIds), ativo: true } });
    const entitled = await this.entitlement.filterEntitledUserIds(hosts.map((host) => host.id));
    const todayKey = toSaoPauloDateKey(now);
    const period = periodBounds(currentPeriodKey(now));

    for (const host of hosts.filter((candidate) => entitled.has(candidate.id))) {
      try {
        if (!host.email) {
          summary.skipped += 1;
          continue;
        }
        const prefs = await this.preferences.getForUser(host.id);
        if (prefs.ownerReports === false) {
          summary.skipped += 1;
          continue;
        }
        const hostOwners = owners.filter((owner) => owner.userId === host.id);
        const links = await this.ownerPropertyRepo.find({ where: { ownerId: In(hostOwners.map((owner) => owner.id)) } });
        const addressIds = Array.from(new Set(links.map((link) => link.addressId)));
        if (!addressIds.length) {
          summary.skipped += 1;
          continue;
        }
        const rows = await this.analiseRepo.find({
          where: {
            usuarioProprietario: { id: host.id },
            endereco: { id: In(addressIds) },
            aplicadoEm: Not(IsNull()),
            resultadoRegistradoEm: IsNull(),
          },
          relations: ['endereco', 'evento'],
          take: 1000,
        });
        const pending = rows.filter((row) => {
          const day = tryToSaoPauloDateKey(row.evento?.dataInicio ?? null);
          return day !== null && day >= period.startKey && day < period.endKeyExclusive && isOutcomePending(row as any, todayKey);
        }).length;
        if (!pending) {
          summary.skipped += 1;
          continue;
        }
        const front = ownerFrontUrl();
        const html = EmailTemplates.getOwnerReportReminderTemplate({
          nome: host.username || 'Usuário',
          pendingTotal: pending,
          ownerCount: hostOwners.length,
          resultsUrl: `${front}/painel`,
          ownersUrl: `${front}/proprietarios`,
          settingsUrl: `${front}/settings/communications?source=owner_report_reminder`,
        });
        const result = await this.mailer.sendHtmlEmail(
          { email: host.email, name: host.username || undefined },
          'Falta registrar resultados antes do relatório do proprietário - My Urban',
          html,
          { unsubscribe: { userId: host.id, category: 'owner_reports' } },
        );
        if (!result?.enviado) throw new Error(result?.message || `status=${result?.status ?? 'desconhecido'}`);
        summary.sent += 1;
      } catch (error) {
        summary.failed += 1;
        this.logger.warn(`[owner-report] lembrete falhou host=${host.id}: ${this.safeReason(error)}`);
      }
    }
    return summary;
  }

  // -------------------------------------------------------------- retenção

  /**
   * Retenção (ADR 0027): relatório some `OWNER_REPORT_RETENTION_MONTHS` (padrão 12) depois do fim do
   * mês reportado, levando os links junto (CASCADE); link vencido ou revogado some depois de 30 dias.
   */
  async purgeExpired(now = new Date()): Promise<{ reports: number; links: number }> {
    const cutoffPeriod = shiftPeriodKey(currentPeriodKey(now), -resolveRetentionMonths());
    const graceCutoff = new Date(now.getTime() - OWNER_REPORT_LINK_PURGE_GRACE_DAYS * 86_400_000);
    const expired = await this.linkRepo.delete({ expiresAt: LessThan(graceCutoff) });
    const revoked = await this.linkRepo.delete({ revokedAt: LessThan(graceCutoff) });
    const reports = await this.reportRepo.delete({ period: LessThan(cutoffPeriod) });
    return {
      reports: reports?.affected ?? 0,
      links: (expired?.affected ?? 0) + (revoked?.affected ?? 0),
    };
  }

  // -------------------------------------------------------------- helpers

  private emptySummary(now: Date): OwnerReportDailySummary {
    return { ok: true, date: toSaoPauloDateKey(now), purged: null, send: null, reminder: null };
  }

  private formatDate(value: Date | string): string {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(
      new Date(value),
    );
  }

  /** Motivo curto, sem e-mail nem dado pessoal (vai para a coluna e para o log). */
  private safeReason(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[e-mail]').slice(0, 240);
  }
}
