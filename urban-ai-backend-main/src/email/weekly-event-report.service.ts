import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { AnalisePreco } from 'src/entities/AnalisePreco';
import { Address } from 'src/entities/addresses.entity';
import { User } from 'src/entities/user.entity';
import { MailerService } from 'src/mailer/mailer.service';
import { PushNotificationService } from 'src/push/push-notification.service';
import { Between, In, Repository } from 'typeorm';
import { EmailTemplates } from './templates';
import { CommunicationPreferencesService } from 'src/communication-preferences/communication-preferences.service';

type WeeklyEventReportProperty = {
  title: string;
  totalEvents: number;
  events: WeeklyEventReportEvent[];
};

type WeeklyEventReportEvent = {
  name: string;
  dateLabel: string;
  location: string;
  relevance: number | null;
  currentPrice: number | null;
  suggestedPrice: number | null;
  liftPercent: number | null;
  recommendation: string | null;
};

export type WeeklyEventReportSummary = {
  ok: true;
  users: number;
  sent: number;
  skipped: number;
  failed: number;
  lookaheadDays: number;
  failures: { userId: string; reason: string }[];
};

@Injectable()
export class WeeklyEventReportService {
  private readonly logger = new Logger(WeeklyEventReportService.name);
  private readonly frontUrl = (
    process.env.FRONT_URL ||
    process.env.FRONT_BASE_URL ||
    'https://app.myurbanai.com'
  ).replace(/\/$/, '');

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,
    @InjectRepository(AnalisePreco)
    private readonly analisePrecoRepo: Repository<AnalisePreco>,
    private readonly mailer: MailerService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly communicationPreferences: CommunicationPreferencesService,
  ) { }

  @Cron('0 30 8 * * 1', { name: 'weekly-event-report', timeZone: 'America/Sao_Paulo' })
  async runWeeklyCron(): Promise<WeeklyEventReportSummary> {
    if (process.env.WEEKLY_EVENT_REPORT_ENABLED === 'false') {
      this.logger.log('[weekly-event-report] skipped by env');
      return this.emptySummary();
    }

    this.logger.log('[weekly-event-report] cron started');
    const summary = await this.processWeeklyReports();
    this.logger.log(`[weekly-event-report] cron finished: ${JSON.stringify(summary)}`);
    return summary;
  }

  async processWeeklyReports(now = new Date()): Promise<WeeklyEventReportSummary> {
    const lookaheadDays = this.resolveLookaheadDays();
    const end = new Date(now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000);
    const users = await this.userRepo.find({
      where: { ativo: true },
    });

    const summary: WeeklyEventReportSummary = {
      ok: true,
      users: users.length,
      sent: 0,
      skipped: 0,
      failed: 0,
      lookaheadDays,
      failures: [],
    };

    for (const user of users) {
      try {
        if (!user.email) {
          summary.skipped += 1;
          continue;
        }
        const preferences = await this.communicationPreferences.getForUser(user.id);
        if (!preferences.weeklyReport) {
          summary.skipped += 1;
          continue;
        }

        const properties = await this.buildReportForUser(user, now, end);
        if (!properties.length) {
          summary.skipped += 1;
          continue;
        }

        const html = EmailTemplates.getWeeklyEventReportTemplate({
          nome: user.username || 'Usuario',
          windowDays: lookaheadDays,
          dashboardUrl: `${this.frontUrl}/painel`,
          properties,
        });

        const result = await this.mailer.sendHtmlEmail(
          { email: user.email, name: user.username || undefined },
          'Radar semanal de eventos - Urban AI',
          html,
        );

        if (!result?.enviado) {
          throw new Error(result?.message || `Email provider rejected with status=${result?.status ?? 'unknown'}`);
        }

        await this.pushNotificationService.sendToUser(user.id, {
          title: 'Radar semanal de eventos',
          body: this.buildPushSummary(properties, lookaheadDays),
          url: '/painel?source=pwa_push_weekly_report',
          tag: `weekly-event-report-${now.toISOString().slice(0, 10)}`,
          data: {
            type: 'weekly_event_report',
            lookaheadDays,
            properties: properties.length,
          },
        });

        summary.sent += 1;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        summary.failed += 1;
        summary.failures.push({ userId: user.id, reason });
        this.logger.warn(`[weekly-event-report] failed user=${user.id}: ${reason}`);
      }
    }

    return summary;
  }

  private async buildReportForUser(
    user: User,
    start: Date,
    end: Date,
  ): Promise<WeeklyEventReportProperty[]> {
    const addresses = await this.addressRepo.find({
      where: {
        user: { id: user.id },
        ativo: true,
      },
      relations: ['list', 'user'],
    });
    const usableAddresses = addresses.filter((address) => address.list?.id);
    if (!usableAddresses.length) return [];

    const analyses = await this.analisePrecoRepo.find({
      where: {
        usuarioProprietario: { id: user.id },
        endereco: { id: In(usableAddresses.map((address) => address.id)) },
        evento: {
          dataInicio: Between(start, end),
          ativo: true,
          pendingGeocode: false,
          outOfScope: false,
        },
      },
      relations: ['endereco', 'endereco.list', 'evento'],
      order: {
        criadoEm: 'DESC',
      },
    });

    const latestByPropertyEvent = new Map<string, AnalisePreco>();
    for (const analysis of analyses) {
      const propertyId = analysis.endereco?.id;
      const eventId = analysis.evento?.id;
      if (!propertyId || !eventId) continue;
      const key = `${propertyId}:${eventId}`;
      if (!latestByPropertyEvent.has(key)) latestByPropertyEvent.set(key, analysis);
    }

    return usableAddresses
      .map((address) => {
        const propertyAnalyses = Array.from(latestByPropertyEvent.values())
          .filter((analysis) => analysis.endereco?.id === address.id)
          .sort((left, right) => this.compareAnalysesForReport(left, right));

        if (!propertyAnalyses.length) return null;

        return {
          title: address.list?.titulo || address.getEnderecoCompleto?.() || 'Imovel',
          totalEvents: propertyAnalyses.length,
          events: propertyAnalyses
            .slice(0, this.resolveEventsPerProperty())
            .map((analysis) => this.toReportEvent(analysis)),
        };
      })
      .filter((property): property is WeeklyEventReportProperty => Boolean(property));
  }

  private compareAnalysesForReport(left: AnalisePreco, right: AnalisePreco): number {
    const leftRelevance = Number(left.evento?.relevancia ?? 0);
    const rightRelevance = Number(right.evento?.relevancia ?? 0);
    if (rightRelevance !== leftRelevance) return rightRelevance - leftRelevance;

    const leftAttendance = Number(left.evento?.expectedAttendance ?? left.evento?.capacidadeEstimada ?? 0);
    const rightAttendance = Number(right.evento?.expectedAttendance ?? right.evento?.capacidadeEstimada ?? 0);
    if (rightAttendance !== leftAttendance) return rightAttendance - leftAttendance;

    return new Date(left.evento?.dataInicio ?? 0).getTime() - new Date(right.evento?.dataInicio ?? 0).getTime();
  }

  private toReportEvent(analysis: AnalisePreco): WeeklyEventReportEvent {
    const event = analysis.evento;
    return {
      name: event?.nome || 'Evento',
      dateLabel: this.formatEventDate(event?.dataInicio),
      location: [event?.cidade, event?.estado].filter(Boolean).join(' - '),
      relevance: this.nullableNumber(event?.relevancia),
      currentPrice: this.nullableNumber(analysis.seuPrecoAtual),
      suggestedPrice: this.nullableNumber(analysis.precoSugerido),
      liftPercent: this.nullableNumber(analysis.diferencaPercentual),
      recommendation: analysis.recomendacao || null,
    };
  }

  private formatEventDate(value: Date | string | null | undefined): string {
    if (!value) return 'data a confirmar';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'data a confirmar';
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    }).format(date);
  }

  private buildPushSummary(properties: WeeklyEventReportProperty[], lookaheadDays: number): string {
    const totalEvents = properties.reduce((sum, property) => sum + property.totalEvents, 0);
    const propertyLabel = properties.length === 1 ? '1 imovel' : `${properties.length} imoveis`;
    const eventLabel = totalEvents === 1 ? '1 evento relevante' : `${totalEvents} eventos relevantes`;
    return `${eventLabel} para ${propertyLabel} nos proximos ${lookaheadDays} dias.`;
  }

  private nullableNumber(value: unknown): number | null {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private resolveLookaheadDays(): number {
    const parsed = Number(process.env.WEEKLY_EVENT_REPORT_LOOKAHEAD_DAYS);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 180) : 30;
  }

  private resolveEventsPerProperty(): number {
    const parsed = Number(process.env.WEEKLY_EVENT_REPORT_EVENTS_PER_PROPERTY);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 10) : 5;
  }

  private emptySummary(): WeeklyEventReportSummary {
    return {
      ok: true,
      users: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      lookaheadDays: this.resolveLookaheadDays(),
      failures: [],
    };
  }
}
