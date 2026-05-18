import { expect, test } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

const property = {
  id: 'prop-pricing-e2e',
  propertyName: 'Apartamento Vila Mariana',
  userId: 'user-e2e',
  analisado: 'completed',
  image_url: 'https://example.com/vila-mariana.jpg',
  latitude: -23.589,
  longitude: -46.634,
  id_do_anuncio: '987654321',
  manualDailyPrice: 320,
  averageMonthlyRevenue: 7400,
  dailyPrice: 310,
  pricingInputSource: 'manual',
  nome: 'Apartamento Vila Mariana',
};

async function mockAppShell(page: import('@playwright/test').Page) {
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-e2e',
        username: 'Host E2E',
        email: 'host.e2e@urbanai.com.br',
        role: 'USER',
      }),
    });
  });

  await page.route('**/payments/getSubscription', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'sub_e2e', status: 'active' }),
    });
  });
}

test.describe('Properties pricing inputs', () => {
  test('lista propriedades, salva diaria base e mostra historico', async ({ page }) => {
    await acceptCookieConsent(page);
    const updates: Array<{ manualDailyPrice?: number; averageMonthlyRevenue?: number }> = [];

    await mockAppShell(page);
    await page.route('**/propriedades/dropdown/list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([property]),
      });
    });
    await page.route('**/propriedades/prop-pricing-e2e/pricing-inputs', async (route) => {
      updates.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...property,
          manualDailyPrice: 450,
          averageMonthlyRevenue: 9900,
        }),
      });
    });
    await page.route('**/propriedades/prop-pricing-e2e/pricing-inputs/history**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'hist-e2e',
            previousManualDailyPrice: 320,
            newManualDailyPrice: 450,
            previousAverageMonthlyRevenue: 7400,
            newAverageMonthlyRevenue: 9900,
            source: 'manual',
            changedByUserId: 'user-e2e',
            createdAt: '2026-05-15T12:00:00.000Z',
          },
        ]),
      });
    });

    await page.goto('/properties');

    await expect(page.getByText('Apartamento Vila Mariana')).toBeVisible();
    await page.getByText(/Detalhes t.cnicos/i).click();
    await expect(page.getByText(/-23\.589/)).toBeVisible();

    await page.locator('input[inputmode="decimal"]').nth(0).fill('450');
    await page.locator('input[inputmode="decimal"]').nth(1).fill('9900');
    await page.getByRole('button', { name: /^Salvar$/i }).click();

    expect(updates[0]).toEqual({
      manualDailyPrice: 450,
      averageMonthlyRevenue: 9900,
    });

    await page.getByRole('button', { name: /Hist.rico/i }).click();
    await expect(page.getByText(/ltimas altera/i)).toBeVisible();
    await expect(page.getByText(/R\$\s*320,00/)).toBeVisible();
    await expect(page.getByText(/R\$\s*450,00/)).toBeVisible();
    await expect(page.getByText(/R\$\s*7\.400,00/)).toBeVisible();
    await expect(page.getByText(/R\$\s*9\.900,00/)).toBeVisible();
  });

  test('confirma exclusao e remove propriedade da lista', async ({ page }) => {
    await acceptCookieConsent(page);
    const deletions: string[] = [];

    await mockAppShell(page);
    await page.route('**/propriedades/dropdown/list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([property]),
      });
    });
    await page.route('**/propriedades/address/prop-pricing-e2e', async (route) => {
      deletions.push(route.request().method());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto('/properties');

    await expect(page.getByText('Apartamento Vila Mariana')).toBeVisible();
    await page.getByRole('button', { name: /delete|excluir/i }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: /^Excluir$/i }).click();

    expect(deletions).toEqual(['DELETE']);
    await expect(page.getByText('Apartamento Vila Mariana')).toHaveCount(0);
  });
});
