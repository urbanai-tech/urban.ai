import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import * as Sentry from '@sentry/nestjs';
import { Event } from '../entities/events.entity';
import { EventSource } from '../entities/event-source.entity';
import { MailerService } from '../mailer/mailer.service';
import { ScheduledJobRunnerService, runScheduledJob } from '../admin-job-runs/scheduled-job-runner.service';

/**
 * D2 — detecção de "sucesso silencioso" de fonte de eventos, do lado do BACKEND.
 *
 * Quando o HTML/API de um site muda, o spider/coletor termina OK com 0 itens e o
 * scheduler (Prefect ou cron interno) continua verde. O backend, porém, vê tudo
 * que chega: cada item ingerido atualiza `event_sources.lastSeenAt` (e
 * `events.dataCrawl`). Para cada `source`:
 *
 *   - baselineItems = itens vistos nos últimos BASELINE_DAYS (a fonte é "normalmente ativa");
 *   - recentItems   = itens vistos na janela recente (WINDOW_HOURS);
 *   - alerta quando baselineItems >= MIN_BASELINE_ITEMS e NADA foi visto na janela.
 *
 * Funciona independente do scheduler. Complementa o `CollectorStalenessService`
 * (que olha apenas eventos NOVOS, `createdAt`, e por isso não percebe uma fonte
 * que só reenvia eventos já conhecidos).
 *
 * Config (env, todas opcionais — defaults seguros; ver
 * docs/runbooks/coletores-zero-yield.md e matriz-env-operacional.md):
 *   COLLECTOR_ZERO_YIELD_ENABLED            default true
 *   COLLECTOR_ZERO_YIELD_WINDOW_HOURS       default 36   (coletores rodam a cada 6h; spiders 1x/dia)
 *   COLLECTOR_ZERO_YIELD_BASELINE_DAYS      default 14
 *   COLLECTOR_ZERO_YIELD_MIN_BASELINE_ITEMS default 5
 *   COLLECTOR_ZERO_YIELD_IGNORE_SOURCES     default "admin-*,marcha-para-jesus" (lista, sufixo * = prefixo)
 *   COLLECTOR_ZERO_YIELD_SOURCE_WINDOWS     default ""   ("fonte:horas,fonte:horas" — janela própria por fonte)
 *   COLLECTOR_ZERO_YIELD_REALERT_HOURS      default 24   (reenvio do mesmo alerta)
 */

export interface ZeroYieldConfig {
  enabled: boolean;
  windowHours: number;
  baselineDays: number;
  minBaselineItems: number;
  ignoreSources: string[];
  sourceWindowHours: Record<string, number>;
  realertHours: number;
}

export interface SourceActivity {
  source: string;
  /** Último momento em que a fonte enviou qualquer item (MAX lastSeenAt/dataCrawl). */
  lastSeenAt: Date | null;
  /** Itens vistos na janela recente padrão. */
  recentItems: number;
  /** Itens vistos na janela de baseline. */
  baselineItems: number;
}

export interface ZeroYieldFinding {
  source: string;
  windowHours: number;
  hoursSinceLastItem: number | null;
  baselineItems: number;
  recentItems: number;
  lastSeenAt: string | null;
}

const DEFAULT_IGNORE = 'admin-*,marcha-para-jesus';

function positiveNumber(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizeSourceName(source: string): string {
  return source.trim().replace(/_/g, '-').toLowerCase();
}

export function readZeroYieldConfig(env: NodeJS.ProcessEnv = process.env): ZeroYieldConfig {
  const list = (raw: string | undefined, fallback: string) =>
    (raw === undefined ? fallback : raw)
      .split(',')
      .map((s) => normalizeSourceName(s))
      .filter(Boolean);

  const sourceWindowHours: Record<string, number> = {};
  for (const pair of (env.COLLECTOR_ZERO_YIELD_SOURCE_WINDOWS ?? '').split(',')) {
    const [name, hours] = pair.split(':');
    const value = Number(hours);
    if (name?.trim() && Number.isFinite(value) && value > 0) {
      sourceWindowHours[normalizeSourceName(name)] = value;
    }
  }

  return {
    enabled: (env.COLLECTOR_ZERO_YIELD_ENABLED ?? 'true').trim().toLowerCase() !== 'false',
    windowHours: positiveNumber(env.COLLECTOR_ZERO_YIELD_WINDOW_HOURS, 36),
    baselineDays: positiveNumber(env.COLLECTOR_ZERO_YIELD_BASELINE_DAYS, 14),
    minBaselineItems: positiveNumber(env.COLLECTOR_ZERO_YIELD_MIN_BASELINE_ITEMS, 5),
    ignoreSources: list(env.COLLECTOR_ZERO_YIELD_IGNORE_SOURCES, DEFAULT_IGNORE),
    sourceWindowHours,
    realertHours: positiveNumber(env.COLLECTOR_ZERO_YIELD_REALERT_HOURS, 24),
  };
}

export function isIgnoredSource(source: string, ignoreSources: string[]): boolean {
  const name = normalizeSourceName(source);
  return ignoreSources.some((pattern) =>
    pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : name === pattern,
  );
}

/**
 * Lógica pura: dado o que cada fonte enviou, decide quais "normalmente ativas"
 * caíram a zero. Sem I/O, para ser testada isoladamente.
 */
export function evaluateZeroYield(
  activity: SourceActivity[],
  config: ZeroYieldConfig,
  now: Date = new Date(),
): ZeroYieldFinding[] {
  if (!config.enabled) return [];

  const findings: ZeroYieldFinding[] = [];
  for (const item of activity) {
    const source = normalizeSourceName(item.source);
    if (!source || isIgnoredSource(source, config.ignoreSources)) continue;
    if (item.baselineItems < config.minBaselineItems) continue; // nunca foi "normalmente ativa"

    const windowHours = config.sourceWindowHours[source] ?? config.windowHours;
    const lastSeenMs = item.lastSeenAt ? item.lastSeenAt.getTime() : NaN;
    const hoursSince = Number.isFinite(lastSeenMs) ? (now.getTime() - lastSeenMs) / 3_600_000 : null;
    const silent = hoursSince === null || hoursSince > windowHours;
    if (!silent) continue;

    findings.push({
      source,
      windowHours,
      hoursSinceLastItem: hoursSince === null ? null : Math.round(hoursSince * 10) / 10,
      baselineItems: item.baselineItems,
      recentItems: 0,
      lastSeenAt: item.lastSeenAt ? item.lastSeenAt.toISOString() : null,
    });
  }
  return findings.sort((a, b) => b.baselineItems - a.baselineItems || a.source.localeCompare(b.source));
}

@Injectable()
export class CollectorZeroYieldService {
  private readonly logger = new Logger(CollectorZeroYieldService.name);
  /** source -> último alerta enviado (evita repetir a cada execução do cron). */
  private readonly lastAlertAt = new Map<string, number>();

  constructor(
    @InjectRepository(EventSource) private readonly eventSourceRepo: Repository<EventSource>,
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @Optional() private readonly mailer?: MailerService,
    @Optional() private readonly scheduledJobRunner?: ScheduledJobRunnerService,
  ) {}

  @Cron('30 */6 * * *', {
    name: 'collector-zero-yield',
    timeZone: 'America/Sao_Paulo',
    waitForCompletion: true,
  })
  async check(): Promise<{ checked: number; alerts: ZeroYieldFinding[] }> {
    return runScheduledJob(this.scheduledJobRunner, 'collector-zero-yield', () => this.checkOnce());
  }

  /** Atividade por fonte (event_sources + events.dataCrawl como fallback legado). */
  async loadActivity(now: Date = new Date(), config = readZeroYieldConfig()): Promise<SourceActivity[]> {
    const recentStart = new Date(now.getTime() - config.windowHours * 3_600_000);
    const baselineStart = new Date(now.getTime() - config.baselineDays * 86_400_000);

    const merged = new Map<string, SourceActivity>();
    const mergeRows = (rows: Array<Record<string, unknown>>) => {
      for (const row of rows) {
        if (!row.source) continue;
        const name = normalizeSourceName(String(row.source));
        const lastSeen = row.lastSeenAt ? new Date(row.lastSeenAt as string | Date) : null;
        const current = merged.get(name) ?? { source: name, lastSeenAt: null, recentItems: 0, baselineItems: 0 };
        if (lastSeen && !Number.isNaN(lastSeen.getTime()) && (!current.lastSeenAt || lastSeen > current.lastSeenAt)) {
          current.lastSeenAt = lastSeen;
        }
        // Mesmo item aparece nas duas tabelas: usa o maior, não a soma.
        current.recentItems = Math.max(current.recentItems, Number(row.recentItems ?? 0));
        current.baselineItems = Math.max(current.baselineItems, Number(row.baselineItems ?? 0));
        merged.set(name, current);
      }
    };

    const sourcesRows = await this.eventSourceRepo
      .createQueryBuilder('s')
      .select('s.source', 'source')
      .addSelect('MAX(s.lastSeenAt)', 'lastSeenAt')
      .addSelect('SUM(CASE WHEN s.lastSeenAt >= :recentStart THEN 1 ELSE 0 END)', 'recentItems')
      .addSelect('COUNT(*)', 'baselineItems')
      .where('s.lastSeenAt >= :baselineStart', { baselineStart })
      .setParameter('recentStart', recentStart)
      .groupBy('s.source')
      .getRawMany();
    mergeRows(sourcesRows);

    const eventRows = await this.eventRepo
      .createQueryBuilder('e')
      .select('e.source', 'source')
      .addSelect('MAX(e.dataCrawl)', 'lastSeenAt')
      .addSelect('SUM(CASE WHEN e.dataCrawl >= :recentStart THEN 1 ELSE 0 END)', 'recentItems')
      .addSelect('COUNT(*)', 'baselineItems')
      .where('e.source IS NOT NULL')
      .andWhere('e.dataCrawl >= :baselineStart', { baselineStart })
      .setParameter('recentStart', recentStart)
      .groupBy('e.source')
      .getRawMany();
    mergeRows(eventRows);

    return [...merged.values()];
  }

  /** Para o painel admin: findings atuais (sem efeitos colaterais). */
  async currentFindings(now: Date = new Date()): Promise<{ config: ZeroYieldConfig; findings: ZeroYieldFinding[] }> {
    const config = readZeroYieldConfig();
    if (!config.enabled) return { config, findings: [] };
    const activity = await this.loadActivity(now, config);
    return { config, findings: evaluateZeroYield(activity, config, now) };
  }

  private async checkOnce(): Promise<{ checked: number; alerts: ZeroYieldFinding[] }> {
    const now = new Date();
    const config = readZeroYieldConfig();
    if (!config.enabled) {
      this.logger.log('Zero-yield desabilitado (COLLECTOR_ZERO_YIELD_ENABLED=false).');
      return { checked: 0, alerts: [] };
    }

    let activity: SourceActivity[];
    try {
      activity = await this.loadActivity(now, config);
    } catch (error: any) {
      this.logger.warn(`Zero-yield check falhou: ${error?.message}`);
      return { checked: 0, alerts: [] };
    }

    const findings = evaluateZeroYield(activity, config, now);
    const active = new Set(findings.map((f) => f.source));
    for (const source of [...this.lastAlertAt.keys()]) {
      if (!active.has(source)) this.lastAlertAt.delete(source); // voltou a enviar: rearma o alerta
    }

    const due = findings.filter((f) => {
      const last = this.lastAlertAt.get(f.source);
      return last === undefined || now.getTime() - last >= config.realertHours * 3_600_000;
    });

    if (due.length > 0) {
      this.logger.error(
        `Fontes de eventos normalmente ativas SEM nenhum item recente: ${due
          .map((f) => `${f.source} (${f.hoursSinceLastItem ?? '?'}h, baseline ${f.baselineItems})`)
          .join(', ')}`,
      );
      Sentry.captureMessage('Fonte de eventos sem dados (zero-yield)', {
        level: 'error',
        tags: { component: 'collector-zero-yield' },
        extra: { alerts: due, windowHours: config.windowHours, baselineDays: config.baselineDays },
      });
      await this.notifyAdmin(due);
      for (const f of due) this.lastAlertAt.set(f.source, now.getTime());
    } else {
      this.logger.log(`Zero-yield OK — ${activity.length} fontes, ${findings.length} em silêncio já alertadas.`);
    }

    return { checked: activity.length, alerts: findings };
  }

  private async notifyAdmin(findings: ZeroYieldFinding[]): Promise<void> {
    const to = process.env.ADMIN_ALERT_EMAIL?.trim() || process.env.OPS_ALERT_EMAIL?.trim();
    if (!to || !this.mailer) {
      this.logger.warn('ADMIN_ALERT_EMAIL/OPS_ALERT_EMAIL não configurado — alerta zero-yield só no Sentry/log.');
      return;
    }
    const lines = findings.map(
      (f) =>
        `- ${f.source}: nenhum item há ${f.hoursSinceLastItem ?? '?'}h (janela ${f.windowHours}h); ` +
        `baseline ${f.baselineItems} itens nos últimos dias; último visto ${f.lastSeenAt ?? 'nunca'}`,
    );
    const body = [
      'Fontes de eventos que normalmente enviam dados pararam de enviar (provável mudança no site/API de origem):',
      '',
      ...lines,
      '',
      'Veja /admin/collectors-health e docs/runbooks/coletores-zero-yield.md.',
    ].join('\n');
    try {
      const result = await this.mailer.sendTextEmailCron(
        { email: to, name: 'My Urban Admin' },
        `My Urban — fonte de eventos sem dados (${findings.map((f) => f.source).join(', ')})`.slice(0, 200),
        body,
      );
      if (!result.enviado) this.logger.warn(`E-mail zero-yield não enviado: ${result.message ?? result.status}`);
    } catch (error: any) {
      this.logger.warn(`Falha ao enviar e-mail zero-yield: ${error?.message}`);
    }
  }
}
