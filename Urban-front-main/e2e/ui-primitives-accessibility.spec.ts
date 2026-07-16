import { expect, type Locator, test } from '@playwright/test';
import { installLocalAuthFixture } from './local-auth-fixture';
import { acceptCookieConsent } from './test-helpers';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

async function expectTouchTargets(locator: Locator) {
  const count = await locator.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const item = locator.nth(index);
    if (!(await item.isVisible())) continue;
    const box = await item.boundingBox();
    expect(box, `target ${index} sem bounding box`).not.toBeNull();
    expect(box!.width, `largura do target ${index}`).toBeGreaterThanOrEqual(44);
    expect(box!.height, `altura do target ${index}`).toBeGreaterThanOrEqual(44);
  }
}

test('Ask Urban captura, prende e restaura foco, preservando Escape', async ({ page }) => {
  test.setTimeout(60_000);
  await installLocalAuthFixture(page, 'host');
  const usageReady = page.waitForResponse(
    (response) => response.url().includes('/ask/usage') && response.status() === 200,
  );
  await page.goto('/my-plan', { waitUntil: 'domcontentloaded' });
  await page.locator('main').first().waitFor({ state: 'visible' });
  await usageReady;

  const trigger = page.getByRole('button', { name: /Abrir Ask Urban/ });
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'Ask Urban' });
  await expect(dialog).toBeVisible();
  const textarea = dialog.getByRole('textbox', { name: 'Pergunte ao Ask Urban' });
  await expect(textarea).toBeFocused();

  const focusables = dialog.locator(focusableSelector);
  const first = focusables.first();
  const last = focusables.last();
  await last.focus();
  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
});

test('botões canônicos host e admin têm alvo mobile mínimo de 44px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('/request-reset-password', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Enviar link' }).waitFor({ state: 'visible' });
  await expectTouchTargets(page.locator('.urban-canonical-button'));

  await installLocalAuthFixture(page, 'admin');
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Painel' }).waitFor({ state: 'visible' });
  await expectTouchTargets(page.locator('.urban-canonical-button'));
});

test('loading mantém ação contextual e anuncia aria-busy', async ({ page }) => {
  let releaseRequest: (() => void) | undefined;
  await acceptCookieConsent(page);
  await page.route('**/email/forgot-password', async (route) => {
    await new Promise<void>((resolve) => { releaseRequest = resolve; });
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ enviado: true }),
    });
  });
  await page.goto('/request-reset-password', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  const email = page.getByRole('textbox', { name: 'E-mail' });
  await email.fill('host@urbanai.test');
  await expect(email).toHaveValue('host@urbanai.test');

  const button = page.getByRole('button', { name: 'Enviar link' });
  const requestStarted = page.waitForRequest(
    (request) => request.url().includes('/email/forgot-password'),
  );
  await button.click();
  await requestStarted;
  const busyButton = page.getByRole('button', { name: 'Enviar link — carregando' });
  await expect(busyButton).toHaveAttribute('aria-busy', 'true');
  await expect(busyButton).toContainText('Enviar link');

  releaseRequest?.();
  await expect(page.getByRole('heading', { name: 'E-mail enviado' })).toBeVisible();
});
