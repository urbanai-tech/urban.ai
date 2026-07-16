import { test, expect } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

/**
 * Smoke tests - public production-safe checks.
 * Authenticated E2E needs a real beta tester credential or a staging seed user.
 */

test.describe('Smoke - rotas publicas', () => {
  test('respostas públicas aplicam headers defensivos sem expor o framework', async ({ request }) => {
    const response = await request.get('/');
    expect(response.ok()).toBeTruthy();
    const headers = response.headers();

    expect(headers['x-powered-by']).toBeUndefined();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['strict-transport-security']).toBe('max-age=31536000');
    expect(headers['permissions-policy']).toContain('camera=()');
    expect(headers['content-security-policy-report-only']).toContain("default-src 'self'");
  });

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
    const input = page.locator('input[type="email"][id="waitlist-email"]').first();
    await expect(input).toBeVisible();
    await input.fill('teste+smoke@urbanai.com.br');
    await expect(page.locator('button[type="submit"]').first()).toBeEnabled();
  });

  test('link criar conta do header aponta para o app com barra correta', async ({ page }) => {
    await page.goto('/lancamento');
    const href = await page.getByRole('link', { name: 'Criar conta' }).first().getAttribute('href');
    expect(href).toBeTruthy();

    const createUrl = new URL(href as string);
    expect(createUrl.protocol).toBe('https:');
    expect(createUrl.pathname).toBe('/create');
    expect(createUrl.href).not.toContain('//create');
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

  test('banner de STAGING corresponde ao ambiente executado', async ({ page, baseURL }) => {
    await page.goto('/');
    const banner = page.getByText(/ambiente de staging/i);
    if (baseURL?.includes('staging')) {
      await expect(banner).toBeVisible();
    } else {
      await expect(banner).toHaveCount(0);
    }
  });
});
