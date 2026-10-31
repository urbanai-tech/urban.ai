import { expect, test, type Page } from '@playwright/test';
import { expectNoCriticalA11yViolations } from './a11y-helpers';
import { installLocalAuthFixture } from './local-auth-fixture';

/**
 * /admin/event-coverage/reference (ADR 0026) com a API mockada: fila de conflitos,
 * aprovar/rejeitar, curadoria, import CSV, métricas e série.
 */

const conflict = {
  id: 'ref-conflito-1',
  name: 'Palmeiras x Corinthians',
  venueKey: 'allianz-parque',
  venueName: 'Allianz Parque',
  startsAt: '2026-11-10T22:00:00.000Z',
  dateKey: '2026-11-10',
  city: 'São Paulo',
  category: 'esporte',
  size: 'grande',
  status: 'conflito',
  origin: 'curadoria',
  evidenceUrls: ['https://www.sympla.com.br/evento/1'],
  votesSupport: 2,
  votesAgainst: 0,
  approvedBy: null,
  approvedAt: null,
  decisionNote: null,
  conflictReason: 'divergência de data com "Palmeiras x Corinthians" (2026-11-11)',
  matchedEventId: null,
  matchedAt: null,
  votes: [
    {
      id: 'v1',
      validatorKey: 'web:sympla.com.br',
      validatorKind: 'tavily',
      verdict: 'support',
      sourceUrl: 'https://www.sympla.com.br/evento/1',
      extractor: 'gemini',
      observedName: 'Palmeiras x Corinthians',
      observedDate: '2026-11-10',
      observedVenue: 'Allianz Parque',
      snippet: 'Página sympla',
      createdAt: '2026-11-01T06:00:00.000Z',
    },
    {
      id: 'v2',
      validatorKey: 'db:eventbrite',
      validatorKind: 'events_db',
      verdict: 'support',
      sourceUrl: null,
      extractor: 'none',
      observedName: 'Palmeiras x Corinthians',
      observedDate: '2026-11-11',
      observedVenue: 'Allianz Parque',
      snippet: 'Evento ingerido pela fonte eventbrite',
      createdAt: '2026-11-01T06:00:00.000Z',
    },
  ],
};

const approvedItem = {
  ...conflict,
  id: 'ref-ok-1',
  name: 'Show Aprovado',
  status: 'aprovado',
  approvedBy: 'auto-consenso',
  conflictReason: null,
  matchedEventId: 'evt-1',
};

const metricRow = (over: Record<string, unknown>) => ({
  scope: 'past30',
  dimension: 'total',
  dimensionValue: 'all',
  referenceTotal: 0,
  referenceMatched: 0,
  recallPct: null,
  precisionSample: null,
  precisionConfirmed: null,
  precisionRefuted: null,
  precisionPct: null,
  ...over,
});

const metrics = {
  latestDate: '2026-11-20',
  floorPct: 70,
  rows: [
    metricRow({ referenceTotal: 30, referenceMatched: 20, recallPct: 66.67 }),
    metricRow({ scope: 'next90', referenceTotal: 10, referenceMatched: 9, recallPct: 90, precisionSample: 40, precisionConfirmed: 38, precisionRefuted: 1, precisionPct: 95 }),
    metricRow({ dimension: 'size', dimensionValue: 'grande', referenceTotal: 12, referenceMatched: 11, recallPct: 91.67 }),
    metricRow({ dimension: 'size', dimensionValue: 'medio', referenceTotal: 18, referenceMatched: 9, recallPct: 50 }),
  ],
  series: [
    { date: '2026-11-18', recallPast30Pct: 60, recallNext90Pct: 85, precisionPct: 94, referencePast30: 28 },
    { date: '2026-11-19', recallPast30Pct: 64, recallNext90Pct: 88, precisionPct: 95, referencePast30: 29 },
    { date: '2026-11-20', recallPast30Pct: 66.67, recallNext90Pct: 90, precisionPct: 95, referencePast30: 30 },
  ],
};

const config = {
  config: {
    curationEnabled: false,
    metricsEnabled: true,
    horizonDays: 90,
    minAgree: 2,
    maxSearchCalls: 30,
    maxScrapeCalls: 12,
    maxLlmCalls: 60,
    maxJudgeCalls: 20,
    recallFloorPct: 70,
  },
  providers: { tavily: false, serpapi: false, firecrawl: false, gemini: false, anthropic: false },
  venues: [{ key: 'allianz-parque', name: 'Allianz Parque', size: 'grande', officialUrl: null }],
  venuesSource: 'seed',
  warnings: [
    'Sem chaves para validar fora do banco: a curadoria só gera candidatos para a fila humana.',
    'ANTHROPIC_API_KEY ausente: sem juiz independente.',
  ],
  counts: { aprovado: 30, candidato: 5, conflito: 1, rejeitado: 2 },
  csvTemplate: 'nome,venue,dataInicio\n',
};

type Calls = { approve: string[]; reject: string[]; curate: number; match: number; importBodies: string[] };

async function mockApi(page: Page, options: { conflicts?: unknown[] } = {}) {
  const calls: Calls = { approve: [], reject: [], curate: 0, match: 0, importBodies: [] };
  let conflicts = options.conflicts ?? [conflict];
  const json = (body: unknown, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

  await page.route('**/admin/event-reference/config', (route) => route.fulfill(json(config)));
  await page.route('**/admin/event-reference/metrics**', (route) => route.fulfill(json(metrics)));
  await page.route('**/admin/event-reference/conflicts', (route) => route.fulfill(json({ items: conflicts })));
  await page.route('**/admin/event-reference/missing**', (route) =>
    route.fulfill(json({ items: [{ id: 'm1', name: 'Festival Fantasma', venueName: 'Audio', dateKey: '2026-11-12', size: 'medio', category: 'show' }] })),
  );
  await page.route(/\/admin\/event-reference(\?.*)?$/, (route) =>
    route.fulfill(json({ items: [approvedItem, ...(conflicts as typeof approvedItem[])], total: 2, page: 1, limit: 15 })),
  );
  await page.route('**/admin/event-reference/*/approve', async (route) => {
    calls.approve.push(route.request().url().split('/').slice(-2)[0]);
    conflicts = [];
    await route.fulfill(json({ ...conflict, status: 'aprovado', approvedBy: 'admin-e2e' }));
  });
  await page.route('**/admin/event-reference/*/reject', async (route) => {
    calls.reject.push(route.request().url().split('/').slice(-2)[0]);
    conflicts = [];
    await route.fulfill(json({ ...conflict, status: 'rejeitado', approvedBy: 'admin-e2e' }));
  });
  await page.route('**/admin/event-reference/curate', async (route) => {
    calls.curate += 1;
    await route.fulfill(
      json({
        id: 'run-1',
        name: 'event-reference-curation',
        status: 'success',
        errorMessage: null,
        result: {
          venuesProcessed: 17,
          venuesTotal: 17,
          observations: 24,
          referencesCreated: 5,
          referencesTouched: 9,
          approvedAuto: 3,
          conflicts: 1,
          candidates: 5,
          warnings: ['ANTHROPIC_API_KEY ausente: sem juiz independente.'],
          budgetExhausted: [],
        },
      }),
    );
  });
  await page.route('**/admin/event-reference/match', async (route) => {
    calls.match += 1;
    await route.fulfill(
      json({
        id: 'run-2',
        name: 'event-coverage-match-metrics',
        status: 'success',
        errorMessage: null,
        result: { snapshotDate: '2026-11-20', referencesChecked: 30, matched: 20, unmatched: 10, recallPast30Pct: 66.67, precisionPct: 95, alerted: false },
      }),
    );
  });
  await page.route('**/admin/event-reference/import-csv', async (route) => {
    calls.importBodies.push(route.request().postData() ?? '');
    await route.fulfill(
      json({
        parsedRows: 3,
        created: 2,
        updated: 0,
        unchanged: 0,
        invalidRows: [{ line: 4, reason: 'data inválida (use AAAA-MM-DD, ISO ou dd/mm/aaaa)' }],
      }),
    );
  });
  return calls;
}

test.describe('Admin - lista de referência de eventos', () => {
  test.beforeEach(async ({ page }) => {
    await installLocalAuthFixture(page, 'admin');
  });

  test('mostra recall, precisão, avisos de configuração, série e recortes', async ({ page }) => {
    await mockApi(page);
    await page.goto('/admin/event-coverage/reference');

    await expect(page).toHaveTitle(/Lista de referência de eventos · Admin · My Urban/);
    await expect(page.getByRole('heading', { name: 'Lista de referência', level: 1 })).toBeVisible();
    await expect(page.getByText(/Sem chaves para validar fora do banco/)).toBeVisible();
    await expect(page.getByText(/ANTHROPIC_API_KEY ausente/).first()).toBeVisible();

    const kpis = page.getByRole('region', { name: 'Recall e precisão' });
    await expect(kpis.getByText('66,7%').first()).toBeVisible();
    await expect(kpis.getByText('20 de 30 referências no radar')).toBeVisible();
    await expect(kpis.getByText('38 de 40 confirmados (1 refutados)')).toBeVisible();
    await expect(kpis.getByText('95%').first()).toBeVisible();
    await expect(kpis.getByText('70%')).toBeVisible();

    await expect(page.getByRole('img', { name: /Recall diário, de 60% em 18\/11\/2026 a 66,7% em 20\/11\/2026/ })).toBeVisible();

    const breakdown = page.getByRole('region', { name: 'Recall por dimensão' });
    await expect(breakdown.getByRole('row', { name: /Grande.*91,7%/ })).toBeVisible();
    await expect(breakdown.getByRole('row', { name: /Médio.*50%/ })).toBeVisible();

    await expect(page.getByRole('region', { name: 'Referências que o radar não achou' }).getByText('Festival Fantasma')).toBeVisible();
  });

  test('fila de conflitos: mostra os votos de cada validador e aprova com um clique', async ({ page }) => {
    const calls = await mockApi(page);
    await page.goto('/admin/event-coverage/reference');

    const queue = page.getByRole('region', { name: 'Fila de conflitos' });
    await expect(queue.getByText('FILA DE CONFLITOS · 1')).toBeVisible();
    await expect(queue.getByText('Palmeiras x Corinthians').first()).toBeVisible();
    await expect(queue.getByText(/divergência de data/)).toBeVisible();
    const votes = queue.getByRole('list', { name: /Votos dos validadores para Palmeiras x Corinthians/ });
    await expect(votes.getByText('sympla.com.br')).toBeVisible();
    await expect(votes.getByText('Banco · eventbrite')).toBeVisible();
    await expect(votes.getByRole('link', { name: 'Abrir fonte' })).toHaveAttribute('href', 'https://www.sympla.com.br/evento/1');

    await queue.getByRole('button', { name: 'Aprovar Palmeiras x Corinthians' }).click();

    await expect.poll(() => calls.approve).toEqual(['ref-conflito-1']);
    await expect(queue.getByText(/Nenhum conflito para revisar/)).toBeVisible();
    expect(calls.reject).toEqual([]);
  });

  test('fila de conflitos: rejeitar registra a decisão e esvazia a fila', async ({ page }) => {
    const calls = await mockApi(page);
    await page.goto('/admin/event-coverage/reference');

    const queue = page.getByRole('region', { name: 'Fila de conflitos' });
    await queue.getByRole('button', { name: 'Rejeitar Palmeiras x Corinthians' }).click();

    await expect.poll(() => calls.reject).toEqual(['ref-conflito-1']);
    await expect(queue.getByText(/Nenhum conflito para revisar/)).toBeVisible();
    expect(calls.approve).toEqual([]);
  });

  test('rodar a curadoria pede confirmação e mostra o resumo da execução', async ({ page }) => {
    const calls = await mockApi(page);
    await page.goto('/admin/event-coverage/reference');

    await page.getByRole('button', { name: 'Rodar curadoria' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Rodar a curadoria agora?' })).toBeVisible();
    await expect(dialog.getByText(/tetos de chamadas/)).toBeVisible();
    expect(calls.curate).toBe(0);
    await dialog.getByRole('button', { name: 'Rodar curadoria' }).click();

    await expect(page.getByText(/17\/17 venues, 24 observações, 9 referências \(3 aprovadas, 1 em conflito, 5 candidatas\)/)).toBeVisible();
    expect(calls.curate).toBe(1);

    await page.getByRole('button', { name: 'Recalcular métricas' }).click();
    await expect(page.getByText(/20 de 30 referências no radar; recall 30 d 66,7%; precisão 95%/)).toBeVisible();
    expect(calls.match).toBe(1);
  });

  test('importa CSV e lista as linhas inválidas', async ({ page }) => {
    const calls = await mockApi(page);
    await page.goto('/admin/event-coverage/reference');

    const csv = 'nome,venue,dataInicio\nShow A,Audio,2026-12-01\nShow B,Audio,2026-12-02\nShow C,Audio,31/02/2026\n';
    await page.getByLabel('Arquivo CSV').setInputFiles({ name: 'referencia.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.getByLabel('Entrar como').selectOption('candidato');
    await page.getByRole('button', { name: 'Importar' }).click();

    await expect(page.getByText(/3 linhas lidas: 2 criadas, 0 atualizadas, 0 sem mudança, 1 inválidas/)).toBeVisible();
    await expect(page.getByText(/Linha 4: data inválida/)).toBeVisible();
    expect(calls.importBodies).toHaveLength(1);
    expect(calls.importBodies[0]).toContain('name="status"');
    expect(calls.importBodies[0]).toContain('candidato');
    expect(calls.importBodies[0]).toContain('Show A,Audio,2026-12-01');
  });

  test('a lista filtra por status via API e a página não tem violations críticas (axe)', async ({ page }) => {
    await mockApi(page);
    const statuses: Array<string | null> = [];
    await page.route(/\/admin\/event-reference\?.*status=/, async (route) => {
      statuses.push(new URL(route.request().url()).searchParams.get('status'));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [approvedItem], total: 1, page: 1, limit: 15 }),
      });
    });
    await page.goto('/admin/event-coverage/reference');
    await page.getByRole('region', { name: 'Fila de conflitos' }).waitFor({ state: 'visible' });

    await page.getByLabel('Status').selectOption('aprovado');
    await expect.poll(() => statuses).toContain('aprovado');
    await expect(page.getByRole('region', { name: 'Lista de referência' }).getByText('Show Aprovado')).toBeVisible();

    await expectNoCriticalA11yViolations(page);
  });

  test('sem medição ainda, explica o que fazer em vez de mostrar zeros', async ({ page }) => {
    await mockApi(page);
    await page.route('**/admin/event-reference/metrics**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ latestDate: null, floorPct: 70, rows: [], series: [] }) }),
    );
    await page.goto('/admin/event-coverage/reference');
    await expect(page.getByText(/Ainda não há medição/)).toBeVisible();
    await expect(page.getByText(/A série começa no primeiro dia/)).toBeVisible();
  });
});
