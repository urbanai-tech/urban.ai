import { expect, type Route, test } from '@playwright/test';
import { expectNoCriticalA11yViolations } from './a11y-helpers';
import { installLocalAuthFixture } from './local-auth-fixture';

/**
 * /admin/market-sources (ADR 0028) com API mockada: saúde por fonte e bairro, cobertura,
 * coleta própria desligada e upload do dataset licenciado com licença obrigatória.
 */

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const health = {
  generatedAt: '2026-10-31T12:00:00.000Z',
  config: { minHosts: 5, minExternalListings: 8, externalMaxAgeDays: 548, scrapingEnabled: false },
  sources: [
    { id: 'customers', label: 'Clientes My Urban', enabled: true, listings: 14, lastCollectedAt: null, stale: false },
    { id: 'licensed_dataset', label: 'Dataset licenciado', enabled: true, listings: 120, lastCollectedAt: '2026-10-01', stale: false },
    { id: 'inside_airbnb', label: 'Inside Airbnb', enabled: true, listings: 300, lastCollectedAt: '2024-01-01', stale: true },
    { id: 'own_scraping', label: 'Coleta própria', enabled: false, reason: 'aguardando parecer jurídico', listings: 0, lastCollectedAt: null, stale: false },
  ],
  neighborhoods: [
    { source: 'inside_airbnb', city: 'rio-de-janeiro', neighborhood: 'Copacabana', listings: 300, lastCollectedAt: '2024-01-01' },
    { source: 'licensed_dataset', city: 'sao-paulo', neighborhood: 'Pinheiros', listings: 120, lastCollectedAt: '2026-10-01' },
    { source: 'customers', city: 'São Paulo', neighborhood: 'Pinheiros', listings: 14, hosts: 9, lastCollectedAt: null },
  ],
  recentImports: [
    {
      id: 'imp-1',
      source: 'licensed:airroi',
      city: 'sao-paulo',
      license: 'licensed_internal_only',
      collectedAt: '2026-10-01',
      fileName: 'airroi.csv',
      rowsImported: 120,
      rowsSkipped: 2,
      observationsImported: 240,
      createdAt: '2026-10-02T10:00:00.000Z',
    },
  ],
  coverage: {
    activeProperties: 40,
    sampled: 40,
    withSufficientCompSet: 24,
    ratio: 0.6,
    target: 0.8,
    contributions: { customers: 10, licensed_dataset: 24 },
    cachedAt: '2026-10-31T12:00:00.000Z',
  },
};

test.describe('Admin · fontes de mercado (API mockada)', () => {
  test.beforeEach(async ({ page }) => {
    await installLocalAuthFixture(page, 'admin');
  });

  test('mostra saúde por fonte, cobertura, bairros e a coleta própria desligada', async ({ page }) => {
    await page.route('**/admin/market/health', (route) => json(route, health));
    await page.goto('/admin/market-sources');

    await expect(page.getByRole('heading', { name: 'Fontes de mercado' })).toBeVisible();
    const coverage = page.getByRole('region', { name: 'Cobertura de comp set' });
    await expect(coverage.getByText('60%')).toBeVisible();
    await expect(coverage.getByText('meta 80%', { exact: true })).toBeVisible();
    await expect(coverage.getByText('24 de 40 imóveis avaliados têm comp set suficiente (meta 80%).')).toBeVisible();

    const bySource = page.getByRole('region', { name: 'Por fonte' });
    await expect(bySource.getByRole('row', { name: /Dataset licenciado.*Atualizada/ })).toBeVisible();
    await expect(bySource.getByRole('row', { name: /Inside Airbnb.*Desatualizada/ })).toBeVisible();
    await expect(bySource.getByRole('row', { name: /Coleta própria.*Desligada.*aguardando parecer jurídico/ })).toBeVisible();

    const hints = page.getByRole('region', { name: 'O que fazer' });
    await expect(hints.getByText(/Inside Airbnb: dado desatualizado/)).toBeVisible();
    await expect(hints.getByText(/Coleta própria desligada \(aguardando parecer jurídico\)/)).toBeVisible();

    const neighborhoods = page.getByRole('region', { name: 'Volume por bairro' });
    await expect(neighborhoods.getByRole('row', { name: /Clientes.*Pinheiros.*14 · 9 anf\./ })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Importações recentes' }).getByText('licensed:airroi')).toBeVisible();
    await expectNoCriticalA11yViolations(page);
  });

  test('upload exige a licença (sem padrão) e valida antes de enviar', async ({ page }) => {
    let imports = 0;
    await page.route('**/admin/market/health', (route) => json(route, health));
    await page.route('**/admin/market/licensed-dataset/import', (route) => {
      imports += 1;
      return json(route, {});
    });
    await page.goto('/admin/market-sources');
    const upload = page.getByRole('region', { name: 'Enviar dataset licenciado' });

    await expect(upload.getByLabel('Licença contratada')).toHaveValue('');
    await upload.getByRole('button', { name: 'Importar dataset' }).click();
    await expect(upload.getByText('Escolha um arquivo CSV.')).toBeVisible();
    await expect(upload.getByText(/Escolha a licença contratada/)).toBeVisible();
    await expect(upload.getByText('Informe a data de coleta do arquivo.')).toBeVisible();
    await expect(upload.getByRole('alert')).toHaveText(/Corrija os campos destacados/);
    expect(imports).toBe(0);

    await upload.getByLabel('Mapeamento de colunas (opcional, JSON)').fill('{nao json');
    await upload.getByRole('button', { name: 'Importar dataset' }).click();
    await expect(upload.getByText(/Mapeamento não é um JSON válido/)).toBeVisible();
    expect(imports).toBe(0);
  });

  test('envia o CSV com licença, data de coleta e mapeamento, e mostra o resultado', async ({ page }) => {
    let healthCalls = 0;
    let uploaded = '';
    await page.route('**/admin/market/health', (route) => {
      healthCalls += 1;
      return json(route, health);
    });
    await page.route('**/admin/market/licensed-dataset/import', (route) => {
      uploaded = route.request().postData() ?? '';
      return json(route, {
        batchId: 'batch-1',
        source: 'licensed:airroi',
        parsed: 27,
        imported: 12,
        skipped: 3,
        skippedReasons: { 'sem id do anúncio': 1, 'coordenadas inválidas': 1, 'diária fora do intervalo plausível': 1 },
        observations: 24,
        collectedAt: '2026-10-01',
        warnings: ['3 linha(s) puladas; veja o motivo em skippedReasons.'],
      });
    });
    await page.goto('/admin/market-sources');
    const upload = page.getByRole('region', { name: 'Enviar dataset licenciado' });

    await upload.getByLabel('Arquivo CSV').setInputFiles({
      name: 'amostra-sintetica.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('listing_id,latitude,longitude,adr\nsyn-1,-23.56,-46.68,300\n'),
    });
    await upload.getByLabel('Fornecedor (rótulo)').fill('airroi');
    await upload.getByLabel('Data de coleta do arquivo').fill('2026-10-01');
    await upload.getByLabel('Licença contratada').selectOption('licensed_internal_only');
    await upload.getByLabel('Mapeamento de colunas (opcional, JSON)').fill('{"adr":"preco"}');
    await upload.getByRole('button', { name: 'Importar dataset' }).click();

    const result = page.getByRole('status').filter({ hasText: 'licensed:airroi' });
    await expect(result).toBeVisible();
    await expect(result.getByText('1 linha(s): sem id do anúncio')).toBeVisible();
    await expect(result.getByText('1 linha(s): coordenadas inválidas')).toBeVisible();
    for (const field of ['name="datasetLabel"', 'airroi', 'name="license"', 'licensed_internal_only', 'name="collectedAt"', '2026-10-01', 'name="mapping"', '{"adr":"preco"}', 'amostra-sintetica.csv']) {
      expect(uploaded).toContain(field);
    }
    await expect.poll(() => healthCalls).toBeGreaterThan(1); // a saúde recarrega depois do import
  });

  test('erro do servidor no upload aparece como mensagem e não limpa o formulário', async ({ page }) => {
    await page.route('**/admin/market/health', (route) => json(route, health));
    await page.route('**/admin/market/licensed-dataset/import', (route) =>
      json(route, { message: 'mapeamento inválido: coluna "preco" (campo adr) não existe no arquivo' }, 400),
    );
    await page.goto('/admin/market-sources');
    const upload = page.getByRole('region', { name: 'Enviar dataset licenciado' });
    await upload.getByLabel('Arquivo CSV').setInputFiles({ name: 'x.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2\n') });
    await upload.getByLabel('Fornecedor (rótulo)').fill('airroi');
    await upload.getByLabel('Data de coleta do arquivo').fill('2026-10-01');
    await upload.getByLabel('Licença contratada').selectOption('cc_by_4');
    await upload.getByRole('button', { name: 'Importar dataset' }).click();

    await expect(page.getByText(/mapeamento inválido: coluna "preco"/)).toBeVisible();
    await expect(upload.getByLabel('Fornecedor (rótulo)')).toHaveValue('airroi');
  });

  test('erro de carga mostra estado próprio e tenta de novo', async ({ page }) => {
    let calls = 0;
    await page.route('**/admin/market/health', (route) => {
      calls += 1;
      return calls === 1 ? json(route, { message: 'falha' }, 500) : json(route, health);
    });
    await page.goto('/admin/market-sources');
    await expect(page.getByText('Falha ao carregar')).toBeVisible();
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await expect(page.getByRole('heading', { name: 'Fontes de mercado' })).toBeVisible();
  });
});
