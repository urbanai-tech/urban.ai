import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { addDaysToDateKey, saoPauloDayBounds, saoPauloDaySql, todaySaoPauloDateKey } from '../common/sp-date';
import { Repository } from 'typeorm';
import { CollectorZeroYieldService, ZeroYieldFinding } from '../evento/collector-zero-yield.service';
import { KNOWN_EVENT_COLLECTORS } from '../evento/collector-registry';
import { Event as EventEntity } from '../entities/events.entity';
import { clampInt } from '../common/clamp-int';

/**
 * AdminEventsService — analytics, listagem, timeline e saúde dos coletores do
 * motor de eventos para o painel admin.
 */
@Injectable()
export class AdminEventsService {
  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepo: Repository<EventEntity>,
    @Optional() private readonly zeroYieldService?: CollectorZeroYieldService,
  ) {}

  // =========================================================================
  // F6.2 — Analytics de eventos
  // =========================================================================

  /**
   * Análise da cobertura do motor de eventos:
   *  - Total + ativos
   *  - Por categoria, cidade, intervalo de relevância
   *  - Eventos com / sem coordenadas (geocoding gap)
   *  - Eventos sem relevância (Gemini enrichment gap)
   *  - Janela temporal (próximos 7/30/90 dias)
   *  - Top 10 eventos de maior relevância
   */
  async eventsAnalytics() {
    const now = new Date();
    const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in90d = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const [
      total,
      ativos,
      withCoords,
      withRelevance,
      next7d,
      next30d,
      next90d,
      megaUpcoming,
      byCategory,
      byCity,
      byRelevance,
      topUpcoming,
      lastCrawl,
    ] = await Promise.all([
      this.eventRepo.count(),
      this.eventRepo.count({ where: { ativo: true } }),
      this.eventRepo.createQueryBuilder('e').where('e.latitude IS NOT NULL AND e.longitude IS NOT NULL').getCount(),
      this.eventRepo.createQueryBuilder('e').where('e.relevancia IS NOT NULL').getCount(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.dataInicio BETWEEN :start AND :end', {
          start: now,
          end: in7d,
        })
        .getCount(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.dataInicio BETWEEN :start AND :end', {
          start: now,
          end: in30d,
        })
        .getCount(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.dataInicio BETWEEN :start AND :end', {
          start: now,
          end: in90d,
        })
        .getCount(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.dataInicio BETWEEN :start AND :end', {
          start: now,
          end: in30d,
        })
        .andWhere('e.relevancia >= 80')
        .getCount(),
      this.eventRepo
        .createQueryBuilder('e')
        .select("COALESCE(e.categoria, 'sem categoria')", 'categoria')
        .addSelect('COUNT(*)', 'count')
        .groupBy('categoria')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany(),
      this.eventRepo
        .createQueryBuilder('e')
        .select('e.cidade', 'cidade')
        .addSelect('COUNT(*)', 'count')
        .groupBy('e.cidade')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany(),
      this.eventRepo
        .createQueryBuilder('e')
        .select(
          `CASE
             WHEN e.relevancia IS NULL THEN 'sem relevância'
             WHEN e.relevancia < 30 THEN '0-29'
             WHEN e.relevancia < 60 THEN '30-59'
             WHEN e.relevancia < 80 THEN '60-79'
             ELSE '80-100 (mega)'
           END`,
          'bucket',
        )
        .addSelect('COUNT(*)', 'count')
        .groupBy('bucket')
        .getRawMany(),
      this.eventRepo
        .createQueryBuilder('e')
        .where('e.dataInicio >= :now', { now })
        .andWhere('e.relevancia IS NOT NULL')
        .orderBy('e.relevancia', 'DESC')
        .addOrderBy('e.dataInicio', 'ASC')
        .limit(10)
        .getMany(),
      this.eventRepo.createQueryBuilder('e').select('MAX(e.dataCrawl)', 'lastCrawl').getRawOne(),
    ]);

    const coveragePercent = total > 0 ? Math.round((withCoords / total) * 1000) / 10 : 0;
    const enrichmentPercent = total > 0 ? Math.round((withRelevance / total) * 1000) / 10 : 0;

    // Contadores de cobertura geográfica (F6.2 Plus)
    const [inScope, outOfScope] = await Promise.all([
      this.eventRepo.count({ where: { outOfScope: false } }),
      this.eventRepo.count({ where: { outOfScope: true } }),
    ]);

    return {
      summary: {
        total,
        ativos,
        inScope,
        outOfScope,
        coveragePercent, // % com coordenadas
        enrichmentPercent, // % com relevância (Gemini)
        coordsMissing: total - withCoords,
        relevanceMissing: total - withRelevance,
      },
      upcoming: {
        next7d,
        next30d,
        next90d,
        megaUpcoming,
      },
      byCategory: byCategory.map((r: any) => ({
        categoria: r.categoria,
        count: Number(r.count),
      })),
      byCity: byCity.map((r: any) => ({
        cidade: r.cidade,
        count: Number(r.count),
      })),
      byRelevance: byRelevance.map((r: any) => ({
        bucket: r.bucket,
        count: Number(r.count),
      })),
      topUpcoming: topUpcoming.map((e) => ({
        id: e.id,
        nome: e.nome,
        cidade: e.cidade,
        dataInicio: e.dataInicio,
        relevancia: e.relevancia,
        categoria: e.categoria,
        capacidadeEstimada: e.capacidadeEstimada,
        raioImpactoKm: e.raioImpactoKm,
        hasCoords: e.latitude != null && e.longitude != null,
      })),
      lastCrawlAt: lastCrawl?.lastCrawl ?? null,
    };
  }

  // ========================================================================
  // F6.2 Plus — Listing paginada de eventos com filtro de cobertura
  // ========================================================================

  /**
   * Lista paginada de eventos para o painel admin com filtros.
   * Usado pelo `/admin/events` quando admin quer auditar eventos individualmente.
   *
   * @param filters.scope 'in' (default — só dentro da cobertura) | 'out' | 'all'
   * @param filters.source filtro por source (api-football, sympla, scraper-eventim, etc.)
   * @param filters.search match contra nome/cidade
   * @param filters.upcoming se true, só dataInicio >= now
   */
  async eventsListing(filters: {
    page?: number;
    limit?: number;
    scope?: 'in' | 'out' | 'all';
    source?: string;
    search?: string;
    upcoming?: boolean;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
    const scope = filters.scope ?? 'in';

    const qb = this.eventRepo.createQueryBuilder('e');

    if (scope === 'in') qb.andWhere('e.outOfScope = :v', { v: false });
    else if (scope === 'out') qb.andWhere('e.outOfScope = :v', { v: true });

    if (scope !== 'all') {
      qb.andWhere('e.duplicateOfEventId IS NULL').andWhere("(e.dedupStatus IS NULL OR e.dedupStatus = 'canonical')");
    }

    if (filters.source) qb.andWhere('e.source = :src', { src: filters.source });

    if (filters.upcoming) qb.andWhere('e.dataInicio >= :now', { now: new Date() });

    if (filters.search) {
      const like = `%${filters.search.toLowerCase()}%`;
      qb.andWhere("(LOWER(e.nome) LIKE :like OR LOWER(COALESCE(e.cidade, '')) LIKE :like)", { like });
    }

    qb.orderBy('e.dataInicio', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      page,
      limit,
      total,
      scope,
      items: items.map((e) => ({
        id: e.id,
        nome: e.nome,
        cidade: e.cidade,
        estado: e.estado,
        dataInicio: e.dataInicio,
        dataFim: e.dataFim,
        categoria: e.categoria,
        relevancia: e.relevancia,
        capacidadeEstimada: e.capacidadeEstimada,
        raioImpactoKm: e.raioImpactoKm,
        venueType: e.venueType,
        venueCapacity: e.venueCapacity,
        source: e.source,
        outOfScope: e.outOfScope,
        pendingGeocode: e.pendingGeocode,
        ativo: e.ativo,
        latitude: e.latitude,
        longitude: e.longitude,
        enrichmentAttempts: e.enrichmentAttempts,
        enrichmentLastError: e.enrichmentLastError,
        crawledUrl: e.crawledUrl,
        canonicalName: e.canonicalName,
        dedupStatus: e.dedupStatus,
        duplicateOfEventId: e.duplicateOfEventId,
        identityConfidence: e.identityConfidence,
        sourceCount: e.sourceCount,
        lastSeenAt: e.lastSeenAt,
      })),
    };
  }

  // ========================================================================
  // F6.2 Plus — Timeline diária de ingestão (in-scope vs out-of-scope)
  // ========================================================================

  /**
   * Agregado diário de eventos coletados nos últimos N dias, separados por
   * scope (in/out). Usado pelo gráfico de evolução em `/admin/events`.
   *
   * Critério: `e.dataCrawl` (timestamp da última coleta).
   *
   * @param days janela em dias (default 30, max 90)
   */
  async eventsTimeline(days: number = 30) {
    const safeDays = clampInt(days, { min: 1, max: 90, fallback: 30 });
    // Dias de calendário de São Paulo (não UTC): uma coleta às 22h BRT é 01h UTC
    // do dia seguinte e não pode cair no bucket errado.
    const todayKey = todaySaoPauloDateKey();
    const firstKey = addDaysToDateKey(todayKey, -(safeDays - 1));
    const since = saoPauloDayBounds(firstKey).start;

    const rows = await this.eventRepo
      .createQueryBuilder('e')
      .select(saoPauloDaySql('e.dataCrawl'), 'day')
      .addSelect('SUM(CASE WHEN e.outOfScope = FALSE THEN 1 ELSE 0 END)', 'inScope')
      .addSelect('SUM(CASE WHEN e.outOfScope = TRUE THEN 1 ELSE 0 END)', 'outOfScope')
      .where('e.dataCrawl >= :since', { since })
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany();

    // Preenche dias vazios (sem coleta) com 0/0 pra gráfico contínuo
    const map = new Map<string, { in: number; out: number }>();
    for (const r of rows) {
      const dayKey = String(r.day).slice(0, 10);
      map.set(dayKey, {
        in: Number(r.inScope ?? 0),
        out: Number(r.outOfScope ?? 0),
      });
    }
    const buckets: Array<{ day: string; inScope: number; outOfScope: number }> = [];
    for (let i = safeDays - 1; i >= 0; i--) {
      const key = addDaysToDateKey(todayKey, -i);
      const entry = map.get(key) ?? { in: 0, out: 0 };
      buckets.push({ day: key, inScope: entry.in, outOfScope: entry.out });
    }

    const totalIn = buckets.reduce((s, b) => s + b.inScope, 0);
    const totalOut = buckets.reduce((s, b) => s + b.outOfScope, 0);
    const peakDay = buckets.reduce(
      (acc, b) => (b.inScope + b.outOfScope > acc.total ? { day: b.day, total: b.inScope + b.outOfScope } : acc),
      {
        day: '',
        total: 0,
      },
    );

    return {
      days: safeDays,
      generatedAt: new Date().toISOString(),
      totalInScope: totalIn,
      totalOutScope: totalOut,
      avgPerDay: Math.round((totalIn + totalOut) / safeDays),
      peakDay,
      buckets,
    };
  }

  // ========================================================================
  // F6.2 Plus — Saúde dos coletores (por source)
  // ========================================================================

  /**
   * Métricas de saúde por `source`. Usado pra debugar quais coletores estão
   * trazendo lixo, qual fonte tem mais eventos out-of-scope, qual tem mais
   * falhas de enrichment, etc.
   *
   * Considera todos os eventos NÃO-source-NULL agrupados por source.
   * Inclui spider-* (legados Scrapy) e api-* / firecrawl / serpapi / tavily /
   * sp-cultura / admin-* (Camadas 1+2+3).
   */
  async collectorsHealth() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const rows = await this.eventRepo
      .createQueryBuilder('e')
      .select("COALESCE(e.source, '(sem source)')", 'source')
      .addSelect('COUNT(*)', 'total')
      .addSelect('SUM(CASE WHEN e.dataCrawl >= :sevenDaysAgo THEN 1 ELSE 0 END)', 'last7d')
      .addSelect('SUM(CASE WHEN e.dataCrawl >= :oneDayAgo THEN 1 ELSE 0 END)', 'last24h')
      .addSelect('SUM(CASE WHEN e.outOfScope = TRUE THEN 1 ELSE 0 END)', 'outOfScope')
      .addSelect('SUM(CASE WHEN e.pendingGeocode = TRUE THEN 1 ELSE 0 END)', 'pendingGeocode')
      .addSelect('SUM(CASE WHEN e.relevancia IS NULL AND e.outOfScope = FALSE THEN 1 ELSE 0 END)', 'pendingEnrichment')
      .addSelect('SUM(CASE WHEN e.relevancia IS NOT NULL THEN 1 ELSE 0 END)', 'enriched')
      .addSelect('SUM(CASE WHEN e.enrichmentLastError IS NOT NULL THEN 1 ELSE 0 END)', 'withErrors')
      .addSelect(
        "SUM(CASE WHEN e.duplicateOfEventId IS NOT NULL OR e.dedupStatus IN ('duplicate', 'merged', 'ignored', 'review_pending') THEN 1 ELSE 0 END)",
        'duplicateCount',
      )
      .addSelect(
        "SUM(CASE WHEN e.duplicateOfEventId IS NULL AND (e.dedupStatus IS NULL OR e.dedupStatus = 'canonical') THEN 1 ELSE 0 END)",
        'canonicalCount',
      )
      .addSelect('SUM(COALESCE(e.sourceCount, 0))', 'sourceLinksCount')
      .addSelect('MAX(e.dataCrawl)', 'lastSeen')
      .setParameter('sevenDaysAgo', sevenDaysAgo)
      .setParameter('oneDayAgo', oneDayAgo)
      .groupBy('source')
      .orderBy('total', 'DESC')
      .getRawMany();

    // Registro compartilhado com o alerta "fonte configurada que nunca entregou" (evento/collector-registry.ts).
    const knownCollectors = KNOWN_EVENT_COLLECTORS;

    const sources: any[] = rows.map((r: any) => {
      const rawSource = String(r.source ?? '(sem source)');
      const normalizedSource = rawSource.replace(/_/g, '-');
      const known = knownCollectors.find(
        (collector) =>
          collector.source === normalizedSource || ('aliases' in collector && collector.aliases?.includes(rawSource)),
      );
      const total = Number(r.total ?? 0);
      const outOfScope = Number(r.outOfScope ?? 0);
      const pendingEnrichment = Number(r.pendingEnrichment ?? 0);
      const enriched = Number(r.enriched ?? 0);
      const withErrors = Number(r.withErrors ?? 0);
      const duplicateCount = Number(r.duplicateCount ?? 0);
      const canonicalCount = Number(r.canonicalCount ?? 0);
      const lastSeen = r.lastSeen ?? null;
      const missingEnv = known?.requiredEnv.filter((name) => !process.env[name]) ?? [];
      const stale = Boolean(lastSeen && Date.now() - new Date(lastSeen).getTime() > 48 * 60 * 60 * 1000);
      return {
        source: known?.source ?? rawSource,
        status: missingEnv.length ? 'missing_key' : stale ? 'stale' : 'has_events',
        critical: known?.critical ?? null,
        aliases: known?.aliases ?? [],
        requiredEnv: known?.requiredEnv ?? [],
        missingEnv,
        stale,
        total,
        last7d: Number(r.last7d ?? 0),
        last24h: Number(r.last24h ?? 0),
        outOfScope,
        outOfScopePercent: total > 0 ? Math.round((outOfScope / total) * 1000) / 10 : 0,
        canonicalCount,
        duplicateCount,
        duplicateRatePercent: total > 0 ? Math.round((duplicateCount / total) * 1000) / 10 : 0,
        sourceLinksCount: Number(r.sourceLinksCount ?? 0),
        pendingGeocode: Number(r.pendingGeocode ?? 0),
        pendingEnrichment,
        enriched,
        withErrors,
        errorRate: enriched + withErrors > 0 ? Math.round((withErrors / (enriched + withErrors)) * 1000) / 10 : 0,
        lastSeen,
      };
    });
    const present = new Set(sources.map((source) => String(source.source ?? '').replace(/_/g, '-')));
    for (const collector of knownCollectors) {
      if (present.has(collector.source)) {
        continue;
      }
      const missingEnv = collector.requiredEnv.filter((name) => !process.env[name]);
      sources.push({
        source: collector.source,
        status: missingEnv.length ? 'missing_key' : 'no_events',
        critical: collector.critical,
        total: 0,
        last7d: 0,
        last24h: 0,
        outOfScope: 0,
        outOfScopePercent: 0,
        canonicalCount: 0,
        duplicateCount: 0,
        duplicateRatePercent: 0,
        sourceLinksCount: 0,
        pendingGeocode: 0,
        pendingEnrichment: 0,
        enriched: 0,
        withErrors: 0,
        errorRate: 0,
        lastSeen: null,
        missingEnv,
      });
    }

    // D2 — fontes normalmente ativas que pararam de enviar qualquer item.
    const zeroYield = await this.zeroYieldSummary();
    const zeroBySource = new Map(zeroYield.alerts.map((alert) => [alert.source, alert]));
    for (const row of sources) {
      const alert = zeroBySource.get(String(row.source ?? '').replace(/_/g, '-').toLowerCase());
      if (!alert) continue;
      row.zeroYield = alert;
      row.signals = [...(row.signals ?? []), 'zero_yield'];
      if (row.status !== 'missing_key') row.status = 'zero_yield';
    }

    return {
      generatedAt: new Date().toISOString(),
      zeroYield,
      sources: sources.sort((a, b) => b.total - a.total || a.source.localeCompare(b.source)),
    };
  }

  private async zeroYieldSummary(): Promise<{
    enabled: boolean;
    windowHours: number | null;
    baselineDays: number | null;
    minBaselineItems: number | null;
    alerts: ZeroYieldFinding[];
  }> {
    const empty = { enabled: false, windowHours: null, baselineDays: null, minBaselineItems: null, alerts: [] };
    if (!this.zeroYieldService) return empty;
    try {
      const { config, findings } = await this.zeroYieldService.currentFindings();
      return {
        enabled: config.enabled,
        windowHours: config.windowHours,
        baselineDays: config.baselineDays,
        minBaselineItems: config.minBaselineItems,
        alerts: findings,
      };
    } catch {
      return empty; // painel de saúde não pode cair por causa do detector
    }
  }
}
