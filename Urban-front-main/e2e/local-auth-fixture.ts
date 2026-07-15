import type { Page } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

export type LocalAuthRole = 'host' | 'admin';

const subscriptionFixture = {
  id: 'local-auth-fixture',
  status: 'trialing',
  metadata: {
    urbanai_plan: 'alpha',
    urbanai_quantity: '2',
    urbanai_billing_cycle: 'monthly',
  },
  plan: { id: 'alpha', amount: null, currency: 'brl', interval: 'month' },
};

/**
 * Deterministic fallback for authenticated browser tests.
 *
 * Real credentials remain the preferred staging path. Locally, this fixture
 * exercises the complete rendered route, guards and error states without
 * turning missing secrets into silently skipped coverage.
 */
export async function installLocalAuthFixture(page: Page, role: LocalAuthRole) {
  await acceptCookieConsent(page);
  await page.addInitScript(() => {
    window.localStorage.setItem('accessToken', 'e2e-local-auth-token');
  });

  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: `e2e-local-${role}`,
        username: role === 'admin' ? 'Admin E2E Local' : 'Host E2E Local',
        email: `${role}.e2e.local@urbanai.invalid`,
        role: role === 'admin' ? 'admin' : 'user',
        ativo: true,
      }),
    });
  });

  await page.route('**/payments/getSubscription', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(subscriptionFixture),
    });
  });

  await page.route('**/payments/listings-quota', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ contratados: 2, ativos: 1, podeAdicionar: true }),
    });
  });

  await page.route('**/ask/usage', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        used: 0,
        quota: 20,
        hardCap: 30,
        canUse: true,
        plan: 'profissional',
        reason: null,
      }),
    });
  });

  if (role !== 'admin') return;

  await page.route('**/admin/overview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        users: { total: 1, active: 1, admins: 1 },
        product: {
          propertiesRegistered: 0,
          eventsTotal: 0,
          eventsLast7d: 0,
          analysesTotal: 0,
          analysesAccepted: 0,
          acceptanceRatePercent: 0,
        },
        revenue: { activeSubscriptions: 0 },
        ai: {
          currentTier: 'bootstrap',
          currentStrategy: 'rules',
          reason: 'fixture local deterministica',
          dataset: {
            totalSnapshots: 0,
            distinctListings: 0,
            distinctDays: 0,
            trainingReady: 0,
          },
        },
      }),
    });
  });

  await page.route('**/admin/pricing/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        activeStrategy: 'rules',
        tier: 'bootstrap',
        reason: 'fixture local deterministica',
        datasetSize: {
          total: 0,
          distinctListings: 0,
          distinctDays: 0,
          trainingReady: 0,
        },
        strategyEnvDefault: 'rules',
        bootstrapOnBoot: false,
      }),
    });
  });

  await page.route('**/admin/dataset/metrics', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ byOrigin: [], daysCovered: 0, topListings: [] }),
    });
  });

  await page.route('**/admin/roi?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        windowDays: 30,
        generatedAt: '2026-07-15T00:00:00.000Z',
        totals: {
          users: 0,
          usersWithPositiveRoi: 0,
          activePayments: 0,
          confirmedIncrementalCents: 0,
          projectedIncrementalCents: 0,
          totalAttributedCents: 0,
          subscriptionCostCents: 0,
          netValueCents: 0,
          roiPercent: null,
          roiMultiple: null,
          potentialLostCents: 0,
          impactedNights: 0,
        },
        leaderboard: [],
      }),
    });
  });
}
