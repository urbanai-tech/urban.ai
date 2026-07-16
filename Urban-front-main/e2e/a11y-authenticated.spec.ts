import { test } from '@playwright/test';
import { expectNoCriticalA11yViolations } from './a11y-helpers';
import { installLocalAuthFixture } from './local-auth-fixture';
import { E2E_AUTH_EMAIL, E2E_AUTH_PASSWORD, loginViaForm } from './test-helpers';

/**
 * A11y (axe-core) nas rotas AUTENTICADAS e ADMIN — complemento de a11y.spec.ts
 * (que so cobre publicas). Gated nas credenciais e2e, igual aos smokes:
 *   - autenticadas: E2E_AUTH_EMAIL / E2E_AUTH_PASSWORD
 *   - admin:        E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD (conta com papel admin)
 *
 * Mesma barra dos publicos: bloqueia violations critical/serious WCAG 2.1 AA.
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test.describe('A11y - rotas autenticadas', () => {
  test.beforeEach(async ({ page }) => {
    if (E2E_AUTH_EMAIL && E2E_AUTH_PASSWORD) {
      await loginViaForm(page);
    } else {
      await installLocalAuthFixture(page, 'host');
    }
  });

  const routes: Array<{ label: string; path: string }> = [
    { label: 'painel', path: '/painel' },
    { label: 'portfolio', path: '/properties' },
    { label: 'meu ROI', path: '/my-roi' },
    { label: 'onboarding', path: '/onboarding' },
    { label: 'integracoes', path: '/settings/integrations' },
  ];

  for (const { label, path } of routes) {
    test(`${label} (${path}) - sem violations criticas`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.locator('main').first().waitFor({ state: 'visible' });
      await page.waitForTimeout(500);
      await expectNoCriticalA11yViolations(page);
    });
  }
});

test.describe('A11y - admin', () => {
  test.beforeEach(async ({ page }) => {
    if (ADMIN_EMAIL && ADMIN_PASSWORD) {
      await loginViaForm(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    } else {
      await installLocalAuthFixture(page, 'admin');
    }
  });

  const routes: Array<{ label: string; path: string }> = [
    { label: 'admin home', path: '/admin' },
    { label: 'admin finance', path: '/admin/finance' },
    { label: 'admin events', path: '/admin/events' },
  ];

  for (const { label, path } of routes) {
    test(`${label} (${path}) - sem violations criticas`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.locator('main').first().waitFor({ state: 'visible' });
      await page.waitForTimeout(500);
      await expectNoCriticalA11yViolations(page);
    });
  }
});
