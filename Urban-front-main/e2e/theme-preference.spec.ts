import { expect, test } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

test.describe('Theme preference', () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookieConsent(page);
  });

  test('applies persisted dark theme before page interaction', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('urban-ai-theme', 'dark');
    });

    await page.goto('/lancamento', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(8, 10, 15)');
  });

  test('applies persisted light theme before page interaction', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('urban-ai-theme', 'light');
    });

    await page.goto('/lancamento', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(250, 250, 251)');
  });

  test('system mode follows browser color scheme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(() => {
      window.localStorage.setItem('urban-ai-theme', 'system');
    });

    await page.goto('/lancamento', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('admin theme toggle persists the selected mode', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: /tema escuro|escuro/i }).click();

    await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('urban-ai-theme'))).toBe('dark');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
