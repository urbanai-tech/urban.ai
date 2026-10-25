import { expect, test } from '@playwright/test';

const acceptedConsent = {
  essential: true,
  analytics: true,
  marketing: true,
  decidedAt: '2026-07-21T00:00:00.000Z',
  version: 1,
};

test.describe('Cadastro comercial', () => {
  test('cadastro real em modo público: exige termos, não envia PII ao analytics e vai para a confirmação de e-mail', async ({ page }) => {
    let registerPayload: Record<string, unknown> | null = null;

    await page.addInitScript((state) => {
      window.localStorage.setItem('urban-ai-consent-v1', JSON.stringify(state));
      const target = window as unknown as {
        __urbanAiEvents: Array<{ vendor: string; args: unknown[] }>;
        gtag: (...args: unknown[]) => void;
        fbq: (...args: unknown[]) => void;
      };
      target.__urbanAiEvents = [];
      target.gtag = (...args: unknown[]) => target.__urbanAiEvents.push({ vendor: 'gtag', args });
      target.fbq = (...args: unknown[]) => target.__urbanAiEvents.push({ vendor: 'fbq', args });
    }, acceptedConsent);

    await page.route('**/public-config', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ launchMode: 'public', prelaunchMode: false }),
    }));
    await page.route('**/auth/register', async (route) => {
      registerPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ mode: 'registered' }) });
    });
    await page.route('**/auth/login', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accessToken: 'e2e-token' }),
    }));

    await page.goto('/create?utm_source=meta&utm_medium=cpc&utm_campaign=public-launch');
    await expect(page.getByRole('heading', { name: 'Criar conta' })).toBeVisible();
    await expect(page.getByText(/lista de espera|acesso antecipado/i)).toHaveCount(0);

    await page.getByLabel('Nome de usuário').fill('Lead Comercial');
    await page.getByLabel('E-mail').fill('lead+public@urbanai.com.br');
    await page.getByLabel('Senha', { exact: true }).fill('SenhaForte1!');
    await page.getByLabel('Confirmar senha').fill('SenhaForte1!');
    await page.getByRole('checkbox', { name: /Termos de Uso/i }).check();
    await page.getByRole('button', { name: 'Criar conta' }).click();

    // E-mail NÃO vai na URL (PII em histórico/logs/Referer): fica em sessionStorage.
    await expect(page).toHaveURL(/\/confirm-email$/, { timeout: 15_000 });
    expect(page.url()).not.toMatch(/lead|%40|@/);
    expect(registerPayload).toMatchObject({ email: 'lead+public@urbanai.com.br', username: 'Lead Comercial', termsAccepted: true });

    const events = await page.evaluate(() => (window as unknown as { __urbanAiEvents: Array<{ vendor: string; args: unknown[] }> }).__urbanAiEvents);
    expect(events.some((event) => event.vendor === 'gtag' && event.args[1] === 'sign_up')).toBe(true);
    expect(events.some((event) => event.vendor === 'fbq' && event.args[1] === 'CompleteRegistration')).toBe(true);
    // Privacidade: nenhum evento carrega e-mail, nome ou senha.
    expect(JSON.stringify(events)).not.toMatch(/lead\+public|Lead Comercial|SenhaForte/);
  });

  test('em pré-lançamento o /create continua sendo a lista de espera', async ({ page }) => {
    await page.route('**/public-config', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ launchMode: 'prelaunch', prelaunchMode: true }),
    }));
    await page.goto('/create');
    await expect(page.getByText(/lista/i).first()).toBeVisible();
    await expect(page.getByLabel('Confirmar senha')).toHaveCount(0);
  });
});
