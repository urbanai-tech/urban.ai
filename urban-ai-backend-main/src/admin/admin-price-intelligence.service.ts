import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, In } from 'typeorm';
import { Address } from '../entities/addresses.entity';
import { List } from '../entities/list.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import { PriceSnapshot } from '../entities/price-snapshot.entity';
import { AdminJobRun } from '../entities/admin-job-run.entity';
import { DatasetCollectorService } from '../knn-engine/dataset-collector.service';
import { countPt } from './admin-format.util';

/**
 * AdminPriceIntelligenceService — saúde do pipeline de inteligência de preço
 * (snapshots, observações, sugestões, jobs e schema) para `/admin/price-intelligence/health`.
 */
@Injectable()
export class AdminPriceIntelligenceService {
  constructor(
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,
    @InjectRepository(List) private readonly listRepo: Repository<List>,
    @InjectRepository(AnalisePreco)
    private readonly analiseRepo: Repository<AnalisePreco>,
    @InjectRepository(PriceSnapshot)
    private readonly snapshotRepo: Repository<PriceSnapshot>,
    @InjectRepository(AdminJobRun)
    private readonly jobRunRepo: Repository<AdminJobRun>,
    private readonly collector: DatasetCollectorService,
  ) {}

  async priceIntelligenceHealth(windowDays = 7) {
    const now = new Date();
    const safeWindowDays = Math.max(1, Math.min(30, Number(windowDays) || 7));
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const windowStart = new Date(now.getTime() - safeWindowDays * 24 * 60 * 60 * 1000);
    const jobNames = [
      'dataset-airbnb-price-observations',
      'dataset-daily-snapshot',
      'dataset-event-proximity-snapshot',
      'dataset-snapshot',
      'event-proximity-snapshot',
      'events-geocoder',
      'events-enrichment',
      'geocoder',
      'pricing-retrain',
      'stays-auto-apply',
      'alpha-pricing-reprocess',
    ];

    const [
      activeAirbnbListings,
      snapshotMetrics,
      observations,
      suggestionMetrics,
      recentJobs,
      failedJobsLast24h,
      avgJobDurationRow,
      lastSuccessJob,
      runningJobs,
      jobRunsInWindow,
      latestJobByName,
      collectorHealth,
      problematicProperties,
      verificationFailures,
      schemaHealth,
    ] = await Promise.all([
      this.listRepo
        .createQueryBuilder('l')
        .where('l.ativo = :active', { active: true })
        .andWhere("l.id_do_anuncio IS NOT NULL AND TRIM(l.id_do_anuncio) <> ''")
        .getCount(),
      this.priceSnapshotMetrics(oneDayAgo, sevenDaysAgo),
      this.priceObservationMetrics(oneDayAgo, sevenDaysAgo),
      this.priceSuggestionMetrics(oneDayAgo, sevenDaysAgo, now),
      this.jobRunRepo.find({
        where: { name: In(jobNames) },
        order: { startedAt: 'DESC' },
        take: 10,
      }),
      this.jobRunRepo.count({
        where: {
          name: In(jobNames),
          status: 'error',
          startedAt: MoreThanOrEqual(oneDayAgo),
        },
      }),
      this.jobRunRepo
        .createQueryBuilder('job')
        .select('AVG(job.durationMs)', 'avgDurationMs')
        .where('job.name IN (:...jobNames)', { jobNames })
        .andWhere('job.startedAt >= :since', { since: windowStart })
        .andWhere('job.durationMs IS NOT NULL')
        .getRawOne(),
      this.jobRunRepo.findOne({
        where: { name: In(jobNames), status: 'success' },
        order: { startedAt: 'DESC' },
      }),
      this.jobRunRepo.count({
        where: { name: In(jobNames), status: 'running' },
      }),
      this.jobRunRepo.find({
        where: { name: In(jobNames), startedAt: MoreThanOrEqual(windowStart) },
        order: { startedAt: 'DESC' },
        take: 200,
      }),
      Promise.all(
        jobNames.map(async (name) => ({
          name,
          lastRun: await this.jobRunRepo.findOne({
            where: { name },
            order: { startedAt: 'DESC' },
          }),
        })),
      ),
      this.collector.priceIntelligenceHealth(safeWindowDays * 24),
      this.priceIntelligenceProblematicProperties(),
      this.verificationFailuresByType(windowStart),
      this.priceIntelligenceSchemaHealth(),
    ]);

    const observationCoveragePercent =
      activeAirbnbListings > 0 ? Math.round((observations.distinctListingsLast7d / activeAirbnbListings) * 1000) / 10 : 0;
    const verifiedPercent =
      suggestionMetrics.accepted > 0 ? Math.round((suggestionMetrics.verified / suggestionMetrics.accepted) * 1000) / 10 : 0;

    const failuresByType = this.mergeFailureGroups(
      this.failuresFromJobRuns(recentJobs),
      verificationFailures,
      collectorHealth.failures.recent.map((failure) => ({
        type: failure.reason || 'airbnb_observation_failed',
        count: 1,
        lastSeenAt: collectorHealth.lastRun?.observedAt ?? now.toISOString(),
      })),
    );
    const jobMetricsByName = this.jobMetricsByName(
      jobNames,
      jobRunsInWindow,
      new Map(latestJobByName.map((item) => [item.name, item.lastRun])),
    );
    const recurrentFailures = failuresByType.filter((failure) => failure.count >= 2);
    const endpointGaps = this.priceIntelligenceEndpointGaps(schemaHealth);

    const alerts: Array<{
      severity: 'red' | 'amber' | 'info';
      message: string;
    }> = [];
    if (schemaHealth.missing.length > 0) {
      alerts.push({
        severity: 'red',
        message: `Schema incompleto para Price Intelligence: ${schemaHealth.missing
          .slice(0, 3)
          .join(', ')}. Rodar migrations pendentes antes de confiar no painel.`,
      });
    }
    if (schemaHealth.checkError) {
      alerts.push({
        severity: 'amber',
        message: `Não foi possível validar schema/migrations: ${schemaHealth.checkError}.`,
      });
    }
    if (observations.last24h === 0 && activeAirbnbListings > 0) {
      alerts.push({
        severity: 'red',
        message: 'Nenhuma diária real do Airbnb foi observada nas últimas 24h.',
      });
    }
    if (activeAirbnbListings > 0 && observationCoveragePercent < 70) {
      alerts.push({
        severity: observationCoveragePercent < 30 ? 'red' : 'amber',
        message: `Cobertura de observação abaixo do alvo: ${observationCoveragePercent}% dos imóveis ativos com Airbnb nos últimos 7 dias.`,
      });
    }
    if (suggestionMetrics.pendingVerification > 0) {
      alerts.push({
        severity: 'amber',
        message: `${countPt(
          suggestionMetrics.pendingVerification,
          'sugestão aceita aguardando verificação de aplicação',
          'sugestões aceitas aguardando verificação de aplicação',
        )}.`,
      });
    }
    if (suggestionMetrics.failedVerification > 0) {
      alerts.push({
        severity: 'amber',
        message: `${countPt(
          suggestionMetrics.failedVerification,
          'sugestão com verificação falha ou divergente',
          'sugestões com verificação falha ou divergente',
        )}.`,
      });
    }
    if (failedJobsLast24h > 0) {
      alerts.push({
        severity: 'red',
        message: `${countPt(failedJobsLast24h, 'job de Price Intelligence falhou', 'jobs de Price Intelligence falharam')} nas últimas 24h.`,
      });
    }
    for (const jobMetric of jobMetricsByName) {
      if (jobMetric.failures >= 2) {
        alerts.push({
          severity: 'red',
          message: `Falha recorrente no job ${jobMetric.name}: ${countPt(jobMetric.failures, 'erro', 'erros')} em ${countPt(
            safeWindowDays,
            'dia',
            'dias',
          )}. Ação: abrir histórico do job e corrigir a causa antes de reprocessar.`,
        });
      } else if (!jobMetric.lastRunAt) {
        alerts.push({
          severity: 'info',
          message: `Sem AdminJobRun para ${jobMetric.name}; confirmar se o cron/manual trigger está instrumentado.`,
        });
      }
    }
    if (recurrentFailures.length > 0) {
      alerts.push({
        severity: 'amber',
        message: `Falhas recorrentes agrupadas: ${recurrentFailures
          .slice(0, 3)
          .map((failure) => `${failure.type} (${failure.count})`)
          .join(', ')}.`,
      });
    }
    if (endpointGaps.length > 0) {
      alerts.push({
        severity: 'info',
        message: `${endpointGaps.length} lacuna(s) de contrato operacional ainda exposta(s) em endpointGaps.`,
      });
    }
    for (const warning of collectorHealth.warnings.slice(0, 3)) {
      alerts.push({ severity: 'info', message: warning });
    }

    const health: 'green' | 'amber' | 'red' = alerts.some((alert) => alert.severity === 'red')
      ? 'red'
      : alerts.some((alert) => alert.severity === 'amber')
        ? 'amber'
        : 'green';

    return {
      generatedAt: now.toISOString(),
      health,
      windowDays: safeWindowDays,
      alerts,
      snapshots: {
        total: snapshotMetrics.total,
        last24h: snapshotMetrics.last24h,
        last7d: snapshotMetrics.last7d,
        distinctListings: snapshotMetrics.distinctListings,
        trainingReady: snapshotMetrics.trainingReady,
        latestSnapshotAt: snapshotMetrics.latestSnapshotAt,
      },
      observations: {
        total: observations.total,
        last24h: observations.last24h,
        last7d: observations.last7d,
        distinctListings: observations.distinctListings,
        trainingReady: observations.trainingReady,
        coveragePercent: observationCoveragePercent,
        latestObservedAt: observations.latestObservedAt ?? collectorHealth.observations.latestObservedAt,
      },
      suggestions: {
        total: suggestionMetrics.total,
        last24h: suggestionMetrics.last24h,
        last7d: suggestionMetrics.last7d,
        future: suggestionMetrics.future,
        verified: suggestionMetrics.verified,
        verifiedPercent,
        accepted: suggestionMetrics.accepted,
        applied: suggestionMetrics.applied,
        pendingVerification: suggestionMetrics.pendingVerification,
        failedVerification: suggestionMetrics.failedVerification,
      },
      jobs: {
        running: runningJobs,
        queued: 0,
        queueAvailable: false,
        queueUnavailableReason:
          'Nenhuma fila persistente/BullMQ foi implementada para Price Intelligence; queued está sempre indisponível neste painel.',
        failedLast24h: failedJobsLast24h,
        avgDurationMs:
          avgJobDurationRow?.avgDurationMs === null || avgJobDurationRow?.avgDurationMs === undefined
            ? null
            : Math.round(Number(avgJobDurationRow.avgDurationMs)),
        lastRun: recentJobs[0] ?? null,
        lastSuccessAt: lastSuccessJob?.finishedAt.toISOString?.() ?? lastSuccessJob?.finishedAt ?? null,
        recent: recentJobs,
        byName: jobMetricsByName,
      },
      failuresByType,
      problematicProperties,
      schema: schemaHealth,
      shortcuts: [
        {
          label: 'Qualidade',
          href: '/admin/quality',
          description: 'MAPE, ocupação e ground truth.',
        },
        {
          label: 'Jobs do sistema',
          href: '/admin/jobs',
          description: 'Executar snapshots e recomputações.',
        },
        {
          label: 'Config. de preços',
          href: '/admin/pricing-config',
          description: 'Regras e parâmetros operacionais.',
        },
        {
          label: 'Radar de demanda',
          href: '/admin/event-radar',
          description: 'Eventos que alimentam sugestões.',
        },
      ],
      endpointGaps,
    };
  }

  private async priceSnapshotMetrics(oneDayAgo: Date, sevenDaysAgo: Date) {
    const row = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('COUNT(*)', 'total')
      .addSelect('SUM(CASE WHEN s.createdAt >= :oneDayAgo THEN 1 ELSE 0 END)', 'last24h')
      .addSelect('SUM(CASE WHEN s.createdAt >= :sevenDaysAgo THEN 1 ELSE 0 END)', 'last7d')
      .addSelect('COUNT(DISTINCT s.externalListingId)', 'distinctListings')
      .addSelect('SUM(CASE WHEN s.trainingReady = true THEN 1 ELSE 0 END)', 'trainingReady')
      .addSelect('MAX(s.createdAt)', 'latestSnapshotAt')
      .setParameters({ oneDayAgo, sevenDaysAgo })
      .getRawOne();

    return {
      total: Number(row?.total ?? 0),
      last24h: Number(row?.last24h ?? 0),
      last7d: Number(row?.last7d ?? 0),
      distinctListings: Number(row?.distinctListings ?? 0),
      trainingReady: Number(row?.trainingReady ?? 0),
      latestSnapshotAt: this.toIsoOrNull(row?.latestSnapshotAt),
    };
  }

  private async priceObservationMetrics(oneDayAgo: Date, sevenDaysAgo: Date) {
    const row = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('COUNT(*)', 'total')
      .addSelect('SUM(CASE WHEN s.observedAt >= :oneDayAgo THEN 1 ELSE 0 END)', 'last24h')
      .addSelect('SUM(CASE WHEN s.observedAt >= :sevenDaysAgo THEN 1 ELSE 0 END)', 'last7d')
      .addSelect(
        'COUNT(DISTINCT CASE WHEN s.observedAt >= :sevenDaysAgo THEN s.externalListingId ELSE NULL END)',
        'distinctListingsLast7d',
      )
      .addSelect('COUNT(DISTINCT s.externalListingId)', 'distinctListings')
      .addSelect('SUM(CASE WHEN s.trainingReady = true THEN 1 ELSE 0 END)', 'trainingReady')
      .addSelect('MAX(s.observedAt)', 'latestObservedAt')
      .where('s.origin = :origin', { origin: 'airbnb_observation' })
      .setParameters({ oneDayAgo, sevenDaysAgo })
      .getRawOne();

    return {
      total: Number(row?.total ?? 0),
      last24h: Number(row?.last24h ?? 0),
      last7d: Number(row?.last7d ?? 0),
      distinctListings: Number(row?.distinctListings ?? 0),
      distinctListingsLast7d: Number(row?.distinctListingsLast7d ?? 0),
      trainingReady: Number(row?.trainingReady ?? 0),
      latestObservedAt: this.toIsoOrNull(row?.latestObservedAt),
    };
  }

  private async priceSuggestionMetrics(oneDayAgo: Date, sevenDaysAgo: Date, now: Date) {
    const row = await this.analiseRepo
      .createQueryBuilder('a')
      .leftJoin('a.evento', 'evento')
      .select('COUNT(*)', 'total')
      .addSelect('SUM(CASE WHEN a.criadoEm >= :oneDayAgo THEN 1 ELSE 0 END)', 'last24h')
      .addSelect('SUM(CASE WHEN a.criadoEm >= :sevenDaysAgo THEN 1 ELSE 0 END)', 'last7d')
      .addSelect('SUM(CASE WHEN evento.dataInicio >= :now THEN 1 ELSE 0 END)', 'future')
      .addSelect('SUM(CASE WHEN a.aceito = true THEN 1 ELSE 0 END)', 'accepted')
      .addSelect('SUM(CASE WHEN a.precoAplicado IS NOT NULL THEN 1 ELSE 0 END)', 'applied')
      .addSelect("SUM(CASE WHEN a.verificationStatus = 'verified' THEN 1 ELSE 0 END)", 'verified')
      .addSelect(
        "SUM(CASE WHEN a.aceito = true AND (a.verificationStatus IS NULL OR a.verificationStatus = 'pending') THEN 1 ELSE 0 END)",
        'pendingVerification',
      )
      .addSelect("SUM(CASE WHEN a.verificationStatus IN ('failed', 'mismatch') THEN 1 ELSE 0 END)", 'failedVerification')
      .setParameters({ oneDayAgo, sevenDaysAgo, now })
      .getRawOne();

    return {
      total: Number(row?.total ?? 0),
      last24h: Number(row?.last24h ?? 0),
      last7d: Number(row?.last7d ?? 0),
      future: Number(row?.future ?? 0),
      accepted: Number(row?.accepted ?? 0),
      applied: Number(row?.applied ?? 0),
      verified: Number(row?.verified ?? 0),
      pendingVerification: Number(row?.pendingVerification ?? 0),
      failedVerification: Number(row?.failedVerification ?? 0),
    };
  }

  private failuresFromJobRuns(jobs: AdminJobRun[]) {
    const failures: Array<{
      type: string;
      count: number;
      lastSeenAt: string | null;
    }> = [];
    for (const job of jobs) {
      const result = job.result as any;
      const jobFailures = Array.isArray(result?.failures) ? result.failures : [];
      for (const failure of jobFailures) {
        failures.push({
          type: this.compactFailureType(failure?.reason ?? result?.errorMessage ?? job.errorMessage ?? job.status),
          count: 1,
          lastSeenAt: job.finishedAt.toISOString?.() ?? job.startedAt.toISOString?.() ?? null,
        });
      }
      if (job.status === 'error' && jobFailures.length === 0) {
        failures.push({
          type: this.compactFailureType(job.errorMessage ?? 'job_error'),
          count: 1,
          lastSeenAt: job.finishedAt.toISOString?.() ?? job.startedAt.toISOString?.() ?? null,
        });
      }
    }
    return failures;
  }

  private async verificationFailuresByType(since: Date) {
    const rows = await this.analiseRepo
      .createQueryBuilder('a')
      .select('a.verificationStatus', 'status')
      .addSelect('a.verificationError', 'error')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MAX(a.verificationCheckedAt)', 'lastSeenAt')
      .where("a.verificationStatus IN ('failed', 'mismatch')")
      .andWhere('a.verificationCheckedAt >= :since', { since })
      .groupBy('a.verificationStatus')
      .addGroupBy('a.verificationError')
      .limit(25)
      .getRawMany();

    return rows.map((row: any) => ({
      type: this.compactFailureType(row.error ?? row.status ?? 'verification_failed'),
      count: Number(row.count ?? 0),
      lastSeenAt: this.toIsoOrNull(row.lastSeenAt),
    }));
  }

  private mergeFailureGroups(...groups: Array<Array<{ type: string; count: number; lastSeenAt: string | null }>>) {
    const merged = new Map<string, { type: string; count: number; lastSeenAt: string | null }>();
    for (const group of groups) {
      for (const item of group) {
        const key = item.type || 'unknown';
        const existing = merged.get(key);
        if (!existing) {
          merged.set(key, { ...item, type: key });
          continue;
        }
        existing.count += item.count;
        if (!existing.lastSeenAt || (item.lastSeenAt && item.lastSeenAt > existing.lastSeenAt)) {
          existing.lastSeenAt = item.lastSeenAt;
        }
      }
    }
    return [...merged.values()].sort((a, b) => b.count - a.count).slice(0, 12);
  }

  private jobMetricsByName(jobNames: string[], runs: AdminJobRun[], latestByName: Map<string, AdminJobRun | null>) {
    return jobNames.map((name) => {
      const jobRuns = runs.filter((run) => run.name === name);
      const successes = jobRuns.filter((run) => run.status === 'success').length;
      const failures = jobRuns.filter((run) => run.status === 'error').length;
      const running = jobRuns.filter((run) => run.status === 'running').length;
      const durations = jobRuns
        .map((run) => run.durationMs)
        .filter((duration): duration is number => typeof duration === 'number' && Number.isFinite(duration));
      const lastRun = latestByName.get(name) ?? jobRuns[0] ?? null;
      const lastSuccess = jobRuns.find((run) => run.status === 'success') ?? null;
      const lastFailure = jobRuns.find((run) => run.status === 'error') ?? null;

      return {
        name,
        total: jobRuns.length,
        successes,
        failures,
        running,
        successRate: jobRuns.length > 0 ? Math.round((successes / jobRuns.length) * 1000) / 10 : null,
        avgDurationMs:
          durations.length > 0 ? Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length) : null,
        lastRunAt: lastRun?.startedAt.toISOString?.() ?? null,
        lastStatus: lastRun?.status ?? null,
        lastSuccessAt: lastSuccess?.finishedAt.toISOString?.() ?? null,
        lastFailureAt: lastFailure?.finishedAt.toISOString?.() ?? null,
        lastErrorMessage: lastFailure?.errorMessage ?? null,
      };
    });
  }

  private async priceIntelligenceSchemaHealth() {
    const required: Record<string, string[]> = {
      admin_job_runs: ['name', 'status', 'startedAt', 'finishedAt', 'durationMs', 'result', 'errorMessage'],
      price_snapshots: [
        'origin',
        'externalListingId',
        'trainingReady',
        'observedAt',
        'observedCheckIn',
        'observedNights',
        'observationMetadata',
      ],
      analise_preco: [
        'verification_status',
        'verification_checked_at',
        'verified_applied_at',
        'observed_price',
        'verification_source',
        'verification_error',
      ],
      airbnb_pricing_attempt_logs: [
        'listingId',
        'checkIn',
        'checkOut',
        'source',
        'status',
        'reason',
        'durationMs',
        'priceTotal',
        'dailyPrice',
        'startedAt',
        'finishedAt',
      ],
    };

    try {
      const tables = Object.keys(required);
      const rows = await this.jobRunRepo.query(
        `
          SELECT table_name AS tableName, column_name AS columnName
          FROM information_schema.columns
          WHERE table_schema = DATABASE()
            AND table_name IN (${tables.map(() => '?').join(',')})
        `,
        tables,
      );
      const columnsByTable = new Map<string, Set<string>>();
      for (const row of rows as Array<{
        tableName?: string;
        TABLE_NAME?: string;
        columnName?: string;
        COLUMN_NAME?: string;
      }>) {
        const tableName = row.tableName ?? row.TABLE_NAME;
        const columnName = row.columnName ?? row.COLUMN_NAME;
        if (!tableName || !columnName) continue;
        if (!columnsByTable.has(tableName)) columnsByTable.set(tableName, new Set());
        columnsByTable.get(tableName)?.add(columnName);
      }

      const missing: string[] = [];
      for (const [table, columns] of Object.entries(required)) {
        const present = columnsByTable.get(table);
        if (!present) {
          missing.push(`${table}.*`);
          continue;
        }
        for (const column of columns) {
          if (!present.has(column)) missing.push(`${table}.${column}`);
        }
      }

      return {
        ok: missing.length === 0,
        checkedAt: new Date().toISOString(),
        missing,
        checkError: null,
      };
    } catch (error: any) {
      return {
        ok: false,
        checkedAt: new Date().toISOString(),
        missing: [],
        checkError: error?.message || 'schema_check_failed',
      };
    }
  }

  private priceIntelligenceEndpointGaps(schemaHealth: { ok: boolean; missing: string[]; checkError: string | null }) {
    const gaps = [
      'POST /admin/dataset/airbnb-observations/run ausente; coleta Airbnb real depende apenas do cron dataset-airbnb-price-observations.',
      'POST /admin/jobs/pricing-retrain/run ausente; pricing-retrain está instrumentado como cron, mas não tem trigger admin dedicado.',
      'POST /admin/jobs/stays-auto-apply/run ausente; auto-apply aparece em AdminJobRun, mas não tem execução manual controlada nesta tela.',
      'GET /admin/price-intelligence/queue ausente; queued não é mensurável porque não há fila persistente implementada.',
    ];
    if (!schemaHealth.ok || schemaHealth.checkError) {
      gaps.push(
        'Saúde do schema degradada; aplicar migrations de AdminJobRun, verificação de analise_preco e observações Airbnb antes do go-live.',
      );
    }
    return gaps;
  }

  private async priceIntelligenceProblematicProperties() {
    const addresses = await this.addressRepo.find({
      where: { ativo: true },
      relations: ['list', 'user'],
      take: 200,
    });
    const rows: Array<{
      addressId: string | null;
      listId: string | null;
      title: string | null;
      userEmail: string | null;
      city: string | null;
      state: string | null;
      severity: 'red' | 'amber' | 'info';
      issue: string;
      lastSnapshotAt: string | null;
      lastObservationAt: string | null;
      suggestionsPending: number;
      failedSuggestions: number;
    }> = [];

    for (const address of addresses) {
      if (!address.list?.id) continue;
      const listingId = address.list.id_do_anuncio || `urban-list:${address.list.id}`;
      const [snapshot, observation, suggestionRow] = await Promise.all([
        this.snapshotRepo.findOne({
          where: { externalListingId: listingId },
          order: { createdAt: 'DESC' },
        }),
        this.snapshotRepo.findOne({
          where: {
            externalListingId: listingId,
            origin: 'airbnb_observation',
          } as any,
          order: { observedAt: 'DESC' as any },
        }),
        this.analiseRepo
          .createQueryBuilder('a')
          .select(
            "SUM(CASE WHEN a.aceito = true AND (a.verificationStatus IS NULL OR a.verificationStatus = 'pending') THEN 1 ELSE 0 END)",
            'pending',
          )
          .addSelect("SUM(CASE WHEN a.verificationStatus IN ('failed', 'mismatch') THEN 1 ELSE 0 END)", 'failed')
          .where('a.endereco_id = :addressId', { addressId: address.id })
          .getRawOne(),
      ]);

      const suggestionsPending = Number(suggestionRow?.pending ?? 0);
      const failedSuggestions = Number(suggestionRow?.failed ?? 0);
      let severity: 'red' | 'amber' | 'info' | null = null;
      let issue = '';

      if (!address.list.id_do_anuncio) {
        severity = 'red';
        issue = 'Imóvel ativo sem ID Airbnb; não conseguimos observar diária real.';
      } else if (!address.latitude || !address.longitude) {
        severity = 'red';
        issue = 'Imóvel ativo sem latitude/longitude; eventos e features ficam incompletos.';
      } else if (failedSuggestions > 0) {
        severity = 'red';
        issue = 'Há sugestões aceitas com verificação falha ou divergente.';
      } else if (!observation) {
        severity = 'amber';
        issue = 'Ainda não existe observação real de diária via Airbnb para este imóvel.';
      } else if (suggestionsPending > 0) {
        severity = 'amber';
        issue = 'Há sugestões aceitas aguardando verificação de aplicação.';
      }

      if (!severity) continue;
      rows.push({
        addressId: address.id ?? null,
        listId: address.list.id ?? null,
        title: address.list.titulo ?? null,
        userEmail: address.user?.email ?? address.list.user?.email ?? null,
        city: address.cidade ?? null,
        state: address.estado ?? null,
        severity,
        issue,
        lastSnapshotAt: snapshot?.createdAt.toISOString?.() ?? null,
        lastObservationAt: observation?.observedAt.toISOString?.() ?? null,
        suggestionsPending,
        failedSuggestions,
      });
    }

    const priority = { red: 3, amber: 2, info: 1 };
    return rows.sort((a, b) => priority[b.severity] - priority[a.severity]).slice(0, 25);
  }

  private compactFailureType(value: unknown): string {
    const text = String(value ?? 'unknown')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return 'unknown';
    if (/captcha|human|access denied|forbidden/i.test(text)) return 'captcha_or_blocked';
    if (/timeout|timed out|navigation/i.test(text)) return 'timeout';
    if (/quota|429|rate/i.test(text)) return 'quota_or_rate_limit';
    if (/price|preco|cotacao|quote/i.test(text)) return 'price_unavailable';
    if (/latitude|longitude|geocode/i.test(text)) return 'missing_geodata';
    return text.slice(0, 80);
  }

  private toIsoOrNull(value: unknown): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
}
