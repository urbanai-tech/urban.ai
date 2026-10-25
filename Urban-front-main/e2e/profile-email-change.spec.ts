import { expect, test } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

/**
 * Troca de e-mail no perfil (F5): exige a senha atual, manda o hash no corpo e,
 * quando o backend sinaliza verificação pendente, oferece confirmar o novo e-mail.
 */
test.describe('Perfil: troca de e-mail', () => {
  test('pede a senha atual, envia currentPassword em SHA-256 e mostra o estado de confirmação', async ({ page }) => {
    await acceptCookieConsent(page);
    const puts: Array<Record<string, unknown>> = [];

    await page.route('**/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-e2e', userId: 'user-e2e', username: 'Host E2E', email: 'antigo@urbanai.com.br',
          role: 'host', emailVerified: true,
        }),
      });
    });
    await page.route('**/auth/profile**', async (route) => {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON();
        puts.push(body);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'user-e2e', username: 'Host E2E', email: body.email, emailVerificationPending: true,
            createdAt: '2026-01-01T00:00:00.000Z',
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-e2e', username: 'Host E2E', email: 'antigo@urbanai.com.br', role: 'host',
          createdAt: '2026-01-01T00:00:00.000Z',
        }),
      });
    });

    await page.goto('/profile');
    const email = page.getByLabel('E-mail');
    await expect(email).toHaveValue('antigo@urbanai.com.br');
    await expect(page.getByLabel('Senha atual')).toHaveCount(0);

    await email.fill('novo@urbanai.com.br');
    const password = page.getByLabel('Senha atual');
    await expect(password).toBeVisible();

    // Sem senha: não envia nada.
    await page.getByRole('button', { name: /Salvar perfil/i }).click();
    expect(puts).toHaveLength(0);

    await password.fill('Senha123!');
    await page.getByRole('button', { name: /Salvar perfil/i }).click();

    await expect.poll(() => puts.length).toBe(1);
    expect(puts[0].email).toBe('novo@urbanai.com.br');
    expect(puts[0].currentPassword).toMatch(/^[a-f0-9]{64}$/);
    expect(puts[0].currentPassword).not.toBe('Senha123!');
    await expect(page.getByRole('heading', { name: /Confirme seu novo e-mail/i })).toBeVisible();

    await page.getByRole('button', { name: /Confirmar agora/i }).click();
    await expect(page).toHaveURL(/\/confirm-email$/);
    expect(page.url()).not.toContain('novo');
  });
});
