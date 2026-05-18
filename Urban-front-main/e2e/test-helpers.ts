import type { Page } from '@playwright/test';

const acceptedConsent = {
  essential: true,
  analytics: true,
  marketing: true,
  decidedAt: '2026-05-14T00:00:00.000Z',
  version: 1,
};

export async function acceptCookieConsent(page: Page) {
  await page.addInitScript((state) => {
    window.localStorage.setItem('urban-ai-consent-v1', JSON.stringify(state));

    const hideNextDevTools = () => {
      const style = document.createElement('style');
      style.dataset.e2eNextDevTools = 'hidden';
      style.textContent = `
        nextjs-portal,
        [data-nextjs-dev-overlay],
        [data-nextjs-toast],
        [data-nextjs-dialog],
        [data-nextjs-dev-tools],
        [data-nextjs-router-announcer] {
          display: none !important;
          pointer-events: none !important;
        }
      `;
      document.head.appendChild(style);
    };

    if (document.head) {
      hideNextDevTools();
    } else {
      window.addEventListener('DOMContentLoaded', hideNextDevTools, { once: true });
    }
  }, acceptedConsent);
}
