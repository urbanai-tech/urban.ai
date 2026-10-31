import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoCriticalA11yViolations } from './a11y-helpers';
import { installLocalAuthFixture } from './local-auth-fixture';

/**
 * Admin unificado de eventos (frente EVB): /admin/event-coverage com abas Cobertura, Qualidade,
 * Regiões e Mudanças; /admin/coverage vira redirect. 100% mockado (sem backend).
 */

const DAYS = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);

const coverageReport = {
  generatedAt: '2026-10-31T15:00:00.000Z',
  timezone: 'America/Sao_Paulo',
  today: '2026-10-31',
  scope: { description: 'Eventos canônicos e ativos em SP.', regions: [{ name: 'Grande São Paulo', status: 'active' }] },
  target: { events30d: 100, minGeocodedPct: 80 },
  status: 'at_risk',
  reasons: [
    {
      code: 'source_never_delivered',
      severity: 'warning',
      source: 'anhembi',
      message: 'anhembi: configurada há 10 dias e nunca entregou eventos.',
    },
  ],
  counts: { next7d: 22, next30d: 118, next90d: 240, next30dFromHealthySources: 100 },
  quality: { geocodedPct: 91.5, withCategoryPct: 74.2, missingGeocode30d: 10, missingCategory30d: 30 },
  duplicatesPendingReview: { total: 4, high: 1 },
  histogram: DAYS.map((date, i) => ({ date, count: i % 4 })),
  sources: [
    {
      source: 'sympla-api',
      events30d: 90,
      lastIngestAt: '2026-10-31T13:00:00.000Z',
      hoursSinceLastIngest: 2,
      windowHours: 36,
      health: 'healthy',
    },
    {
      source: 'anhembi',
      events30d: 0,
      lastIngestAt: null,
      hoursSinceLastIngest: null,
      windowHours: 36,
      health: 'never_delivered',
      daysWaiting: 10,
    },
  ],
};

const leadTime = {
  generatedAt: '2026-10-31T15:00:00.000Z',
  windowDays: 90,
  sample: 140,
  targetMedianDays: 21,
  overall: { count: 132, medianDays: 18.5, p25Days: 7, p75Days: 33, meanDays: 22.1 },
  lateDiscovered: 8,
  distribution: [
    { key: 'd0_6', label: '0 a 6 dias', count: 20 },
    { key: 'd7_13', label: '7 a 13 dias', count: 25 },
    { key: 'd14_29', label: '14 a 29 dias', count: 40 },
    { key: 'd30_59', label: '30 a 59 dias', count: 35 },
    { key: 'd60_plus', label: '60 dias ou mais', count: 12 },
  ],
  bySource: [
    { key: 'sympla-api', count: 90, medianDays: 21, p25Days: 9, p75Days: 35, meanDays: 24 },
    { key: 'allianz-parque', count: 12, medianDays: 45, p25Days: 30, p75Days: 60, meanDays: 44 },
  ],
  byCategory: [{ key: 'show', count: 70, medianDays: 20, p25Days: 8, p75Days: 34, meanDays: 23 }],
  bySize: [
    { key: 'large', count: 18, medianDays: 41, p25Days: 28, p75Days: 58, meanDays: 42 },
    { key: 'unknown', count: 60, medianDays: 12, p25Days: 5, p75Days: 22, meanDays: 15 },
  ],
};

const changesReport = (types: string | null) => {
  const all = [
    {
      id: 'c1',
      eventId: 'e1',
      eventName: 'Show da Banda X',
      eventDate: '2026-12-05T22:00:00.000Z',
      changeType: 'rescheduled',
      field: 'dataInicio',
      oldValue: '2026-11-20T22:00:00.000Z',
      newValue: '2026-12-05T22:00:00.000Z',
      source: 'sympla-api',
      detectedAt: '2026-10-30T12:00:00.000Z',
    },
    {
      id: 'c2',
      eventId: 'e2',
      eventName: 'Feira Y',
      eventDate: '2026-11-15T13:00:00.000Z',
      changeType: 'possibly_cancelled',
      field: 'lastSeenAt',
      oldValue: '2026-10-20T15:00:00.000Z',
      newValue: null,
      source: 'sp-cultura',
      detectedAt: '2026-10-31T09:15:00.000Z',
    },
    {
      id: 'c3',
      eventId: 'e3',
      eventName: 'Jogo Z',
      eventDate: '2026-11-22T19:00:00.000Z',
      changeType: 'cancelled',
      field: 'status',
      oldValue: null,
      newValue: 'cancelled',
      source: 'api-football',
      detectedAt: '2026-10-29T10:00:00.000Z',
    },
  ];
  const wanted = types ? types.split(',') : null;
  return {
    generatedAt: '2026-10-31T15:00:00.000Z',
    timezone: 'America/Sao_Paulo',
    config: { enabled: true, possiblyCancelledDays: 7, applyReschedule: false },
    summary: {
      windowDays: 30,
      firstSeen: 64,
      rescheduled: 3,
      venueChanged: 1,
      urlChanged: 2,
      cancelled: 1,
      postponed: 0,
      possiblyCancelled: 5,
      reappeared: 1,
    },
    series: DAYS.slice(0, 30).map((date, i) => ({
      date,
      firstSeen: (i * 3) % 7,
      rescheduled: i === 5 ? 2 : 0,
      cancelled: i === 8 ? 1 : 0,
      possiblyCancelled: i === 12 ? 3 : 0,
    })),
    recent: wanted ? all.filter((c) => wanted.includes(c.changeType)) : all,
  };
};

const regions = [
  {
    id: 'r1',
    name: 'Grande São Paulo',
    status: 'active',
    centerLat: -23.55,
    centerLng: -46.63,
    radiusKm: 80,
    minLat: null,
    maxLat: null,
    minLng: null,
    maxLng: null,
    notes: 'Região principal',
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
  },
];

/** Resposta de API; navegação do documento (mesma URL de página) segue para o Next. */
async function json(route: Route, body: unknown) {
  if (route.request().resourceType() === 'document') return route.continue();
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockAdminCoverage(page: Page, seen: { changes: URLSearchParams[] } = { changes: [] }) {
  await page.route('**/admin/event-coverage', (route) => json(route, coverageReport));
  await page.route('**/admin/event-coverage/lead-time**', (route) => json(route, leadTime));
  await page.route('**/admin/event-coverage/changes**', (route) => {
    const params = new URL(route.request().url()).searchParams;
    seen.changes.push(params);
    return json(route, changesReport(params.get('types')));
  });
  await page.route('**/admin/coverage', (route) => json(route, regions));
  await page.route('**/admin/coverage/stats', (route) =>
    json(route, { activeRegions: 1, bootstrapRegions: 0, addresses: 12, addressRadiusKm: 80 }),
  );
}

test.describe('Admin unificado: cobertura de eventos (EVB)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installLocalAuthFixture(page, 'admin');
  });

  test('abre em Cobertura com lead time, remarcados e fonte que nunca entregou', async ({ page }) => {
    await mockAdminCoverage(page);
    await page.goto('/admin/event-coverage', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { level: 1, name: 'Cobertura de eventos' })).toBeVisible();
    const tabs = page.getByRole('tablist', { name: 'Seções da cobertura de eventos' });
    await expect(tabs.getByRole('tab')).toHaveText(['Cobertura', 'Qualidade', 'Regiões', 'Mudanças']);
    await expect(tabs.getByRole('tab', { name: 'Cobertura' })).toHaveAttribute('aria-selected', 'true');

    await expect(page.getByText('de 100 (meta)')).toBeVisible();
    await expect(page.getByText('Lead time mediano')).toBeVisible();
    await expect(page.getByText('18,5 d').first()).toBeVisible();
    await expect(page.getByText('Remarcados (30 d)')).toBeVisible();
    await expect(page.getByText('Possivelmente cancelados (30 d)')).toBeVisible();

    // Fonte configurada que nunca entregou aparece na tabela e nas dicas.
    await expect(page.getByText('Nunca entregou', { exact: true })).toBeVisible();
    await expect(page.getByText('Fonte anhembi configurada, mas nunca entregou')).toBeVisible();
  });

  test('Qualidade mostra lacunas, distribuição de lead time e o lugar de referência e recall', async ({ page }) => {
    await mockAdminCoverage(page);
    await page.goto('/admin/event-coverage', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Qualidade' }).click();

    await expect(page).toHaveURL(/\/admin\/event-coverage\?tab=qualidade$/);
    await expect(page.getByRole('tab', { name: 'Qualidade' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('link', { name: 'Abrir referência e recall' })).toHaveAttribute(
      'href',
      '/admin/event-coverage/reference',
    );
    await expect(page.getByText('Com coordenadas')).toBeVisible();
    await expect(page.getByText('Abaixo da meta')).toBeVisible();
    await expect(page.getByRole('progressbar', { name: '14 a 29 dias: 40 evento(s)' })).toBeVisible();
    await expect(page.getByText('allianz-parque')).toBeVisible();
    await expect(page.getByText('Grande (10 mil+)')).toBeVisible();
  });

  test('Mudanças lista remarcados e cancelados, mostra a série diária e filtra por tipo', async ({ page }) => {
    const seen = { changes: [] as URLSearchParams[] };
    await mockAdminCoverage(page, seen);
    await page.goto('/admin/event-coverage?tab=mudancas', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('tab', { name: 'Mudanças' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Show da Banda X')).toBeVisible();
    await expect(page.getByText('20/11 19:00 → 05/12 19:00')).toBeVisible();
    await expect(page.getByText('Feira Y')).toBeVisible();
    await expect(page.getByText('Possivelmente cancelado', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('img', { name: /Mudanças por dia nos últimos 30 dias: 2 remarcados, 1 cancelados, 3 possivelmente cancelados/ })).toBeVisible();
    await expect(page.getByRole('img', { name: /Eventos novos por dia/ })).toBeVisible();

    await page.getByLabel('Tipo').selectOption('cancelled');
    await expect(page.getByText('Jogo Z')).toBeVisible();
    await expect(page.getByText('Show da Banda X')).toHaveCount(0);
    expect(seen.changes.at(-1)?.get('types')).toBe('cancelled');

    await page.getByLabel('Janela').selectOption('90');
    await expect.poll(() => seen.changes.at(-1)?.get('days')).toBe('90');
  });

  test('Regiões mostra o CRUD de regiões dentro da página unificada', async ({ page }) => {
    await mockAdminCoverage(page);
    await page.goto('/admin/event-coverage?tab=regioes', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('tab', { name: 'Regiões' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Região principal')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nova região' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Testar ponto' })).toBeVisible();
    // Um único h1 na página (o painel não repete o título).
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('/admin/coverage redireciona para a aba Regiões', async ({ page }) => {
    await mockAdminCoverage(page);
    await page.goto('/admin/coverage', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/admin\/event-coverage\?tab=regioes$/);
    await expect(page.getByRole('tab', { name: 'Regiões' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Região principal')).toBeVisible();
  });

  test('navegação por teclado entre abas (setas, Home, End) e a barra lateral tem uma entrada só', async ({ page }) => {
    await mockAdminCoverage(page);
    await page.goto('/admin/event-coverage', { waitUntil: 'domcontentloaded' });

    await page.getByRole('tab', { name: 'Cobertura' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Qualidade' })).toBeFocused();
    await expect(page.getByRole('tab', { name: 'Qualidade' })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Mudanças' })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.getByRole('tab', { name: 'Cobertura' })).toHaveAttribute('aria-selected', 'true');

    const nav = page.getByRole('navigation', { name: 'Seções do admin' }).first();
    await expect(nav.getByRole('link', { name: 'Cobertura de eventos' })).toHaveCount(1);
    await expect(nav.getByRole('link', { name: 'Regiões de cobertura' })).toHaveCount(0);
  });

  test('falha do lead time não derruba a página', async ({ page }) => {
    await mockAdminCoverage(page);
    await page.route('**/admin/event-coverage/lead-time**', (route) =>
      route.request().resourceType() === 'document'
        ? route.continue()
        : route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"erro"}' }),
    );
    await page.goto('/admin/event-coverage', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('de 100 (meta)')).toBeVisible();
    await page.getByRole('tab', { name: 'Qualidade' }).click();
    await expect(page.getByText('Não foi possível carregar o lead time agora.')).toBeVisible();
  });

  test('sem violações críticas de acessibilidade nas abas', async ({ page }) => {
    await mockAdminCoverage(page);
    for (const tab of ['', 'qualidade', 'mudancas', 'regioes']) {
      await page.goto(`/admin/event-coverage${tab ? `?tab=${tab}` : ''}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('tabpanel')).toBeVisible();
      await expect(page.getByRole('tabpanel').getByText(/Carregando|Tentar novamente/)).toHaveCount(0);
      await expectNoCriticalA11yViolations(page);
    }
  });
});
