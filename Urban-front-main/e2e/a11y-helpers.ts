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
  include(selector: string): AxeBuilderInstance;
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

export async function findBlockingA11yViolations(page: Page, include?: string) {
  // Audita o estado final e estavel da interface. Durante o fade-in, cores
  // semitransparentes podem gerar falsos negativos de contraste no axe.
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const AxeBuilder = await loadAxeBuilder();
  expect(
    AxeBuilder,
    '@axe-core/playwright nao esta instalado; acessibilidade nao pode ser silenciosamente pulada.',
  ).not.toBeNull();
  if (!AxeBuilder) throw new Error('@axe-core/playwright indisponivel');

  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  if (include) builder = builder.include(include);
  const results = await builder.analyze();

  // Permitimos incidents minor/moderate; bloqueamos critical/serious.
  return results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
}

/** Resumo curto (regra, impacto e alvos) para a mensagem de falha. */
export function summarizeA11yViolations(violations: AxeViolation[]) {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    targets: (violation.nodes ?? []).map((node) => {
      const { target, html } = node as { target?: unknown; html?: string };
      return { target, html: html?.slice(0, 200) };
    }),
  }));
}

export async function expectNoCriticalA11yViolations(page: Page, include?: string) {
  const blockers = await findBlockingA11yViolations(page, include);
  expect(blockers.length, JSON.stringify(summarizeA11yViolations(blockers), null, 2)).toBe(0);
}
