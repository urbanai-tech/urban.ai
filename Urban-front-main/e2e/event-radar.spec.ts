import { expect, test, type Page } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';
import { eventRadarFixture, mockEventRadarApis } from './fixtures/event-radar.fixture';

const primaryEventName = eventRadarFixture.catalogResponse.items[0].name;
const primaryPropertyName =
  eventRadarFixture.hostRadarResponse.propertyImpacts['evt-gp-sp-2026'][0].propertyName;

function textPattern(value: string) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

async function gotoAppRoute(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response, `${path} deve retornar uma resposta HTTP`).not.toBeNull();
  expect(response?.status(), `${path} nao pode estar ausente no release gate`).not.toBe(404);
  expect(response?.status(), `${path} deve carregar sem erro 5xx`).toBeLessThan(500);
}

test.describe('Event radar contract-first E2E', () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookieConsent(page);
    await mockEventRadarApis(page);
  });

  test('catalogo host mostra eventos mapeados, fonte e link oficial', async ({ page }) => {
    await gotoAppRoute(page, '/events');

    await expect(page.getByRole('heading', { name: /eventos em São Paulo/i })).toBeVisible();
    await expect(page.getByText(primaryEventName)).toBeVisible();
    await expect(page.getByText('Autodromo de Interlagos', { exact: true })).toBeVisible();
    await expect(page.getByText(/alto impacto/i).first()).toBeVisible();
    await expect(page.getByText(/official site|fonte oficial/i).first()).toBeVisible();

    const officialLink = page.getByRole('link', { name: /fonte oficial/i }).first();
    await expect(officialLink).toBeVisible();
    await expect(officialLink).toHaveAttribute('href', /example\.com\/gp-sp/);
  });

  test('substitui imagens indisponiveis por fallback visual de evento', async ({ page }) => {
    await page.route('https://example.com/events/gp-sp.jpg', async (route) => {
      await route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
    });
    await page.route('https://example.com/events/expo-tech.jpg', async (route) => {
      await route.abort('blockedbyclient');
    });

    await gotoAppRoute(page, '/events');

    await expect(page.getByTestId('event-image-fallback')).toHaveCount(2);
    await expect(page.getByRole('img', { name: /Imagem indisponível para Grande Premio/i })).toBeVisible();
    await expect(page.getByTestId('host-events-list').getByTestId('event-image')).toHaveCount(0);
  });

  test('detalhe host mostra interpretacao, source e curva de absorcao', async ({ page }) => {
    await gotoAppRoute(page, '/events/evt-gp-sp-2026');

    await expect(page.getByRole('heading', { name: primaryEventName })).toBeVisible();
    await expect(page.getByText(/Este evento deve aquecer a regiao/i)).toBeVisible();
    await expect(page.getByText(/Publico esperado|Oferta pressionada/i).first()).toBeVisible();
    await expect(
      page.getByTestId('host-event-impact-table').getByRole('row', { name: textPattern(primaryPropertyName) }),
    ).toBeVisible();
    await expect(page.getByText(/Conservador|Recomendado|Agressivo|Extremo/i).first()).toBeVisible();
    await expect(page.getByText(/R\$\s*850|2,7x|63%/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /oficial|site|fonte/i }).first()).toBeVisible();
  });

  test('radar host mostra KPIs, eventos relevantes e imoveis impactados', async ({ page }) => {
    await gotoAppRoute(page, '/event-radar');

    await expect(page.getByRole('heading', { name: /oportunidades por evento/i })).toBeVisible();
    await expect(page.getByText(/R\$\s*1,5 mil/i).first()).toBeVisible();
    await expect(page.getByText(/Eventos relevantes/i).first()).toBeVisible();
    await expect(page.getByText(/Noites com oportunidade/i).first()).toBeVisible();
    await expect(page.getByText(primaryEventName).first()).toBeVisible();
    await expect(
      page.getByTestId('host-event-radar-main').getByRole('row', { name: textPattern(primaryPropertyName) }).first(),
    ).toBeVisible();
    await expect(page.getByText(/R\$\s*850|2,7x|63%/i).first()).toBeVisible();
  });

  test('admin radar mostra KPIs de demanda e blind spots', async ({ page }) => {
    await gotoAppRoute(page, '/admin/event-radar');

    await expect(page.getByRole('heading', { name: /radar de demanda/i })).toBeVisible();
    await expect(page.getByText(/R\$\s*2\.800/i).first()).toBeVisible();
    await expect(page.getByText(/Alto potencial/i).first()).toBeVisible();
    await expect(page.getByText(/Imoveis impactados|Imóveis impactados/i).first()).toBeVisible();
    await expect(page.getByText('Alta demanda sem recomendacao')).toBeVisible();
    await expect(page.getByText('Eventos sem coordenada')).toBeVisible();
    await expect(
      page.getByTestId('admin-geo-revenue-list').getByText(primaryEventName).first(),
    ).toBeVisible();
  });
});
