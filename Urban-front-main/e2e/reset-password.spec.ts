import { expect, test } from '@playwright/test';

test.describe('Reset de senha', () => {
  test('solicita link de reset e mostra confirmacao honesta', async ({ page }) => {
    const payloads: Array<{ email?: string }> = [];

    await page.route('**/email/forgot-password', async (route) => {
      payloads.push(route.request().postDataJSON());
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ enviado: true }),
      });
    });

    await page.goto('/request-reset-password');

    await expect(page.getByRole('heading', { name: /Resetar Senha/i })).toBeVisible();
    await page.getByPlaceholder('seuemail@exemplo.com').fill('host.reset@urbanai.com.br');
    await page.getByRole('button', { name: /^Resetar Senha$/i }).click();

    expect(payloads[0]).toEqual({ email: 'host.reset@urbanai.com.br' });
    await expect(page.getByText(/Um e-mail para reset de senha foi enviado/i)).toBeVisible();
    await expect(page.getByText(/host\.reset@urbanai\.com\.br/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Tentar novamente/i })).toBeVisible();
  });

  test('define nova senha somente quando requisitos sao cumpridos', async ({ page }) => {
    const payloads: Array<{ token?: string; pass?: string }> = [];

    await page.route('**/email/update-password', async (route) => {
      payloads.push(route.request().postDataJSON());
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          enviado: true,
          user: {
            id: 'user-reset-e2e',
            username: 'host-reset',
            email: 'host.reset@urbanai.com.br',
            password: null,
            createdAt: new Date().toISOString(),
            distanceKm: 0,
            ativo: true,
          },
        }),
      });
    });

    await page.goto('/reset-password/TOKEN_RESET_E2E');

    await expect(page.getByRole('heading', { name: /Confirma/i })).toBeVisible();
    const submit = page.getByRole('button', { name: /Confirmar Nova Senha/i });
    await expect(submit).toBeDisabled();

    await page.getByPlaceholder('Digite sua nova senha').fill('Urban@123');
    await page.getByPlaceholder('Repita a nova senha').fill('Urban@123');
    await expect(page.getByText(/As senhas coincidem/i)).toBeVisible();
    await expect(submit).toBeEnabled();
    await submit.click();

    const submittedPayload = payloads[0];
    expect(submittedPayload.token).toBe('TOKEN_RESET_E2E');
    expect(submittedPayload.pass).toMatch(/^[a-f0-9]{64}$/);
    expect(submittedPayload.pass).not.toBe('Urban@123');
    await expect(page.getByText(/Senha atualizada com sucesso/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Ir para Login/i })).toBeVisible();
  });
});
