import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { User } from 'src/entities/user.entity';
import { Address } from 'src/entities/addresses.entity';
import { AnalisePreco } from 'src/entities/AnalisePreco';
import { Payment } from 'src/entities/payment.entity';
import { MailerService } from 'src/mailer/mailer.service';
import { EmailTemplates } from './templates';

/**
 * OnboardingDripService — fecha o gap H9 do roadmap.
 *
 * Templates D1/D3/D7 ja existem em `email/templates.ts`. Este service:
 *  1. Roda diariamente as 10:00 (cron `0 10 * * *`).
 *  2. Para cada dia D ∈ {1, 3, 7}: pega usuarios criados ha exatamente D dias
 *     (janela [start_of_day(now-D), start_of_day(now-D+1)]).
 *  3. Verifica `onboardingDripLastDay` para idempotencia — nao re-envia
 *     se ja mandou esse dia.
 *  4. Calcula contexto (numero de imoveis, recomendacoes, assinatura ativa)
 *     e dispara o template apropriado via MailerService.
 *  5. Atualiza `onboardingDripLastDay` + `onboardingDripLastSentAt`.
 *
 * Falha em um usuario nao bloqueia os outros (best-effort).
 *
 * Pode ser disparado manualmente via endpoint admin para testes:
 *   POST /admin/onboarding-drip/run-now
 */
@Injectable()
export class OnboardingDripService {
  private readonly logger = new Logger(OnboardingDripService.name);
  private readonly frontUrl: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,
    @InjectRepository(AnalisePreco)
    private readonly analisePrecoRepo: Repository<AnalisePreco>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly mailer: MailerService,
  ) {
    this.frontUrl = (process.env.FRONT_URL || 'https://app.myurbanai.com').replace(/\/$/, '');
  }

  /**
   * Cron diario as 10:00 UTC. E-mail transacional tende a entregar melhor entre 9-11h
   * locais; UTC-3 (Brasil) coloca o disparo em ~7:00 BRT — chega na caixa
   * antes do anfitriao abrir o e-mail no inicio do dia.
   */
  @Cron('0 10 * * *')
  async runDailyDrip(): Promise<void> {
    this.logger.log('[onboarding-drip] cron started');
    const summary = await this.processAll();
    this.logger.log(
      `[onboarding-drip] cron finished: ${JSON.stringify(summary)}`,
    );
  }

  /**
   * Roda os 3 dias (D+1, D+3, D+7) em sequencia.
   * Retorna contadores agregados para logs/observability.
   */
  async processAll(): Promise<{
    d1: { eligible: number; sent: number; failed: number };
    d3: { eligible: number; sent: number; failed: number };
    d7: { eligible: number; sent: number; failed: number };
  }> {
    return {
      d1: await this.processDay(1),
      d3: await this.processDay(3),
      d7: await this.processDay(7),
    };
  }

  /**
   * Janela do dia D: usuarios criados entre meia-noite de (hoje - D dias) e
   * meia-noite de (hoje - D + 1 dias). Exemplo: rodando em 17/05 10:00 com D=1,
   * pega usuarios criados entre 16/05 00:00:00 e 17/05 00:00:00.
   */
  async processDay(targetDay: 1 | 3 | 7): Promise<{
    eligible: number;
    sent: number;
    failed: number;
    skipped: number;
  }> {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const windowEnd = new Date(startOfToday);
    windowEnd.setDate(windowEnd.getDate() - (targetDay - 1));

    const windowStart = new Date(windowEnd);
    windowStart.setDate(windowStart.getDate() - 1);

    const users = await this.userRepo.find({
      where: {
        createdAt: Between(windowStart, windowEnd),
        ativo: true,
      },
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const user of users) {
      // Idempotencia: nao re-envia se ja enviou esse dia (ou um dia maior)
      if (
        user.onboardingDripLastDay != null &&
        user.onboardingDripLastDay >= targetDay
      ) {
        skipped++;
        continue;
      }

      try {
        await this.sendForUser(user, targetDay);
        user.onboardingDripLastDay = targetDay;
        user.onboardingDripLastSentAt = new Date();
        await this.userRepo.save(user);
        sent++;
        this.logger.log(
          `[onboarding-drip] D+${targetDay} sent userId=${user.id} email=${this.maskEmail(user.email)}`,
        );
      } catch (err) {
        failed++;
        this.logger.warn(
          `[onboarding-drip] D+${targetDay} failed userId=${user.id} err=${(err as Error)?.message}`,
        );
      }
    }

    return { eligible: users.length, sent, failed, skipped };
  }

  private async sendForUser(user: User, day: 1 | 3 | 7): Promise<void> {
    const ctx = await this.gatherContext(user.id);

    let subject = '';
    let html = '';

    if (day === 1) {
      subject = ctx.propertiesCount === 0
        ? '👋 Bem-vindo! Cadastre seu primeiro imóvel'
        : 'Bem-vindo à Urban AI — o motor já está rodando';
      html = EmailTemplates.getOnboardingDay1Template({
        nome: user.username,
        propertiesCount: ctx.propertiesCount,
        dashboardUrl: `${this.frontUrl}/painel`,
        propertiesUrl: `${this.frontUrl}/properties`,
      });
    } else if (day === 3) {
      subject = ctx.recommendationsCount > 0
        ? `Você tem ${ctx.recommendationsCount} recomendaç${ctx.recommendationsCount === 1 ? 'ão' : 'ões'} de preço`
        : 'Atualização sobre suas recomendações';
      html = EmailTemplates.getOnboardingDay3Template({
        nome: user.username,
        recommendationsCount: ctx.recommendationsCount,
        dashboardUrl: `${this.frontUrl}/painel`,
        staysUrl: `${this.frontUrl}/settings/integrations`,
      });
    } else {
      subject = ctx.hasActiveSubscription
        ? 'Uma semana com a Urban AI — extraia o máximo'
        : 'Uma semana com a Urban AI — escolha seu plano';
      html = EmailTemplates.getOnboardingDay7Template({
        nome: user.username,
        hasActiveSubscription: ctx.hasActiveSubscription,
        plansUrl: `${this.frontUrl}/plans`,
        dashboardUrl: `${this.frontUrl}/painel`,
        suggestedAppliedCount: ctx.appliedRecommendationsCount,
      });
    }

    const result = await this.mailer.sendHtmlEmail(
      { email: user.email, name: user.username },
      subject,
      html,
    );

    if (!result?.enviado) {
      throw new Error(`Transactional email provider rejected email with status=${result?.status ?? 'unknown'}`);
    }
  }

  private async gatherContext(userId: string): Promise<{
    propertiesCount: number;
    recommendationsCount: number;
    appliedRecommendationsCount: number;
    hasActiveSubscription: boolean;
  }> {
    const [propertiesCount, recommendationsCount, appliedRecommendationsCount, activePayment] =
      await Promise.all([
        this.addressRepo
          .createQueryBuilder('a')
          .where('a.user_id = :userId', { userId })
          .getCount(),
        this.countFutureRecommendations(userId),
        this.countAppliedRecommendations(userId),
        this.paymentRepo
          .createQueryBuilder('p')
          .where('p.user_id = :userId', { userId })
          .andWhere('p.status = :status', { status: 'active' })
          .getOne(),
      ]);

    return {
      propertiesCount,
      recommendationsCount,
      appliedRecommendationsCount,
      hasActiveSubscription: !!activePayment,
    };
  }

  private async countFutureRecommendations(userId: string): Promise<number> {
    return this.analisePrecoRepo
      .createQueryBuilder('ap')
      .innerJoin('ap.evento', 'ev')
      .innerJoin('ap.usuarioProprietario', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('ev.dataInicio >= :now', { now: new Date() })
      .getCount();
  }

  private async countAppliedRecommendations(userId: string): Promise<number> {
    return this.analisePrecoRepo
      .createQueryBuilder('ap')
      .innerJoin('ap.usuarioProprietario', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('ap.precoAplicado IS NOT NULL')
      .getCount();
  }

  private maskEmail(email: string): string {
    const [user, domain] = email.split('@');
    if (!user || !domain) return '***';
    const head = user.slice(0, 2);
    return `${head}***@${domain}`;
  }
}
