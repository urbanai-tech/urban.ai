import { expect, test } from '@playwright/test';

async function mockDashboardShell(page: import('@playwright/test').Page) {
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-logout-e2e',
        username: 'Host Logout',
        email: 'host.logout@urbanai.com.br',
        role: 'USER',
      }),
    });
  });

  await page.route('**/payments/getSubscription', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'sub_logout_e2e', status: 'active' }),
    });
  });

  await page.route('**/propriedades/dropdown/list', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'prop-logout-e2e',
          propertyName: 'Studio Logout',
          userId: 'user-logout-e2e',
          analisado: 'completed',
          image_url: 'https://example.com/studio-logout.jpg',
          latitude: -23.56,
          longitude: -46.65,
          nome: 'Studio Logout',
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
}

test.describe('Logout', () => {
  test('encerra sessao no backend e volta para login', async ({ page }) => {
    const logoutCalls: string[] = [];

    await mockDashboardShell(page);
    await page.route('**/auth/logout', async (route) => {
      logoutCalls.push(route.request().method());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: /Calend.rio/i })).toBeVisible();
    await page.getByRole('button', { name: /^Logout$/i }).click();

    expect(logoutCalls).toEqual(['POST']);
    await page.waitForURL(/\/$/);
    await expect(page.getByRole('heading', { name: /Entre na sua conta/i })).toBeVisible();
  });
});
