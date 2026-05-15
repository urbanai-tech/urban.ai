import { expect, test } from '@playwright/test';

test.describe('Login and post-login routing', () => {
  test('faz login com senha hasheada e direciona host com propriedade para dashboard', async ({ page }) => {
    const loginPayloads: Array<{ email?: string; password?: string }> = [];
    const statePayloads: Array<{ email?: string }> = [];

    await page.route('**/auth/login', async (route) => {
      loginPayloads.push(route.request().postDataJSON());
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.route('**/email/verificar-usuario-state', async (route) => {
      statePayloads.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ativo: true }),
      });
    });

    await page.route('**/users/me/has-address**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ hasAddress: true, count: 1 }),
      });
    });

    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-login-e2e',
          username: 'Host Login E2E',
          email: 'host.login@urbanai.com.br',
          role: 'USER',
        }),
      });
    });

    await page.route('**/payments/getSubscription', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'sub_login_e2e', status: 'active' }),
      });
    });

    await page.route('**/propriedades/dropdown/list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'prop-login-e2e',
            propertyName: 'Studio Login',
            userId: 'user-login-e2e',
            analisado: 'completed',
            image_url: 'https://example.com/studio-login.jpg',
            latitude: -23.56,
            longitude: -46.65,
            nome: 'Studio Login',
          },
        ]),
      });
    });

    await page.route('**/propriedades/eventos-analisados-com-price**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto('/');

    await page.locator('input[type="email"]').fill('host.login@urbanai.com.br');
    await page.locator('input[type="password"]').fill('UrbanLogin@123');
    await page.getByRole('button', { name: /Entrar/i }).click();

    expect(loginPayloads[0]?.email).toBe('host.login@urbanai.com.br');
    expect(loginPayloads[0]?.password).toMatch(/^[a-f0-9]{64}$/);
    expect(loginPayloads[0]?.password).not.toBe('UrbanLogin@123');
    expect(statePayloads[0]).toEqual({ email: 'host.login@urbanai.com.br' });

    await page.waitForURL(/\/dashboard$/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Calend.rio/i })).toBeVisible();
  });
});
