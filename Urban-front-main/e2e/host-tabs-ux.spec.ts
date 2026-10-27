import { expect, test, type Page } from '@playwright/test';
import { expectNoCriticalA11yViolations } from './a11y-helpers';
import { installLocalAuthFixture } from './local-auth-fixture';

/**
 * Abas Hoje, Calendário e Avisos no celular (390×844), API mockada.
 *  - Hoje: "Como foi?" → oportunidades (data, depois ganho/noite) → métricas.
 *  - Calendário: sem "janela visível"; agenda por dia e estado vazio do período.
 *  - Avisos: grupos Hoje/Ontem/Esta semana, ações de 44px, marcar todos.
 */

test.use({ serviceWorkers: 'block', timezoneId: 'America/Sao_Paulo' });

const MOBILE = { width: 390, height: 844 };
const DAY = 24 * 60 * 60 * 1000;

function atDaysFromNow(days: number, hour = 20) {
  const date = new Date(Date.now() + days * DAY);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

const property = {
  id: 'prop-ux-e2e',
  propertyName: 'Studio Jardins',
  nome: 'Studio Jardins',
  userId: 'e2e-local-host',
  analisado: 'completed',
  image_url: '',
  latitude: -23.56,
  longitude: -46.65,
  pricingInputsUpdatedAt: null,
};

function suggestion(id: string, nome: string, days: number, sugerido: number, atual: number) {
  return {
    id,
    nome,
    dataInicio: atDaysFromNow(days),
    dataFim: atDaysFromNow(days, 23),
    enderecoCompleto: 'São Paulo, SP',
    cidade: 'São Paulo',
    estado: 'SP',
    precoSugerido: String(sugerido),
    seuPrecoAtual: String(atual),
    diferencaPercentual: String(Math.round(((sugerido - atual) / atual) * 100)),
    recomendacao: 'Evento perto do imóvel.',
    motivo_ia: 'Evento perto do imóvel, procura acima do normal.',
    distancia_metros: '1500',
    idAnalise: `analysis-${id}`,
    aceito: false,
    status: 'suggested',
  };
}

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function mockHost(page: Page) {
  await installLocalAuthFixture(page, 'host');
  await page.route('**/auth/profile/**', (route) => route.fulfill(json({ id: 'e2e-local-host', operationMode: 'notifications' })));
  await page.route('**/propriedades/dropdown/list', (route) => route.fulfill(json([property])));
  await page.route('**/notifications/user/unread-count', (route) => route.fulfill(json({ unread: 0 })));
  await page.route('**/dados**', (route) =>
    route.fulfill(
      json({
        quantidadePropriedadesAtivas: 1,
        lucroProjetadoGeradoPeloUrban: 640,
        receitaProjetada: { receitaProjetada: 4180, diferencaPercentual: 18 },
        quantidadeEventos: 3,
      }),
    ),
  );
  await page.route('**/pace/portfolio**', (route) => route.fulfill(json({ points: [] })));
  await page.route('**/properties/*/pace**', (route) => route.fulfill(json({ points: [] })));
}

test.describe('Abas do anfitrião no celular', () => {
  test.describe.configure({ timeout: 60_000 });

  test('Hoje começa pela ação: Como foi? → oportunidades ordenadas → métricas', async ({ page }) => {
    await mockHost(page);
    await page.setViewportSize(MOBILE);
    const pending = {
      ...suggestion('passado', 'Lollapalooza Brasil', -3, 610, 420),
      aceito: true,
      status: 'applied_manual',
      precoAplicado: 590,
      propertyId: property.id,
    };
    await page.route('**/sugestoes-preco/resultados-pendentes', (route) => route.fulfill(json({ total: 1, data: [pending] })));
    await page.route('**/propriedades/eventos-acompanhando**', (route) =>
      route.fulfill(
        json({
          // Fora de ordem de propósito: o Hoje ordena por data e, no mesmo dia, pelo ganho por noite.
          data: [
            suggestion('feira', 'Feira Hospitalar', 12, 390, 340),
            suggestion('jogo', 'Corinthians x Palmeiras', 3, 420, 380),
            suggestion('show', 'Show no Allianz Parque', 3, 520, 380),
          ],
          total: 3,
        }),
      ),
    );

    await page.goto('/painel', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { level: 1, name: 'Hoje' })).toBeVisible();
    await expect(page.getByText('Como foi?', { exact: false }).first()).toBeVisible();
    const items = page.locator('[data-today-item]');
    await expect(items).toHaveCount(3);
    expect(await items.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-today-item')))).toEqual([
      'analysis-show',
      'analysis-jogo',
      'analysis-feira',
    ]);
    await expect(items.first().getByText('em 3 dias')).toBeVisible();
    await expect(items.first().getByText(/\+R\$\s*140 por noite/)).toBeVisible();
    await expect(items.first().getByRole('button', { name: /Vou aplicar este pre/i })).toBeVisible();

    // Ordem visual: Como foi? → oportunidades → métricas.
    const tops = await page.evaluate(() =>
      ['outcomes', 'opportunities', 'metrics'].map(
        (id) => document.querySelector(`[data-today-section="${id}"]`)!.getBoundingClientRect().top,
      ),
    );
    expect(tops[0]).toBeLessThan(tops[1]);
    expect(tops[1]).toBeLessThan(tops[2]);
    await expect(page.locator('[data-metric="opportunities"]')).toContainText('3');

    // Subtítulo cabe numa linha no celular.
    const subtitle = page.getByText('Decida os preços que mais importam agora.');
    const box = await subtitle.boundingBox();
    expect(box?.height ?? 99).toBeLessThan(30);

    // O último item rola para fora de baixo do FAB do Ask Urban + tab bar.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const clearance = await page.evaluate(() => {
      const fab = document.querySelector<HTMLElement>('[data-ask-urban-fab]');
      const sections = document.querySelectorAll('[data-today-section]');
      const last = sections[sections.length - 1]!.getBoundingClientRect();
      return { lastBottom: last.bottom, fabTop: fab && !fab.hidden ? fab.getBoundingClientRect().top : Infinity };
    });
    expect(clearance.lastBottom).toBeLessThanOrEqual(clearance.fabTop);
  });

  test('Hoje sem sugestões explica o porquê e leva para Imóveis', async ({ page }) => {
    await mockHost(page);
    await page.setViewportSize(MOBILE);
    await page.route('**/sugestoes-preco/resultados-pendentes', (route) => route.fulfill(json({ total: 0, data: [] })));
    await page.route('**/propriedades/eventos-acompanhando**', (route) => route.fulfill(json({ data: [], total: 0 })));

    await page.goto('/painel', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Nenhuma sugestão para decidir agora' })).toBeVisible();
    await expect(page.getByText(/diária de referência/)).toBeVisible();
    await expect(page.getByRole('link', { name: /Ver Imóveis/ })).toHaveAttribute('href', '/properties');
    await expect(page.getByText('Como foi?')).toHaveCount(0);
  });

  test('Calendário no celular: agenda por dia, sem "janela visível", vazio do período aponta o próximo', async ({ page }) => {
    await mockHost(page);
    await page.setViewportSize(MOBILE);
    // Só um evento, daqui a ~2 meses: o mês atual fica vazio.
    const future = suggestion('futuro', 'Bienal do Livro', 62, 480, 400);
    await page.route('**/propriedades/eventos-analisados-com-price**', (route) => route.fulfill(json({ data: [future] })));

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { level: 1, name: 'Calendário' })).toBeVisible();
    await expect(page.getByText(/janela vis[ií]vel/i)).toHaveCount(0);
    // Sem grade do mês no celular.
    await expect(page.locator('.urban-cal-days')).toHaveCount(0);

    const emptyTitle = page.getByRole('heading', { name: /^Nenhuma sugestão em / });
    await expect(emptyTitle).toBeVisible();
    await expect(page.getByText(/Nenhuma sugestão nesta janela — próximos eventos em /)).toBeVisible();

    // Seletor de período compacto, com alvos de 44px.
    const period = page.locator('[data-calendar-period]');
    const periodBox = await period.boundingBox();
    expect(periodBox?.height ?? 999).toBeLessThan(140);
    for (const button of await period.getByRole('button').all()) {
      const box = await button.boundingBox();
      if (box && box.width > 0) expect(box.height).toBeGreaterThanOrEqual(44);
    }

    await page.getByRole('button', { name: /^Ver / }).click();
    const agenda = page.locator('[data-calendar-agenda]');
    await expect(agenda).toBeVisible();
    await expect(agenda.getByText('Bienal do Livro')).toBeVisible();
    await expect(agenda.locator('.urban-cal-agenda__day-label')).toHaveCount(1);
    await expectNoCriticalA11yViolations(page);
  });

  test('Calendário sem nenhuma sugestão no horizonte diz que seguimos procurando', async ({ page }) => {
    await mockHost(page);
    await page.setViewportSize(MOBILE);
    await page.route('**/propriedades/eventos-analisados-com-price**', (route) => route.fulfill(json({ data: [] })));

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Sem sugestões nos próximos meses' })).toBeVisible();
    await expect(page.getByText(/Não encontramos evento futuro/)).toBeVisible();
  });

  test('Avisos agrupa por dia, destaca não lidos e marca todos como lidos', async ({ page }) => {
    await mockHost(page);
    await page.setViewportSize(MOBILE);
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString();
    const notifications = [
      { id: 'n1', title: 'Nova sugestão de preço', description: 'Show no sábado.', createdAt: hoursAgo(0.5), opened: false, redirectTo: '/dashboard', titleButton: 'Ver sugestão' },
      { id: 'n2', title: 'Pagamento confirmado', description: 'Plano renovado.', createdAt: hoursAgo(30), opened: true, redirectTo: '/my-plan' },
      { id: 'n3', title: 'Evento novo no radar', description: 'Feira perto do imóvel.', createdAt: hoursAgo(24 * 4), opened: false, redirectTo: '/event-radar' },
      { id: 'n4', title: 'Análise concluída', description: 'Imóvel pronto.', createdAt: hoursAgo(24 * 20), opened: true },
    ];
    let markAllCalls = 0;
    // A ordem importa: a rota registrada por último vence, e '**/notifications/user/?**'
    // também casaria com unread-count e opened.
    await page.route('**/notifications/user/?**', (route) =>
      route.fulfill(json({ data: notifications, page: 1, lastPage: 1, total: notifications.length })),
    );
    await page.route('**/notifications/user/unread-count', (route) => route.fulfill(json({ unread: markAllCalls ? 0 : 2 })));
    await page.route('**/notifications/user/opened', async (route) => {
      markAllCalls += 1;
      await route.fulfill(json({ updated: true }));
    });

    await page.goto('/notificacao', { waitUntil: 'domcontentloaded' });

    const groups = page.locator('[data-notification-group]');
    await expect(groups.first()).toBeVisible();
    // Grupos dependem da hora local: "Ontem" pode virar "Esta semana" logo depois da meia-noite.
    const labels = await groups.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-notification-group')));
    expect(labels[0]).toBe('today');
    expect(labels[labels.length - 1]).toBe('older');
    expect(labels).toContain('week');
    await expect(page.locator('[data-notification-group="today"]').getByText('Nova sugestão de preço')).toBeVisible();
    await expect(page.locator('[data-notification-group="older"]').getByText('Análise concluída')).toBeVisible();

    // Não lido: marcação extra, mesmo contraste de texto que o lido.
    const unread = page.locator('[data-notification-id="n1"]');
    const read = page.locator('[data-notification-id="n4"]');
    await expect(unread).toHaveAttribute('data-unread', 'true');
    const color = (loc: typeof unread) => loc.locator('p').first().evaluate((el) => getComputedStyle(el).color);
    expect(await color(unread)).toBe(await color(read));

    // Ações explícitas de 44px (sem swipe).
    for (const button of await unread.getByRole('button').all()) {
      const box = await button.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    const markAll = page.getByRole('button', { name: 'Marcar todos como lidos' });
    const markAllBox = await markAll.boundingBox();
    expect(markAllBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expectNoCriticalA11yViolations(page);
    await markAll.click();
    await expect.poll(() => markAllCalls).toBe(1);
    await expect(page.locator('[data-unread="true"]')).toHaveCount(0);
    await expect(markAll).toBeDisabled();
  });
});
