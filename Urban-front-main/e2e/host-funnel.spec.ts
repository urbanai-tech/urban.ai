import { expect, test, type Page } from '@playwright/test';
import { acceptCookieConsent, gotoHydrated } from './test-helpers';

/**
 * Funil do anfitrião (mocked local): termos no cadastro, e-mail verificado,
 * gate de admin, guard de assinatura sem paywall em erro e checkout por url.
 */

async function mockSession(page: Page, role: string) {
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        userId: 'e2e-funnel',
        id: 'e2e-funnel',
        username: 'Funnel E2E',
        email: 'funnel.e2e@urbanai.invalid',
        role,
        emailVerified: true,
      }),
    });
  });
}

test.describe('Funil do anfitrião', () => {
  test('cadastro exige aceite dos termos, envia termsVersion e segue para confirmar e-mail', async ({ page }) => {
    await acceptCookieConsent(page);
    await page.route('**/public-config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ launchMode: 'closed_beta', prelaunchMode: false, appEnv: 'test', version: 'e2e' }),
      });
    });

    // Objeto-recipiente: o TS não estreita propriedades atribuídas dentro de callbacks.
    const captured: { register: Record<string, unknown> | null } = { register: null };
    await page.route('**/auth/register', async (route) => {
      captured.register = route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ mode: 'registered' }) });
    });
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ authenticated: true }) });
    });
    await page.route('**/email/enviar-codigo', async (route) => {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ enviado: true }) });
    });

    await gotoHydrated(page, '/create');

    await page.getByLabel(/^Nome/i).first().fill('Ana Host');
    await page.getByLabel(/E-mail/i).first().fill('ana.host@urbanai.invalid');
    await page.getByLabel(/^Senha/i).first().fill('Senha123!');
    await page.getByLabel(/Confirmar senha/i).fill('Senha123!');

    const submit = page.getByRole('button', { name: /Criar conta/i });
    await expect(submit).toBeDisabled();

    const terms = page.getByRole('checkbox', { name: /Termos de Uso/i });
    await expect(page.getByRole('link', { name: 'Termos de Uso' })).toHaveAttribute('href', /\/termos$/);
    await expect(page.getByRole('link', { name: 'Política de Privacidade' })).toHaveAttribute('href', /\/privacidade$/);
    await terms.check();
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect.poll(() => captured.register?.termsAccepted).toBe(true);
    expect(captured.register?.termsVersion).toBe('2026-05-11');
    await expect(page).toHaveURL(/\/confirm-email$/, { timeout: 10_000 });
    expect(page.url()).not.toMatch(/ana\.host|%40|@/);
    await expect(page.getByText('an***@urbanai.invalid')).toBeVisible();
  });

  test('admin: host comum é enviado para /forbidden sem montar o shell', async ({ page }) => {
    await acceptCookieConsent(page);
    await mockSession(page, 'host');
    await gotoHydrated(page, '/admin');
    await expect(page).toHaveURL(/\/forbidden/, { timeout: 10_000 });
  });

  test('guard de assinatura: erro 500 na consulta não mostra paywall e oferece nova tentativa', async ({ page }) => {
    await acceptCookieConsent(page);
    await mockSession(page, 'host');
    await page.route('**/payments/getSubscription', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    });
    await page.route('**/plans', async (route) => {
      if (route.request().resourceType() === 'document') return route.continue();
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await gotoHydrated(page, '/dashboard');

    await expect(page.getByTestId('subscription-check-error')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Tentar de novo/i })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('checkout redireciona pela url hospedada do Stripe', async ({ page }) => {
    await acceptCookieConsent(page);
    await mockSession(page, 'host');
    await page.route('**/plans', async (route) => {
      if (route.request().resourceType() === 'document') return route.continue();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1, name: 'starter', title: 'Starter', description: 'Plano', priceMonthly: '49', priceQuarterly: '45',
            priceSemestral: '42', priceAnnualNew: '39', minProperties: 1, maxProperties: 10, discountQuarterlyPercent: 5,
            discountSemestralPercent: 10, discountAnnualPercent: 20, period: 'por imovel', propertyLimit: null,
            features: ['Recomendacoes por eventos'], isCustomPrice: false, highlightBadge: '', discountBadge: '', isActive: true,
          },
        ]),
      });
    });
    await page.route('**/payments/create-checkout-session', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ sessionId: 'cs_test_e2e', url: 'https://checkout.stripe.com/c/pay/cs_test_e2e' }),
      });
    });
    await page.route('https://checkout.stripe.com/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>stripe-checkout-mock</body></html>' });
    });

    await gotoHydrated(page, '/plans');
    await page.getByRole('button', { name: /Continuar para pagamento/i }).click();

    await expect(page).toHaveURL(/checkout\.stripe\.com\/c\/pay\/cs_test_e2e/, { timeout: 10_000 });
  });

  test('retorno do checkout mostra aviso claro em /plans (cancelado)', async ({ page }) => {
    await acceptCookieConsent(page);
    await mockSession(page, 'host');
    await page.route('**/plans', async (route) => {
      if (route.request().resourceType() === 'document') return route.continue();
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    // E2E-18: sem estes mocks o shell consultava a API real (fora do ar) e a página remontava
    // depois do aviso; com tudo mockado e a espera pela hidratação o aviso é determinístico.
    await page.route('**/payments/getSubscription', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'inactive' }) }),
    );
    await page.route('**/propriedades/dropdown/list', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await page.route('**/notifications/user/unread-count', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ unread: 0 }) }),
    );

    await gotoHydrated(page, '/plans?checkout=canceled');

    await expect(page.getByText(/Checkout cancelado\. Nenhuma cobrança foi feita/i)).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL(/checkout=canceled/);
  });
});
