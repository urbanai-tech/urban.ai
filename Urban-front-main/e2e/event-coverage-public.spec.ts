import { expect, test, type Page } from '@playwright/test';
import { expectNoCriticalA11yViolations } from './a11y-helpers';
import { acceptCookieConsent } from './test-helpers';

/**
 * Página pública /cobertura-de-eventos (ADR 0026) com a API mockada.
 *
 * O servidor do Next não enxerga o mock do navegador; por isso o resumo que importa
 * para o teste vem da leitura do navegador (page.route), que é a mesma que atualiza a página
 * em produção. Sem resposta válida a página fica no estado honesto "em medição".
 */

const measuring = {
  status: 'measuring',
  measuredAt: '2026-11-20',
  measuringSince: '2026-11-10',
  daysMeasured: 11,
  minWeeks: 4,
  recallLargeEventsPct: null,
  largeEventsSample: 3,
  eventsTracked: 42,
  venuesCovered: 9,
  message: 'Estamos medindo.',
};

const measured = {
  status: 'measured',
  measuredAt: '2026-12-01',
  measuringSince: '2026-11-01',
  daysMeasured: 31,
  minWeeks: 4,
  recallLargeEventsPct: 92.4,
  largeEventsSample: 25,
  eventsTracked: 70,
  venuesCovered: 12,
  message: 'ok',
};

async function mockCoverage(page: Page, body: unknown, status = 200) {
  await page.route('**/public/event-coverage', async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(body),
    });
  });
}

test.describe('Cobertura de eventos - página pública', () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookieConsent(page);
  });

  test('antes de 4 semanas mostra "em medição", sem número de recall, e os agregados', async ({ page }) => {
    await mockCoverage(page, measuring);
    await page.goto('/cobertura-de-eventos');

    await expect(page).toHaveTitle(/Cobertura de eventos de São Paulo \| My Urban AI/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('realmente enxerga');

    const stats = page.getByTestId('coverage-stats');
    await expect(stats).toHaveAttribute('data-status', 'measuring');
    await expect(stats.getByText('Em medição', { exact: true })).toBeVisible();
    await expect(stats.getByText('Medição em andamento')).toBeVisible();
    await expect(stats.getByText(/Só publicamos o percentual depois de 4 semanas/)).toBeVisible();
    await expect(stats.getByRole('progressbar', { name: /das 4 semanas de medição/ })).toBeVisible();
    await expect(stats.locator('dd').nth(0)).toHaveText('42');
    await expect(stats.locator('dd').nth(1)).toHaveText('9');
    await expect(stats.locator('dd').nth(2)).toHaveText('20/11/2026');
    // O percentual de recall não aparece (só o "x% das 4 semanas" da barra de andamento).
    await expect(stats.getByText(/dos grandes eventos de São Paulo/)).toHaveCount(0);
  });

  test('com 4 semanas de medição publica o recall dos grandes eventos', async ({ page }) => {
    await mockCoverage(page, measured);
    await page.goto('/cobertura-de-eventos');

    const stats = page.getByTestId('coverage-stats');
    await expect(stats).toHaveAttribute('data-status', 'measured');
    await expect(stats.getByText('92,4%', { exact: true })).toBeVisible();
    await expect(stats.getByText('92,4% dos grandes eventos de São Paulo')).toBeVisible();
    await expect(stats.getByText(/25 grandes eventos da nossa lista de referência/)).toBeVisible();
    await expect(stats.locator('dd').nth(0)).toHaveText('70');
    await expect(stats.locator('dd').nth(1)).toHaveText('12');
    await expect(stats.locator('dd').nth(2)).toHaveText('01/12/2026');
    await expect(stats.getByRole('progressbar')).toHaveCount(0);
  });

  test('payload inválido ou erro da API não vira número: continua em medição', async ({ page }) => {
    await mockCoverage(page, { status: 'measured', recallLargeEventsPct: 99 });
    await page.goto('/cobertura-de-eventos');
    const stats = page.getByTestId('coverage-stats');
    await expect(stats).toHaveAttribute('data-status', 'measuring');
    await expect(stats.getByText('Em medição', { exact: true })).toBeVisible();
    await expect(stats.getByText('99%')).toHaveCount(0);

    await page.unroute('**/public/event-coverage');
    await mockCoverage(page, { message: 'erro' }, 500);
    await page.reload();
    await expect(page.getByTestId('coverage-stats')).toHaveAttribute('data-status', 'measuring');
  });

  test('tem SEO do site público, explica o método e está linkada no rodapé', async ({ page }) => {
    await mockCoverage(page, measuring);
    await page.goto('/cobertura-de-eventos');

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/cobertura-de-eventos$/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /recall/i);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Cobertura de eventos/);
    await expect(page.getByRole('heading', { name: /Uma lista de referência que/ })).toBeVisible();
    await expect(page.getByText(/pelo menos duas fontes independentes/)).toBeVisible();
    await expect(page.getByText(/Não há dados pessoais/)).toBeVisible();

    await page.goto('/sobre');
    const footerLink = page.locator('footer').getByRole('link', { name: 'Cobertura de eventos' });
    await expect(footerLink).toHaveAttribute('href', '/cobertura-de-eventos');
    await footerLink.click();
    await expect(page).toHaveURL(/\/cobertura-de-eventos$/);
  });

  test('sem violations críticas de acessibilidade (axe), nos dois estados', async ({ page }) => {
    await mockCoverage(page, measuring);
    await page.goto('/cobertura-de-eventos');
    await page.getByTestId('coverage-stats').waitFor({ state: 'visible' });
    await expectNoCriticalA11yViolations(page);

    await page.unroute('**/public/event-coverage');
    await mockCoverage(page, measured);
    await page.reload();
    await expect(page.getByText('92,4%', { exact: true })).toBeVisible();
    await expectNoCriticalA11yViolations(page);
  });
});
