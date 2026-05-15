import { expect, test } from '@playwright/test';

const now = '2026-05-15T12:00:00.000Z';

const historyRun = {
  id: 'job-history-1',
  name: 'dataset-snapshot',
  status: 'success',
  triggeredByUserId: 'admin-e2e',
  startedAt: now,
  finishedAt: '2026-05-15T12:00:01.000Z',
  durationMs: 1000,
  result: { captured: 3, skipped: 1 },
  errorMessage: null,
};

test.describe('Admin jobs operations', () => {
  test('mostra readiness e executa geocoder com API mockada', async ({ page }) => {
    let geocoderRunRequested = false;

    await page.route('**/events/geocoder/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ pendingGeocode: 12 }),
      });
    });

    await page.route('**/admin/dataset/diagnostics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generatedAt: now,
          health: 'amber',
          readiness: 'collecting',
          blockers: [],
          tables: {
            priceSnapshots: {
              total: 10,
              distinctListings: 3,
              distinctDays: 4,
              trainingReady: 2,
              latestSnapshotDate: '2026-05-15',
            },
            occupancyHistory: { total: 0, trainingReady: 0, latestDate: null },
            eventProximityFeatures: { total: 0, latestSnapshotDate: null },
          },
          externalDependencies: {},
          lastOwnedListingsSnapshot: null,
        }),
      });
    });

    await page.route('**/admin/jobs/runs**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([historyRun]),
      });
    });

    await page.route('**/admin/jobs/geocoder/run**', async (route) => {
      expect(route.request().method()).toBe('POST');
      expect(route.request().url()).toContain('limit=50');
      geocoderRunRequested = true;

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'job-geocoder-e2e',
          name: 'geocoder',
          status: 'success',
          triggeredByUserId: 'admin-e2e',
          startedAt: now,
          finishedAt: '2026-05-15T12:00:02.000Z',
          durationMs: 2000,
          result: {
            attempted: 12,
            succeeded: 10,
            failed: 2,
            failures: [{ id: 'evt-1', reason: 'missing address' }],
          },
          errorMessage: null,
        }),
      });
    });

    await page.goto('/admin/jobs');

    await expect(page.getByRole('heading', { name: /Jobs operacionais/i })).toBeVisible();
    await expect(page.getByText(/12 pendentes/i)).toBeVisible();
    await expect(page.getByText(/amber \/ collecting/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Ultimos jobs admin/i })).toBeVisible();
    await expect(page.getByText('dataset-snapshot')).toBeVisible();

    await page.getByRole('button', { name: /Rodar geocoder/i }).click();

    await expect(page.getByRole('heading', { name: 'geocoder' })).toBeVisible();
    await expect(page.getByText(/attempted/i)).toBeVisible();
    await expect(page.getByText(/missing address/i)).toBeVisible();
    expect(geocoderRunRequested).toBe(true);
  });
});
