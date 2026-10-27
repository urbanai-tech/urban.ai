import { expect, type Locator, type Page, type Route, test } from '@playwright/test';
import { expectNoCriticalA11yViolations } from './a11y-helpers';
import { acceptCookieConsent } from './test-helpers';

/**
 * DS3 - acessibilidade dos fluxos-chave, 100% mockada (sem backend real).
 *
 * Roda axe (WCAG 2.0/2.1 A e AA) e bloqueia violacoes serious/critical em:
 * login, cadastro, recuperacao de senha, onboarding (etapas 1 a 3), planos,
 * paywall, imoveis (lista + modal de adicionar), pagina do imovel com o
 * formulario "Preencher manualmente", dashboard com o dialog de aplicar preco,
 * painel e perfil. O admin nao tem login proprio: entra pelo /login.
 *
 * Tambem verifica o contrato de dialogs: foco entra no dialog, Tab e preso,
 * Escape fecha e o foco volta ao gatilho. Leitor de tela e contraste em
 * hover/focus seguem em revisao manual (docs/runbooks/wcag-audit-checklist.md).
 */

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const user = {
  id: 'user-a11y',
  userId: 'user-a11y',
  username: 'Host A11y',
  email: 'host.a11y@urbanai.com.br',
  role: 'USER',
  emailVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const plan = {
  id: 'starter-a11y',
  name: 'starter',
  title: 'Starter',
  price: '97',
  priceAnnual: '970',
  priceMonthly: '97',
  priceQuarterly: '92',
  priceSemestral: '87',
  priceAnnualNew: '77',
  discountQuarterlyPercent: 5,
  discountSemestralPercent: 10,
  discountAnnualPercent: 20,
  period: 'por imovel',
  minProperties: 1,
  maxProperties: 3,
  maxCheckoutQuantity: 3,
  propertyLimit: null,
  features: ['Recomendacoes por eventos', 'Dashboard de precos'],
  isCustomPrice: false,
  selfServiceEnabled: true,
  highlightBadge: '',
  discountBadge: '',
  isActive: true,
};

const property = {
  id: 'prop-a11y',
  propertyName: 'Apartamento Vila Mariana',
  userId: 'user-a11y',
  analisado: 'completed',
  image_url: 'https://example.com/vila-mariana.jpg',
  latitude: -23.589,
  longitude: -46.634,
  id_do_anuncio: '987654321',
  manualDailyPrice: 320,
  averageMonthlyRevenue: 7400,
  dailyPrice: 310,
  pricingInputSource: 'manual',
  nome: 'Apartamento Vila Mariana',
};

const propertyDetail = {
  id: 'prop-a11y',
  cep: '04101-000',
  numero: '10',
  logradouro: 'Rua Teste',
  bairro: 'Vila Mariana',
  cidade: 'São Paulo',
  estado: 'SP',
  ativo: true,
  list: {
    id: 'list-a11y',
    titulo: 'Apartamento Vila Mariana',
    id_do_anuncio: '987654321',
    pricingInputSource: null,
    pricingInputsUpdatedAt: null,
    manualDailyPrice: null,
    dailyPrice: null,
    lastScrapedAt: null,
  },
};

const recommendation = {
  id: 'event-a11y',
  nome: 'Expo Turismo SP',
  dataInicio: new Date().toISOString(),
  dataFim: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  enderecoCompleto: 'Sao Paulo Expo',
  cidade: 'Sao Paulo',
  estado: 'SP',
  precoSugerido: '420',
  seuPrecoAtual: '350',
  diferencaPercentual: '20',
  recomendacao: 'Evento com demanda alta perto do imovel. Sugestao dentro do guardrail.',
  motivo_ia: 'Evento proximo, alta demanda esperada e preco atual abaixo dos comparaveis.',
  distancia_metros: '1800',
  idAnalise: 'analysis-a11y',
  aceito: false,
  status: 'suggested',
};

async function mockSession(page: Page, subscriptionStatus: 'active' | 'inactive' = 'active') {
  await acceptCookieConsent(page);
  await page.addInitScript(() => {
    window.localStorage.setItem('accessToken', 'e2e-a11y-token');
  });
  await page.route('**/auth/me', (route) => json(route, user));
  await page.route('**/auth/profile**', (route) => json(route, user));
  await page.route('**/payments/getSubscription', (route) =>
    json(route, { id: 'sub_a11y', status: subscriptionStatus, plan: 'alpha' }),
  );
  await page.route('**/payments/listings-quota', (route) =>
    json(route, { contratados: 2, ativos: 1, podeAdicionar: true }),
  );
  await page.route('**/ask/usage', (route) =>
    json(route, { used: 0, quota: 20, hardCap: 30, canUse: true, plan: 'profissional', reason: null }),
  );
  await page.route('**/propriedades/dropdown/list', (route) => json(route, [property]));
}

async function mockPlans(page: Page) {
  await page.route('**/plans', (route) => {
    if (route.request().resourceType() === 'document') return route.continue();
    return json(route, [plan]);
  });
}

async function mockProperty(page: Page) {
  await page.route('**/propriedades/prop-a11y', (route) => json(route, propertyDetail));
  await page.route('**/propriedades/prop-a11y/pricing-inputs/history**', (route) => json(route, []));
  await page.route('**/propriedades/prop-a11y/occupancy**', (route) => json(route, []));
  await page.route('**/propriedades/prop-a11y/baseline', (route) =>
    json(route, {
      addressId: 'prop-a11y',
      listId: 'list-a11y',
      dailyPrice: null,
      source: null,
      updatedAt: null,
      stale: false,
      reason: 'none',
      minDailyPrice: null,
      weekendDailyPrice: null,
      essentialsSource: null,
      essentialsUpdatedAt: null,
    }),
  );
}

async function mockRecommendations(page: Page) {
  await page.route('**/propriedades/eventos-analisados-com-price**', (route) =>
    json(route, { data: [recommendation] }),
  );
}

async function settle(page: Page, heading?: RegExp | string) {
  if (heading) {
    await page.getByRole('heading', { name: heading }).first().waitFor({ state: 'visible' });
  } else {
    await page.locator('main, [role="main"], form').first().waitFor({ state: 'visible' });
  }
  await page.waitForTimeout(400);
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

async function expectFocusInside(page: Page, dialog: Locator) {
  const inside = await dialog.evaluate((node) => node.contains(document.activeElement));
  expect(inside, 'o foco deve estar dentro do dialog').toBe(true);
}

/** Foco entra, Tab/Shift+Tab ciclam dentro, Escape fecha e o foco volta ao gatilho. */
async function expectDialogContract(page: Page, dialog: Locator, trigger: Locator) {
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expectFocusInside(page, dialog);

  const focusables = dialog.locator(focusableSelector);
  await focusables.last().focus();
  await page.keyboard.press('Tab');
  await expectFocusInside(page, dialog);
  await expect(focusables.first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(focusables.last()).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
}

const viewports = [
  { label: 'desktop', width: 1280, height: 900 },
  { label: 'mobile', width: 390, height: 844 },
] as const;

test.describe('A11y mockada - fluxos publicos', () => {
  test.beforeEach(async ({ page }) => {
    await acceptCookieConsent(page);
  });

  for (const viewport of viewports) {
    test(`login em ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/login');
      await settle(page);
      await expectNoCriticalA11yViolations(page);
    });
  }

  test('login apos credenciais invalidas (toast de erro visivel)', async ({ page }) => {
    await page.route('**/auth/login', (route) =>
      json(route, { message: 'Credenciais invalidas' }, 401),
    );
    await page.goto('/login');
    await settle(page);
    await page.locator('input[type="email"]').fill('host@urbanai.com.br');
    await page.locator('input[type="password"]').fill('senha-errada-123');
    await Promise.all([
      page.waitForResponse((response) => response.url().includes('/auth/login')),
      page.getByRole('button', { name: /entrar/i }).click(),
    ]);
    await page.waitForTimeout(500);
    await expectNoCriticalA11yViolations(page);
  });

  test('cadastro (/create)', async ({ page }) => {
    await page.goto('/create');
    await settle(page);
    await expectNoCriticalA11yViolations(page);
  });

  test('cadastro com campos invalidos expoe erros acessiveis', async ({ page }) => {
    await page.goto('/create');
    await settle(page);
    await page.getByLabel('Senha', { exact: true }).fill('Abcdef12!');
    await page.getByLabel('Confirmar senha').fill('Outra-senha-1');
    await expect(page.getByText('As senhas não conferem.')).toBeVisible();
    await expect(page.getByLabel('Confirmar senha')).toHaveAttribute('aria-invalid', 'true');
    await expectNoCriticalA11yViolations(page);
  });

  test('recuperar senha (/request-reset-password)', async ({ page }) => {
    await page.goto('/request-reset-password');
    await settle(page);
    await expectNoCriticalA11yViolations(page);
  });

});

test.describe('A11y mockada - planos', () => {
  test('planos (/plans) com landmark main', async ({ page }) => {
    await mockSession(page);
    await mockPlans(page);
    await page.goto('/plans');
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForTimeout(500);
    await expectNoCriticalA11yViolations(page);
  });
});

test.describe('A11y mockada - onboarding', () => {
  test('etapas 1, 2 e 3 (importacao do imovel)', async ({ page }) => {
    await mockSession(page, 'inactive');
    await mockPlans(page);
    await page.route('**/propriedades/dropdown/list', (route) => json(route, []));
    await page.route('**/connect/resolve**', (route) =>
      json(route, { finalUrl: 'https://www.airbnb.com.br/rooms/12345678' }),
    );
    await page.route('**/propriedades/quick-info**', (route) =>
      json(route, {
        propertyId: '12345678',
        title: 'Loft Paulista perto do metro',
        pictureUrl: 'https://example.com/loft.jpg',
        hostId: 'host-a11y',
        hostName: 'Host A11y',
        bedrooms: 1,
        beds: 1,
        bathrooms: 1,
        guests: 2,
        rating: 4.92,
        isNewListing: false,
        reviewCount: 48,
        propertyType: 'Apartamento inteiro',
        neighborhood: 'Bela Vista',
        street: 'Rua Frei Caneca',
        city: 'Sao Paulo',
        state: 'SP',
        zipCode: '01307-001',
        fullAddress: 'Rua Frei Caneca, Bela Vista, Sao Paulo-SP',
        latitude: -23.557,
        longitude: -46.658,
        amenitiesCount: 12,
        amenities: ['Wi-Fi', 'Ar-condicionado'],
      }),
    );

    await page.goto('/onboarding');
    await page.getByRole('heading', { name: /Bem-vindo ao Urban AI/i }).waitFor();
    await page.waitForTimeout(400);
    await expectNoCriticalA11yViolations(page);

    await page.getByRole('button', { name: /Come.*configura/i }).click();
    await page.getByRole('heading', { name: /Conecte seus Im/i }).waitFor();
    await page.waitForTimeout(300);
    await expectNoCriticalA11yViolations(page);

    await page
      .getByPlaceholder('https://www.airbnb.com.br/rooms/12345678')
      .fill('https://www.airbnb.com.br/rooms/12345678');
    await page.getByRole('button', { name: /Buscar im/i }).click();
    await page.getByRole('heading', { name: /Selecionar Im/i }).waitFor();
    await page.waitForTimeout(300);
    await expectNoCriticalA11yViolations(page);
  });
});

test.describe('A11y mockada - paywall', () => {
  test('paywall sem assinatura ativa: axe, foco dentro e foco preso', async ({ page }) => {
    await mockSession(page, 'inactive');
    await mockPlans(page);
    await page.goto('/properties');

    const dialog = page.getByRole('dialog', { name: /Escolha seu plano/i });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await page.waitForTimeout(600);
    await expectFocusInside(page, dialog);
    // O conteudo atras do paywall fica escurecido pelo overlay; audita-se o dialog.
    await expectNoCriticalA11yViolations(page, '[role="dialog"]');

    const focusables = dialog.locator(focusableSelector);
    await focusables.last().focus();
    await page.keyboard.press('Tab');
    await expect(focusables.first()).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(focusables.last()).toBeFocused();

    // Paywall bloqueante: Escape nao pode dispensa-lo.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
  });
});

test.describe('A11y mockada - imoveis', () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
  });

  test('lista de imoveis', async ({ page }) => {
    await page.goto('/properties');
    await expect(page.getByText('Apartamento Vila Mariana').first()).toBeVisible();
    await expectNoCriticalA11yViolations(page);
  });

  test('modal de adicionar imovel: axe e contrato de dialog', async ({ page }) => {
    await page.goto('/properties');
    await expect(page.getByText('Apartamento Vila Mariana').first()).toBeVisible();
    const trigger = page.getByRole('button', { name: /adicionar im/i }).first();
    await trigger.focus();
    await trigger.click();

    const dialog = page.getByRole('dialog', { name: /Adicionar im/i });
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(300);
    await expectNoCriticalA11yViolations(page);
    await expectDialogContract(page, dialog, trigger);
  });

  test('pagina do imovel com o formulario "Preencher manualmente"', async ({ page }) => {
    await mockProperty(page);
    await page.goto('/properties/prop-a11y');
    await expect(page.getByText('Sem diária base').first()).toBeVisible();
    await page.waitForTimeout(400);
    await expectNoCriticalA11yViolations(page);

    const toggle = page.getByRole('button', { name: 'Preencher manualmente' });
    if (await toggle.isVisible()) await toggle.click();
    await expect(page.getByLabel(/Diária base atual/)).toBeVisible();
    await expectNoCriticalA11yViolations(page);
  });
});

test.describe('A11y mockada - area logada', () => {
  test.beforeEach(async ({ page }) => {
    await mockSession(page);
  });

  test('dashboard e dialog de aplicar preco', async ({ page }) => {
    await mockRecommendations(page);
    await page.goto('/dashboard');
    const trigger = page.getByRole('button', { name: /Vou aplicar este pre/i });
    await expect(trigger).toBeVisible();
    await page.waitForTimeout(400);
    await expectNoCriticalA11yViolations(page);

    await trigger.focus();
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: /Vou aplicar este pre/i });
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(300);
    await expectNoCriticalA11yViolations(page);
    await expectDialogContract(page, dialog, trigger);
  });

  test('dialog de aplicar preco com erro de validacao liga a mensagem ao campo', async ({ page }) => {
    await mockRecommendations(page);
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /Vou aplicar este pre/i }).click();
    const dialog = page.getByRole('dialog', { name: /Vou aplicar este pre/i });
    const field = dialog.getByLabel(/Pre[cç]o que apliquei/i);
    await field.fill('42000');
    await dialog.getByRole('button', { name: /^Confirmar$/ }).click();
    await expect(dialog.getByText(/fora do esperado/i)).toBeVisible();
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    const describedBy = await field.getAttribute('aria-describedby');
    expect(describedBy, 'campo invalido deve apontar para a mensagem').toBeTruthy();
    await expectNoCriticalA11yViolations(page);
  });

  test('painel', async ({ page }) => {
    await mockRecommendations(page);
    await page.goto('/painel');
    await settle(page);
    await expectNoCriticalA11yViolations(page);
  });

  test('perfil', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByLabel('E-mail')).toBeVisible();
    await page.waitForTimeout(300);
    await expectNoCriticalA11yViolations(page);
  });
});

test.describe('A11y mockada - admin', () => {
  test('admin entra pelo mesmo /login (sem tela propria)', async ({ page }) => {
    await acceptCookieConsent(page);
    const response = await page.goto('/admin/login');
    // Sem rota propria: cai no 404 do app ou redireciona ao login; em ambos a pagina e auditavel.
    expect([200, 404]).toContain(response?.status() ?? 200);
    await page.waitForTimeout(400);
    await expectNoCriticalA11yViolations(page);
  });
});
