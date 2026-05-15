import { expect, test } from '@playwright/test';

/**
 * Release-gate smoke for public, production-safe pages.
 *
 * These checks avoid authenticated state and external side effects.
 * They can run against local, staging, or production before a release is promoted.
 */

const publicRoutes = [
  '/',
  '/lancamento',
  '/precos',
  '/sobre',
  '/contato',
  '/termos',
  '/privacidade',
];

const protectedRoutes = [
  '/dashboard',
  '/admin',
  '/admin/dashboard',
  '/admin/jobs',
  '/settings/integrations',
];

test.describe('Release gate - public pages', () => {
  for (const route of publicRoutes) {
    test(`${route} loads without server/runtime error`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });

      expect(response?.status(), `${route} should respond below 400`).toBeLessThan(400);
      await expect(page.locator('body')).not.toContainText(/Application error|Unhandled Runtime Error|404|500/i);
    });
  }

  test('/lancamento keeps legal/support links reachable', async ({ page }) => {
    await page.goto('/lancamento');

    await expect(page.getByRole('link', { name: /Contato/i }).first()).toHaveAttribute('href', /\/contato$/);
    await expect(page.getByRole('link', { name: /Privacidade/i }).first()).toHaveAttribute('href', /\/privacidade$/);
    await expect(page.getByRole('link', { name: /Termos/i }).first()).toHaveAttribute('href', /\/termos$/);
  });
});

test.describe('Release gate - anonymous access', () => {
  for (const route of protectedRoutes) {
    test(`${route} does not expose private app data to anonymous users`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      const body = page.locator('body');
      await expect(body).not.toContainText(/PriceSnapshot|admin_job_runs|Stripe webhook secret|accessToken/i);
    });
  }
});
