import { test, expect, type Page } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

const authEmail = process.env.E2E_AUTH_EMAIL || process.env.E2E_EMAIL;
const authPassword = process.env.E2E_AUTH_PASSWORD || process.env.E2E_PASSWORD;
const alphaEmail = process.env.E2E_ALPHA_EMAIL || authEmail;

async function login(page: Page) {
  await acceptCookieConsent(page);
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

  await expect(page.getByText(/credenciais invalidas|invalid credentials/i)).toHaveCount(0);
}

async function expectNotBackAtLogin(page: Page) {
  await expect(page).not.toHaveURL(/\/login$|\/$/);
  await expect(page.getByRole('heading', { name: /entre na sua conta/i })).toHaveCount(0);
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
    await expect(
      page.getByRole('heading', { name: /calend.rio/i }).or(
        page.getByText(/ainda n.o h. im.vel|sem recomenda/i),
      ),
    ).toBeVisible({ timeout: 15_000 });

    await page.goto('/admin');
    await expectNotBackAtLogin(page);
    await expect(
      page.getByRole('heading', { name: /painel urban ai|painel/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/acesso negado/i)).toHaveCount(0);

    await page.goto('/admin/alpha');
    await expectNotBackAtLogin(page);
    await expect(page.getByRole('heading', { name: /painel alpha/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/acesso negado/i)).toHaveCount(0);

    if (alphaEmail) {
      await page.locator('input').first().fill(alphaEmail);
      await page.getByRole('button', { name: /atualizar/i }).click();
    }

    await expect(page.getByRole('heading', { name: /recomenda..es/i })).toBeVisible({
      timeout: 15_000,
    });

    await page.goto('/admin/roi');
    await expectNotBackAtLogin(page);
    await expect(page.getByRole('heading', { name: /roi dos anfitri/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/acesso negado/i)).toHaveCount(0);
  });
});
