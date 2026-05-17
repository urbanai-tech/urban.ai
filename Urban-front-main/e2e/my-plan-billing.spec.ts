import { expect, test } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

test.describe('My plan billing view', () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookieConsent(page);
    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'host-my-plan-e2e',
          username: 'Host My Plan E2E',
          email: 'host.my-plan@urbanai.com.br',
          role: 'host',
        }),
      });
    });
  });

  test('mostra assinatura, ciclo e quota com API mockada', async ({ page }) => {
    await page.route('**/payments/getSubscription', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'sub_e2e',
          status: 'active',
          currency: 'brl',
          start_date: 1_770_000_000,
          metadata: {
            urbanai_plan: 'profissional',
            urbanai_quantity: '5',
            urbanai_billing_cycle: 'quarterly',
          },
          plan: {
            id: 'profissional',
            amount: 29900,
            currency: 'brl',
            interval: 'month',
          },
        }),
      });
    });

    await page.route('**/payments/listings-quota', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          contratados: 5,
          ativos: 3,
          podeAdicionar: true,
        }),
      });
    });

    await page.route('**/payments/billing-portal-session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: '/billing-portal-e2e' }),
      });
    });

    await page.goto('/my-plan', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /Meu plano/i })).toBeVisible();
    await expect(page.getByText(/Plano profissional/i)).toBeVisible();
    await expect(page.getByText('trimestral', { exact: true })).toBeVisible();
    await expect(page.getByText(/5 imoveis contratados/i)).toBeVisible();
    await expect(page.getByTestId('quota-contracted-card')).toContainText('Contratados');
    await expect(page.getByTestId('quota-active-card')).toContainText('Ativos');
    await expect(page.getByTestId('quota-available-card')).toContainText('Disponiveis');
    await expect(page.getByText(/Pode cadastrar mais/i)).toBeVisible();

    const essentialCookiesButton = page.getByRole('button', { name: /Apenas essenciais/i });
    if (await essentialCookiesButton.count()) {
      await essentialCookiesButton.click();
    }

    await page.getByTestId('manage-billing-button').click();
    await page.waitForURL(/\/billing-portal-e2e$/, { waitUntil: 'commit' });
    expect(page.url()).toMatch(/\/billing-portal-e2e$/);
  });

  test('mantem assinatura visivel quando quota falha', async ({ page }) => {
    await page.route('**/payments/getSubscription', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'alpha-user-e2e',
          status: 'trialing',
          metadata: {
            urbanai_plan: 'alpha',
            urbanai_quantity: '2',
            urbanai_billing_cycle: 'monthly',
          },
          plan: { id: 'alpha', amount: null, currency: null, interval: null },
        }),
      });
    });

    await page.route('**/payments/listings-quota', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'quota unavailable' }),
      });
    });

    await page.goto('/my-plan', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/Plano Alpha/i)).toBeVisible();
    await expect(page.getByText(/Alpha assistido/i)).toBeVisible();
    await expect(page.getByText(/Nao foi possivel carregar sua quota/i)).toBeVisible();
    await expect(page.getByTestId('manage-billing-button')).toHaveCount(0);
  });
});
