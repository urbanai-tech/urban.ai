import { expect, test, type Page } from '@playwright/test';

/**
 * Helpers compartilhados de acessibilidade (axe-core) — usados pelas suites
 * de rotas publicas (a11y.spec.ts) e autenticadas/admin (a11y-authenticated.spec.ts).
 *
 * O axe cobre parte dos criterios WCAG 2.1 AA. Navegacao por teclado, screen
 * reader e contraste em hover/focus continuam em revisao manual conforme
 * docs/runbooks/wcag-audit-checklist.md.
 */

type AxeImpact = 'minor' | 'moderate' | 'serious' | 'critical' | null;

type AxeViolation = {
  id?: string;
  impact?: AxeImpact;
  help?: string;
  nodes?: unknown[];
};

type AxeResult = {
  violations: AxeViolation[];
};

type AxeBuilderInstance = {
  withTags(tags: string[]): AxeBuilderInstance;
  analyze(): Promise<AxeResult>;
};

type AxeBuilderConstructor = new (options: { page: Page }) => AxeBuilderInstance;

async function loadAxeBuilder(): Promise<AxeBuilderConstructor | null> {
  try {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (
      specifier: string,
    ) => Promise<{ default?: AxeBuilderConstructor }>;
    const module = await dynamicImport('@axe-core/playwright');
    return module.default ?? null;
  } catch (error) {
    if (
      error instanceof Error &&
      /Cannot find package|Cannot find module|ERR_MODULE_NOT_FOUND/i.test(error.message)
    ) {
      return null;
    }
    throw error;
  }
}

export async function expectNoCriticalA11yViolations(page: Page) {
  const AxeBuilder = await loadAxeBuilder();
  test.skip(
    AxeBuilder === null,
    '@axe-core/playwright nao esta instalado no node_modules local; rode npm install para habilitar esta suite.',
  );

  if (!AxeBuilder) return;

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  // Permitimos incidents minor/moderate; bloqueamos critical/serious.
  const blockers = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  expect(blockers, JSON.stringify(blockers, null, 2)).toEqual([]);
}
