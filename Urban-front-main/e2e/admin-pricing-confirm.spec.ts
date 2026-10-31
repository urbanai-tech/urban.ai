import { expect, test } from '@playwright/test';
import { installLocalAuthFixture } from './local-auth-fixture';

const plan = {
  id: 'plan-pro',
  name: 'profissional',
  title: 'Profissional',
  price: '99',
  period: '/imóvel/mês',
  features: [],
  isActive: true,
  selfServiceEnabled: true,
  priceMonthly: '99',
  priceQuarterly: '85',
  priceSemestral: '72',
  priceAnnualNew: '67',
  discountQuarterlyPercent: 14,
  discountSemestralPercent: 27,
  discountAnnualPercent: 32,
  minProperties: 4,
  maxProperties: 500,
  maxCheckoutQuantity: 500,
  propertyLimit: 500,
  sortOrder: 20,
};

test.describe('Admin pricing-config', () => {
  test('mostra o diff antigo -> novo e só grava depois de confirmar', async ({ page }) => {
    await installLocalAuthFixture(page, 'admin');
    let patched: unknown = null;

    await page.route('**/admin/plans-config', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([plan]) });
    });
    await page.route('**/admin/stripe/sync-check', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    });
    await page.route('**/admin/plans-config/profissional', async (route) => {
      patched = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...plan, priceMonthly: '109' }),
      });
    });

    await page.goto('/admin/pricing-config');
    await page.getByLabel('Mensal (R$/imóvel/mês)').fill('109');
    await page.getByRole('button', { name: /Salvar mudanças/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /Aplicar mudanças no plano Profissional\?/ })).toBeVisible();
    await expect(dialog.getByText('Mensal (R$/imóvel/mês)')).toBeVisible();
    await expect(dialog.getByText('99', { exact: true })).toBeVisible();
    await expect(dialog.getByText('109', { exact: true })).toBeVisible();
    expect(patched).toBeNull();

    await dialog.getByRole('button', { name: /Cancelar/i }).click();
    expect(patched).toBeNull();

    await page.getByRole('button', { name: /Salvar mudanças/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Aplicar no checkout/i }).click();
    await expect.poll(() => patched).toEqual({ priceMonthly: '109' });
  });
});
