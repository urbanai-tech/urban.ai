import { expect, type Route, test } from '@playwright/test';
import { installLocalAuthFixture } from './local-auth-fixture';
import { acceptCookieConsent } from './test-helpers';

/**
 * Onda 2 / PR E - navegação e teclado (WCAG 2.1.1, 2.4.3, 2.4.1, 4.1.2).
 * 100% mockado: menu público mobile como dialog, sidebar com links reais,
 * skip link, aviso de sessão expirada, validação inline do cadastro e
 * região rolável focável nas tabelas do admin.
 */

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

test.describe('menu público mobile (A11Y-14)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('dialog: foco inicial, Tab/Shift+Tab presos, Escape devolve o foco ao botão', async ({ page }) => {
    await acceptCookieConsent(page);
    await page.goto('/landing');

    const toggle = page.getByRole('button', { name: 'Abrir menu' });
    await toggle.click();

    const dialog = page.getByRole('dialog', { name: 'Menu de navegação' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    const links = dialog.getByRole('link');
    await expect(links.first()).toBeFocused();

    // Shift+Tab do primeiro item vai ao botão (que continua visível) e dele ao último link.
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Fechar menu' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(links.last()).toBeFocused();
    // Tab do último volta ao botão e depois ao primeiro link: o foco não escapa do menu.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Fechar menu' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(links.first()).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeFocused();
  });
});

test.describe('sidebar do app (A11Y-08)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('itens são links com aria-current e o skip link leva ao conteúdo', async ({ page }) => {
    await installLocalAuthFixture(page, 'host');
    await page.route('**/propriedades/dropdown/list', (route) => json(route, []));
    await page.goto('/painel', { waitUntil: 'domcontentloaded' });
    await page.locator('main').first().waitFor({ state: 'visible' });

    const sidebar = page.locator('[data-host-sidebar]');
    const painel = sidebar.getByRole('link', { name: /painel|hoje/i }).first();
    await expect(painel).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /imóveis/i }).first()).toHaveAttribute('href', '/properties');
    await expect(sidebar.locator('a[aria-current="page"]')).toHaveCount(1);

    // O skip link é o primeiro Tab e move o foco para o <main>.
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Pular para conteúdo principal' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#host-main-content')).toBeFocused();
  });
});

test.describe('sessão expirada (E2E-06)', () => {
  test('mostra o aviso só quando vem do redirect de sessão expirada', async ({ page }) => {
    await acceptCookieConsent(page);
    await page.goto('/?next=%2Fproperties&reason=session-expired');
    await expect(page.getByRole('status').filter({ hasText: 'Sua sessão expirou' })).toBeVisible();

    await page.goto('/?next=%2Fproperties');
    await expect(page.getByText('Sua sessão expirou')).toHaveCount(0);
  });
});

test.describe('cadastro (A11Y-12 / E2E-17)', () => {
  test('botão habilitado: o que falta aparece inline e o e-mail duplicado marca o campo', async ({ page }) => {
    await acceptCookieConsent(page);
    await page.goto('/create');

    const submit = page.getByRole('button', { name: 'Criar conta' });
    await expect(submit).toBeEnabled();
    await submit.click();

    const summary = page.locator('#create-error');
    await expect(summary).toHaveAttribute('role', 'alert');
    await expect(summary).toContainText('nome de usuário');
    await expect(summary).toContainText('e-mail');
    await expect(summary).toContainText('Termos de Uso');
    await expect(submit).toHaveAttribute('aria-describedby', 'create-error');
    await expect(page.getByLabel('E-mail')).toHaveAttribute('aria-invalid', 'true');

    await page.route('**/auth/register', (route) => json(route, { message: 'E-mail já cadastrado.' }, 409));
    await page.getByLabel('Nome de usuário').fill('Ana Host');
    await page.getByLabel('E-mail').fill('ana@urbanai.invalid');
    await page.getByLabel('Senha', { exact: true }).fill('Senha123!');
    await page.getByLabel('Confirmar senha').fill('Senha123!');
    await page.getByRole('checkbox', { name: /Termos de Uso/i }).check();
    await submit.click();

    await expect(page.locator('#create-error')).toContainText('E-mail já cadastrado.');
    const email = page.getByLabel('E-mail');
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(email).toHaveAccessibleDescription(/E-mail já cadastrado/);
  });
});

test.describe('admin (A11Y-13)', () => {
  test('tabela é região focável, coluna de ação tem nome e o link da linha também', async ({ page }) => {
    await installLocalAuthFixture(page, 'admin');
    // Só a chamada de API (o glob também casa o documento e o chunk JS da própria página).
    await page.route('**/admin/properties**', (route) => {
      if (!['fetch', 'xhr'].includes(route.request().resourceType())) return route.continue();
      return json(route, {
        items: [
          {
            id: 'p1aaaaaaaa',
            propertyName: 'Loft Centro',
            userId: 'u1',
            userEmail: 'a@b.c',
            city: 'São Paulo',
            state: 'SP',
            latitude: -23,
            longitude: -46,
            manualDailyPrice: 300,
            lastAnalysisAt: null,
            futureRecommendationsCount: 0,
          },
        ],
      });
    });
    await page.goto('/admin/properties', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Loft Centro')).toBeVisible();

    const region = page.locator('[role="region"][tabindex="0"]').first();
    await expect(region).toBeVisible();
    await expect(region).toHaveAccessibleName(/\S/);
    await expect(page.getByRole('columnheader', { name: 'Ações' }).last()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver detalhes de Loft Centro' })).toBeVisible();
  });

  test('drawer mobile: foco entra, Escape fecha e devolve o foco ao botão de menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installLocalAuthFixture(page, 'admin');
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await page.locator('main').first().waitFor({ state: 'visible' });

    const trigger = page.getByRole('button', { name: 'Abrir menu' });
    await trigger.focus();
    await trigger.click();
    const drawer = page.getByRole('dialog', { name: 'Menu de operação' });
    await expect(drawer).toBeVisible();
    await expect
      .poll(() => drawer.evaluate((node) => node.contains(document.activeElement)))
      .toBe(true);
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
