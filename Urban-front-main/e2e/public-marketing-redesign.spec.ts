import { expect, test } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

test.describe('Site público comercial', () => {
  test.beforeEach(async ({ page }) => acceptCookieConsent(page));

  test('landing explica o produto, mostra a interface e usa um funil de cadastro real', async ({ page }) => {
    await page.goto('/landing', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { level: 1, name: /cidade muda/i })).toBeVisible();
    await expect(page.getByLabel('Prévia principal do painel de recomendação da Urban AI')).toBeVisible();
    await expect(page.locator('.public-hero').getByRole('link', { name: /Criar minha conta/i })).toHaveAttribute('href', /\/create$/);
    await expect(page.locator('body')).not.toContainText(/pré-lançamento|lista de espera|beta privado|acesso por convite/i);
  });

  test('menu móvel expõe estado, fecha com Escape e não cria overflow horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/landing');

    const toggle = page.getByRole('button', { name: 'Abrir menu' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(page.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('navigation', { name: 'Navegação móvel' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();

    const widths = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  });

  test('preços apresentam CTA por plano e comparação objetiva', async ({ page }) => {
    await page.goto('/precos');
    await expect(page.getByRole('heading', { level: 1, name: /cada fase/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Starter' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Profissional', exact: true })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('link', { name: /Escolher plano/i })).toHaveCount(2);
  });

  test('rota de lançamento virou início comercial sem formulário de espera', async ({ page }) => {
    await page.goto('/lancamento');
    await expect(page.getByRole('heading', { level: 1, name: /comece com um imóvel/i })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(page.locator('.public-page-hero').getByRole('link', { name: /Criar minha conta/i })).toHaveAttribute('href', /\/create$/);
  });
});
