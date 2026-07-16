import { expect, test, type Page } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

async function mockAdminSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('accessToken', 'e2e-theme-admin-token');
  });

  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'e2e-theme-admin',
        username: 'Admin Theme E2E',
        email: 'admin-theme+e2e@urbanai.com.br',
        role: 'admin',
      }),
    });
  });
  await page.route('**/payments/getSubscription', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'active', plan: 'pro' }),
    });
  });
  await page.route('**/admin/overview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        users: { total: 1, active: 1, admins: 1 },
        product: {
          propertiesRegistered: 0,
          eventsTotal: 0,
          eventsLast7d: 0,
          analysesTotal: 0,
          analysesAccepted: 0,
          acceptanceRatePercent: 0,
        },
        revenue: { activeSubscriptions: 0 },
        ai: {
          currentTier: 'bootstrap',
          currentStrategy: 'rules',
          reason: 'e2e',
          dataset: { totalSnapshots: 0, distinctListings: 0, distinctDays: 0, trainingReady: 0 },
        },
      }),
    });
  });
  await page.route('**/admin/pricing/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        activeStrategy: 'rules',
        tier: 'bootstrap',
        reason: 'e2e',
        datasetSize: { total: 0, distinctListings: 0, distinctDays: 0, trainingReady: 0 },
        strategyEnvDefault: 'rules',
        bootstrapOnBoot: false,
      }),
    });
  });
  await page.route('**/admin/dataset/metrics', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ byOrigin: [], daysCovered: 0, topListings: [] }),
    });
  });
}

test.describe('Theme preference', () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookieConsent(page);
  });

  test('applies persisted dark theme before page interaction', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('urban-ai-theme', 'dark');
    });

    await page.goto('/lancamento', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(8, 10, 15)');
  });

  test('applies persisted light theme before page interaction', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('urban-ai-theme', 'light');
    });

    await page.goto('/lancamento', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(250, 250, 251)');
  });

  test('system mode follows browser color scheme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(() => {
      window.localStorage.setItem('urban-ai-theme', 'system');
    });

    await page.goto('/lancamento', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('admin theme toggle persists the selected mode', async ({ page }) => {
    await mockAdminSession(page);
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: 'Usar tema escuro' }).click();

    await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('urban-ai-theme'))).toBe('dark');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByText(/Network Error/i)).toHaveCount(0);
  });
});
