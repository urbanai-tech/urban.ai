import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

/**
 * Auditoria automática de acessibilidade com axe-core contra as rotas públicas.
 *
 * O axe cobre ~30–50% dos critérios WCAG 2.1 AA. O restante (navegação por
 * teclado, screen reader, contraste em estados hover/focus) exige revisão
 * manual — checklist em docs/runbooks/wcag-audit-checklist.md.
 */

test.describe('A11y — rotas públicas', () => {
  test('home (/) — sem violations WCAG 2.0/2.1 AA críticas', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Permitimos incidents minor/moderate; bloqueamos critical/serious.
    const blockers = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(blockers, JSON.stringify(blockers, null, 2)).toEqual([]);
  });

  test('landing /lancamento — sem violations críticas', async ({ page }) => {
    await page.goto('/lancamento');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const blockers = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(blockers, JSON.stringify(blockers, null, 2)).toEqual([]);
  });

  test('página de planos — sem violations críticas', async ({ page }) => {
    await page.goto('/plans');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const blockers = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(blockers, JSON.stringify(blockers, null, 2)).toEqual([]);
  });
});
