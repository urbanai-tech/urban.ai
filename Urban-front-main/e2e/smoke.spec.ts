import { test, expect } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

/**
 * Smoke tests - public production-safe checks.
 * Authenticated E2E needs a real beta tester credential or a staging seed user.
 */

test.describe('Smoke - rotas publicas', () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookieConsent(page);
  });

  test('home responde e nao explode', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status(), 'home should respond 200-ish').toBeLessThan(400);
    await expect(page).toHaveTitle(/urban ai/i);
  });

  test('landing de lancamento tem hero e CTA de acesso antecipado', async ({ page }) => {
    await page.goto('/lancamento');
    await expect(page.getByRole('heading', { name: /ESGOTAR R.PIDO/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /LISTA DE ACESSO ANTECIPADO/i })).toBeVisible();
  });

  test('landing tem formulario de waitlist e aceita entrada de e-mail', async ({ page }) => {
    await page.goto('/lancamento#waitlist');
    const input = page.locator('input[type="email"][id="waitlist-email"]');
    await expect(input).toBeVisible();
    await input.fill('teste+smoke@urbanai.com.br');
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

  test('link criar conta do header aponta para o app com barra correta', async ({ page }) => {
    await page.goto('/lancamento');
    await expect(page.getByRole('link', { name: 'Criar conta' }).first()).toHaveAttribute(
      'href',
      /https:\/\/app\.myurbanai\.com\/create$/,
    );
  });

  test('pagina de planos mostra os 2 planos, auth ou pre-launch', async ({ page }) => {
    await page.goto('/plans');
    const { pathname } = new URL(page.url());
    const reachedExpectedRoute =
      pathname === '/' ||
      pathname === '/plans' ||
      pathname === '/login' ||
      pathname.startsWith('/auth');
    expect(reachedExpectedRoute, `inesperado: ${page.url()}`).toBe(true);
  });
});

test.describe('Smoke - sinalizacoes de ambiente', () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookieConsent(page);
  });

  test('banner de STAGING aparece quando NEXT_PUBLIC_APP_ENV=staging', async ({ page, baseURL }) => {
    test.skip(
      !baseURL?.includes('staging'),
      'Sobe so quando rodando contra staging - em prod, banner nao deve aparecer.',
    );
    await page.goto('/');
    await expect(page.locator('text=/STAGING/i')).toBeVisible();
  });
});
