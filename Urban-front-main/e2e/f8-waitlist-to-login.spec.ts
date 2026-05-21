import { expect, test } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

test.describe('F8 Happy Path: waitlist -> convite -> aceite -> dashboard', () => {
  test('fluxo completo F8 simulado via API mocks atuais', async ({ page }) => {
    await acceptCookieConsent(page);
    await page.route('**/waitlist', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          position: 42,
          referralCode: 'abc123xy',
          aheadOfYou: 41,
          totalSignups: 42,
        }),
      });
    });

    await page.goto('/lancamento');

    await expect(page.getByRole('heading', { name: /ESGOTAR R.PIDO/i })).toBeVisible();

    const emailInput = page.locator('input[type="email"][id="waitlist-email"]').first();
    await expect(emailInput).toBeVisible();
    await emailInput.fill('teste.e2e@urbanai.com.br');

    await page.getByRole('button', { name: /Quero acesso antecipado/i }).click();

    await expect(page.getByText(/Voce esta na lista|Voc. est. na lista/i)).toBeVisible();
    await expect(page.getByText('42')).toBeVisible();

    await page.route('**/waitlist/invite?token=MOCK_TOKEN_123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          email: 'teste.e2e@urbanai.com.br',
          name: 'Teste E2E',
          position: 42,
        }),
      });
    });

    let acceptPayload: Record<string, unknown> | undefined;
    await page.route('**/auth/waitlist/accept', async (route) => {
      acceptPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'converted',
          user: {
            id: 'user-mock-123',
            email: 'teste.e2e@urbanai.com.br',
            role: 'host',
          },
        }),
      });
    });

    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: 'user-mock-123',
          email: 'teste.e2e@urbanai.com.br',
          role: 'host',
        }),
      });
    });

    await page.route('**/propriedades/dropdown/list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/waitlist/aceitar?token=MOCK_TOKEN_123');

    await expect(page.getByLabel(/E-mail/i)).toHaveValue('teste.e2e@urbanai.com.br');

    await page.getByLabel(/Crie sua senha/i).fill('UrbanE2E@123');
    await page.getByLabel(/Confirme a senha/i).fill('UrbanE2E@123');

    await page.getByRole('button', { name: /Aceitar convite/i }).click();

    await expect.poll(() => acceptPayload).toMatchObject({
      token: 'MOCK_TOKEN_123',
      username: 'Teste E2E',
      password: 'UrbanE2E@123',
    });

    await page.waitForURL('**/dashboard');
    await expect(page.locator('main h1')).toContainText(/Calend.rio/i);
  });
});
