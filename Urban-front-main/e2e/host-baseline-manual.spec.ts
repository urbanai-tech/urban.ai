import { expect, test } from '@playwright/test';
import { acceptCookieConsent } from './test-helpers';

// Plano B do scraping (ADR 0010): quando o Airbnb não devolve diária, o anfitrião
// preenche manualmente na tela do imóvel e vê de onde veio a diária base.

const propertyId = 'prop-baseline-e2e';

const propertyDetail = {
  id: propertyId,
  cep: '04101-000',
  numero: '10',
  logradouro: 'Rua Teste',
  bairro: 'Vila Mariana',
  cidade: 'São Paulo',
  estado: 'SP',
  ativo: true,
  list: {
    id: 'list-baseline-e2e',
    titulo: 'Apartamento Vila Mariana',
    id_do_anuncio: '987654321',
    pricingInputSource: null,
    pricingInputsUpdatedAt: null,
    manualDailyPrice: null,
    dailyPrice: null,
    lastScrapedAt: null,
  },
};

async function fulfillJson(route: import('@playwright/test').Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

test.describe('Plano B do scraping: preencher manualmente', () => {
  test('sem diária do Airbnb, salva os dados informados e mostra a origem', async ({ page }) => {
    await acceptCookieConsent(page);
    const saves: Array<Record<string, unknown>> = [];
    let saved = false;

    await page.route('**/auth/me', (route) =>
      fulfillJson(route, { id: 'user-e2e', username: 'Host E2E', email: 'host.e2e@urbanai.com.br', role: 'USER' }),
    );
    await page.route('**/payments/getSubscription', (route) => fulfillJson(route, { id: 'sub_e2e', status: 'active' }));
    await page.route(`**/propriedades/${propertyId}`, (route) =>
      fulfillJson(
        route,
        saved
          ? {
              ...propertyDetail,
              list: {
                ...propertyDetail.list,
                manualDailyPrice: 380,
                dailyPrice: 380,
                pricingInputSource: 'host_input',
                pricingInputsUpdatedAt: '2026-10-26T12:00:00.000Z',
              },
            }
          : propertyDetail,
      ),
    );
    await page.route(`**/propriedades/${propertyId}/baseline`, (route) =>
      fulfillJson(
        route,
        saved
          ? {
              addressId: propertyId,
              listId: 'list-baseline-e2e',
              dailyPrice: 380,
              source: 'host_input',
              updatedAt: '2026-10-26T12:00:00.000Z',
              stale: false,
              reason: 'host_input_only',
              minDailyPrice: 250,
              weekendDailyPrice: null,
              essentialsSource: null,
              essentialsUpdatedAt: null,
            }
          : {
              addressId: propertyId,
              listId: 'list-baseline-e2e',
              dailyPrice: null,
              source: null,
              updatedAt: null,
              stale: false,
              reason: 'none',
              minDailyPrice: null,
              weekendDailyPrice: null,
              essentialsSource: null,
              essentialsUpdatedAt: null,
            },
      ),
    );
    await page.route(`**/propriedades/${propertyId}/host-baseline`, async (route) => {
      saves.push(route.request().postDataJSON());
      saved = true;
      await fulfillJson(route, { addressId: propertyId, dailyPrice: 380, source: 'host_input' });
    });
    await page.route(`**/propriedades/${propertyId}/pricing-inputs/history**`, (route) => fulfillJson(route, []));
    await page.route(`**/propriedades/${propertyId}/occupancy**`, (route) => fulfillJson(route, []));

    await page.goto(`/properties/${propertyId}`);

    await expect(page.getByText('Sem diária base').first()).toBeVisible();
    await expect(page.getByLabel(/Diária base atual/i)).toBeVisible();

    // diária obrigatória: sem ela nada é enviado
    await page.getByRole('button', { name: /Salvar dados/i }).click();
    expect(saves).toHaveLength(0);

    await page.getByLabel(/Diária base atual/i).fill('380');
    await page.getByLabel(/Diária mínima/i).fill('250');
    await page.getByRole('button', { name: /Salvar dados/i }).click();

    await expect.poll(() => saves[0]).toEqual({ manualDailyPrice: 380, minDailyPrice: 250 });
    await expect(page.getByText('Informada por você')).toBeVisible();
  });
});
