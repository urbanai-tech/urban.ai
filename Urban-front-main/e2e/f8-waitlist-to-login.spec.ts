import { expect, test } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

test.describe('F8 legado: convite emitido -> aceite -> dashboard', () => {
  test('preserva a conversao de convites existentes sem reabrir waitlist publica', async ({ page }) => {
    await acceptCookieConsent(page);
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
          id: 'user-mock-123',
          username: 'Teste E2E',
          email: 'teste.e2e@urbanai.com.br',
          role: 'host',
        }),
      });
    });
    await page.route('**/payments/getSubscription', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'active', plan: 'alpha' }),
      });
    });

    await page.route('**/propriedades/dropdown/list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'prop-f8-e2e',
            propertyName: 'Studio F8',
            userId: 'user-mock-123',
            analisado: 'completed',
            image_url: 'https://example.com/studio-f8.jpg',
            latitude: -23.56,
            longitude: -46.65,
            nome: 'Studio F8',
          },
        ]),
      });
    });
    await page.route('**/propriedades/eventos-analisados-com-price**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
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
    });
    expect(String(acceptPayload?.password)).toMatch(/^[a-f0-9]{64}$/);
    expect(acceptPayload?.password).not.toBe('UrbanE2E@123');

    await page.waitForURL('**/dashboard');
    await expect(page.getByRole('heading', { name: /Calend.rio/i })).toBeVisible();
  });
});
