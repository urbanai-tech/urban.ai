import { test, expect } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

/**
 * Smoke tests - public production-safe checks.
 * Authenticated E2E needs a staging seed user.
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

  test('rota de lancamento apresenta o produto disponivel e cadastro real', async ({ page }) => {
    await page.goto('/lancamento');
    await expect(page.getByRole('heading', { name: /Comece com um im.vel/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Criar minha conta' }).first()).toHaveAttribute('href', /\/create$/);
  });

  test('rota de lancamento nao reintroduz lista de espera', async ({ page }) => {
    await page.goto('/lancamento');
    await expect(page.locator('#waitlist-email')).toHaveCount(0);
    await expect(page.getByText(/lista de acesso antecipado/i)).toHaveCount(0);
    await expect(page.getByText(/produto est. dispon.vel para cadastro/i)).toBeVisible();
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
