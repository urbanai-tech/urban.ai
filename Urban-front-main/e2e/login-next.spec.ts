import { expect, type Page, test } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

async function mockLoginApis(page: Page) {
  await page.route('**/auth/login', (route) =>
    route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
  );
  await page.route('**/email/verificar-usuario-state', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ativo: true }) }),
  );
  await page.route('**/users/me/has-address**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hasAddress: true, count: 1 }) }),
  );
  await page.route('**/auth/profile', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ email: 'host.next@urbanai.com.br', emailVerifiedAt: '2026-01-01T00:00:00.000Z' }),
    }),
  );
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'user-next-e2e', username: 'Host Next', email: 'host.next@urbanai.com.br', role: 'USER' }),
    }),
  );
  await page.route('**/payments/getSubscription', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'sub_next', status: 'active' }) }),
  );
  await page.route('**/plans', (route) => {
    if (route.request().resourceType() === 'document') return route.continue();
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/propriedades/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }),
  );
}

async function fillAndSubmit(page: Page) {
  await page.locator('input[type="email"]').fill('host.next@urbanai.com.br');
  await page.locator('input[type="password"]').fill('UrbanLogin@123');
  await page.getByRole('button', { name: /Entrar/i }).click();
}

test.describe('Login honra o destino (next)', () => {
  test('sessao expirada -> login -> volta para a pagina de origem', async ({ page }) => {
    await acceptCookieConsent(page);
    await mockLoginApis(page);

    await page.goto('/?next=%2Fplans');
    await fillAndSubmit(page);

    await page.waitForURL(/\/plans$/, { timeout: 10_000 });
    await expect(page.getByRole('link', { name: /Voltar ao painel/i })).toBeVisible();
  });

  test('next externo ou protocol-relative e ignorado (segue para o dashboard)', async ({ page }) => {
    await acceptCookieConsent(page);
    await mockLoginApis(page);

    await page.goto('/?next=%2F%2Fevil.example');
    await fillAndSubmit(page);

    await page.waitForURL(/\/dashboard$/, { timeout: 10_000 });
    expect(new URL(page.url()).hostname).not.toContain('evil');
  });

  test('login tem h1 tambem no mobile', async ({ page }) => {
    await acceptCookieConsent(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1, name: /Bem-vindo/i })).toBeVisible();
  });
});
