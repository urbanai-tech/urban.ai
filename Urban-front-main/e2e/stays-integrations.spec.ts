import { expect, test } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

test.describe('Stays integrations settings', () => {
  test('conecta com consentimento e mostra status operacional mockado', async ({ page }) => {
    await acceptCookieConsent(page);
    let connectPayload: Record<string, unknown> | null = null;

    await page.route('**/stays/listings', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/stays/connect', async (route) => {
      expect(route.request().method()).toBe('POST');
      connectPayload = route.request().postDataJSON() as Record<string, unknown>;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'stays-account-e2e',
          status: 'active',
          clientId: 'client-e2e',
          lastSyncAt: '2026-05-15T12:00:00.000Z',
          consentVersion: 'stays-connect-v1',
          consentAcceptedAt: '2026-05-15T11:59:00.000Z',
        }),
      });
    });

    await page.route('**/stays/listings/sync', async (route) => {
      expect(route.request().method()).toBe('POST');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 2,
          listings: [
            {
              id: 'listing-1',
              staysListingId: 'ST-1',
              title: 'Studio Paulista',
              shortAddress: 'Avenida Paulista',
              basePriceCents: 25000,
              active: true,
              operationMode: 'auto',
              propriedadeId: 'prop-1',
            },
            {
              id: 'listing-2',
              staysListingId: 'ST-2',
              title: 'Loft Centro',
              shortAddress: 'Centro',
              basePriceCents: 18000,
              active: false,
              operationMode: 'notifications',
              propriedadeId: null,
            },
          ],
        }),
      });
    });

    await page.goto('/settings/integrations');
    await page.getByLabel('Client ID').fill('client-e2e');
    await page.getByLabel('Access Token').fill('token-e2e');
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: /Conectar Stays/i }).click();

    await expect(page.getByText(/Conectada e ativa/i)).toBeVisible();
    await expect(page.getByText(/stays-connect-v1/i)).toBeVisible();
    await expect(page.getByText('1/2')).toBeVisible();
    await expect(page.getByText('1 sem vínculo')).toBeVisible();
    await expect(page.getByText(/aplicam pre.o sem confirma/i)).toBeVisible();
    await expect(page.getByText(/Studio Paulista/i).last()).toBeVisible();
    await expect(page.getByText(/Autom.tico beta/i)).toBeVisible();
    await expect(page.getByText(/Recomenda..o manual/i)).toBeVisible();
    expect(connectPayload).toMatchObject({
      clientId: 'client-e2e',
      accessToken: 'token-e2e',
      consentAccepted: true,
      consentVersion: 'stays-connect-v1',
    });
  });
});
