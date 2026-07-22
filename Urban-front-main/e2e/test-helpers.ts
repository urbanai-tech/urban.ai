import { expect, type Page } from '@playwright/test';

const acceptedConsent = {
  essential: true,
  analytics: true,
  marketing: true,
  decidedAt: '2026-05-14T00:00:00.000Z',
  version: 1,
};

export async function acceptCookieConsent(page: Page) {
  await page.addInitScript((state) => {
    window.localStorage.setItem('urban-ai-consent-v1', JSON.stringify(state));

    const hideNextDevTools = () => {
      const style = document.createElement('style');
      style.dataset.e2eNextDevTools = 'hidden';
      style.textContent = `
        nextjs-portal,
        [data-nextjs-dev-overlay],
        [data-nextjs-toast],
        [data-nextjs-dialog],
        [data-nextjs-dev-tools],
        [data-nextjs-router-announcer] {
          display: none !important;
          pointer-events: none !important;
        }
      `;
      document.head.appendChild(style);
    };

    if (document.head) {
      hideNextDevTools();
    } else {
      window.addEventListener('DOMContentLoaded', hideNextDevTools, { once: true });
    }
  }, acceptedConsent);
}

export const E2E_AUTH_EMAIL = process.env.E2E_AUTH_EMAIL || process.env.E2E_EMAIL;
export const E2E_AUTH_PASSWORD = process.env.E2E_AUTH_PASSWORD || process.env.E2E_PASSWORD;

function isPostLoginRoute(url: URL) {
  return /\/(post-login|dashboard|onboarding|confirm-email|painel|properties)(\/|$)/.test(
    url.pathname,
  );
}

/**
 * Login e2e reutilizavel via formulario (cookies httpOnly). Espelha o helper que
 * ja existia inline nos smokes autenticados; extraido para uso compartilhado
 * (ex.: a11y-authenticated.spec.ts). Gated: exige E2E_AUTH_EMAIL/PASSWORD.
 */
export async function loginViaForm(
  page: Page,
  email: string | undefined = E2E_AUTH_EMAIL,
  password: string | undefined = E2E_AUTH_PASSWORD,
) {
  await acceptCookieConsent(page);
  await page.goto('/login');

  await page.locator('input[type="email"]').fill(email!);
  await page.locator('input[type="password"]').fill(password!);

  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/auth/login') &&
        response.request().method() === 'POST' &&
        response.status() < 500,
    ),
    page.getByRole('button', { name: /entrar/i }).click(),
  ]);

  await page.waitForURL(isPostLoginRoute, { timeout: 15_000 });
  await expect(page.getByText(/credenciais invalidas|invalid credentials/i)).toHaveCount(0);
}
