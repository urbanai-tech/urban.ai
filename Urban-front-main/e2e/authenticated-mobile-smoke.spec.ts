import { expect, test, type Page } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

const authEmail = process.env.E2E_AUTH_EMAIL || process.env.E2E_EMAIL;
const authPassword = process.env.E2E_AUTH_PASSWORD || process.env.E2E_PASSWORD;

async function login(page: Page) {
  await acceptCookieConsent(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await page.locator('input[type="email"]').fill(authEmail!);
  await page.locator('input[type="password"]').fill(authPassword!);

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/auth/login') &&
        response.request().method() === 'POST' &&
        response.status() < 500,
    ),
    page.getByRole('button', { name: /entrar/i }).click(),
  ]);

  await page.waitForURL(/\/(post-login|dashboard|onboarding|app|confirm-email)/, {
    timeout: 15_000,
  });
}

async function expectMobileHealthy(page: Page) {
  await expect(page).not.toHaveURL(/\/login$|\/$/);
  await expect(page.getByText(/credenciais invalidas|invalid credentials|acesso negado/i)).toHaveCount(0);

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

test.describe('Smoke autenticado mobile', () => {
  test.skip(
    !authEmail || !authPassword,
    'Defina E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD para rodar o smoke autenticado mobile.',
  );

  test('rotas core do anfitriao e admin carregam sem overflow horizontal', async ({ page }) => {
    await login(page);

    for (const route of ['/dashboard', '/properties', '/my-plan', '/settings/integrations']) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expectMobileHealthy(page);
    }

    await page.goto('/admin/properties');
    await page.waitForLoadState('networkidle');
    await expectMobileHealthy(page);
  });
});
