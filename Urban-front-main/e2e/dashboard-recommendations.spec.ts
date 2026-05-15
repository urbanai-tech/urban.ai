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

  test('aceita recomendacao e registra preco aplicado com resultado', async ({ page }) => {
    const acceptPayloads: Array<{ aceito?: boolean }> = [];
    const appliedPayloads: Array<{
      precoAplicado?: number;
      origem?: string;
      reservaStatus?: string;
      receitaReal?: number;
      noitesReservadas?: number;
      feedbackObservacao?: string;
    }> = [];
    let currentRecommendation: Record<string, unknown> = { ...recommendation };

    await mockProperties(page);
    await page.route('**/propriedades/eventos-analisados-com-price**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [currentRecommendation] }),
      });
    });
    await page.route('**/sugestoes-preco/analysis-e2e/aceito', async (route) => {
      acceptPayloads.push(route.request().postDataJSON());
      currentRecommendation = { ...currentRecommendation, aceito: true, status: 'accepted' };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
    await page.route('**/sugestoes-preco/analysis-e2e/aplicado', async (route) => {
      const payload = route.request().postDataJSON();
      appliedPayloads.push(payload);
      currentRecommendation = {
        ...currentRecommendation,
        precoAplicado: payload.precoAplicado,
        aplicadoEm: new Date().toISOString(),
        origemAplicacao: payload.origem,
        reservaStatus: payload.reservaStatus,
        receitaReal: payload.receitaReal,
        noitesReservadas: payload.noitesReservadas,
        feedbackObservacao: payload.feedbackObservacao,
        status: 'applied_manual',
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto('/dashboard');
    await page.getByRole('button', { name: /Aceitar Sugest/i }).click();

    expect(acceptPayloads[0]).toEqual({ aceito: true });
    await expect(page.getByRole('button', { name: /Cancelar/i })).toBeVisible();

    await page.getByPlaceholder(/aplicado/i).fill('450');
    await page.locator('select').selectOption('booked');
    await page.getByPlaceholder(/Receita real/i).fill('1350');
    await page.getByPlaceholder(/Noites/i).fill('3');
    await page.getByPlaceholder(/Observacao/i).fill('Reserva fechada pelo Airbnb');
    await page.getByRole('button', { name: /Registrar pre/i }).click();

    expect(appliedPayloads[0]).toMatchObject({
      precoAplicado: 450,
      origem: 'manual_dashboard',
      reservaStatus: 'booked',
      receitaReal: 1350,
      noitesReservadas: 3,
      feedbackObservacao: 'Reserva fechada pelo Airbnb',
    });
    await expect(page.getByLabel(/Pre.o aplicado registrado/i)).toContainText(/R\$/);
  });
});
