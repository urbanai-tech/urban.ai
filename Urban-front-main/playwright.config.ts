import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke test config.
 *
 * BASE_URL precedence:
 *   1. explicit env var E2E_BASE_URL (CI, staging, prod smoke)
 *   2. https://staging.myurbanai.com (quando existir — F5C.2 item 11)
 *   3. http://localhost:3000 (dev local com `npm run dev` em paralelo)
 *
 * Para rodar contra localhost, iniciar o Next em outro terminal:
 *   npm run dev
 * Depois:
 *   npm run test:e2e
 */
const baseURL =
  process.env.E2E_BASE_URL ||
  (process.env.CI ? 'https://staging.myurbanai.com' : 'http://localhost:3000');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html'], ['list']] : 'list',
  timeout: 30_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
