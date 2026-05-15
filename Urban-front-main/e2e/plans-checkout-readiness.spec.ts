import { expect, type Page, test } from '@playwright/test';

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
    await expect(page.getByRole('button', { name: /Assinar/i })).toBeDisabled();
    expect(checkoutCalled).toBe(false);
  });

  test('mostra erro claro quando Stripe publishable key nao esta configurada', async ({ page }) => {
    test.skip(
      !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      'Este smoke valida especificamente o fail-closed sem publishable key local.',
    );

    await mockPlans(page, [makePlan()]);

    let checkoutCalled = false;
    await page.route('**/payments/create-checkout-session', async (route) => {
      checkoutCalled = true;
      await route.fulfill({ status: 500, body: '{}' });
    });

    await page.goto('/plans');
    await page.getByRole('button', { name: /Assinar/i }).click();

    await expect(page.getByRole('alert')).toContainText(/Stripe nao configurada/i);
    expect(checkoutCalled).toBe(false);
  });

  test('plano sob consulta nao renderiza CTA de checkout', async ({ page }) => {
    await mockPlans(page, [makePlan({ name: 'enterprise', title: 'Enterprise', isCustomPrice: true })]);

    await page.goto('/plans');

    await expect(page.getByText(/preco sob consulta/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /comercial@myurbanai\.com/i })).toHaveAttribute(
      'href',
      'mailto:comercial@myurbanai.com',
    );
    await expect(page.getByRole('button', { name: /Assinar/i })).toHaveCount(0);
  });
});
