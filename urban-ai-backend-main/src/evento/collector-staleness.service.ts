import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import * as Sentry from '@sentry/nestjs';
import { Event } from '../entities/events.entity';
import { ScheduledJobRunnerService, runScheduledJob } from '../admin-job-runs/scheduled-job-runner.service';

const STALE_HOURS = 24;

/**
 * OBS-1 — alerta de staleness de coletor.
 *
 * O `/health` já expõe a frescura dos crons; aqui fechamos o lado de eventos:
 * para cada `source` que já produziu eventos, se o último evento tem mais de
 * 24h, captura um alerta no Sentry. Assim um coletor que parou (spider quebrada,
 * chave expirada) não fica invisível até alguém abrir o admin.
 *
 * Roda diariamente 07:00 BRT.
 */
@Injectable()
export class CollectorStalenessService {
  private readonly logger = new Logger(CollectorStalenessService.name);

  constructor(
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @Optional() private readonly scheduledJobRunner?: ScheduledJobRunnerService,
  ) {}

  @Cron('0 7 * * *', {
    name: 'collector-staleness',
    timeZone: 'America/Sao_Paulo',
    waitForCompletion: true,
  })
  async check(): Promise<{ checked: number; stale: string[] }> {
    return runScheduledJob(this.scheduledJobRunner, 'collector-staleness', () => this.checkOnce());
  }

  private async checkOnce(): Promise<{ checked: number; stale: string[] }> {
    let rows: Array<{ source: string | null; lastAt: Date | string | null }>;
    try {
      rows = await this.eventRepo
        .createQueryBuilder('e')
        .select('e.source', 'source')
        .addSelect('MAX(e.createdAt)', 'lastAt')
        .where('e.source IS NOT NULL')
        .groupBy('e.source')
        .getRawMany();
    } catch (error: any) {
      this.logger.warn(`Staleness check falhou: ${error?.message}`);
      return { checked: 0, stale: [] };
    }

    const now = Date.now();
    const stale: string[] = [];
    for (const r of rows) {
      if (!r.source) continue;
      const t = r.lastAt ? new Date(r.lastAt).getTime() : NaN;
      if (!Number.isFinite(t)) continue;
      const hoursAgo = (now - t) / 3_600_000;
      if (hoursAgo > STALE_HOURS) {
        stale.push(`${r.source} (${Math.round(hoursAgo)}h)`);
      }
    }

    if (stale.length > 0) {
      this.logger.warn(`Coletores sem eventos novos > ${STALE_HOURS}h: ${stale.join(', ')}`);
      Sentry.captureMessage('Coletores de eventos parados', {
        level: 'warning',
        tags: { component: 'collector-staleness' },
        extra: { stale, thresholdHours: STALE_HOURS },
      });
    } else {
      this.logger.log(`Staleness OK — ${rows.length} fontes, nenhuma parada > ${STALE_HOURS}h.`);
    }

    return { checked: rows.length, stale };
  }
}
