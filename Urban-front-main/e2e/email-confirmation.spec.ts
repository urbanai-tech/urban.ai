import { expect, test } from '@playwright/test';

test.describe('Confirmacao de e-mail', () => {
  test('envia codigo ao abrir, valida 6 digitos e redireciona apos confirmar', async ({ page }) => {
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

    await page.goto('/confirm-email/host.confirm%40urbanai.com.br');

    await expect(page.getByRole('heading', { name: /Confirme seu e-mail/i })).toBeVisible();
    await expect(page.getByText('host.confirm@urbanai.com.br')).toBeVisible();
    expect(sentCodes[0]).toEqual({ email: 'host.confirm@urbanai.com.br' });

    const confirmButton = page.getByRole('button', { name: /Confirmar E-mail/i });
    await expect(confirmButton).toBeDisabled();

    const codeInputs = page.locator('input[inputmode="numeric"]');
    await expect(codeInputs).toHaveCount(6);
    for (const [index, digit] of ['1', '2', '3', '4', '5', '6'].entries()) {
      await codeInputs.nth(index).fill(digit);
    }

    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    expect(confirmationPayloads[0]).toEqual({
      email: 'host.confirm@urbanai.com.br',
      codigo: '123456',
    });
    await page.waitForURL(/\/dashboard$/);
  });
});
