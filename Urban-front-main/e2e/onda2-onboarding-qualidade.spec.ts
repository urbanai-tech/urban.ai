import { expect, test, type Page } from '@playwright/test';
import { installLocalAuthFixture } from './local-auth-fixture';
import { gotoHydrated } from './test-helpers';

/**
 * Onda 2 (PR F): onboarding (um só contador, etapa de estratégia no celular, sem NaN no
 * <svg>), estado vazio com "o que vem a seguir", /my-roi no celular, telas que recebem
 * formato inesperado da API e Stripe.js só onde há checkout. API mockada.
 */

test.use({ serviceWorkers: 'block', timezoneId: 'America/Sao_Paulo' });

const MOBILE = { width: 390, height: 844 };
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

const readyProperty = {
  id: 'prop-f-e2e',
  propertyName: 'Studio Jardins',
  nome: 'Studio Jardins',
  userId: 'e2e-local-host',
  analisado: 'completed',
  image_url: '',
  latitude: -23.56,
  longitude: -46.65,
  cidade: 'São Paulo',
  estado: 'SP',
  pricingInputsUpdatedAt: null,
};

async function mockShell(page: Page) {
  await installLocalAuthFixture(page, 'host');
  await page.route('**/auth/profile/**', (route) => route.fulfill(json({ id: 'e2e-local-host', operationMode: 'notifications' })));
  await page.route('**/notifications/user/unread-count', (route) => route.fulfill(json({ unread: 0 })));
  await page.route('**/dados**', (route) =>
    route.fulfill(json({ quantidadePropriedadesAtivas: 1, lucroProjetadoGeradoPeloUrban: 0, receitaProjetada: { receitaProjetada: 0, diferencaPercentual: 0 }, quantidadeEventos: 0 })),
  );
  await page.route('**/pace/portfolio**', (route) => route.fulfill(json({ points: [] })));
  await page.route('**/properties/*/pace**', (route) => route.fulfill(json({ points: [] })));
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test.describe('Onboarding', () => {
  async function mockOnboardingToStrategy(page: Page) {
    await mockShell(page);
    await page.route('**/plans', (route) => (route.request().resourceType() === 'document' ? route.continue() : route.fulfill(json([]))));
    await page.route('**/payments/getSubscription', (route) => route.fulfill(json({ status: 'inactive' })));
    await page.route('**/propriedades/dropdown/list', (route) => route.fulfill(json([])));
    await page.route('**/connect/resolve**', (route) => route.fulfill(json({ finalUrl: 'https://www.airbnb.com.br/rooms/12345678' })));
    await page.route('**/propriedades/quick-info**', (route) =>
      route.fulfill(json({ propertyId: '12345678', title: 'Loft', pictureUrl: '', hostId: 'h', propertyType: 'Apartamento inteiro', city: 'Sao Paulo', state: 'SP' })),
    );
    await page.route('**/connect/register', (route) =>
      route.fulfill(json([{ id: 'list-f', titulo: 'Loft', id_do_anuncio: '12345678', pictureUrl: '', ativo: true }], 201)),
    );
    await page.route('**/connect/addresses', (route) => route.fulfill(json([{ id: 'addr-f', list: { id: 'list-f', manualDailyPrice: 300 } }], 201)));
    await page.route('**/processos', (route) => route.fulfill(json({ status: 'queued' }, 201)));
  }

  test('mostra um único contador de etapa e não gera NaN em <svg>', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    await mockOnboardingToStrategy(page);
    await page.setViewportSize(MOBILE);
    await gotoHydrated(page, '/onboarding');

    await page.getByRole('button', { name: /Come.*configura/i }).click();
    await expect(page.getByRole('heading', { name: /Conecte seus Im/i })).toBeVisible();
    await expect(page.getByText(/Etapa 2 de 5/)).toBeVisible();
    await expect(page.getByText(/Passo \d de \d/)).toHaveCount(0);

    await page.getByPlaceholder('https://www.airbnb.com.br/rooms/12345678').fill('https://www.airbnb.com.br/rooms/12345678');
    await page.getByRole('button', { name: /Buscar im/i }).click();
    await expect(page.getByRole('heading', { name: /Selecionar Im/i })).toBeVisible();
    await expect(page.getByText(/Passo \d de \d/)).toHaveCount(0);
    await page.getByRole('button', { name: /Registrar 1 im/i }).click();

    await expect(page.getByRole('heading', { name: /Ajustar as recomenda/i })).toBeVisible();
    await expect(page.getByText(/Etapa 4 de 5/)).toBeVisible();
    await expect(page.getByText(/Passo \d de \d/)).toHaveCount(0);

    // E2E-04: cartões de estilo empilhados em 1 coluna no celular, sem corte nem overflow.
    const cards = page.locator('[class*="gridMobile1"]').first();
    await expect(cards).toBeVisible();
    const columns = await cards.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(1);
    const badge = page.getByText('Recomendado').first();
    const badgeBox = await badge.boundingBox();
    expect(badgeBox).not.toBeNull();
    expect(badgeBox!.x + badgeBox!.width).toBeLessThanOrEqual(MOBILE.width);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    // E2E-14: nenhum <svg> com width/height NaN.
    expect(consoleErrors.filter((text) => /<svg>.*(NaN)/i.test(text))).toEqual([]);
    expect(await page.locator('svg[width="NaN"], svg[height="NaN"]').count()).toBe(0);
  });

  test('estratégia em desktop mantém 3 colunas', async ({ page }) => {
    await mockOnboardingToStrategy(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoHydrated(page, '/onboarding');
    await page.getByRole('button', { name: /Come.*configura/i }).click();
    await page.getByPlaceholder('https://www.airbnb.com.br/rooms/12345678').fill('https://www.airbnb.com.br/rooms/12345678');
    await page.getByRole('button', { name: /Buscar im/i }).click();
    await page.getByRole('button', { name: /Registrar 1 im/i }).click();
    await expect(page.getByRole('heading', { name: /Ajustar as recomenda/i })).toBeVisible();
    const columns = await page
      .locator('[class*="gridDesktop3"]')
      .first()
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(3);
  });
});

test.describe('Estado vazio com o que vem a seguir (MKT-05)', () => {
  test('Hoje sem sugestão mostra eventos da cidade, aviso semanal e próximos passos', async ({ page }) => {
    await mockShell(page);
    await page.route('**/propriedades/dropdown/list', (route) => route.fulfill(json([readyProperty])));
    await page.route('**/sugestoes-preco/resultados-pendentes', (route) => route.fulfill(json({ total: 0, data: [] })));
    await page.route('**/propriedades/eventos-acompanhando**', (route) => route.fulfill(json({ data: [], total: 0 })));
    const catalogQueries: string[] = [];
    await page.route('**/host/events/catalog**', (route) => {
      catalogQueries.push(new URL(route.request().url()).search);
      const startsAt = new Date(Date.now() + 9 * 86_400_000).toISOString();
      return route.fulfill(
        json({
          generatedAt: new Date().toISOString(),
          total: 1,
          cities: ['São Paulo'],
          categories: [],
          sources: [],
          items: [{ id: 'ev-1', name: 'Festival da Cidade', startsAt, endsAt: null, city: 'São Paulo', state: 'SP', venueName: 'Parque Central', urbanScore: 70, badges: [] }],
        }),
      );
    });
    await page.setViewportSize(MOBILE);
    await gotoHydrated(page, '/painel');

    const guide = page.locator('[data-next-suggestions]');
    await expect(guide.getByRole('heading', { name: 'Nenhuma sugestão para decidir agora' })).toBeVisible();
    await expect(guide.getByText('Próximos eventos em São Paulo')).toBeVisible();
    await expect(guide.getByText('Festival da Cidade')).toBeVisible();
    await expect(guide.getByText(/Parque Central/)).toBeVisible();
    await expect(guide.getByText(/Próximo envio: .*segunda-feira.*8h30/)).toBeVisible();
    await expect(guide.getByRole('link', { name: /Ver Imóveis/ })).toHaveAttribute('href', '/properties');
    expect(catalogQueries[0]).toContain('city=S%C3%A3o+Paulo');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('sem eventos no catálogo, o guia explica que seguimos monitorando', async ({ page }) => {
    await mockShell(page);
    await page.route('**/propriedades/dropdown/list', (route) => route.fulfill(json([readyProperty])));
    await page.route('**/sugestoes-preco/resultados-pendentes', (route) => route.fulfill(json({ total: 0, data: [] })));
    await page.route('**/propriedades/eventos-acompanhando**', (route) => route.fulfill(json({ data: [], total: 0 })));
    await page.route('**/host/events/catalog**', (route) => route.fulfill(json({ generatedAt: '', total: 0, cities: [], categories: [], sources: [], items: [] })));
    await gotoHydrated(page, '/painel');
    const guide = page.locator('[data-next-suggestions]');
    await expect(guide.getByText(/Seguimos monitorando/)).toBeVisible();
    await expect(guide.getByText('Como e quando você é avisado')).toBeVisible();
  });
});

test.describe('Telas do anfitrião e do admin', () => {
  test('/my-roi no celular não estoura a largura e mantém o título legível', async ({ page }) => {
    await mockShell(page);
    await page.route('**/propriedades/dropdown/list', (route) => route.fulfill(json([readyProperty])));
    await page.route('**/roi/me**', (route) =>
      route.fulfill(
        json({
          windowDays: 30,
          generatedAt: '2026-10-31T00:00:00.000Z',
          money: { totalAttributedCents: 123400, confirmedIncrementalCents: 100000, projectedIncrementalCents: 23400, subscriptionCostCents: 9700, netValueCents: 113700, roiPercent: 1172, roiMultiple: 12, potentialLostCents: 0 },
          activity: { recommendations: 10, accepted: 4, applied: 3, acceptanceRatePercent: 40, impactedNights: 6 },
          dataQuality: { confidence: 'low', label: 'Dados parciais, estimativa com poucas reservas confirmadas' },
          perProperty: [{ propertyId: 'p1', propertyName: 'Studio Jardins no Bairro dos Jardins', totalAttributedCents: 123400 }],
        }),
      ),
    );
    await page.setViewportSize(MOBILE);
    await gotoHydrated(page, '/my-roi');
    // Só money/activity/dataQuality: o normalizador completa o resto, sem cair no error boundary.
    await expect(page.getByText('Resultado por imóvel')).toBeVisible();
    const title = page.getByRole('heading', { level: 1 });
    await expect(title).toBeVisible();
    expect((await title.boundingBox())!.width).toBeGreaterThan(200);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('/my-roi com resposta inesperada cai no erro amigável, não no error boundary', async ({ page }) => {
    await mockShell(page);
    await page.route('**/propriedades/dropdown/list', (route) => route.fulfill(json([readyProperty])));
    await page.route('**/roi/me**', (route) => route.fulfill(json({})));
    await gotoHydrated(page, '/my-roi');
    await expect(page.getByText(/invalid roi response|Erro ao carregar/i)).toBeVisible();
  });

  test('/properties/[id] com respostas vazias renderiza sem exceção', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await mockShell(page);
    await page.route('**/propriedades/dropdown/list', (route) => route.fulfill(json([readyProperty])));
    // Envelope vazio/estranho em tudo que a tela lê.
    await page.route(/\/propriedades\/prop-f-e2e(\?.*)?$/, (route) => route.fulfill(json({})));
    await page.route('**/propriedades/**', (route) => {
      if (!['fetch', 'xhr'].includes(route.request().resourceType())) return route.continue();
      return route.fulfill(json({}));
    });
    await page.route('**/roi/me**', (route) => route.fulfill(json({})));
    await page.route('**/properties/**', (route) => {
      if (!['fetch', 'xhr'].includes(route.request().resourceType())) return route.continue();
      return route.fulfill(json({}));
    });
    await gotoHydrated(page, '/properties/prop-f-e2e');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/Algo deu errado|Application error/i)).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('/admin/seo rotula os números como dados de exemplo', async ({ page }) => {
    await installLocalAuthFixture(page, 'admin');
    await page.route('**/notifications/user/unread-count', (route) => route.fulfill(json({ unread: 0 })));
    await gotoHydrated(page, '/admin/seo');
    const notice = page.locator('[data-seo-sample-notice]');
    await expect(notice).toBeVisible();
    await expect(notice.getByText('DADOS DE EXEMPLO')).toBeVisible();
    await expect(page.getByText(/^Exemplo de /)).toBeVisible();
  });
});

test.describe('Stripe.js sob demanda (E2E-11)', () => {
  test('telas logadas sem checkout não carregam js.stripe.com', async ({ page }) => {
    const stripeRequests: string[] = [];
    page.on('request', (request) => {
      if (/stripe\.com/.test(request.url())) stripeRequests.push(request.url());
    });
    await mockShell(page);
    await page.route('**/propriedades/dropdown/list', (route) => route.fulfill(json([readyProperty])));
    await page.route('**/sugestoes-preco/resultados-pendentes', (route) => route.fulfill(json({ total: 0, data: [] })));
    await page.route('**/propriedades/eventos-acompanhando**', (route) => route.fulfill(json({ data: [], total: 0 })));
    await page.route('**/propriedades/eventos-analisados-com-price**', (route) => route.fulfill(json({ data: [] })));
    await page.route('**/host/events/catalog**', (route) => route.fulfill(json({ generatedAt: '', total: 0, cities: [], categories: [], sources: [], items: [] })));

    for (const path of ['/painel', '/dashboard']) {
      await gotoHydrated(page, path);
      await expect(page.locator('[data-next-suggestions]')).toBeVisible();
    }
    await page.waitForLoadState('load');
    expect(stripeRequests).toEqual([]);
  });
});
