import { expect, test } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

/**
 * Release-gate smoke for public, production-safe pages.
 *
 * These checks avoid authenticated state and external side effects.
 * They can run against local, staging, or production before a release is promoted.
 */

const publicRoutes = [
  '/',
  '/lancamento',
  '/precos',
  '/sobre',
  '/contato',
  '/termos',
  '/privacidade',
];

const protectedRoutes = [
  '/dashboard',
  '/admin',
  '/admin/dashboard',
  '/admin/jobs',
  '/settings/integrations',
];

test.describe('Release gate - public pages', () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookieConsent(page);
  });

  for (const route of publicRoutes) {
    test(`${route} loads without server/runtime error`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });

      expect(response?.status(), `${route} should respond below 400`).toBeLessThan(400);
      await expect(page.locator('body')).not.toContainText(/Application error|Unhandled Runtime Error|404|500/i);
    });
  }

  test('/lancamento keeps legal/support links reachable', async ({ page }) => {
    await page.goto('/lancamento');

    await expect(page.getByRole('link', { name: /Contato/i }).first()).toHaveAttribute('href', /\/contato$/);
    await expect(page.getByRole('link', { name: /Privacidade/i }).first()).toHaveAttribute('href', /\/privacidade$/);
    await expect(page.getByRole('link', { name: /Termos/i }).first()).toHaveAttribute('href', /\/termos$/);
  });

  test('/contato submits public lead to triage API', async ({ page }) => {
    let payload: Record<string, unknown> | null = null;

    await page.route('**/contact-submissions', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      payload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'contact-e2e',
          status: 'new',
          ...payload,
        }),
      });
    });

    await page.goto('/contato');
    await page.getByPlaceholder('Seu nome').fill('Lead Operacional');
    await page.getByPlaceholder('seu@email.com').fill('lead+contato@urbanai.com.br');
    await page.getByPlaceholder('Qual o motivo do contato?').fill('Quero entrar no beta');
    await page.getByPlaceholder('Descreva como podemos ajudar...').fill('Tenho 4 imoveis em Sao Paulo e quero testar a Urban AI.');
    await page.getByRole('button', { name: /Enviar mensagem/i }).click();

    await expect(page.getByRole('status')).toContainText(/Mensagem registrada/i);
    expect(payload).toMatchObject({
      name: 'Lead Operacional',
      email: 'lead+contato@urbanai.com.br',
      subject: 'Quero entrar no beta',
      message: 'Tenho 4 imoveis em Sao Paulo e quero testar a Urban AI.',
      source: 'public-contact',
    });
  });
});

test.describe('Release gate - anonymous access', () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookieConsent(page);
  });

  for (const route of protectedRoutes) {
    test(`${route} does not expose private app data to anonymous users`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      const body = page.locator('body');
      await expect(body).not.toContainText(/PriceSnapshot|admin_job_runs|Stripe webhook secret|accessToken/i);
    });
  }
});
