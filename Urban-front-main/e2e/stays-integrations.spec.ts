import { expect, test, type Page, type Route } from '@playwright/test';
import { acceptCookieConsent, gotoHydrated } from './test-helpers';

/**
 * /settings/integrations com a API Stays 100% mockada (nenhuma conta real).
 * Um único handler em `**\/stays/**` despacha por método + caminho.
 */

type StaysState = {
  account: Record<string, unknown> | null;
  capabilities: { priceWritesEnabled: boolean; autoApplyEnabled: boolean; autoApplyDryRun: boolean };
  listings: Array<Record<string, unknown>>;
  history: Array<Record<string, unknown>>;
  calls: Array<{ method: string; path: string; body: unknown }>;
};

const listingFixtures = () => [
  {
    id: '11111111-1111-4111-8111-111111111111',
    staysListingId: 'ST-1',
    title: 'Studio Paulista',
    shortAddress: 'Avenida Paulista, 1000, São Paulo',
    basePriceCents: null,
    active: true,
    operationMode: 'auto',
    propriedadeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    staysListingId: 'ST-2',
    title: 'Loft Centro',
    shortAddress: 'Rua Direita, 50, São Paulo',
    basePriceCents: null,
    active: false,
    operationMode: 'notifications',
    propriedadeId: null,
  },
];

const properties = [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', titulo: 'Studio Paulista Urban', internalNickname: null },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', titulo: 'Loft Centro Urban', internalNickname: 'Loft' },
];

async function mockSession(page: Page) {
  await acceptCookieConsent(page);
  await page.route('**/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'user-stays-e2e', username: 'Host Stays E2E', email: 'host.stays@urbanai.invalid', role: 'USER' }),
    }),
  );
  await page.route('**/payments/getSubscription', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'sub_stays_e2e', status: 'active' }) }),
  );
}

async function mockStays(page: Page, state: StaysState) {
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route('**/stays/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^.*\/stays/, '/stays');
    const method = request.method();
    const body = request.postData() ? request.postDataJSON() : null;
    state.calls.push({ method, path, body });

    if (method === 'GET' && path === '/stays/account') return json(route, state.account);
    if (method === 'GET' && path === '/stays/capabilities') return json(route, state.capabilities);
    if (method === 'GET' && path === '/stays/listings') return json(route, state.listings);
    if (method === 'GET' && path === '/stays/properties') return json(route, properties);
    if (method === 'GET' && path === '/stays/listings/match-suggestions') {
      return json(route, [{
        listingId: '22222222-2222-4222-8222-222222222222',
        propriedadeId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        propriedadeTitulo: 'Loft Centro Urban',
        score: 0.6,
        reason: 'name_address_similarity',
      }]);
    }
    if (method === 'POST' && path === '/stays/connect') {
      state.account = {
        id: 'stays-account-e2e', status: 'active', clientId: 'client-e2e', accountSlug: 'minhaconta',
        lastSyncAt: '2026-10-25T12:00:00.000Z', consentVersion: 'stays-connect-v1', consentAcceptedAt: '2026-10-25T11:59:00.000Z',
      };
      return json(route, state.account);
    }
    if (method === 'POST' && path === '/stays/listings/sync') {
      state.listings = listingFixtures();
      return json(route, { count: state.listings.length, listings: state.listings });
    }
    const link = path.match(/^\/stays\/listings\/([^/]+)\/property$/);
    if (link) {
      const listing = state.listings.find((item) => item.id === link[1]);
      if (!listing) return json(route, { message: 'not found' }, 404);
      listing.propriedadeId = method === 'PUT' ? (body as { propriedadeId: string }).propriedadeId : null;
      return json(route, listing);
    }
    const recommendation = path.match(/^\/stays\/listings\/([^/]+)\/recommendation$/);
    if (recommendation) {
      return json(route, {
        analisePrecoId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        targetDate: '2026-11-20',
        recommendedPriceCents: 32000,
        eventName: 'Show no Allianz',
      });
    }
    if (method === 'POST' && path === '/stays/price/preview') {
      const input = body as { listingId: string; targetDate: string; newPriceCents: number; previousPriceCents?: number };
      const blockers = state.capabilities.priceWritesEnabled
        ? []
        : [{ code: 'stays_price_writes_disabled', message: 'Escrita desligada neste ambiente; prévia disponível.' }];
      return json(route, {
        listingId: input.listingId, staysListingId: 'ST-1', title: 'Studio Paulista', targetDate: input.targetDate,
        previousPriceCents: 28000, previousPriceSource: 'stays_calendar', newPriceCents: input.newPriceCents,
        currency: 'BRL', diffCents: input.newPriceCents - 28000, diffPercent: ((input.newPriceCents - 28000) / 28000) * 100,
        maxIncreasePercent: 25, maxDecreasePercent: 20, withinGuardrails: true,
        readyForPush: blockers.length === 0, priceWritesEnabled: state.capabilities.priceWritesEnabled,
        blockers, warnings: [], existingPriceUpdateId: null, idempotentReplay: false,
      });
    }
    if (method === 'POST' && path === '/stays/price/push') {
      const input = body as { listingId: string; targetDate: string; newPriceCents: number; previousPriceCents: number };
      const record = {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', listingId: input.listingId, targetDate: input.targetDate,
        previousPriceCents: input.previousPriceCents, newPriceCents: input.newPriceCents, currency: 'BRL',
        origin: 'user_accepted', status: 'success', errorMessage: null, rollbackOfId: null, createdAt: '2026-10-25T12:01:00.000Z',
      };
      state.history.unshift(record);
      return json(route, record);
    }
    const rollback = path.match(/^\/stays\/price\/([^/]+)\/rollback$/);
    if (method === 'POST' && rollback) {
      const original = state.history.find((item) => item.id === rollback[1]);
      const record = {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', listingId: original?.listingId, targetDate: original?.targetDate,
        previousPriceCents: original?.newPriceCents, newPriceCents: original?.previousPriceCents, currency: 'BRL',
        origin: 'rollback', status: 'success', errorMessage: null, rollbackOfId: rollback[1], createdAt: '2026-10-25T12:02:00.000Z',
      };
      state.history.unshift(record);
      return json(route, record);
    }
    if (method === 'GET' && path === '/stays/price-updates') {
      const listingId = url.searchParams.get('listingId');
      return json(route, state.history.filter((item) => !listingId || item.listingId === listingId));
    }
    return json(route, { message: `unmocked ${method} ${path}` }, 500);
  });
}

function newState(overrides: Partial<StaysState> = {}): StaysState {
  return {
    account: null,
    capabilities: { priceWritesEnabled: false, autoApplyEnabled: false, autoApplyDryRun: true },
    listings: [],
    history: [],
    calls: [],
    ...overrides,
  };
}

const connectedAccount = {
  id: 'stays-account-e2e', status: 'active', clientId: 'client-e2e', accountSlug: 'minhaconta',
  lastSyncAt: '2026-10-25T12:00:00.000Z', consentVersion: 'stays-connect-v1', consentAcceptedAt: '2026-10-25T11:59:00.000Z',
};

test.describe('Stays integrations settings', () => {
  test('conecta só com o identificador da conta e avisa que a escrita está desligada', async ({ page }) => {
    await mockSession(page);
    const state = newState();
    await mockStays(page, state);

    await gotoHydrated(page, '/settings/integrations');
    await expect(page.getByRole('heading', { name: /Conex.o com a Stays/i })).toBeVisible();
    await expect(page.getByText('Escrita desligada neste ambiente').first()).toBeVisible();

    await page.getByRole('textbox', { name: /^Conta Stays/i }).fill('https://evil.example');
    await page.getByRole('textbox', { name: /Código da conta Stays/i }).fill('client-e2e');
    await page.getByRole('textbox', { name: /Chave de acesso Stays/i }).fill('token-e2e');
    await page.locator('#stays-consent').check();
    await page.getByRole('button', { name: /Conectar Stays/i }).click();
    await expect(page.getByRole('alert').filter({ hasText: /Informe só o nome da sua conta Stays/i })).toBeVisible();
    expect(state.calls.some((call) => call.path === '/stays/connect')).toBe(false);

    await page.getByRole('textbox', { name: /^Conta Stays/i }).fill('https://MinhaConta.stays.net');
    await page.getByRole('button', { name: /Conectar Stays/i }).click();

    await expect(page.getByText(/Conectada e ativa/i)).toBeVisible();
    await expect(page.getByText('1/2')).toBeVisible();
    await expect(page.getByText('1 sem vínculo')).toBeVisible();
    await expect(page.getByText('Beta automático')).toBeVisible();
    const connect = state.calls.find((call) => call.path === '/stays/connect');
    expect(connect?.body).toEqual({
      clientId: 'client-e2e',
      accountSlug: 'minhaconta',
      accessToken: 'token-e2e',
      consentAccepted: true,
      consentVersion: 'stays-connect-v1',
    });
  });

  test('vincula imóvel, usa sugestão, aplica preço recomendado com prévia e reverte', async ({ page }) => {
    await mockSession(page);
    const state = newState({
      account: connectedAccount,
      capabilities: { priceWritesEnabled: true, autoApplyEnabled: false, autoApplyDryRun: false },
      listings: listingFixtures(),
    });
    await mockStays(page, state);

    await gotoHydrated(page, '/settings/integrations');
    await expect(page.getByText(/Conectada e ativa/i)).toBeVisible();
    await expect(page.getByText('Escrita desligada neste ambiente')).toHaveCount(0);

    // sugestão automática confirmada pelo usuário
    await expect(page.getByText(/Sugestão:/)).toContainText('Loft Centro Urban');
    await page.getByRole('button', { name: 'Usar sugestão' }).click();
    await expect.poll(() => state.calls.filter((call) => call.method === 'PUT').map((call) => [call.path, call.body]))
      .toEqual([['/stays/listings/22222222-2222-4222-8222-222222222222/property', { propriedadeId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }]]);
    await expect(page.getByText('todos vinculados')).toBeVisible();

    // desvincular pelo seletor
    await page.getByLabel(/Imóvel My Urban de Loft Centro/).selectOption('');
    await expect.poll(() => state.calls.filter((call) => call.method === 'DELETE').length).toBe(1);

    // aplicar o preço recomendado: prévia lê o preço atual da Stays
    await page.getByRole('button', { name: 'Aplicar via Stays' }).first().click();
    await expect(page.getByText(/PRÉVIA · 2026-11-20 · Show no Allianz/)).toBeVisible();
    await expect(page.getByText(/Atual na Stays:/)).toContainText('280,00');
    await expect(page.getByText(/Recomendado:/)).toContainText('320,00');
    const preview = state.calls.find((call) => call.path === '/stays/price/preview');
    expect(preview?.body).not.toHaveProperty('previousPriceCents');
    await page.getByRole('button', { name: 'Confirmar e aplicar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Aplicar' }).click();
    await expect(page.getByRole('status')).toContainText(/Preço aplicado na Stays/);
    const push = state.calls.find((call) => call.path === '/stays/price/push')?.body as Record<string, unknown>;
    expect(push).toMatchObject({
      listingId: '11111111-1111-4111-8111-111111111111',
      targetDate: '2026-11-20',
      newPriceCents: 32000,
      previousPriceCents: 28000,
      analisePrecoId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });
    expect(push.requestId).toMatch(/^[0-9a-f-]{36}$/);

    // histórico + reverter
    await expect(page.getByText(/2026-11-20 · R\$\s*280,00 → R\$\s*320,00/)).toBeVisible();
    await page.getByRole('button', { name: 'Reverter' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reverter' }).click();
    await expect(page.getByRole('status')).toContainText(/Preço revertido/);
    expect(state.calls.some((call) => call.path === '/stays/price/dddddddd-dddd-4ddd-8ddd-dddddddddddd/rollback')).toBe(true);
    await expect(page.getByRole('button', { name: 'Reverter' })).toHaveCount(0);
  });

  test('com escrita desligada mostra a prévia mas bloqueia aplicar e reverter', async ({ page }) => {
    await mockSession(page);
    const state = newState({
      account: connectedAccount,
      listings: listingFixtures(),
      history: [{
        id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', listingId: '11111111-1111-4111-8111-111111111111', targetDate: '2026-11-01',
        previousPriceCents: 20000, newPriceCents: 22000, currency: 'BRL', origin: 'ai_auto', status: 'success',
        errorMessage: null, rollbackOfId: null, createdAt: '2026-10-20T12:00:00.000Z',
      }],
    });
    await mockStays(page, state);

    await gotoHydrated(page, '/settings/integrations');
    await expect(page.getByText(/Conectada e ativa/i)).toBeVisible();
    await expect(page.getByText('Escrita desligada neste ambiente').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reverter' })).toBeDisabled();

    await page.getByRole('button', { name: 'Aplicar via Stays' }).first().click();
    await expect(page.getByText(/PRÉVIA · 2026-11-20/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Escrita desligada neste ambiente' })).toBeDisabled();
    expect(state.calls.some((call) => call.path === '/stays/price/push')).toBe(false);
  });
});
