import { expect, test } from '@playwright/test';

type WaitlistPayload = {
  email: string;
  source?: string;
  referredBy?: string;
};

function assertCapturedPayload(payload: WaitlistPayload | null): WaitlistPayload {
  expect(payload).not.toBeNull();
  if (!payload) {
    throw new Error('Waitlist payload was not captured');
  }

  return payload;
}

const acceptedConsent = {
  essential: true,
  analytics: true,
  marketing: true,
  decidedAt: '2026-05-14T00:00:00.000Z',
  version: 1,
};

const rejectedConsent = {
  ...acceptedConsent,
  analytics: false,
  marketing: false,
};

async function mockPrelaunch(page: import('@playwright/test').Page) {
  await page.route('**/public-config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        prelaunchMode: true,
        appEnv: 'production',
        version: 'e2e',
      }),
    });
  });
}

async function installAnalyticsSpies(
  page: import('@playwright/test').Page,
  consentState: typeof acceptedConsent,
) {
  await page.addInitScript((state) => {
    window.localStorage.setItem('urban-ai-consent-v1', JSON.stringify(state));

    const target = window as unknown as {
      __urbanAiEvents: Array<{ vendor: string; args: unknown[] }>;
      gtag: (...args: unknown[]) => void;
      fbq: (...args: unknown[]) => void;
    };

    target.__urbanAiEvents = [];
    target.gtag = (...args: unknown[]) => {
      target.__urbanAiEvents.push({ vendor: 'gtag', args });
    };
    target.fbq = (...args: unknown[]) => {
      target.__urbanAiEvents.push({ vendor: 'fbq', args });
    };
  }, consentState);
}

test.describe('Prelaunch waitlist analytics', () => {
  test('usa runtime prelaunch, envia UTM/referral e dispara analytics com consentimento', async ({ page }) => {
    let payload: WaitlistPayload | null = null;

    await installAnalyticsSpies(page, acceptedConsent);
    await mockPrelaunch(page);
    await page.route('**/waitlist', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      payload = route.request().postDataJSON() as WaitlistPayload;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          position: 7,
          referralCode: 'e2ecode7',
          aheadOfYou: 6,
          totalSignups: 17,
        }),
      });
    });

    await page.goto('/create?utm_source=meta&utm_medium=cpc&utm_campaign=beta-sp&ref=abc123xy');
    await expect(page.getByText(/Garanta seu lugar/i)).toBeVisible();

    await page.locator('input[type="email"]').fill('lead+prelaunch@urbanai.com.br');
    await page.locator('input[autocomplete="name"]').fill('Lead Prelaunch');
    await page.locator('input[type="tel"]').fill('(11) 99999-0000');
    await page.getByRole('button', { name: /Entrar na lista/i }).click();

    await expect(page.getByText(/dentro/i)).toBeVisible();
    const sentPayload = assertCapturedPayload(payload);
    expect(sentPayload.email).toBe('lead+prelaunch@urbanai.com.br');
    expect(sentPayload.referredBy).toBe('abc123xy');
    expect(sentPayload.source).toContain('create-signup');
    expect(sentPayload.source).toContain('meta');
    expect(sentPayload.source).toContain('cpc');

    const events = await page.evaluate(() => {
      const target = window as unknown as {
        __urbanAiEvents: Array<{ vendor: string; args: unknown[] }>;
      };
      return target.__urbanAiEvents;
    });

    expect(events.some((event) => event.vendor === 'gtag' && event.args[1] === 'waitlist_signup')).toBe(true);
    expect(events.some((event) => event.vendor === 'fbq' && event.args[1] === 'Lead')).toBe(true);
  });

  test('nao dispara GA/Pixel quando usuario recusou analytics e marketing', async ({ page }) => {
    await installAnalyticsSpies(page, rejectedConsent);
    await mockPrelaunch(page);
    await page.route('**/waitlist', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          position: 8,
          referralCode: 'e2ecode8',
          aheadOfYou: 7,
          totalSignups: 18,
        }),
      });
    });

    await page.goto('/create?utm_source=meta&utm_medium=cpc&utm_campaign=beta-sp');
    await page.locator('input[type="email"]').fill('lead+no-consent@urbanai.com.br');
    await page.getByRole('button', { name: /Entrar na lista/i }).click();
    await expect(page.getByText(/dentro/i)).toBeVisible();

    const events = await page.evaluate(() => {
      const target = window as unknown as {
        __urbanAiEvents: Array<{ vendor: string; args: unknown[] }>;
      };
      return target.__urbanAiEvents;
    });

    expect(events).toEqual([]);
  });
});
