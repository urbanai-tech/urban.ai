import { expect, type Page } from '@playwright/test';

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
    const axeModule = await dynamicImport('@axe-core/playwright');
    return axeModule.default ?? null;
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
  // Audita o estado final e estavel da interface. Durante o fade-in, cores
  // semitransparentes podem gerar falsos negativos de contraste no axe.
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const AxeBuilder = await loadAxeBuilder();
  expect(
    AxeBuilder,
    '@axe-core/playwright nao esta instalado; acessibilidade nao pode ser silenciosamente pulada.',
  ).not.toBeNull();
  if (!AxeBuilder) throw new Error('@axe-core/playwright indisponivel');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  // Permitimos incidents minor/moderate; bloqueamos critical/serious.
  const blockers = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  expect(blockers, JSON.stringify(blockers, null, 2)).toEqual([]);
}
