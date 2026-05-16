import { expect, test } from '@playwright/test';

test.describe('Admin quality occupancy', () => {
  test('registra ocupacao manual com API mockada', async ({ page }) => {
    let manualPayload: any = null;
    let coverageCalls = 0;

    await page.route('**/admin/pricing/quality', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          windowDays: 30,
          sampleSize: 0,
          discarded: 0,
          mapePercent: null,
          rmse: null,
          medianAbsoluteError: null,
          qualityGate: {
            threshold: 20,
            passes: false,
            meetsMinSample: false,
          },
        }),
      });
    });

    await page.route('**/admin/occupancy/coverage', async (route) => {
      coverageCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          coverageCalls === 1
            ? { byStatus: [], byOrigin: [], distinctListings: 0 }
            : {
                byStatus: [{ status: 'booked', count: 1 }],
                byOrigin: [{ origin: 'manual', count: 1 }],
                distinctListings: 1,
              },
        ),
      });
    });

    await page.route('**/admin/occupancy/properties', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            addressId: 'address-alpha-1',
            listId: 'list-alpha-1',
            title: 'Apto Alpha Copacabana',
            airbnbListingId: '123456',
            userId: 'user-alpha',
            userEmail: 'gustavo8gouveia@hotmail.com',
            neighborhood: 'Copacabana',
            city: 'Rio de Janeiro',
            state: 'RJ',
            manualDailyPrice: 150,
            dailyPrice: 120,
            averageMonthlyRevenue: 4500,
          },
        ]),
      });
    });

    await page.route('**/admin/occupancy/manual', async (route) => {
      expect(route.request().method()).toBe('POST');
      manualPayload = route.request().postDataJSON();

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'occupancy-alpha-1',
          ...manualPayload,
          origin: 'manual',
          trainingReady: true,
        }),
      });
    });

    await page.goto('/admin/quality');

    await expect(page.getByRole('heading', { name: /Qualidade da IA/i })).toBeVisible();
    await expect(page.getByText(/0 imoveis elegiveis/i)).not.toBeVisible();
    await expect(page.getByText('Apto Alpha Copacabana', { exact: true })).toBeVisible();

    await page.getByLabel(/Data observada/i).fill('2026-05-15');
    await page.getByLabel(/Status/i).selectOption('booked');
    await page.getByLabel(/Diaria anunciada/i).fill('150,00');
    await page.getByLabel(/Receita real do dia/i).fill('150,00');
    await page.getByRole('button', { name: /Salvar ocupacao/i }).click();

    await expect(page.getByText(/Registro booked salvo/i)).toBeVisible();
    await expect(page.getByText('manual', { exact: true })).toBeVisible();
    expect(manualPayload).toEqual({
      listId: 'list-alpha-1',
      date: '2026-05-15',
      status: 'booked',
      listedPriceCents: 15000,
      revenueCents: 15000,
      currency: 'BRL',
    });
  });
});
