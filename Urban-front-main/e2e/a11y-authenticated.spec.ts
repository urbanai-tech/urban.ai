import { test } from '@playwright/test';
import { expectNoCriticalA11yViolations } from './a11y-helpers';
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
  test.skip(
    !E2E_AUTH_EMAIL || !E2E_AUTH_PASSWORD,
    'Defina E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD para rodar a11y autenticada.',
  );

  test.beforeEach(async ({ page }) => {
    await loginViaForm(page);
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
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expectNoCriticalA11yViolations(page);
    });
  }
});

test.describe('A11y - admin', () => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    'Defina E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD (conta admin) para rodar a11y admin.',
  );

  test.beforeEach(async ({ page }) => {
    // Reusa o fluxo de login por formulario com as credenciais admin.
    await loginViaForm(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  const routes: Array<{ label: string; path: string }> = [
    { label: 'admin home', path: '/admin' },
    { label: 'admin finance', path: '/admin/finance' },
    { label: 'admin events', path: '/admin/events' },
  ];

  for (const { label, path } of routes) {
    test(`${label} (${path}) - sem violations criticas`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expectNoCriticalA11yViolations(page);
    });
  }
});
