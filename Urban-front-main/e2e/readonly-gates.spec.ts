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
      body: JSON.stringify({
        id: 'e2e-readonly-subscription',
        status: 'active',
        metadata: {
          urbanai_plan: 'profissional',
          urbanai_quantity: '2',
          urbanai_billing_cycle: 'monthly',
        },
        plan: { id: 'profissional', amount: 9900, currency: 'brl', interval: 'month' },
      }),
    });
  });

  await page.route('**/payments/listings-quota', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ contratados: 2, ativos: 1, podeAdicionar: true }),
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
  if (/^\/api\/\d+\/envelope\/?$/.test(url.pathname)) return false;

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
    for (const width of [390, 430, 767]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/my-plan', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

      const metrics = await page.evaluate(() => {
        const footer = document.querySelector<HTMLElement>('[data-app-footer]');
        const footerContent = footer?.firstElementChild?.getBoundingClientRect();
        const bottomNav = document.querySelector('[data-host-bottom-nav]')?.getBoundingClientRect();

        return {
          footerContentBottom: footerContent?.bottom ?? 0,
          bottomNavTop: bottomNav?.top ?? 0,
          footerPaddingBottom: footer ? Number.parseFloat(getComputedStyle(footer).paddingBottom) : 0,
        };
      });

      expect(metrics.footerContentBottom, `conteudo do footer em ${width}px`).toBeLessThanOrEqual(
        metrics.bottomNavTop + 1,
      );
      expect(metrics.footerPaddingBottom, `reserva da bottom-nav em ${width}px`).toBeGreaterThanOrEqual(88);
    }

    await page.setViewportSize({ width: 768, height: 844 });
    await page.goto('/my-plan', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-host-bottom-nav]')).toBeHidden();
  });
});

test.describe('Cookie consent layout gates', () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
  });

  test('banner preserva a bottom-nav e reserva area rolavel no host mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/my-plan', { waitUntil: 'domcontentloaded' });

    const banner = page.locator('[data-cookie-consent-banner]');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute('data-cookie-surface', 'host-mobile');
    await expect(page.locator('[data-host-bottom-nav]')).toBeVisible();

    const metrics = await page.evaluate(() => {
      const consent = document.querySelector('[data-cookie-consent-banner]')?.getBoundingClientRect();
      const bottomNav = document.querySelector('[data-host-bottom-nav]')?.getBoundingClientRect();
      return {
        consentBottom: consent?.bottom ?? 0,
        consentHeight: consent?.height ?? 0,
        bottomNavTop: bottomNav?.top ?? 0,
        bodyPaddingBottom: Number.parseFloat(getComputedStyle(document.body).paddingBottom),
      };
    });

    expect(metrics.consentBottom).toBeLessThanOrEqual(metrics.bottomNavTop + 1);
    expect(metrics.bodyPaddingBottom).toBeGreaterThanOrEqual(metrics.consentHeight + 64);
  });

  test('banner do admin reserva espaco e nao cobre o conteudo no fim do scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });

    const banner = page.locator('[data-cookie-consent-banner]');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute('data-cookie-surface', 'admin');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

    const metrics = await page.evaluate(() => {
      const consent = document.querySelector('[data-cookie-consent-banner]')?.getBoundingClientRect();
      const adminContent = document.querySelector('.urban-admin-main > *')?.getBoundingClientRect();
      return {
        consentTop: consent?.top ?? 0,
        consentHeight: consent?.height ?? 0,
        contentBottom: adminContent?.bottom ?? 0,
        bodyPaddingBottom: Number.parseFloat(getComputedStyle(document.body).paddingBottom),
      };
    });

    expect(metrics.contentBottom).toBeLessThanOrEqual(metrics.consentTop - 8);
    expect(metrics.bodyPaddingBottom).toBeGreaterThanOrEqual(metrics.consentHeight + 16);
  });
});
