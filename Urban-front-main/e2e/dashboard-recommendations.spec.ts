import { expect, test } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

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

async function mockProperties(
  page: import('@playwright/test').Page,
  operationMode: 'notifications' | 'auto' = 'notifications',
) {
  await page.route('**/auth/profile/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-e2e',
        username: 'Host E2E',
        email: 'host.e2e@urbanai.com.br',
        operationMode,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    });
  });
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-e2e',
        username: 'Host E2E',
        email: 'host.e2e@urbanai.com.br',
        role: 'USER',
      }),
    });
  });
  await page.route('**/payments/getSubscription', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'active', plan: 'alpha' }),
    });
  });
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
    await acceptCookieConsent(page);
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
    await expect(page.getByRole('heading', { name: /Sem sugest/i })).toBeVisible();
    await expect(page.getByText(/N[aã]o encontramos evento futuro que combine/i)).toBeVisible();
  });

  test('mostra card de recomendacao com motivo e preco aplicado', async ({ page }) => {
    await acceptCookieConsent(page);
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
    await expect(page.getByText(/Sugest[aã]o da IA/i)).toBeVisible();
    await expect(page.getByText('R$ 420').first()).toBeVisible();
    await expect(page.getByText(/Evento pr[oó]ximo/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Vou aplicar este pre/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ignorar/i })).toBeVisible();
  });

  test('dialog honesto: copia valor, confirma preco aplicado e nao promete automacao', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined);
    await acceptCookieConsent(page);
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
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    await page.route('**/sugestoes-preco/analysis-e2e/aplicado', async (route) => {
      const payload = route.request().postDataJSON();
      appliedPayloads.push(payload);
      currentRecommendation = {
        ...currentRecommendation,
        aceito: true,
        precoAplicado: payload.precoAplicado,
        aplicadoEm: new Date().toISOString(),
        origemAplicacao: payload.origem,
        status: 'applied_manual',
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/dashboard');
    await page.getByRole('button', { name: /Vou aplicar este pre/i }).click();

    const dialog = page.getByRole('dialog', { name: /Vou aplicar este pre/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/n[aã]o altera o pre[cç]o no Airbnb/i)).toBeVisible();
    await expect(dialog.getByText('R$ 420').first()).toBeVisible();
    // Passo do roteiro manual. Específico de propósito: entre 22h e 0h (SP) o evento de 2h
    // cruza o dia e o aviso de vários dias também menciona o calendário.
    await expect(dialog.getByText(/entre em Calend[aá]rio/i)).toBeVisible();
    // Abrir o dialog nao grava nada: aceite e aplicacao so acontecem na confirmacao.
    expect(acceptPayloads).toHaveLength(0);
    expect(appliedPayloads).toHaveLength(0);

    // Campo vem preenchido com a recomendacao e e editavel.
    const priceField = dialog.getByLabel(/Pre[cç]o que apliquei/i);
    await expect(priceField).toHaveValue('420');
    await dialog.getByRole('button', { name: /Copiar valor/i }).click();

    // Erro de digitacao fora da faixa e barrado antes de chamar a API.
    await priceField.fill('42000');
    await dialog.getByRole('button', { name: /^Confirmar$/ }).click();
    await expect(dialog.getByText(/fora do esperado/i)).toBeVisible();
    expect(appliedPayloads).toHaveLength(0);

    await priceField.fill('399,90');
    await dialog.getByRole('button', { name: /^Confirmar$/ }).click();

    await expect.poll(() => appliedPayloads.length).toBe(1);
    expect(appliedPayloads[0]).toMatchObject({ precoAplicado: 399.9, origem: 'manual_dashboard' });
    expect(acceptPayloads).toHaveLength(0);
    await expect(dialog).toBeHidden();
    await expect(page.getByText(/Aplicado\s+R\$\s*399,90/)).toBeVisible();
    await expect(page.getByText(/informado por voc/i)).toBeVisible();
  });

  test('ignorar rejeita a sugestao sem registrar preco aplicado', async ({ page }) => {
    await acceptCookieConsent(page);
    const acceptPayloads: Array<{ aceito?: boolean }> = [];
    let appliedCalls = 0;
    await mockProperties(page);
    await page.route('**/propriedades/eventos-analisados-com-price**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [recommendation] }) });
    });
    await page.route('**/sugestoes-preco/analysis-e2e/aceito', async (route) => {
      acceptPayloads.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    await page.route('**/sugestoes-preco/analysis-e2e/aplicado', async (route) => {
      appliedCalls += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/dashboard');
    await page.getByRole('button', { name: /Ignorar/i }).click();

    await expect.poll(() => acceptPayloads[0]).toEqual({ aceito: false });
    expect(appliedCalls).toBe(0);
  });

  test('modo automatico (Stays) mantem o fluxo e os rotulos anteriores', async ({ page }) => {
    await acceptCookieConsent(page);
    const acceptPayloads: Array<{ aceito?: boolean }> = [];
    let currentRecommendation: Record<string, unknown> = { ...recommendation };
    await mockProperties(page, 'auto');
    await page.route('**/propriedades/eventos-analisados-com-price**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [currentRecommendation] }) });
    });
    await page.route('**/sugestoes-preco/analysis-e2e/aceito', async (route) => {
      acceptPayloads.push(route.request().postDataJSON());
      currentRecommendation = { ...currentRecommendation, aceito: true, status: 'accepted' };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/dashboard');
    await expect(page.getByRole('button', { name: /Aplicar sugest/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Vou aplicar este pre/i })).toHaveCount(0);
    await page.getByRole('button', { name: /Aplicar sugest/i }).click();

    await expect.poll(() => acceptPayloads[0]).toEqual({ aceito: true });
    await expect(page.getByRole('button', { name: /Desfazer aprova/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Registrar resultado/i })).toBeVisible();
  });

  test('registra resultado depois de aplicado (reserva, receita, noites)', async ({ page }) => {
    await acceptCookieConsent(page);
    const appliedPayloads: Array<Record<string, unknown>> = [];
    await mockProperties(page);
    await page.route('**/propriedades/eventos-analisados-com-price**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              ...recommendation,
              aceito: true,
              status: 'applied_manual',
              precoAplicado: 420,
              origemAplicacao: 'manual_dashboard',
            },
          ],
        }),
      });
    });
    await page.route('**/sugestoes-preco/analysis-e2e/aplicado', async (route) => {
      appliedPayloads.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/dashboard');
    await page.getByRole('button', { name: /Registrar resultado/i }).click();
    const drawer = page.getByRole('dialog', { name: /Registrar pre/i });
    await drawer.getByRole('textbox', { name: /^Pre[cç]o aplicado/i }).fill('450');
    await page.getByLabel(/Resultado da reserva/i).selectOption('booked');
    await page.getByLabel(/Receita real/i).fill('1350');
    await page.getByLabel(/Noites reservadas/i).fill('3');
    await page.getByLabel(/Observa[cç][aã]o/i).fill('Reserva fechada pelo Airbnb');
    await page.getByRole('button', { name: /Salvar resultado/i }).click();

    await expect.poll(() => appliedPayloads.length).toBe(1);
    expect(appliedPayloads[0]).toMatchObject({
      precoAplicado: 450,
      origem: 'manual_dashboard',
      reservaStatus: 'booked',
      receitaReal: 1350,
      noitesReservadas: 3,
      feedbackObservacao: 'Reserva fechada pelo Airbnb',
    });
  });
});
