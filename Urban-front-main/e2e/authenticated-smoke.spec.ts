import { test, expect, type Page } from '@playwright/test';
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

  await expect(page.getByText(/credenciais invalidas|invalid credentials/i)).toHaveCount(0);
}

async function gotoAuthenticatedRoute(page: Page, route: string) {
  await page.goto(route, { waitUntil: 'domcontentloaded' }).catch((error: unknown) => {
    if (!(error instanceof Error) || !error.message.includes('net::ERR_ABORTED')) throw error;
  });
  await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  await page.waitForTimeout(750);
}

async function expectNotBackAtLogin(page: Page) {
  await expect
    .poll(() => {
      const url = new URL(page.url());
      return url.pathname === '/' || /^\/login\/?$/.test(url.pathname);
    }, { timeout: 10_000 })
    .toBe(false);
  await expect(page.getByRole('heading', { name: /bem-vindo|entre na sua conta/i })).toHaveCount(0);
  await expect(page.getByText(/credenciais invalidas|invalid credentials|acesso negado/i)).toHaveCount(0);
}

async function expectRouteText(page: Page, marker: RegExp) {
  await expect(page.locator('body')).toContainText(marker, { timeout: 15_000 });
}

test.describe('Smoke autenticado - F3/F4/F7', () => {
  test('host acessa dashboard operacional', async ({ page }) => {
    test.skip(!hostCredentials, 'Defina E2E_HOST_EMAIL/E2E_HOST_PASSWORD para rodar o smoke host.');

    await login(page, hostCredentials!);

    await gotoAuthenticatedRoute(page, '/dashboard');
    await expectNotBackAtLogin(page);
    await expectRouteText(page, /calendario|eventos|imoveis|sugestoes|propriedade/i);
  });

  test('admin acessa painel, alpha e ROI', async ({ page }) => {
    test.skip(!adminCredentials, 'Defina E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD para rodar o smoke admin.');

    await login(page, adminCredentials!);

    await gotoAuthenticatedRoute(page, '/admin');
    await expectNotBackAtLogin(page);
    await expectRouteText(page, /painel urban ai|painel/i);
    await expect(page.getByText(/acesso negado/i)).toHaveCount(0);

    await gotoAuthenticatedRoute(page, '/admin/alpha');
    await expectNotBackAtLogin(page);
    await expectRouteText(page, /painel alpha/i);
    await expect(page.getByText(/acesso negado/i)).toHaveCount(0);

    await gotoAuthenticatedRoute(page, '/admin/roi');
    await expectNotBackAtLogin(page);
    await expectRouteText(page, /roi dos anfitri/i);
    await expect(page.getByText(/acesso negado/i)).toHaveCount(0);
  });
});
