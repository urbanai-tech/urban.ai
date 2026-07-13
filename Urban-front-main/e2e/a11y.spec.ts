import { test } from '@playwright/test';
import { expectNoCriticalA11yViolations } from './a11y-helpers';

/**
 * Auditoria automatica de acessibilidade com axe-core contra rotas publicas.
 *
 * O axe cobre parte dos criterios WCAG 2.1 AA. O restante, como navegacao por
 * teclado, screen reader e contraste em estados hover/focus, exige revisao
 * manual conforme docs/runbooks/wcag-audit-checklist.md.
 */

test.describe('A11y - rotas publicas', () => {
  test('home (/) - sem violations WCAG 2.0/2.1 AA criticas', async ({ page }) => {
    await page.goto('/');
    await expectNoCriticalA11yViolations(page);
  });

  test('landing /lancamento - sem violations criticas', async ({ page }) => {
    await page.goto('/lancamento');
    await expectNoCriticalA11yViolations(page);
  });

  test('pagina de planos - sem violations criticas', async ({ page }) => {
    await page.goto('/plans');
    await expectNoCriticalA11yViolations(page);
  });
});
