import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { readZeroYieldConfig } from './collector-zero-yield.service';
import { EventCoverageReportController } from './event-coverage-report.controller';
import {
  EventCoverageReportService,
  buildSourceReport,
  coverageWindows,
  evaluateCoverage,
  readEventCoverageConfig,
} from './event-coverage-report.service';

jest.mock('../mailer/mailer.service', () => ({ MailerService: class MailerService {} }));

const NOW = new Date('2026-10-26T12:00:00.000Z'); // 09:00 BRT
const zyConfig = readZeroYieldConfig({} as NodeJS.ProcessEnv);
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

describe('readEventCoverageConfig', () => {
  it('usa 100 eventos / 80% por padrão e aceita env', () => {
    expect(readEventCoverageConfig({} as NodeJS.ProcessEnv)).toEqual({ target30d: 100, minGeocodedPct: 80 });
    expect(
      readEventCoverageConfig({ EVENT_COVERAGE_TARGET_30D: '150', EVENT_COVERAGE_MIN_GEOCODED_PCT: '90' } as any),
    ).toEqual({ target30d: 150, minGeocodedPct: 90 });
    expect(readEventCoverageConfig({ EVENT_COVERAGE_TARGET_30D: 'abc' } as any).target30d).toBe(100);
  });
});

describe('coverageWindows (dias de São Paulo)', () => {
  it('21:30 BRT (00:30Z do dia seguinte) ainda é o dia anterior em SP', () => {
    const w = coverageWindows(new Date('2026-10-26T00:30:00.000Z'));
    expect(w.today).toBe('2026-10-25');
    // 7 dias: hoje (25) até 31/10 inclusive -> fim às 23:59:59.999 BRT = 02:59:59.999Z de 01/11
    expect(w.ends[7].toISOString()).toBe('2026-11-01T02:59:59.999Z');
    expect(w.ends[30].toISOString()).toBe('2026-11-24T02:59:59.999Z');
    expect(w.histogramDays).toHaveLength(30);
    expect(w.histogramDays[0]).toBe('2026-10-25');
    expect(w.histogramDays[29]).toBe('2026-11-23');
  });

  it('00:30 BRT já é o novo dia', () => {
    expect(coverageWindows(new Date('2026-10-26T03:30:00.000Z')).today).toBe('2026-10-26');
  });
});

describe('buildSourceReport', () => {
  it('classifica fontes: saudável, parada, zero-yield e não monitorada', () => {
    const activity = [
      { source: 'sympla-api', lastSeenAt: hoursAgo(2), recentItems: 10, baselineItems: 50 },
      { source: 'sp_cultura', lastSeenAt: hoursAgo(100), recentItems: 0, baselineItems: 2 }, // baseline < 5: stale, sem alerta
      { source: 'api-football', lastSeenAt: hoursAgo(100), recentItems: 0, baselineItems: 40 }, // zero-yield
      { source: 'admin-manual', lastSeenAt: hoursAgo(900), recentItems: 0, baselineItems: 9 },
    ];
    const rows = [
      { source: 'sympla-api', events30d: '60' },
      { source: 'sp-cultura', events30d: 5 }, // normalizado: sp_cultura == sp-cultura
      { source: 'api-football', events30d: 20 },
      { source: 'admin-manual', events30d: 3 },
      { source: null, events30d: 1 },
    ];
    const out = buildSourceReport(rows, activity, zyConfig, NOW);
    const byName = Object.fromEntries(out.map((s) => [s.source, s]));
    expect(byName['sympla-api']).toMatchObject({ health: 'healthy', events30d: 60, hoursSinceLastIngest: 2 });
    expect(byName['sp-cultura']).toMatchObject({ health: 'stale', events30d: 5 });
    expect(byName['api-football']).toMatchObject({ health: 'zero_yield', events30d: 20 });
    expect(byName['admin-manual']).toMatchObject({ health: 'unmonitored' });
    expect(byName['(sem source)']).toMatchObject({ health: 'stale', lastIngestAt: null, events30d: 1 });
    expect(out[0].source).toBe('sympla-api'); // ordenado por volume
  });

  it('respeita janela própria por fonte', () => {
    const cfg = { ...zyConfig, sourceWindowHours: { 'spider-x': 200 } };
    const out = buildSourceReport(
      [{ source: 'spider-x', events30d: 4 }],
      [{ source: 'spider-x', lastSeenAt: hoursAgo(100), recentItems: 1, baselineItems: 1 }],
      cfg,
      NOW,
    );
    expect(out[0]).toMatchObject({ health: 'healthy', windowHours: 200 });
  });
});

describe('evaluateCoverage (status vs meta)', () => {
  const cfg = { target30d: 100, minGeocodedPct: 80 };
  const src = (source: string, events30d: number, health: any) => ({
    source,
    events30d,
    lastIngestAt: null,
    hoursSinceLastIngest: 1,
    windowHours: 36,
    health,
  });
  const base = (next30d: number, geocoded30d: number, sources: any[]) => ({
    counts: { next7d: 10, next30d, next90d: next30d * 2 },
    geocoded30d,
    withCategory30d: next30d,
    dedupPending: { total: 0, high: 0 },
    sources,
  });

  it('ok: meta atingida com fontes saudáveis e geocoding >= 80%', () => {
    const r = evaluateCoverage(base(120, 110, [src('a', 100, 'healthy'), src('m', 20, 'unmonitored')]), cfg);
    expect(r.status).toBe('ok');
    expect(r.next30dFromHealthySources).toBe(120);
    expect(r.geocodedPct).toBe(91.7);
  });

  it('limite exato: 100 eventos = ok, 99 = insufficient', () => {
    expect(evaluateCoverage(base(100, 100, [src('a', 100, 'healthy')]), cfg).status).toBe('ok');
    const r = evaluateCoverage(base(99, 99, [src('a', 99, 'healthy')]), cfg);
    expect(r.status).toBe('insufficient');
    expect(r.reasons[0]).toMatchObject({ code: 'below_target', severity: 'critical' });
  });

  it('at_risk: meta só é atingida com fonte parada', () => {
    const r = evaluateCoverage(base(130, 130, [src('a', 70, 'healthy'), src('b', 60, 'zero_yield')]), cfg);
    expect(r.status).toBe('at_risk');
    expect(r.reasons.map((x) => x.code)).toEqual(expect.arrayContaining(['unhealthy_sources', 'source_zero_yield']));
    expect(r.reasons.find((x) => x.code === 'source_zero_yield')?.source).toBe('b');
  });

  it('at_risk: geocoding abaixo de 80%', () => {
    const r = evaluateCoverage(base(120, 90, [src('a', 120, 'healthy')]), cfg);
    expect(r.status).toBe('at_risk');
    expect(r.reasons.map((x) => x.code)).toContain('low_geocoding');
  });

  it('insufficient prevalece sobre at_risk e sem fontes é crítico', () => {
    const r = evaluateCoverage(base(0, 0, []), cfg);
    expect(r.status).toBe('insufficient');
    expect(r.geocodedPct).toBeNull();
    expect(r.reasons.map((x) => x.code)).toEqual(expect.arrayContaining(['below_target', 'no_sources']));
  });

  it('lista duplicatas pendentes como informativo', () => {
    const input = { ...base(120, 120, [src('a', 120, 'healthy')]), dedupPending: { total: 4, high: 1 } };
    const r = evaluateCoverage(input, cfg);
    expect(r.status).toBe('ok');
    expect(r.reasons).toEqual([expect.objectContaining({ code: 'dedup_pending', severity: 'info' })]);
  });
});

describe('EventCoverageReportService.report', () => {
  function qb(rawOne: unknown, rawMany: unknown[], captured: { sql: string[]; params: Record<string, unknown>[] }) {
    const chain: any = {};
    for (const m of ['select', 'addSelect', 'where', 'andWhere', 'groupBy']) {
      chain[m] = jest.fn((arg: unknown, params?: Record<string, unknown>) => {
        if (typeof arg === 'string') captured.sql.push(arg);
        if (params) captured.params.push(params);
        return chain;
      });
    }
    chain.setParameters = jest.fn((p: Record<string, unknown>) => {
      captured.params.push(p);
      return chain;
    });
    chain.getRawOne = jest.fn(async () => rawOne);
    chain.getRawMany = jest.fn(async () => rawMany);
    return chain;
  }

  it('agrega em poucas queries, preenche o histograma e devolve o status', async () => {
    const captured = { sql: [] as string[], params: [] as Record<string, unknown>[] };
    const counts = qb(
      { next7d: '30', next30d: '120', next90d: '200', geocoded30d: '110', withCategory30d: '100' },
      [],
      captured,
    );
    const histogram = qb(null, [{ day: '2026-10-26', count: '7' }, { day: '2026-11-03', count: '3' }], captured);
    const sources = qb(null, [{ source: 'sympla-api', events30d: '120' }], captured);
    const queue = [counts, histogram, sources];
    const eventRepo: any = { createQueryBuilder: jest.fn(() => queue.shift()) };
    const dedupQb = qb(null, [{ band: 'high', count: '2' }, { band: 'low', count: '5' }], captured);
    const dedupRepo: any = { createQueryBuilder: jest.fn(() => dedupQb) };
    const regionRepo: any = { find: jest.fn(async () => [{ name: 'Grande São Paulo', status: 'active' }]) };
    const zeroYield: any = {
      loadActivity: jest.fn(async () => [
        { source: 'sympla-api', lastSeenAt: hoursAgo(1), recentItems: 5, baselineItems: 40 },
      ]),
    };

    const service = new EventCoverageReportService(eventRepo, dedupRepo, regionRepo, zeroYield);
    const report = await service.report(NOW);

    expect(eventRepo.createQueryBuilder).toHaveBeenCalledTimes(3);
    expect(dedupRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(report.status).toBe('ok');
    expect(report.counts).toMatchObject({ next7d: 30, next30d: 120, next90d: 200, next30dFromHealthySources: 120 });
    expect(report.quality).toMatchObject({ geocodedPct: 91.7, withCategoryPct: 83.3, missingGeocode30d: 10 });
    expect(report.duplicatesPendingReview).toEqual({ total: 7, high: 2 });
    expect(report.histogram).toHaveLength(30);
    expect(report.histogram[0]).toEqual({ date: '2026-10-26', count: 7 });
    expect(report.histogram.find((d) => d.date === '2026-11-03')?.count).toBe(3);
    expect(report.histogram.reduce((s, d) => s + d.count, 0)).toBe(10);
    expect(report.scope.regions).toEqual([{ name: 'Grande São Paulo', status: 'active' }]);
    expect(report.sources[0]).toMatchObject({ source: 'sympla-api', health: 'healthy' });
    // filtros canônico/ativo/in-scope/SP aplicados
    const sql = captured.sql.join(' | ');
    expect(sql).toContain('e.outOfScope = :out');
    expect(sql).toContain('e.ativo = :ativo');
    expect(sql).toContain('e.duplicateOfEventId IS NULL');
    expect(sql).toContain("e.dedupStatus = 'canonical'");
    expect(sql).toContain('CONVERT_TZ(e.dataInicio');
  });
});

describe('EventCoverageReportController (autorização)', () => {
  it('exige JwtAuthGuard + RolesGuard e papel admin', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, EventCoverageReportController) as unknown[];
    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, EventCoverageReportController)).toEqual(['admin']);
  });

  it('expõe somente GET /admin/event-coverage', () => {
    expect(Reflect.getMetadata(PATH_METADATA, EventCoverageReportController)).toBe('admin/event-coverage');
    const handler = EventCoverageReportController.prototype.coverage;
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
    const routes = Object.getOwnPropertyNames(EventCoverageReportController.prototype).filter(
      (k) => k !== 'constructor',
    );
    expect(routes).toEqual(['coverage']);
  });
});
