import { expect, test } from '@playwright/test';

test.describe('PWA e mobile', () => {
  test('expoe manifest, icons, service worker e offline fallback', async ({ page, request }) => {
    const manifestResponse = await request.get('/manifest.webmanifest');
    expect(manifestResponse.ok()).toBeTruthy();

    const manifest = await manifestResponse.json();
    expect(manifest.name).toBe('Urban AI');
    expect(manifest.short_name).toBe('Urban AI');
    expect(manifest.id).toBe('/?source=pwa');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.background_color).toBe('#080A0F');
    expect(manifest.theme_color).toBe('#E8500A');
    expect(manifest.orientation).toBe('portrait');
    expect(manifest.lang).toBe('pt-BR');
    expect(manifest.categories).toEqual(expect.arrayContaining(['business', 'productivity']));
    expect(manifest.start_url).toContain('/dashboard');
    expect(manifest.shortcuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Dashboard', url: expect.stringContaining('/dashboard') }),
        expect.objectContaining({ name: 'Calendario', url: expect.stringContaining('/portfolio') }),
      ]),
    );
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: '/pwa-icon-192.png', sizes: '192x192' }),
        expect.objectContaining({ src: '/pwa-icon-512.png', sizes: '512x512' }),
        expect.objectContaining({ src: '/maskable-icon-512.png', purpose: 'maskable' }),
      ]),
    );

    expect((await request.get('/pwa-icon-192.png')).ok()).toBeTruthy();
    expect((await request.get('/pwa-icon-512.png')).ok()).toBeTruthy();
    expect((await request.get('/maskable-icon-512.png')).ok()).toBeTruthy();
    expect((await request.get('/apple-touch-icon.png')).ok()).toBeTruthy();
    expect((await request.get('/sw.js')).ok()).toBeTruthy();
    expect((await request.get('/offline.html')).ok()).toBeTruthy();

    await page.goto('/');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
    await expect(page.locator('meta[name="theme-color"][media="(prefers-color-scheme: light)"]')).toHaveAttribute(
      'content',
      '#FAFAFB',
    );
    await expect(page.locator('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]')).toHaveAttribute(
      'content',
      '#080A0F',
    );
    await expect(page.locator('meta[name="theme-color"][data-urban-runtime-theme="true"]')).toHaveAttribute(
      'content',
      /#(?:FAFAFB|080A0F)/,
    );
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      'href',
      '/apple-touch-icon.png',
    );

    const swAvailable = await page.evaluate(() => 'serviceWorker' in navigator);
    expect(swAvailable).toBeTruthy();
  });

  test('service worker mantem fallback offline seguro para navegacao', async ({ request }) => {
    const response = await request.get('/sw.js');
    expect(response.ok()).toBeTruthy();

    const source = await response.text();
    expect(source).toContain('const CACHE_PREFIX = "urban-ai-pwa-"');
    expect(source).toContain('const CACHE_VERSION = `${CACHE_PREFIX}v4`');
    expect(source).toContain('const ACTIVE_CACHES = new Set([STATIC_CACHE, PUSH_CONFIG_CACHE])');
    expect(source).toContain('networkFirstNavigation');
    expect(source).toContain('navigationPreload');
    expect(source).toContain('cache.match("/offline.html")');
    expect(source).toContain('url.pathname.startsWith("/api/")');
    expect(source).toContain('request.method !== "GET"');
    expect(source).toContain('key.startsWith(CACHE_PREFIX) && !ACTIVE_CACHES.has(key)');
  });

  test('rotas publicas principais nao criam overflow horizontal no mobile', async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });

    for (const route of ['/', '/lancamento', '/precos', '/contato', '/termos', '/privacidade']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
      const metrics = await page.evaluate(() => ({
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        clientWidth: Math.max(document.documentElement.clientWidth, document.body.clientWidth),
      }));

      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    }
  });
});
