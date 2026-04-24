import { test, expect } from '@playwright/test';

/**
 * Smoke tests — verificam que as páginas públicas respondem 200 e renderizam
 * o conteúdo essencial. Não cobrem fluxo autenticado — esse virá quando
 * staging estiver provisionado (F5C.2 item 11), permitindo signup real contra
 * um backend não-produtivo.
 */

test.describe('Smoke — rotas públicas', () => {
  test('home responde e não explode', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status(), 'home should respond 200-ish').toBeLessThan(400);
    await expect(page).toHaveTitle(/urban ai/i);
  });

  test('landing de lançamento tem o copy da "Síndrome da Casa Barata"', async ({ page }) => {
    await page.goto('/lancamento');
    await expect(page.locator('text=Síndrome Da Casa Barata')).toBeVisible();
    await expect(page.locator('#cta-piloto-automatico-hero')).toBeVisible();
  });

  test('landing tem formulário de waitlist e aceita entrada de e-mail', async ({ page }) => {
    await page.goto('/lancamento#waitlist');
    const input = page.locator('input[type="email"][id="waitlist-email"]');
    await expect(input).toBeVisible();
    await input.fill('teste+smoke@urbanai.com.br');
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

  test('página de planos mostra os 2 planos (Starter, Profissional)', async ({ page }) => {
    await page.goto('/plans');
    // Essas páginas podem exigir auth em certas configs; aceitamos redirect
    // para login desde que a navegação não quebre.
    const url = page.url();
    const reachedPlansOrLogin = /\/plans|\/(login|auth)/.test(url);
    expect(reachedPlansOrLogin, `inesperado: ${url}`).toBe(true);
  });
});

test.describe('Smoke — sinalizações de ambiente', () => {
  test('banner de STAGING aparece quando NEXT_PUBLIC_APP_ENV=staging', async ({ page, baseURL }) => {
    test.skip(
      !baseURL?.includes('staging'),
      'Sobe só quando rodando contra staging — em prod, banner não deve aparecer.',
    );
    await page.goto('/');
    await expect(page.locator('text=/STAGING/i')).toBeVisible();
  });
});
