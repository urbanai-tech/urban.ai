import { expect, test, type Page } from '@playwright/test';
import { installLocalAuthFixture } from './local-auth-fixture';

/**
 * Shell mobile do anfitrião: tab bar de vidro, bottom sheet "Mais",
 * top bar compacta e safe areas. Tudo com API mockada (sem backend).
 */

test.use({ serviceWorkers: 'block' });

const property = {
  id: 'prop-shell-e2e',
  propertyName: 'Studio Jardins',
  nome: 'Studio Jardins',
  userId: 'user-shell-e2e',
  analisado: 'completed',
  image_url: '',
  latitude: -23.56,
  longitude: -46.65,
  pricingInputsUpdatedAt: null,
};

async function mockHostApi(page: Page) {
  await installLocalAuthFixture(page, 'host');
  const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/propriedades/dropdown/list', (route) => route.fulfill(json([property])));
  await page.route('**/propriedades/eventos-acompanhando**', (route) => route.fulfill(json({ data: [], total: 0 })));
  await page.route('**/propriedades/eventos-analisados-com-price**', (route) => route.fulfill(json({ data: [] })));
  await page.route('**/notifications/user/unread-count', (route) => route.fulfill(json({ unread: 0 })));
  await page.route('**/notifications/user/?**', (route) => route.fulfill(json({ data: [], page: 1, lastPage: 1, total: 0 })));
}

const MOBILE = { width: 390, height: 844 };

test.describe('Shell mobile do anfitrião', () => {
  // Rotas do App Router carregam chunks sob demanda; em máquina carregada a
  // navegação passa de 5s.
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    await mockHostApi(page);
  });

  test('tab bar navega entre abas, marca a ativa e tem alvos de 44px', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/painel', { waitUntil: 'domcontentloaded' });

    const tabbar = page.getByRole('navigation', { name: 'Navegação principal' });
    await expect(tabbar).toBeVisible();
    // Hoje (/painel), Calendário, Imóveis, Avisos + Mais, nessa ordem.
    await expect(tabbar.getByRole('link')).toHaveText(['Hoje', 'Calendário', 'Imóveis', 'Avisos']);
    await expect(tabbar.getByRole('button', { name: 'Mais' })).toBeVisible();
    await expect(tabbar.getByRole('link', { name: 'Hoje' })).toHaveAttribute('aria-current', 'page');

    for (const link of await tabbar.getByRole('link').all()) {
      const box = await link.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }

    await tabbar.getByRole('link', { name: 'Calendário' }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
    await expect(tabbar.getByRole('link', { name: 'Calendário' })).toHaveAttribute('aria-current', 'page');
    await expect(tabbar.getByRole('link', { name: 'Hoje' })).not.toHaveAttribute('aria-current', 'page');

    await tabbar.getByRole('link', { name: 'Avisos' }).click();
    await expect(page).toHaveURL(/\/notificacao$/, { timeout: 20_000 });
    await expect(tabbar.getByRole('link', { name: 'Avisos' })).toHaveAttribute('aria-current', 'page');
  });

  test('"Mais" abre bottom sheet com foco preso e fecha com Esc devolvendo o foco', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/painel', { waitUntil: 'domcontentloaded' });

    const more = page.getByRole('button', { name: 'Mais' });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    const sheet = page.getByRole('dialog', { name: 'Mais' });
    // Repete o toque até a hidratação do React ligar o handler.
    await expect(async () => {
      await more.click();
      await expect(sheet).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => sheet.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    // Radar, Portfólio, Ganhos, Plano, Perfil, Integrações, Comunicações, Precificação e Mapa.
    for (const name of ['Radar', 'Portfólio', 'Ganhos', 'Meu plano', 'Perfil', 'Integrações', 'Comunicações', 'Precificação', 'Mapa']) {
      await expect(sheet.getByRole('link', { name })).toBeVisible();
    }
    // As quatro abas principais não se repetem no sheet.
    await expect(sheet.getByRole('link', { name: 'Imóveis' })).toHaveCount(0);
    // O FAB do Ask Urban não pode cobrir o sheet.
    const fab = page.locator('[data-ask-urban-fab]');
    if (await fab.count()) await expect(fab).toBeHidden();

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(more).toBeFocused();

    await more.click();
    await page.getByRole('dialog', { name: 'Mais' }).getByRole('link', { name: 'Perfil' }).click();
    await expect(page).toHaveURL(/\/profile$/, { timeout: 20_000 });
    await expect(page.getByRole('dialog', { name: 'Mais' })).toBeHidden();
  });

  test('safe areas: tab bar e top bar respeitam o inset e o rodapé não fica atrás da tab bar', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/my-plan', { waitUntil: 'domcontentloaded' });
    // Chromium não simula notch; as safe areas do shell passam por variáveis
    // centralizadas, então simulamos um iPhone com notch (47px) e home indicator (34px).
    await page.addStyleTag({ content: ':root { --app-safe-top: 47px; --app-safe-bottom: 34px; }' });

    const tabbar = page.locator('[data-host-bottom-nav]');
    await expect(tabbar).toBeVisible();

    const metrics = await page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>('[data-host-bottom-nav]')!;
      const topbar = document.querySelector<HTMLElement>('[data-host-mobile-topbar]')!;
      const navRect = nav.getBoundingClientRect();
      return {
        viewportHeight: window.innerHeight,
        navBottom: navRect.bottom,
        navPaddingBottom: Number.parseFloat(getComputedStyle(nav).paddingBottom),
        topbarPaddingTop: Number.parseFloat(getComputedStyle(topbar).paddingTop),
      };
    });

    expect(metrics.navBottom).toBeCloseTo(metrics.viewportHeight, 0);
    expect(metrics.navPaddingBottom).toBe(34);
    expect(metrics.topbarPaddingTop).toBe(47);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const clearance = await page.evaluate(() => {
      const footer = document.querySelector<HTMLElement>('[data-app-footer]');
      const footerContent = footer?.firstElementChild?.getBoundingClientRect();
      const nav = document.querySelector('[data-host-bottom-nav]')!.getBoundingClientRect();
      return { footerContentBottom: footerContent?.bottom ?? 0, navTop: nav.top };
    });
    expect(clearance.footerContentBottom).toBeLessThanOrEqual(clearance.navTop + 1);
  });

  test('top bar mostra o título compacto da tela ao rolar', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/painel', { waitUntil: 'domcontentloaded' });
    const topbar = page.locator('[data-host-mobile-topbar]');
    await expect(topbar).toHaveAttribute('data-scrolled', 'false');
    await expect(async () => {
      await page.evaluate(() => window.scrollTo(0, 400));
      await expect(topbar).toHaveAttribute('data-scrolled', 'true', { timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await expect(topbar.locator('.urban-topbar__title')).toHaveText('Hoje');
  });

  test('desktop mantém a sidebar e esconde tab bar e top bar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/painel', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-host-sidebar]')).toBeVisible();
    await expect(page.locator('[data-host-bottom-nav]')).toBeHidden();
    await expect(page.locator('[data-host-mobile-topbar]')).toBeHidden();
  });
});
