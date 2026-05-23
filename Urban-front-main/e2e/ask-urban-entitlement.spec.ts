import { expect, test, type Page } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

const activeSubscription = { id: 'sub_ask_e2e', status: 'active', plan: 'profissional' };
const hostUser = {
  id: 'user-ask-e2e',
  username: 'Host Ask E2E',
  email: 'host.ask@urbanai.com.br',
  role: 'USER',
};

async function mockHostShell(page: Page) {
  await acceptCookieConsent(page);

  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(hostUser),
    });
  });

  await page.route('**/payments/getSubscription', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(activeSubscription),
    });
  });

  await page.route('**/propriedades/dropdown/list', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/propriedades/eventos-acompanhando**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], total: 0 }),
    });
  });

  await page.route('**/pace/portfolio**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ points: [] }),
    });
  });

  await page.route('**/dados**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        quantidadePropriedadesAtivas: 0,
        lucroProjetadoGeradoPeloUrban: 0,
        receitaProjetada: { receitaProjetada: 0, diferencaPercentual: 0 },
        quantidadeEventos: 0,
      }),
    });
  });
}

test.describe('AskUrban entitlement server-side', () => {
  test('ignora plano adulterado no localStorage e mostra upgrade quando backend bloqueia', async ({ page }) => {
    await mockHostShell(page);

    await page.addInitScript(() => {
      window.localStorage.setItem('urban-ai-plan', 'profissional');
      window.localStorage.setItem('plan', 'profissional');
      window.localStorage.setItem('subscription', JSON.stringify({ status: 'active', plan: 'profissional' }));
    });

    await page.route('**/ask/usage', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          used: 0,
          quota: 0,
          hardCap: 0,
          canUse: false,
          plan: 'starter',
          reason: 'plan_not_allowed',
        }),
      });
    });

    let questionPosted = false;
    await page.route('**/ask/question', async (route) => {
      questionPosted = true;
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ reason: 'plan_not_allowed' }),
      });
    });

    await page.goto('/painel');
    await page.locator('[data-ask-urban-fab]').click();

    await expect(page.getByRole('dialog', { name: /Dispon.vel no plano Profissional/i })).toBeVisible();
    await expect(page.locator('[data-ask-urban-drawer="true"]')).toHaveCount(0);
    expect(questionPosted).toBe(false);
  });

  test('abre drawer quando backend autoriza o AskUrban', async ({ page }) => {
    await mockHostShell(page);

    await page.route('**/ask/usage', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          used: 1,
          quota: 100,
          hardCap: 200,
          canUse: true,
          plan: 'profissional',
          reason: null,
        }),
      });
    });

    await page.goto('/painel');
    await page.locator('[data-ask-urban-fab]').click();

    await expect(page.locator('[data-ask-urban-drawer="true"]')).toHaveCount(1);
    await expect(page.getByRole('dialog', { name: /Ask Urban/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Dispon.vel no plano Profissional/i })).toHaveCount(0);
  });
});
