import * as Sentry from '@sentry/nestjs';
import { CollectorAlertStateService } from './collector-alert-state.service';
import {
  NeverDeliveredConfig,
  evaluateNeverDelivered,
  readNeverDeliveredConfig,
  selectDueAlerts,
} from './collector-never-delivered';
import { configuredCollectors } from './collector-registry';
import { CollectorZeroYieldService } from './collector-zero-yield.service';

jest.mock('@sentry/nestjs', () => ({ captureMessage: jest.fn() }));
jest.mock('../mailer/mailer.service', () => ({ MailerService: class MailerService {} }));

const NOW = new Date('2026-10-31T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
const config: NeverDeliveredConfig = { enabled: true, days: 7 };

describe('readNeverDeliveredConfig', () => {
  it('padrão: ligado, 7 dias; aceita env e ignora valor inválido', () => {
    expect(readNeverDeliveredConfig({} as NodeJS.ProcessEnv)).toEqual({ enabled: true, days: 7 });
    expect(
      readNeverDeliveredConfig({ COLLECTOR_NEVER_DELIVERED_ENABLED: 'false', COLLECTOR_NEVER_DELIVERED_DAYS: '3' } as any),
    ).toEqual({ enabled: false, days: 3 });
    expect(readNeverDeliveredConfig({ COLLECTOR_NEVER_DELIVERED_DAYS: '-2' } as any).days).toBe(7);
  });
});

describe('configuredCollectors', () => {
  it('só entram fontes com todas as chaves; pseudo-fontes ficam de fora', () => {
    const names = configuredCollectors({ API_FOOTBALL_KEY: 'k' } as any).map((c) => c.source);
    expect(names).toContain('api-football');
    expect(names).toContain('anhembi');
    expect(names).not.toContain('serpapi-events'); // sem SERPAPI_KEY
    expect(names).not.toContain('firecrawl'); // faltam chaves
    expect(names).not.toContain('legacy-scrapyd-spiders');
  });
});

describe('evaluateNeverDelivered', () => {
  const expected = [
    { source: 'anhembi', firstExpectedAt: daysAgo(10) },
    { source: 'wtc-sao-paulo', firstExpectedAt: daysAgo(3) },
    { source: 'sp-cultura', firstExpectedAt: daysAgo(30) },
    { source: 'marcha-para-jesus', firstExpectedAt: daysAgo(30) },
  ];
  const ignore = ['admin-*', 'marcha-para-jesus'];

  it('alerta fonte esperada há X dias que nunca entregou', () => {
    const findings = evaluateNeverDelivered(expected, new Set(['sp-cultura']), ignore, config, NOW);
    expect(findings.map((f) => f.source)).toEqual(['anhembi']);
    expect(findings[0]).toMatchObject({ daysWaiting: 10 });
  });

  it('ainda dentro do prazo (3 de 7 dias) não alerta; fonte que já entregou não alerta', () => {
    expect(evaluateNeverDelivered([expected[1]], new Set(), ignore, config, NOW)).toEqual([]);
    expect(evaluateNeverDelivered([expected[0]], new Set(['anhembi']), ignore, config, NOW)).toEqual([]);
  });

  it('fonte ignorada não alerta; underscore e caixa são normalizados', () => {
    expect(evaluateNeverDelivered([expected[3]], new Set(), ignore, config, NOW)).toEqual([]);
    expect(
      evaluateNeverDelivered([{ source: 'serpapi_events', firstExpectedAt: daysAgo(9) }], new Set(['SerpApi-Events']), ignore, config, NOW),
    ).toEqual([]);
  });

  it('desligado não alerta; o prazo é configurável', () => {
    expect(evaluateNeverDelivered(expected, new Set(), ignore, { enabled: false, days: 7 }, NOW)).toEqual([]);
    expect(evaluateNeverDelivered([expected[1]], new Set(), ignore, { enabled: true, days: 2 }, NOW)).toHaveLength(1);
  });
});

describe('selectDueAlerts', () => {
  it('respeita o intervalo de realerta', () => {
    const findings = [{ source: 'a' }, { source: 'b' }, { source: 'c' }];
    const last = new Map([
      ['a', NOW.getTime() - 2 * 3_600_000], // alertado há 2 h: segura
      ['b', NOW.getTime() - 30 * 3_600_000], // há 30 h: reenvia
    ]);
    expect(selectDueAlerts(findings, last, 24, NOW).map((f) => f.source)).toEqual(['b', 'c']);
  });
});

/** Repositório de estado em memória (chave composta source+kind). */
function makeStateRepo() {
  const rows = new Map<string, any>();
  const k = (source: string, kind: string) => `${kind}:${source}`;
  return {
    rows,
    find: jest.fn(async ({ where }: any) => [...rows.values()].filter((r) => r.kind === where.kind)),
    upsert: jest.fn(async (items: any[]) => {
      for (const it of items) rows.set(k(it.source, it.kind), { ...rows.get(k(it.source, it.kind)), ...it });
    }),
    delete: jest.fn(async ({ kind, source }: any) => {
      for (const s of source.value as string[]) rows.delete(k(s, kind));
    }),
  };
}

describe('CollectorZeroYieldService + estado persistido', () => {
  const originalEnv = process.env;

  const qb = (rows: unknown[]) => {
    const builder: any = {};
    for (const m of ['select', 'addSelect', 'where', 'andWhere', 'setParameter', 'groupBy']) {
      builder[m] = jest.fn().mockReturnValue(builder);
    }
    builder.getRawMany = jest.fn().mockResolvedValue(rows);
    return builder;
  };

  const silentRow = {
    source: 'sp-cultura',
    lastSeenAt: new Date(Date.now() - 60 * 3_600_000).toISOString(),
    recentItems: '0',
    baselineItems: '25',
  };

  /** `delivered`: o que a consulta de fontes que já entregaram devolve (events.source). */
  function makeService(stateRepo: any, delivered: string[], sourceRows: unknown[] = []) {
    const eventSourceRepo: any = { createQueryBuilder: jest.fn(() => qb(sourceRows)) };
    const eventRepo: any = {
      createQueryBuilder: jest.fn(() => qb(delivered.map((source) => ({ source })))),
    };
    const mailer: any = { sendTextEmailCron: jest.fn().mockResolvedValue({ enviado: true, status: 201 }) };
    const state = new CollectorAlertStateService(stateRepo);
    return { service: new CollectorZeroYieldService(eventSourceRepo, eventRepo, mailer, undefined, state), mailer, state };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, ADMIN_ALERT_EMAIL: 'admin@example.com' };
    for (const key of ['API_FOOTBALL_KEY', 'SERPAPI_KEY', 'TAVILY_API_KEY', 'FIRECRAWL_API_KEY', 'GEMINI_API_KEY']) {
      delete process.env[key];
    }
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  const neverCalls = () =>
    (Sentry.captureMessage as jest.Mock).mock.calls.filter(
      ([msg]) => msg === 'Fonte de eventos configurada nunca entregou',
    );

  it('fonte configurada esperada há mais de X dias sem nenhum evento dispara alerta (Sentry + e-mail)', async () => {
    const repo = makeStateRepo();
    // anhembi é esperada desde há 10 dias; as demais já entregaram.
    repo.rows.set('expected:anhembi', { source: 'anhembi', kind: 'expected', firstExpectedAt: daysAgo(10) });
    const delivered = ['sp-cultura', 'usp-eventos', 'allianz-parque', 'sao-paulo-expo', 'expo-center-norte',
      'transamerica-expo', 'vibra-sao-paulo', 'tokio-marine-hall', 'espaco-unimed', 'wtc-sao-paulo'];
    const { service, mailer } = makeService(repo, delivered);

    await service.check();

    const calls = neverCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toMatchObject({ level: 'error', tags: { component: 'collector-never-delivered' } });
    expect((calls[0][1] as any).extra.alerts.map((a: any) => a.source)).toEqual(['anhembi']);
    expect(mailer.sendTextEmailCron).toHaveBeenCalledWith(
      { email: 'admin@example.com', name: 'My Urban Admin' },
      expect.stringContaining('nunca entregou'),
      expect.stringContaining('anhembi'),
    );
    expect(repo.rows.get('never_delivered:anhembi')?.lastAlertAt).toBeInstanceOf(Date);
  });

  it('o realerta sobrevive a reinício: uma instância nova lê o estado do banco e não repete', async () => {
    const repo = makeStateRepo();
    repo.rows.set('expected:anhembi', { source: 'anhembi', kind: 'expected', firstExpectedAt: daysAgo(10) });
    const delivered = ['sp-cultura', 'usp-eventos', 'allianz-parque', 'sao-paulo-expo', 'expo-center-norte',
      'transamerica-expo', 'vibra-sao-paulo', 'tokio-marine-hall', 'espaco-unimed', 'wtc-sao-paulo'];

    await makeService(repo, delivered).service.check();
    expect(neverCalls()).toHaveLength(1);

    // "deploy": outra instância do serviço, mesmo banco
    await makeService(repo, delivered).service.check();
    expect(neverCalls()).toHaveLength(1);

    // passado o intervalo de realerta (24 h), alerta de novo
    repo.rows.get('never_delivered:anhembi').lastAlertAt = new Date(Date.now() - 25 * 3_600_000);
    await makeService(repo, delivered).service.check();
    expect(neverCalls()).toHaveLength(2);
  });

  it('o realerta do zero-yield clássico também é persistido entre instâncias', async () => {
    const repo = makeStateRepo();
    const delivered = ['sp-cultura', 'anhembi', 'usp-eventos', 'allianz-parque', 'sao-paulo-expo', 'expo-center-norte',
      'transamerica-expo', 'vibra-sao-paulo', 'tokio-marine-hall', 'espaco-unimed', 'wtc-sao-paulo'];
    const zeroYieldCalls = () =>
      (Sentry.captureMessage as jest.Mock).mock.calls.filter(([msg]) => msg === 'Fonte de eventos sem dados (zero-yield)');

    await makeService(repo, delivered, [silentRow]).service.check();
    await makeService(repo, delivered, [silentRow]).service.check();

    expect(zeroYieldCalls()).toHaveLength(1);
    expect(repo.rows.get('zero_yield:sp-cultura')?.lastAlertAt).toBeInstanceOf(Date);
  });

  it('a espera só começa quando o cron vê a fonte: primeira execução grava firstExpectedAt e não alerta', async () => {
    const repo = makeStateRepo();
    const { service } = makeService(repo, []);
    await service.check();
    expect(repo.rows.get('expected:anhembi')?.firstExpectedAt).toBeInstanceOf(Date);
    expect(neverCalls()).toHaveLength(0);
  });

  it('o painel (persist=false) não inicia a contagem de espera', async () => {
    const repo = makeStateRepo();
    const { service } = makeService(repo, []);
    const { findings } = await service.currentNeverDelivered(NOW, { persist: false });
    expect(findings).toEqual([]);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('fonte que passa a entregar rearma: o estado esperado/alertado é limpo', async () => {
    const repo = makeStateRepo();
    repo.rows.set('expected:anhembi', { source: 'anhembi', kind: 'expected', firstExpectedAt: daysAgo(10) });
    repo.rows.set('never_delivered:anhembi', { source: 'anhembi', kind: 'never_delivered', lastAlertAt: daysAgo(1) });
    const delivered = ['anhembi', 'sp-cultura', 'usp-eventos', 'allianz-parque', 'sao-paulo-expo', 'expo-center-norte',
      'transamerica-expo', 'vibra-sao-paulo', 'tokio-marine-hall', 'espaco-unimed', 'wtc-sao-paulo'];
    await makeService(repo, delivered).service.check();
    expect(repo.rows.has('never_delivered:anhembi')).toBe(false);
    expect(neverCalls()).toHaveLength(0);
  });

  it('banco de estado indisponível cai para memória e o alerta continua funcionando', async () => {
    const repo = makeStateRepo();
    repo.find.mockRejectedValue(new Error('table missing'));
    repo.upsert.mockRejectedValue(new Error('table missing'));
    repo.delete.mockRejectedValue(new Error('table missing'));
    const { service } = makeService(repo, ['sp-cultura'], [silentRow]);
    await expect(service.check()).resolves.toMatchObject({ alerts: [expect.objectContaining({ source: 'sp-cultura' })] });
    await service.check();
    const zero = (Sentry.captureMessage as jest.Mock).mock.calls.filter(
      ([msg]) => msg === 'Fonte de eventos sem dados (zero-yield)',
    );
    expect(zero).toHaveLength(1); // memória segura o realerta
  });
});
