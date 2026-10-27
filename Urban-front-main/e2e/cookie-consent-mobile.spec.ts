import { expect, test, type Page } from '@playwright/test';
import { installLocalAuthFixture } from './local-auth-fixture';

/**
 * Banner de consentimento no celular (390x844): não pode cobrir a tab bar de
 * vidro nem prender o conteúdo, e precisa ser totalmente alcançável/dispensável.
 */

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
test.describe.configure({ timeout: 60_000 });

const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function withoutConsent(page: Page) {
  // O fixture pré-aceita o consentimento; este spec quer o banner visível.
  await page.addInitScript(() => {
    window.localStorage.removeItem('urban-ai-consent-v1');
  });
}

async function mockHostApi(page: Page) {
  await installLocalAuthFixture(page, 'host');
  await withoutConsent(page);
  await page.route('**/propriedades/dropdown/list', (route) => route.fulfill(json([])));
  await page.route('**/propriedades/eventos-acompanhando**', (route) => route.fulfill(json({ data: [], total: 0 })));
  await page.route('**/propriedades/eventos-analisados-com-price**', (route) => route.fulfill(json({ data: [] })));
  await page.route('**/notifications/user/unread-count', (route) => route.fulfill(json({ unread: 0 })));
  await page.route('**/notifications/user/?**', (route) => route.fulfill(json({ data: [], page: 1, lastPage: 1, total: 0 })));
}

test('banner fica acima da tab bar de vidro, sem cobri-la, e é dispensável', async ({ page }) => {
  await mockHostApi(page);
  await page.goto('/painel', { waitUntil: 'domcontentloaded' });

  const banner = page.locator('[data-cookie-consent-banner]');
  const tabbar = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(banner).toBeVisible({ timeout: 20_000 });
  await expect(tabbar).toBeVisible();

  const b = (await banner.boundingBox())!;
  const t = (await tabbar.boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(t.y + 0.5); // banner termina onde a tab bar começa
  expect(b.y).toBeGreaterThanOrEqual(0); // topo não vaza da viewport

  // Cada aba continua clicável (nada por cima).
  for (const link of await tabbar.getByRole('link').all()) {
    const box = (await link.boundingBox())!;
    const topmostIsTab = await link.evaluate((el, p) => {
      const hit = document.elementFromPoint(p.x, p.y);
      return !!hit && el.contains(hit);
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    expect(topmostIsTab).toBe(true);
  }

  // Os três botões estão dentro da viewport e o aceite remove o banner.
  for (const name of ['Personalizar', 'Apenas essenciais', 'Aceitar todos']) {
    const btn = banner.getByRole('button', { name });
    await expect(btn).toBeInViewport();
  }
  await banner.getByRole('button', { name: 'Apenas essenciais' }).click();
  await expect(banner).toHaveCount(0);
});

test('preferências abrem, cabem na tela e fecham', async ({ page }) => {
  await mockHostApi(page);
  await page.goto('/painel', { waitUntil: 'domcontentloaded' });
  const banner = page.locator('[data-cookie-consent-banner]');
  await expect(banner).toBeVisible({ timeout: 20_000 });
  await expect(async () => {
    await banner.getByRole('button', { name: 'Personalizar' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 15_000 });
  const dialog = page.getByRole('dialog');
  const box = (await dialog.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  await dialog.getByRole('button', { name: 'Salvar preferencias' }).click();
  await expect(banner).toHaveCount(0);
});

test('em tela baixa (paisagem) o banner não vaza pelo topo e rola por dentro', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 360 });
  await mockHostApi(page);
  await page.goto('/painel', { waitUntil: 'domcontentloaded' });
  const banner = page.locator('[data-cookie-consent-banner]');
  await expect(banner).toBeVisible({ timeout: 20_000 });
  const b = (await banner.boundingBox())!;
  expect(b.y).toBeGreaterThanOrEqual(0);
  const accept = banner.getByRole('button', { name: 'Aceitar todos' });
  await accept.scrollIntoViewIfNeeded();
  await expect(accept).toBeInViewport();
});

test('em página pública o banner encosta no rodapé e o conteúdo final continua alcançável', async ({ page }) => {
  await withoutConsent(page);
  await page.goto('/landing', { waitUntil: 'domcontentloaded' });
  const banner = page.locator('[data-cookie-consent-banner]');
  await expect(banner).toBeVisible({ timeout: 20_000 });
  const b = (await banner.boundingBox())!;
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.y + b.height).toBeLessThanOrEqual(844 + 0.5);
  // Reserva de espaço no fim da página: o rodapé rola até ficar acima do banner.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const footerBottom = await page.evaluate(() => {
    const el = document.querySelector('footer') ?? document.body.lastElementChild!;
    return el.getBoundingClientRect().bottom;
  });
  expect(footerBottom).toBeLessThanOrEqual(b.y + 1);
  await banner.getByRole('button', { name: 'Aceitar todos' }).click();
  await expect(banner).toHaveCount(0);
});
