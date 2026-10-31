import { expect, type Page, type Route, test } from '@playwright/test';
import { expectNoCriticalA11yViolations } from './a11y-helpers';
import { installLocalAuthFixture } from './local-auth-fixture';

/**
 * Mercado por bairro (ADR 0028) com API 100% mockada: seletor de raio e tipologia, selos de
 * fonte e data de coleta, estados honestos (ocupação e tendência indisponíveis) e a amostra
 * insuficiente explicando o que falta.
 */

const PROPERTY = 'prop-market-e2e';
const MARKET_URL = `/properties/${PROPERTY}/market`;

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const daily = Array.from({ length: 30 }, (_, i) => ({
  date: `2026-10-${String(i + 1).padStart(2, '0')}`,
  yourAdr: 300 + (i % 5) * 4,
  medianAdr: 340,
}));

const baseResponse = {
  propertyId: PROPERTY,
  neighborhood: 'Pinheiros',
  percentile: 32,
  percentileTrend30d: 0,
  comparablesCount: 21,
  medianAdr: 340,
  medianOccupancy: 0,
  yourAdr: 300,
  yourOccupancy: 0,
  eventReactivity: 64,
  daily,
  comparables: [],
  aggregatedOnly: true,
  insufficientData: false,
  minGroupSize: 5,
  minExternalListings: 8,
  radiusKm: 3,
  adrPercentiles: { p25: 280, p50: 340, p75: 410 },
  occupancyPercentiles: null,
  updatedAt: '2026-10-31T12:00:00.000Z',
  schemaVersion: 2,
  radius: { km: 3, min: 1, max: 5 },
  typology: {
    applied: { rooms: null, listingType: null, capacity: null },
    target: { rooms: 2, listingType: 'entire_home', capacity: '3-4' },
  },
  dataSources: [
    { id: 'customers', label: 'Clientes My Urban', listings: 5, latestCollectedAt: null, licenses: ['first_party'] },
    { id: 'licensed_dataset', label: 'Dataset licenciado', listings: 16, latestCollectedAt: '2026-10-01', licenses: ['licensed_display_aggregate'] },
  ],
  attribution: [] as string[],
  yourOccupancyAvailable: false,
  occupancyAvailable: false,
  occupancyIsProxy: false,
  seasonality: [
    { month: 8, index: 0.94, sample: 40 },
    { month: 9, index: 1.02, sample: 40 },
    { month: 10, index: 1.1, sample: 40 },
  ],
  neighborhoodEventEffect: { upliftPct: 18.4, eventDays: 3, baselineDays: 12 },
  trend30d: {
    available: false,
    percentilePoints: null,
    medianAdrChangePct: null,
    currentMedianAdr: null,
    previousMedianAdr: null,
    pairedListings: 2,
    ownBasis: null,
    reason: 'Histórico insuficiente: só 2 anúncio(s) com preço nos dois períodos de 30 dias (mínimo 5).',
  },
  insufficiency: null,
};

function insufficientResponse(radiusKm: number, typologyApplied: Record<string, unknown> = {}) {
  return {
    ...baseResponse,
    radiusKm,
    radius: { km: radiusKm, min: 1, max: 5 },
    typology: { ...baseResponse.typology, applied: { rooms: null, listingType: null, capacity: null, ...typologyApplied } },
    percentile: 0,
    comparablesCount: 0,
    medianAdr: 0,
    daily: [],
    adrPercentiles: null,
    dataSources: [],
    seasonality: null,
    neighborhoodEventEffect: null,
    insufficientData: true,
    message: 'Dados insuficientes: ainda não há imóveis parecidos suficientes na região para comparar com segurança.',
    insufficiency: {
      reasons: [
        'Clientes My Urban: 2 anfitriões distintos na região (mínimo 5).',
        'Fontes externas: 3 anúncios distintos (mínimo 8).',
      ],
      hints: ['Aumente o raio de busca (até 5 km).', 'Afrouxe a tipologia (quartos, tipo de anúncio ou capacidade).'],
      customers: { distinct: 2, required: 5, qualified: false },
      external: { distinct: 3, required: 8, qualified: false },
    },
  };
}

/** Responde conforme a query; guarda as consultas para as asserções. */
async function mockMarket(page: Page, respond: (url: URL) => unknown) {
  const calls: URL[] = [];
  await page.route(`**/properties/${PROPERTY}/market-intel**`, (route) => {
    const url = new URL(route.request().url());
    calls.push(url);
    return json(route, respond(url));
  });
  return calls;
}

test.describe('Mercado por bairro (API mockada)', () => {
  test.beforeEach(async ({ page }) => {
    await installLocalAuthFixture(page, 'host');
  });

  test('mostra selos de fonte com data de coleta, ocupação e tendência indisponíveis, sazonalidade e eventos', async ({ page }) => {
    await mockMarket(page, () => baseResponse);
    await page.goto(MARKET_URL);

    await expect(page.getByRole('heading', { name: /Como seu imóvel se compara/i })).toBeVisible();
    const sources = page.getByRole('region', { name: 'Fontes dos dados' });
    await expect(sources.getByText('Clientes My Urban · 5 imóveis · dados atuais')).toBeVisible();
    await expect(sources.getByText('Dataset licenciado · 16 anúncios · coleta 01/10/2026')).toBeVisible();

    // honestidade: sem ocupação e sem tendência, a tela diz isso (nunca 0% nem "estável")
    await expect(page.getByText('Indisponível').first()).toBeVisible();
    await expect(page.getByText(/As fontes desta região não informam ocupação/)).toBeVisible();
    await expect(page.getByRole('status', { name: /Tendência de 30 dias indisponível/ })).toBeVisible();
    await expect(page.getByText(/MELHOR QUE/)).toBeVisible();
    await expect(page.getByText(/fonte: clientes e dataset licenciado/)).toBeVisible();

    await expect(page.getByText('+18,4%')).toBeVisible();
    await expect(page.getByRole('img', { name: /Sazonalidade da diária/ })).toBeVisible();
    await expectNoCriticalA11yViolations(page);
  });

  test('Inside Airbnb exibe a atribuição CC BY e rotula a ocupação como estimativa', async ({ page }) => {
    await mockMarket(page, () => ({
      ...baseResponse,
      occupancyAvailable: true,
      occupancyIsProxy: true,
      medianOccupancy: 0.61,
      occupancyPercentiles: { p25: 0.5, p50: 0.61, p75: 0.7 },
      dataSources: [
        { id: 'inside_airbnb', label: 'Inside Airbnb', listings: 12, latestCollectedAt: '2026-09-14', licenses: ['cc_by_4'] },
      ],
      attribution: ['Inside Airbnb (insideairbnb.com), licença CC BY 4.0'],
    }));
    await page.goto(MARKET_URL);

    await expect(page.getByText('Inside Airbnb · 12 anúncios · coleta 14/09/2026')).toBeVisible();
    await expect(page.getByText('Inside Airbnb (insideairbnb.com), licença CC BY 4.0')).toBeVisible();
    await expect(page.getByText(/Estimativa pelos dias disponíveis no ano/)).toBeVisible();
    await expect(page.getByText('61%').first()).toBeVisible();
  });

  test('seletor de raio e de tipologia refaz a consulta com os parâmetros certos', async ({ page }) => {
    const calls = await mockMarket(page, (url) => {
      const rooms = url.searchParams.get('rooms');
      return { ...baseResponse, radiusKm: Number(url.searchParams.get('radiusKm') ?? 3), typology: { ...baseResponse.typology, applied: { rooms: rooms ? Number(rooms) : null, listingType: url.searchParams.get('listingType'), capacity: url.searchParams.get('capacity') } } };
    });
    await page.goto(MARKET_URL);
    await expect(page.getByRole('region', { name: 'Fontes dos dados' })).toBeVisible();

    // primeira carga: raio padrão de 3 km, sem tipologia
    expect(calls[0].searchParams.get('radiusKm')).toBe('3');
    expect(calls[0].searchParams.has('rooms')).toBe(false);
    expect(calls[0].searchParams.has('listingType')).toBe(false);

    const filters = page.getByRole('region', { name: 'Filtros do mercado' });
    await filters.getByLabel('Raio').selectOption('5');
    await expect.poll(() => calls.at(-1)?.searchParams.get('radiusKm')).toBe('5');
    await expect(page.getByText(/Comparação com imóveis parecidos em até 5 km/)).toBeVisible();

    await filters.getByLabel('Quartos').selectOption('2');
    await expect.poll(() => calls.at(-1)?.searchParams.get('rooms')).toBe('2');
    await filters.getByLabel('Tipo de anúncio').selectOption('entire_home');
    await expect.poll(() => calls.at(-1)?.searchParams.get('listingType')).toBe('entire_home');
    await filters.getByLabel('Capacidade').selectOption('3-4');
    await expect.poll(() => calls.at(-1)?.searchParams.get('capacity')).toBe('3-4');

    await filters.getByRole('button', { name: 'Limpar tipologia' }).click();
    await expect.poll(() => calls.at(-1)?.searchParams.has('rooms')).toBe(false);
    await expect(filters.getByLabel('Quartos')).toHaveValue('any');
    await expect(filters.getByLabel('Raio')).toHaveValue('5'); // limpar a tipologia mantém o raio
  });

  test('"Igual ao meu imóvel" aplica a tipologia do anúncio', async ({ page }) => {
    const calls = await mockMarket(page, () => baseResponse);
    await page.goto(MARKET_URL);
    const filters = page.getByRole('region', { name: 'Filtros do mercado' });
    await filters.getByRole('button', { name: 'Igual ao meu imóvel' }).click();

    await expect(filters.getByLabel('Quartos')).toHaveValue('2');
    await expect(filters.getByLabel('Tipo de anúncio')).toHaveValue('entire_home');
    await expect(filters.getByLabel('Capacidade')).toHaveValue('3-4');
    await expect.poll(() => calls.at(-1)?.searchParams.get('rooms')).toBe('2');
    await expect.poll(() => calls.at(-1)?.searchParams.get('capacity')).toBe('3-4');
  });

  test('amostra insuficiente explica o que falta e "Aumentar raio" refaz a consulta', async ({ page }) => {
    const calls = await mockMarket(page, (url) => {
      const radius = Number(url.searchParams.get('radiusKm') ?? 3);
      return radius >= 4 ? { ...baseResponse, radiusKm: radius, radius: { km: radius, min: 1, max: 5 } } : insufficientResponse(radius);
    });
    await page.goto(MARKET_URL);

    await expect(page.getByRole('heading', { name: 'Ainda não há amostra suficiente aqui' })).toBeVisible();
    await expect(page.getByText(/Para não expor nenhum anfitrião/)).toBeVisible();
    const missing = page.getByRole('region', { name: 'O que falta para comparar' });
    await expect(missing.getByText('Clientes My Urban: 2 anfitriões distintos na região (mínimo 5).')).toBeVisible();
    await expect(missing.getByText('Fontes externas: 3 anúncios distintos (mínimo 8).')).toBeVisible();
    await expect(missing.getByText('Aumente o raio de busca (até 5 km).')).toBeVisible();
    await expect(page.getByText(/MELHOR QUE/)).toHaveCount(0);
    await expectNoCriticalA11yViolations(page);

    await page.getByRole('button', { name: 'Aumentar raio para 4 km' }).click();
    await expect.poll(() => calls.at(-1)?.searchParams.get('radiusKm')).toBe('4');
    await expect(page.getByText(/MELHOR QUE/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ainda não há amostra suficiente aqui' })).toHaveCount(0);
  });

  test('no raio máximo e com tipologia, só oferece limpar a tipologia', async ({ page }) => {
    await mockMarket(page, (url) =>
      insufficientResponse(Number(url.searchParams.get('radiusKm') ?? 3), { rooms: url.searchParams.get('rooms') ? Number(url.searchParams.get('rooms')) : null }),
    );
    await page.goto(MARKET_URL);
    const filters = page.getByRole('region', { name: 'Filtros do mercado' });
    await filters.getByLabel('Raio').selectOption('5');
    await filters.getByLabel('Quartos').selectOption('3');

    await expect(page.getByRole('button', { name: /Aumentar raio/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Limpar tipologia' }).first()).toBeVisible();
  });

  test('contrato antigo (sem campos novos) continua renderizando', async ({ page }) => {
    await mockMarket(page, () => ({
      propertyId: PROPERTY,
      neighborhood: 'Pinheiros',
      percentile: 55,
      percentileTrend30d: 3,
      comparablesCount: 6,
      medianAdr: 320,
      medianOccupancy: 0.7,
      yourAdr: 310,
      yourOccupancy: 0.6,
      eventReactivity: 40,
      daily,
      comparables: [],
      aggregatedOnly: true,
      insufficientData: false,
      minGroupSize: 5,
      radiusKm: 3,
      adrPercentiles: { p25: 280, p50: 320, p75: 360 },
      occupancyPercentiles: { p25: 0.6, p50: 0.7, p75: 0.8 },
      updatedAt: '2026-10-31T12:00:00.000Z',
    }));
    await page.goto(MARKET_URL);
    await expect(page.getByText(/MELHOR QUE/)).toBeVisible();
    await expect(page.getByText('70%').first()).toBeVisible();
    await expect(page.getByRole('status', { name: /Tendência \+3 pontos/ })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Fontes dos dados' })).toHaveCount(0);
  });

  test('erro da API mostra estado de erro com nova tentativa', async ({ page }) => {
    let attempts = 0;
    await page.route(`**/properties/${PROPERTY}/market-intel**`, (route) => {
      attempts += 1;
      return attempts === 1 ? json(route, { message: 'falha' }, 500) : json(route, baseResponse);
    });
    await page.goto(MARKET_URL);
    await expect(page.getByText('Não conseguimos carregar')).toBeVisible();
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.getByText(/MELHOR QUE/)).toBeVisible();
  });
});
