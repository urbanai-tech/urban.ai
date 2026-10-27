import * as Sentry from '@sentry/nestjs';
import {
  CollectorZeroYieldService,
  SourceActivity,
  ZeroYieldConfig,
  evaluateZeroYield,
  isIgnoredSource,
  readZeroYieldConfig,
} from './collector-zero-yield.service';

jest.mock('@sentry/nestjs', () => ({ captureMessage: jest.fn() }));

const NOW = new Date('2026-10-24T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

const baseConfig: ZeroYieldConfig = {
  enabled: true,
  windowHours: 36,
  baselineDays: 14,
  minBaselineItems: 5,
  ignoreSources: ['admin-*', 'marcha-para-jesus'],
  sourceWindowHours: {},
  realertHours: 24,
};

const activity = (over: Partial<SourceActivity> & { source: string }): SourceActivity => ({
  lastSeenAt: hoursAgo(2),
  recentItems: 10,
  baselineItems: 40,
  ...over,
});

describe('readZeroYieldConfig', () => {
  it('usa defaults seguros sem env', () => {
    expect(readZeroYieldConfig({})).toEqual({
      enabled: true,
      windowHours: 36,
      baselineDays: 14,
      minBaselineItems: 5,
      ignoreSources: ['admin-*', 'marcha-para-jesus'],
      sourceWindowHours: {},
      realertHours: 24,
    });
  });

  it('lê overrides e ignora valores inválidos', () => {
    const cfg = readZeroYieldConfig({
      COLLECTOR_ZERO_YIELD_ENABLED: 'false',
      COLLECTOR_ZERO_YIELD_WINDOW_HOURS: '12',
      COLLECTOR_ZERO_YIELD_BASELINE_DAYS: 'abc',
      COLLECTOR_ZERO_YIELD_MIN_BASELINE_ITEMS: '3',
      COLLECTOR_ZERO_YIELD_IGNORE_SOURCES: 'Foo_Bar, baz-*',
      COLLECTOR_ZERO_YIELD_SOURCE_WINDOWS: 'api-football:168, sympla:0 , x',
      COLLECTOR_ZERO_YIELD_REALERT_HOURS: '-1',
    } as NodeJS.ProcessEnv);
    expect(cfg).toMatchObject({
      enabled: false,
      windowHours: 12,
      baselineDays: 14,
      minBaselineItems: 3,
      ignoreSources: ['foo-bar', 'baz-*'],
      sourceWindowHours: { 'api-football': 168 },
      realertHours: 24,
    });
  });
});

describe('isIgnoredSource', () => {
  it('casa nome exato e prefixo com *', () => {
    expect(isIgnoredSource('admin-csv-import', ['admin-*'])).toBe(true);
    expect(isIgnoredSource('marcha_para_jesus', ['marcha-para-jesus'])).toBe(true);
    expect(isIgnoredSource('sympla', ['admin-*'])).toBe(false);
  });
});

describe('evaluateZeroYield', () => {
  it('alerta fonte normalmente ativa que caiu a zero', () => {
    const findings = evaluateZeroYield(
      [activity({ source: 'sp-cultura', lastSeenAt: hoursAgo(50), recentItems: 0, baselineItems: 30 })],
      baseConfig,
      NOW,
    );
    expect(findings).toEqual([
      {
        source: 'sp-cultura',
        windowHours: 36,
        hoursSinceLastItem: 50,
        baselineItems: 30,
        recentItems: 0,
        lastSeenAt: hoursAgo(50).toISOString(),
      },
    ]);
  });

  it('não alerta fonte que enviou dentro da janela', () => {
    expect(evaluateZeroYield([activity({ source: 'sympla', lastSeenAt: hoursAgo(35) })], baseConfig, NOW)).toEqual([]);
  });

  it('não alerta fonte que nunca foi normalmente ativa (baseline baixo)', () => {
    expect(
      evaluateZeroYield(
        [activity({ source: 'nova-fonte', lastSeenAt: hoursAgo(100), baselineItems: 4 })],
        baseConfig,
        NOW,
      ),
    ).toEqual([]);
  });

  it('respeita fontes ignoradas (curadoria manual, anuais)', () => {
    const silent = { lastSeenAt: hoursAgo(500), baselineItems: 50 };
    expect(
      evaluateZeroYield(
        [
          activity({ source: 'admin-csv-import', ...silent }),
          activity({ source: 'marcha-para-jesus', ...silent }),
        ],
        baseConfig,
        NOW,
      ),
    ).toEqual([]);
  });

  it('janela própria por fonte (coletor semanal não alerta com 3 dias de silêncio)', () => {
    const cfg = { ...baseConfig, sourceWindowHours: { 'api-football': 168 } };
    const rows = [
      activity({ source: 'api-football', lastSeenAt: hoursAgo(72) }),
      activity({ source: 'sympla', lastSeenAt: hoursAgo(72) }),
    ];
    expect(evaluateZeroYield(rows, cfg, NOW).map((f) => f.source)).toEqual(['sympla']);
  });

  it('normaliza underscore do source e ordena por baseline', () => {
    const findings = evaluateZeroYield(
      [
        activity({ source: 'serpapi_events', lastSeenAt: hoursAgo(80), baselineItems: 10 }),
        activity({ source: 'tavily', lastSeenAt: hoursAgo(80), baselineItems: 90 }),
      ],
      baseConfig,
      NOW,
    );
    expect(findings.map((f) => f.source)).toEqual(['tavily', 'serpapi-events']);
  });

  it('lastSeenAt nulo com baseline alto conta como silêncio', () => {
    const findings = evaluateZeroYield([activity({ source: 'x', lastSeenAt: null })], baseConfig, NOW);
    expect(findings[0]).toMatchObject({ source: 'x', hoursSinceLastItem: null, lastSeenAt: null });
  });

  it('desligado não alerta nada', () => {
    expect(
      evaluateZeroYield([activity({ source: 'x', lastSeenAt: hoursAgo(500) })], { ...baseConfig, enabled: false }, NOW),
    ).toEqual([]);
  });
});

describe('CollectorZeroYieldService', () => {
  const originalEnv = process.env;

  const qb = (rows: unknown[]) => {
    const builder: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    };
    return builder;
  };

  function makeService(sourceRows: unknown[], eventRows: unknown[] = [], mailer?: any) {
    const eventSourceRepo: any = { createQueryBuilder: jest.fn(() => qb(sourceRows)) };
    const eventRepo: any = { createQueryBuilder: jest.fn(() => qb(eventRows)) };
    return new CollectorZeroYieldService(eventSourceRepo, eventRepo, mailer);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.ADMIN_ALERT_EMAIL;
    delete process.env.OPS_ALERT_EMAIL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const silentRow = {
    source: 'sp-cultura',
    lastSeenAt: new Date(Date.now() - 60 * 3_600_000).toISOString(),
    recentItems: '0',
    baselineItems: '25',
  };

  it('envia Sentry + e-mail ao admin quando fonte ativa cai a zero', async () => {
    process.env.ADMIN_ALERT_EMAIL = 'admin@example.com';
    const mailer = { sendTextEmailCron: jest.fn().mockResolvedValue({ enviado: true, status: 201 }) };
    const service = makeService([silentRow], [], mailer);

    const result = await service.check();

    expect(result.alerts.map((a) => a.source)).toEqual(['sp-cultura']);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Fonte de eventos sem dados (zero-yield)',
      expect.objectContaining({ level: 'error', tags: { component: 'collector-zero-yield' } }),
    );
    expect(mailer.sendTextEmailCron).toHaveBeenCalledWith(
      { email: 'admin@example.com', name: 'My Urban Admin' },
      expect.stringContaining('sp-cultura'),
      expect.stringContaining('sp-cultura'),
    );
  });

  it('não repete o alerta dentro da janela de re-alerta, e rearma quando a fonte volta', async () => {
    process.env.ADMIN_ALERT_EMAIL = 'admin@example.com';
    const mailer = { sendTextEmailCron: jest.fn().mockResolvedValue({ enviado: true, status: 201 }) };
    const service = makeService([silentRow], [], mailer);

    await service.check();
    await service.check();
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(mailer.sendTextEmailCron).toHaveBeenCalledTimes(1);

    // fonte volta a enviar -> rearma
    (service as any).eventSourceRepo.createQueryBuilder = jest.fn(() =>
      qb([{ ...silentRow, lastSeenAt: new Date().toISOString(), recentItems: '9' }]),
    );
    await service.check();
    (service as any).eventSourceRepo.createQueryBuilder = jest.fn(() => qb([silentRow]));
    await service.check();
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(2);
  });

  it('sem e-mail configurado ainda alerta no Sentry', async () => {
    const mailer = { sendTextEmailCron: jest.fn() };
    const service = makeService([silentRow], [], mailer);
    await service.check();
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(mailer.sendTextEmailCron).not.toHaveBeenCalled();
  });

  it('não alerta quando todas as fontes enviaram recentemente', async () => {
    const service = makeService([{ ...silentRow, lastSeenAt: new Date().toISOString(), recentItems: '12' }]);
    const result = await service.check();
    expect(result.alerts).toEqual([]);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('combina event_sources e events.dataCrawl (fonte legada só em events)', async () => {
    const legacy = { source: 'scraper-sympla', lastSeenAt: silentRow.lastSeenAt, recentItems: '0', baselineItems: '12' };
    const service = makeService([], [legacy]);
    const { findings } = await service.currentFindings();
    expect(findings.map((f) => f.source)).toEqual(['scraper-sympla']);
  });

  it('falha de banco não derruba o job', async () => {
    const eventSourceRepo: any = {
      createQueryBuilder: jest.fn(() => {
        throw new Error('db down');
      }),
    };
    const service = new CollectorZeroYieldService(eventSourceRepo, {} as any);
    await expect(service.check()).resolves.toEqual({ checked: 0, alerts: [] });
  });

  it('COLLECTOR_ZERO_YIELD_ENABLED=false desliga o job', async () => {
    process.env.COLLECTOR_ZERO_YIELD_ENABLED = 'false';
    const service = makeService([silentRow]);
    await expect(service.check()).resolves.toEqual({ checked: 0, alerts: [] });
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });
});
