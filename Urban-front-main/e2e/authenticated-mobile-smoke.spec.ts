import { expect, test, type Page } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

type Credentials = {
  email: string;
  password: string;
  source: string;
};

const adminCredentials = pickCredentials('admin', [
  ['E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD'],
  ['ENTERPRISE_GATE_ADMIN_EMAIL', 'ENTERPRISE_GATE_ADMIN_PASSWORD'],
  ['E2E_AUTH_EMAIL', 'E2E_AUTH_PASSWORD'],
  ['E2E_EMAIL', 'E2E_PASSWORD'],
]);

const hostCredentials = pickCredentials('host', [
  ['E2E_HOST_EMAIL', 'E2E_HOST_PASSWORD'],
  ['ENTERPRISE_GATE_HOST_EMAIL', 'ENTERPRISE_GATE_HOST_PASSWORD'],
]);

function pickCredentials(role: string, pairs: Array<[string, string]>): Credentials | null {
  for (const [emailKey, passwordKey] of pairs) {
    const email = process.env[emailKey];
    const password = process.env[passwordKey];
    if (email && password) return { email, password, source: `${role}:${emailKey}/${passwordKey}` };
  }

  return null;
}

function isPostLoginRoute(url: URL) {
  return /\/(post-login|dashboard|onboarding|confirm-email)(\/|$)/.test(url.pathname);
}

async function login(page: Page, credentials: Credentials) {
  await acceptCookieConsent(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await page.locator('input[type="email"]').fill(credentials.email);
  await page.locator('input[type="password"]').fill(credentials.password);

  const [loginResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/auth/login') &&
        response.request().method() === 'POST' &&
        response.status() < 500,
    ),
    page.getByRole('button', { name: /entrar/i }).click(),
  ]);

  expect(loginResponse.ok(), `login respondeu HTTP ${loginResponse.status()}`).toBeTruthy();

  await page.waitForURL(isPostLoginRoute, {
    timeout: 15_000,
  });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
}

async function gotoAuthenticatedRoute(page: Page, route: string) {
  await page.goto(route, { waitUntil: 'domcontentloaded' }).catch((error: unknown) => {
    if (!(error instanceof Error) || !error.message.includes('net::ERR_ABORTED')) throw error;
  });
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  await page.waitForTimeout(750);
}

async function expectMobileAuthenticatedRouteReady(page: Page) {
  await expect
    .poll(() => {
      const url = new URL(page.url());
      return url.pathname === '/' || /^\/login\/?$/.test(url.pathname);
    }, { timeout: 10_000 })
    .toBe(false);
  await expect(page.getByRole('heading', { name: /bem-vindo|entre na sua conta/i })).toHaveCount(0);
  await expect(page.getByText(/credenciais invalidas|invalid credentials|acesso negado/i)).toHaveCount(0);
}

test.describe('Smoke autenticado mobile', () => {
  test('rotas core do anfitriao carregam no viewport mobile', async ({ page }) => {
    test.skip(!hostCredentials, 'Defina E2E_HOST_EMAIL/E2E_HOST_PASSWORD para rodar o smoke host mobile.');

    await login(page, hostCredentials!);

    for (const route of ['/dashboard', '/properties', '/my-plan', '/settings/integrations']) {
      await gotoAuthenticatedRoute(page, route);
      await expect(page.locator('body')).toBeVisible();
      await expectMobileAuthenticatedRouteReady(page);
    }
  });

  test('rota admin de propriedades carrega no viewport mobile', async ({ page }) => {
    test.skip(!adminCredentials, 'Defina E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD para rodar o smoke admin mobile.');

    await login(page, adminCredentials!);

    await gotoAuthenticatedRoute(page, '/admin/properties');
    await expect(page.locator('body')).toBeVisible();
    await expectMobileAuthenticatedRouteReady(page);
  });
});
