import { expect, type Page, test } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

type PlanOverride = Partial<{
  id: string;
  name: string;
  title: string;
  priceMonthly: string;
  priceQuarterly: string;
  priceSemestral: string;
  priceAnnualNew: string;
  isCustomPrice: boolean;
}>;

const makePlan = (overrides: PlanOverride = {}) => ({
  id: overrides.id ?? 'starter-e2e',
  name: overrides.name ?? 'starter',
  title: overrides.title ?? 'Starter',
  price: '97',
  priceAnnual: '970',
  priceMonthly: overrides.priceMonthly ?? '97',
  priceQuarterly: overrides.priceQuarterly ?? '92',
  priceSemestral: overrides.priceSemestral ?? '87',
  priceAnnualNew: overrides.priceAnnualNew ?? '77',
  discountQuarterlyPercent: 5,
  discountSemestralPercent: 10,
  discountAnnualPercent: 20,
  period: 'por imovel',
  propertyLimit: null,
  features: ['Recomendacoes por eventos', 'Dashboard de precos'],
  isCustomPrice: overrides.isCustomPrice ?? false,
  highlightBadge: '',
  discountBadge: '',
  isActive: true,
});

async function mockPlans(page: Page, plans: unknown[]) {
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-plans-e2e',
        username: 'Host Plans E2E',
        email: 'host.plans@urbanai.com.br',
        role: 'USER',
      }),
    });
  });

  await page.route('**/plans', async (route) => {
    if (route.request().resourceType() === 'document') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(plans),
    });
  });
}

test.describe('Plans checkout readiness', () => {
  test('desabilita checkout quando plano ativo nao tem preco valido no ciclo', async ({ page }) => {
    await acceptCookieConsent(page);
    await mockPlans(page, [
      makePlan({
        priceMonthly: '0',
        priceQuarterly: '0',
        priceSemestral: '0',
        priceAnnualNew: '0',
      }),
    ]);

    let checkoutCalled = false;
    await page.route('**/payments/create-checkout-session', async (route) => {
      checkoutCalled = true;
      await route.fulfill({ status: 500, body: '{}' });
    });

    await page.goto('/plans');

    await expect(page.getByRole('heading', { name: /Starter/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continuar para pagamento/i })).toBeDisabled();
    expect(checkoutCalled).toBe(false);
  });

  test('mostra erro amigavel quando checkout falha', async ({ page }) => {
    await acceptCookieConsent(page);
    await mockPlans(page, [makePlan()]);

    let checkoutCalled = false;
    await page.route('**/payments/create-checkout-session', async (route) => {
      checkoutCalled = true;
      await route.fulfill({ status: 500, body: '{}' });
    });

    await page.goto('/plans');
    await page.getByRole('button', { name: /Continuar para pagamento/i }).click();

    await expect(page.getByText(/O My Urban encontrou uma instabilidade/i)).toBeVisible();
    expect(checkoutCalled).toBe(true);
  });

  test('checkout tem marca, voltar, resumo da cobranca e preco por ciclo', async ({ page }) => {
    await acceptCookieConsent(page);
    await mockPlans(page, [makePlan()]);

    await page.goto('/plans');

    await expect(page.getByRole('link', { name: /Voltar ao painel/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /My Urban, ir para o painel/i })).toBeVisible();

    // E2E-21: cada ciclo mostra o valor por imovel/mes (nao "base").
    const cycles = page.getByRole('group', { name: /Período de cobrança/i });
    await expect(cycles.getByRole('button', { name: /Mensal/ })).toContainText(/R\$\s*97,00 por imóvel\/mês/);
    await expect(cycles.getByRole('button', { name: /Anual/ })).toContainText(/R\$\s*77,00 por imóvel\/mês/);
    await expect(cycles.getByText('base')).toHaveCount(0);

    // UX-12: resumo claro (5 imoveis x R$ 77 x 12 = R$ 4.620 por ano).
    const summary = page.getByLabel('Resumo da cobrança');
    await expect(summary).toContainText('Imóveis');
    await expect(summary).toContainText('Próxima cobrança');
    await expect(page.getByText(/Total a cada ano/i)).toBeVisible();
    await expect(page.getByText(/R\$\s*4\.620,00/).first()).toBeVisible();
    await expect(page.getByText(/Cancele quando quiser, sem multa/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Termos de uso/i })).toBeVisible();
  });

  test('plano sob consulta nao renderiza CTA de checkout', async ({ page }) => {
    await acceptCookieConsent(page);
    await mockPlans(page, [makePlan({ name: 'enterprise', title: 'Enterprise', isCustomPrice: true })]);

    await page.goto('/plans');

    await expect(page.getByText(/fale com a gente para montar o plano Escala/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Falar com comercial/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continuar para pagamento/i })).toHaveCount(0);
  });
});
