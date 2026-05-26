import { test, expect, type Page } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

const authEmail = process.env.E2E_EMAIL || process.env.E2E_AUTH_EMAIL;
const authPassword = process.env.E2E_PASSWORD || process.env.E2E_AUTH_PASSWORD;

function isPostLoginRoute(url: URL) {
  return /\/(post-login|dashboard|onboarding|confirm-email)(\/|$)/.test(url.pathname);
}

async function login(page: Page) {
  await acceptCookieConsent(page);
  await page.goto('/');

  await page.locator('input[type="email"]').fill(authEmail!);
  await page.locator('input[type="password"]').fill(authPassword!);

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
  test.skip(
    !authEmail || !authPassword,
    'Defina E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD para rodar o smoke autenticado.',
  );

  test('login acessa dashboard, admin, alpha e ROI', async ({ page }) => {
    await login(page);

    await page.goto('/dashboard');
    await expectNotBackAtLogin(page);
    await expectRouteText(page, /calendario|eventos|imoveis|sugestoes|propriedade/i);

    await page.goto('/admin');
    await expectNotBackAtLogin(page);
    await expectRouteText(page, /painel urban ai|painel/i);
    await expect(page.getByText(/acesso negado/i)).toHaveCount(0);

    await page.goto('/admin/alpha');
    await expectNotBackAtLogin(page);
    await expectRouteText(page, /painel alpha/i);
    await expect(page.getByText(/acesso negado/i)).toHaveCount(0);

    await page.goto('/admin/roi');
    await expectNotBackAtLogin(page);
    await expectRouteText(page, /roi dos anfitri/i);
    await expect(page.getByText(/acesso negado/i)).toHaveCount(0);
  });
});
