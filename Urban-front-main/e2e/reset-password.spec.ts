import { expect, test } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

test.describe('Reset de senha', () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookieConsent(page);
  });

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

    await expect(page.getByRole('heading', { name: /Redefinir senha/i })).toBeVisible();
    await page.locator('input[type="email"]').fill('host.reset@urbanai.com.br');
    await page.getByRole('button', { name: /^Enviar link$/i }).click();

    await expect.poll(() => payloads.length).toBe(1);
    expect(payloads[0]).toEqual({ email: 'host.reset@urbanai.com.br' });
    await expect(page.getByRole('heading', { name: /E-mail enviado/i })).toBeVisible();
    await expect(page.getByText(/host\.reset@urbanai\.com\.br/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Enviar novamente/i })).toBeVisible();
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

    await page.goto('/reset-password#token=TOKEN_RESET_E2E');

    await expect(page.getByRole('heading', { name: /Crie uma senha segura/i })).toBeVisible();
    const submit = page.getByRole('button', { name: /Confirmar nova senha/i });
    await expect(submit).toBeDisabled();

    await page.getByLabel('Nova senha').fill('Urban@123');
    await page.getByLabel('Confirmar senha').fill('Urban@123');
    await expect(page.getByText(/Senhas coincidem/i)).toBeVisible();
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect.poll(() => payloads.length).toBe(1);
    const submittedPayload = payloads[0];
    expect(submittedPayload.token).toBe('TOKEN_RESET_E2E');
    // Senha em texto puro sob TLS: o hash é só do servidor (ADR 0025).
    expect(submittedPayload.pass).toBe('Urban@123');
    await expect(page.getByText(/Senha atualizada/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Ir para login/i })).toBeVisible();
  });

  test('o token sai do fragmento da URL assim que a página carrega', async ({ page }) => {
    await page.goto('/reset-password#token=TOKEN_RESET_E2E');
    await expect(page.getByRole('heading', { name: /Crie uma senha segura/i })).toBeVisible();
    await expect.poll(() => new URL(page.url()).hash).toBe('');
    expect(page.url()).not.toContain('TOKEN_RESET_E2E');
  });

  test('link legado /reset-password/<token> ainda funciona, mas tira o token do path', async ({ page }) => {
    const payloads: Array<{ token?: string; pass?: string }> = [];
    await page.route('**/email/update-password', async (route) => {
      payloads.push(route.request().postDataJSON());
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ enviado: true }),
      });
    });

    await page.goto('/reset-password/TOKEN_LEGADO_E2E');
    await expect(page).toHaveURL(/\/reset-password$/);
    expect(page.url()).not.toContain('TOKEN_LEGADO_E2E');

    await page.getByLabel('Nova senha').fill('Urban@123');
    await page.getByLabel('Confirmar senha').fill('Urban@123');
    await page.getByRole('button', { name: /Confirmar nova senha/i }).click();
    await expect.poll(() => payloads.length).toBe(1);
    expect(payloads[0].token).toBe('TOKEN_LEGADO_E2E');
  });

  test('sem token mostra link incompleto e não permite enviar', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByText(/Link de redefinicao incompleto/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Confirmar nova senha/i })).toBeDisabled();
  });
});
