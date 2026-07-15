import { expect, test } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

test.describe('QA público responsivo e por teclado', () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookieConsent(page);
  });

  test('login preserva composição e não cria overflow em mobile/desktop', async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844, splitVisible: false },
      { width: 1440, height: 900, splitVisible: true },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      await expect(page.getByRole('heading', { name: /Bem-vindo de volta/i })).toBeVisible();
      const split = page.locator('[data-login-side]');
      if (viewport.splitVisible) await expect(split).toBeVisible();
      else await expect(split).toBeHidden();

      const formBox = await page.locator('form').boundingBox();
      expect(formBox).not.toBeNull();
      expect(formBox!.x).toBeGreaterThanOrEqual(0);
      expect(formBox!.x + formBox!.width).toBeLessThanOrEqual(viewport.width + 1);

      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
    }
  });

  test('login mantém ordem de foco e controle de senha operável por teclado', async ({ page }) => {
    // A ordem de foco existe no HTML inicial, mas a ativação do botão depende
    // da hidratação React. Aguarde o runtime antes de testar o Enter.
    await page.goto('/', { waitUntil: 'networkidle' });

    const email = page.locator('input[type="email"]');
    const password = page.locator('input[autocomplete="current-password"]');
    const passwordToggle = page.getByRole('button', { name: 'Mostrar senha' });

    await page.keyboard.press('Tab');
    await expect(email).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(password).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(passwordToggle).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(password).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Ocultar senha' })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Esqueceu a senha?' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /Criar conta/ })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeFocused();
  });

  test('login respeita preferência por movimento reduzido', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.urban-enter').first()).toHaveCSS('animation-name', 'none');
  });
});
