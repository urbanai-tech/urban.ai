import { expect, test } from '@playwright/test';
import { expectNoCriticalA11yViolations } from './a11y-helpers';
import { installLocalAuthFixture } from './local-auth-fixture';

const viewports = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'mobile', width: 390, height: 844 },
] as const;

test.describe('A11y local com fixtures autenticadas', () => {
  for (const viewport of viewports) {
    test(`host /my-plan em ${viewport.label} sem violações serious/critical`, async ({ page }) => {
      await installLocalAuthFixture(page, 'host');
      await page.setViewportSize(viewport);
      await page.goto('/my-plan', { waitUntil: 'domcontentloaded' });
      await page.locator('main').first().waitFor({ state: 'visible' });
      await expectNoCriticalA11yViolations(page);
    });

    test(`admin /admin em ${viewport.label} sem violações serious/critical`, async ({ page }) => {
      await installLocalAuthFixture(page, 'admin');
      await page.setViewportSize(viewport);
      await page.goto('/admin', { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Painel' }).waitFor({ state: 'visible' });
      await expectNoCriticalA11yViolations(page);
    });
  }

  test('host permite pular para o conteúdo principal por teclado', async ({ page }) => {
    await installLocalAuthFixture(page, 'host');
    await page.goto('/my-plan', { waitUntil: 'domcontentloaded' });
    await page.locator('#host-main-content').waitFor({ state: 'visible' });

    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Pular para conteudo principal' });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
    await skipLink.press('Enter');
    await expect(page.locator('#host-main-content')).toBeFocused();
  });

  test('admin permite pular para o conteúdo principal por teclado', async ({ page }) => {
    await installLocalAuthFixture(page, 'admin');
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Painel' }).waitFor({ state: 'visible' });

    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Pular para conteudo principal' });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
    await skipLink.press('Enter');
    await expect(page.locator('#admin-main-content')).toBeFocused();
  });
});
