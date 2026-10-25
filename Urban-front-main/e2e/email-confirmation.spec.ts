import { expect, test } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

test.describe('Confirmacao de e-mail', () => {
  test('envia codigo ao abrir, valida 6 digitos e redireciona apos confirmar', async ({ page }) => {
    await acceptCookieConsent(page);
    const sentCodes: Array<{ email?: string }> = [];
    const confirmationPayloads: Array<{ email?: string; codigo?: string }> = [];

    await page.route('**/email/enviar-codigo', async (route) => {
      sentCodes.push(route.request().postDataJSON());
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ enviado: true }),
      });
    });

    await page.route('**/email/confirmar-email', async (route) => {
      confirmationPayloads.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.route('**/auth/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ onboardingCompleted: true, loginCount: 2 }),
      });
    });

    // O e-mail chega por sessionStorage (gravado antes de navegar), nunca pela URL.
    await page.addInitScript(() => {
      window.sessionStorage.setItem('urbanai:confirm-email', 'host.confirm@urbanai.com.br');
    });
    await page.goto('/confirm-email');

    await expect(page.getByRole('heading', { name: /Confirme seu e-mail/i })).toBeVisible();
    await expect(page.getByText('ho***@urbanai.com.br')).toBeVisible();
    expect(page.url()).not.toContain('host.confirm');
    await expect.poll(() => sentCodes[0]).toEqual({ email: 'host.confirm@urbanai.com.br' });

    const confirmButton = page.getByRole('button', { name: /Confirmar E-mail/i });
    await expect(confirmButton).toBeDisabled();

    const codeInputs = page.locator('input[inputmode="numeric"]');
    await expect(codeInputs).toHaveCount(6);
    for (const [index, digit] of ['1', '2', '3', '4', '5', '6'].entries()) {
      await codeInputs.nth(index).fill(digit);
    }

    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    await expect.poll(() => confirmationPayloads[0]).toEqual({
      email: 'host.confirm@urbanai.com.br',
      codigo: '123456',
    });
    await page.waitForURL(/\/dashboard$/);
  });

  test('sem e-mail guardado, pede o endereço e só então envia o código', async ({ page }) => {
    await acceptCookieConsent(page);
    const sentCodes: Array<{ email?: string }> = [];
    await page.route('**/email/enviar-codigo', async (route) => {
      sentCodes.push(route.request().postDataJSON());
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ enviado: true }) });
    });

    await page.goto('/confirm-email');
    await expect(page.getByLabel('E-mail da conta')).toBeVisible();
    expect(sentCodes).toHaveLength(0);

    await page.getByLabel('E-mail da conta').fill('digitado@urbanai.com.br');
    await page.getByRole('button', { name: /Enviar código/i }).click();
    await expect.poll(() => sentCodes[0]).toEqual({ email: 'digitado@urbanai.com.br' });
    await expect(page.getByText('di***@urbanai.com.br')).toBeVisible();
  });

  test('rota legada /confirm-email/<e-mail> guarda o e-mail e vai para /confirm-email', async ({ page }) => {
    await acceptCookieConsent(page);
    const sentCodes: Array<{ email?: string }> = [];
    await page.route('**/email/enviar-codigo', async (route) => {
      sentCodes.push(route.request().postDataJSON());
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ enviado: true }) });
    });

    await page.goto('/confirm-email/antigo%40urbanai.com.br');
    await expect(page).toHaveURL(/\/confirm-email$/);
    expect(page.url()).not.toMatch(/antigo|%40/);
    await expect.poll(() => sentCodes[0]).toEqual({ email: 'antigo@urbanai.com.br' });
  });
});
