import { expect, test } from '@playwright/test';

const completedProperty = {
  id: 'prop-dashboard-e2e',
  propertyName: 'Studio Jardins',
  userId: 'user-e2e',
  analisado: 'completed',
  image_url: 'https://example.com/studio.jpg',
  latitude: -23.56,
  longitude: -46.65,
  nome: 'Studio Jardins',
};

const recommendation = {
  id: 'event-e2e',
  nome: 'Expo Turismo SP',
  dataInicio: new Date().toISOString(),
  dataFim: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  enderecoCompleto: 'Sao Paulo Expo',
  cidade: 'Sao Paulo',
  estado: 'SP',
  precoSugerido: '420',
  seuPrecoAtual: '350',
  diferencaPercentual: '20',
  recomendacao: 'Evento com demanda alta perto do imovel. Sugestao dentro do guardrail.',
  motivo_ia: 'Evento proximo, alta demanda esperada e preco atual abaixo dos comparaveis.',
  distancia_metros: '1800',
  idAnalise: 'analysis-e2e',
  aceito: false,
  status: 'suggested',
};

async function mockProperties(page: import('@playwright/test').Page) {
  await page.route('**/propriedades/dropdown/list', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([completedProperty]),
    });
  });
}

test.describe('Dashboard recommendations', () => {
  test('mostra empty state honesto quando nao ha recomendacoes no mes', async ({ page }) => {
    await mockProperties(page);
    await page.route('**/propriedades/eventos-analisados-com-price**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: /Calend.rio/i })).toBeVisible();
    await expect(page.getByText(/Sem recomenda/i)).toBeVisible();
    await expect(page.getByText(/N.o encontramos evento futuro compat.vel/i)).toBeVisible();
  });

  test('mostra card de recomendacao com motivo e preco aplicado', async ({ page }) => {
    await mockProperties(page);
    await page.route('**/propriedades/eventos-analisados-com-price**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [recommendation] }),
      });
    });

    await page.goto('/dashboard');

    await expect(page.getByText('Expo Turismo SP')).toBeVisible();
    await expect(page.getByLabel(/Pre.o sugerido/i)).toContainText(/R\$/);
    await expect(page.getByText(/Por que sugerimos/i)).toBeVisible();
    await expect(page.getByText(/Evento proximo/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Aceitar Sugest/i })).toBeVisible();
  });
});
