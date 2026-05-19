import { expect, test, type Page, type Route } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

const hostReadOnlyRoutes = ['/dashboard', '/properties', '/portfolio', '/my-plan'];
const adminReadOnlyRoutes = ['/admin', '/admin/dashboard', '/admin/properties', '/admin/users'];
const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

type MutationCall = {
  method: string;
  path: string;
};

async function mockSession(page: Page) {
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'e2e-admin',
        username: 'Admin E2E',
        email: 'admin+e2e@urbanai.com.br',
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

  await page.addInitScript(() => {
    window.localStorage.setItem('accessToken', 'e2e-readonly-token');
  });
}

function isBackendMutation(route: Route) {
  const request = route.request();
  if (!mutatingMethods.has(request.method())) return false;

  const url = new URL(request.url());
  if (url.pathname.startsWith('/_next/')) return false;
  if (url.pathname.startsWith('/__')) return false;

  return true;
}

test.describe('Read-only gates - host e admin', () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookieConsent(page);
    await mockSession(page);
  });

  for (const routeName of hostReadOnlyRoutes) {
    test(`host ${routeName} nao dispara mutacao no carregamento`, async ({ page }) => {
      const mutations: MutationCall[] = [];

      await page.route('**/*', async (route) => {
        if (isBackendMutation(route)) {
          const request = route.request();
          mutations.push({ method: request.method(), path: new URL(request.url()).pathname });
          await route.fulfill({ status: 405, contentType: 'application/json', body: '{"error":"blocked by e2e"}' });
          return;
        }

        await route.fallback();
      });

      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(routeName, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), `${routeName} deve responder sem erro de documento`).toBeLessThan(500);
      await page.waitForTimeout(750);

      expect(mutations).toEqual([]);
    });
  }

  for (const routeName of adminReadOnlyRoutes) {
    test(`admin ${routeName} nao dispara mutacao no carregamento`, async ({ page }) => {
      const mutations: MutationCall[] = [];

      await page.route('**/*', async (route) => {
        if (isBackendMutation(route)) {
          const request = route.request();
          mutations.push({ method: request.method(), path: new URL(request.url()).pathname });
          await route.fulfill({ status: 405, contentType: 'application/json', body: '{"error":"blocked by e2e"}' });
          return;
        }

        await route.fallback();
      });

      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(routeName, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), `${routeName} deve responder sem erro de documento`).toBeLessThan(500);
      await page.waitForTimeout(750);

      expect(mutations).toEqual([]);
    });
  }

  test('footer do host fica acima da bottom-nav no mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/my-plan', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-app-footer]').scrollIntoViewIfNeeded();

    const metrics = await page.evaluate(() => {
      const footerContent = document.querySelector('[data-app-footer] > div')?.getBoundingClientRect();
      const bottomNav = document.querySelector('[data-host-bottom-nav]')?.getBoundingClientRect();

      return {
        footerContentBottom: footerContent?.bottom ?? 0,
        bottomNavTop: bottomNav?.top ?? 0,
      };
    });

    expect(metrics.footerContentBottom).toBeLessThanOrEqual(metrics.bottomNavTop + 1);
  });
});
