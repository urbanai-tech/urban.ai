import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(scriptDir, '..');
const workspaceRoot = resolve(appDir, '..');
const fixturePath = resolve(workspaceRoot, 'docs', 'contracts', 'event-radar-fixtures-v0.json');
const specPath = resolve(appDir, 'e2e', 'event-radar.spec.ts');
const defaultOutputDir =
  process.platform === 'win32'
    ? 'C:\\tmp\\urban-ai-event-radar-direct-smoke'
    : join(tmpdir(), 'urban-ai-event-radar-direct-smoke');

const rawArgs = process.argv.slice(2);
const hasArg = (name) => rawArgs.includes(name) || rawArgs.some((arg) => arg.startsWith(`${name}=`));
const failUsage = (message) => {
  console.error(`[direct-smoke] ${message}`);
  process.exit(2);
};
const getArg = (name, fallback) => {
  const inline = rawArgs.find((arg) => arg.startsWith(`${name}=`));
  if (inline) {
    const value = inline.slice(name.length + 1);
    if (!value) failUsage(`${name} exige um valor.`);
    return value;
  }

  const index = rawArgs.indexOf(name);
  if (index < 0) return fallback;

  const value = rawArgs[index + 1];
  if (!value || value.startsWith('--')) failUsage(`${name} exige um valor.`);
  return value;
};
const getIntegerArg = (name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const raw = getArg(name, fallback);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    failUsage(`${name} deve ser um inteiro entre ${min} e ${max}; recebido "${raw}".`);
  }
  return value;
};

const baseURL = getArg('--base-url', process.env.E2E_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const outputDir = resolve(getArg('--output', process.env.E2E_OUTPUT_DIR || defaultOutputDir));
const navigationTimeoutMs = getIntegerArg('--navigation-timeout-ms', process.env.E2E_NAVIGATION_TIMEOUT_MS || '45000');
const assertionTimeoutMs = getIntegerArg('--assertion-timeout-ms', process.env.E2E_ASSERTION_TIMEOUT_MS || '20000');
const viewportMode = getArg('--viewport', process.env.E2E_VIEWPORT || 'all');
const headed = hasArg('--headed');

const viewportPresets = [
  {
    name: 'desktop',
    options: {
      viewport: { width: 1440, height: 1000 },
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
    },
  },
  {
    name: 'mobile',
    options: {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    },
  },
];

function selectedViewports() {
  if (viewportMode === 'all') return viewportPresets;

  const preset = viewportPresets.find((item) => item.name === viewportMode);
  if (!preset) {
    failUsage('--viewport deve ser "all", "desktop" ou "mobile".');
  }
  return [preset];
}

function assertSpecNoSkips() {
  if (!existsSync(specPath)) {
    throw new Error(`Spec Event Radar nao encontrado: ${specPath}`);
  }

  const spec = readFileSync(specPath, 'utf8');
  const skipPattern = /\b(test|describe)\.skip\b|\.skip\(/;
  if (skipPattern.test(spec)) {
    throw new Error('Spec Event Radar contem skip; remova skips antes do smoke/release.');
  }
}

function confidenceToPercent(value) {
  if (typeof value === 'number') return value;
  if (value === 'high') return 86;
  if (value === 'medium') return 68;
  if (value === 'low') return 42;
  return 50;
}

function severity(value) {
  if (value === 'critical') return 'high';
  if (value === 'warn') return 'medium';
  if (value === 'info') return 'low';
  return value || 'medium';
}

function normalizeGeocodeStatus(value) {
  if (value === 'ready' || value === 'ok') return 'ok';
  if (value === 'missing') return 'missing';
  return 'pending';
}

function normalizeEnrichmentStatus(value) {
  if (value === 'ready' || value === 'ok') return 'ok';
  if (value === 'failed') return 'failed';
  if (value === 'unknown') return 'unknown';
  return 'pending';
}

function mapAbsorptionScenario(scenario) {
  return {
    id: scenario.scenario,
    label: scenario.label,
    dailyPriceCents: scenario.priceCents,
    multiplier: scenario.multiplier,
    bookingProbability: scenario.bookingProbability,
    expectedRevenueCents: scenario.expectedRevenueCents,
    risk: scenario.riskLevel,
    reading: scenario.explanation,
    recommended: scenario.scenario === 'recommended',
  };
}

function mapImpactWithCurve(impact, detail) {
  const curve = detail.priceAbsorptionCurves.find((item) => item.propertyId === impact.propertyId);
  return {
    ...impact,
    affectedNights: curve?.affectedNights || [],
    absorptionScenarios: (curve?.scenarios || []).map(mapAbsorptionScenario),
  };
}

function buildHostRadar(fixture) {
  const raw = fixture.hostRadarResponse;
  const detail = fixture.eventDetailResponse;
  const propertyImpacts = Object.fromEntries(
    Object.entries(raw.propertyImpacts).map(([eventId, impacts]) => [
      eventId,
      impacts.map((impact) => mapImpactWithCurve(impact, detail)),
    ]),
  );
  const demandScores = raw.events.map((event) => event.demandScore || 0).filter(Boolean);
  const averageDemandScore = demandScores.length
    ? Math.round(demandScores.reduce((sum, score) => sum + score, 0) / demandScores.length)
    : 0;

  return {
    ...raw,
    summary: {
      revenuePotentialCents: raw.summary.revenuePotentialCents ?? raw.summary.estimatedRevenuePotentialCents ?? 0,
      relevantEvents: raw.summary.relevantEvents ?? raw.summary.relevantEventsCount ?? raw.events.length,
      opportunityNights: raw.summary.opportunityNights ?? raw.summary.opportunityNightsCount ?? 0,
      impactedProperties: raw.summary.impactedProperties ?? raw.summary.affectedPropertiesCount ?? 0,
      averageDemandScore: raw.summary.averageDemandScore ?? averageDemandScore,
    },
    propertyImpacts,
    events: raw.events.map((event, index) => {
      const impacts = propertyImpacts[event.id] || [];
      const intelligence =
        event.id === detail.event.id
          ? detail.intelligence
          : {
              ...detail.intelligence,
              eventDemandScore: event.demandScore,
              eventRevenuePotentialCents: index === 1 ? 49000 : 42000,
              confidence: event.confidence,
              interpretation: 'Congresso corporativo com demanda concentrada no eixo sul e boa absorcao moderada.',
            };

      return {
        ...event,
        intelligence,
        impactedProperties: impacts,
        bestPropertyImpact: impacts[0] || null,
        eventRevenuePotentialCents: intelligence.eventRevenuePotentialCents,
        demandRadiusKm: intelligence.demandRadiusKm,
        heatLevel: event.demandScore,
        interpretation: intelligence.interpretation,
      };
    }),
  };
}

function buildAdminIntelligence(fixture) {
  const raw = fixture.adminIntelligenceResponse;
  const events = raw.items.map((item) => {
    const event = item.event;
    const intelligence = item.intelligence;
    return {
      id: event.id,
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      city: event.city,
      state: event.state,
      venueName: event.venueName,
      category: event.category,
      source: event.source,
      sourceId: `${event.source || 'source'}:${event.id}`,
      dedupHash: `dedup-${event.id}`,
      demandScore: intelligence.eventDemandScore ?? event.demandScore,
      revenuePotentialCents: intelligence.eventRevenuePotentialCents,
      confidence: intelligence.confidence || event.confidence || 'medium',
      affectedPropertiesCount: item.impactedPropertiesCount || 0,
      recommendationsGenerated: item.generatedRecommendationsCount || 0,
      demandRadiusKm: intelligence.demandRadiusKm,
      expectedAttendance: intelligence.expectedAttendance,
      geocodeStatus: normalizeGeocodeStatus(item.geocodeStatus),
      enrichmentStatus: normalizeEnrichmentStatus(item.enrichmentStatus),
      sourceStatus: 'fresh',
      officialUrl: event.officialUrl,
      crawledUrl: event.crawledUrl,
      imageUrl: event.imageUrl,
      latitude: event.latitude,
      longitude: event.longitude,
      interpretation: intelligence.interpretation,
      riskFlags: intelligence.riskFlags || [],
      dataQualityFlags: intelligence.dataQualityFlags || [],
      raw: event,
    };
  });

  const kpis = raw.kpis;
  return {
    generatedAt: raw.generatedAt,
    contractMode: 'backend',
    filters: {
      from: '2026-06-01',
      to: '2026-06-30',
      scope: 'in',
      confidence: 'all',
    },
    kpis: {
      demandPotentialScore: events.reduce((sum, event) => sum + (event.demandScore || 0), 0),
      revenuePotentialCents: kpis.revenuePotentialCents ?? kpis.totalDemandPotentialCents ?? 0,
      highPotentialEvents: kpis.highPotentialEvents || 0,
      affectedProperties: kpis.affectedProperties ?? kpis.impactedProperties ?? 0,
      recommendationsGenerated: kpis.recommendationsGenerated ?? kpis.generatedRecommendations ?? 0,
      highPotentialWithoutRecommendation: kpis.highPotentialWithoutRecommendation || 0,
      averageConfidencePercent: kpis.averageConfidencePercent ?? confidenceToPercent(kpis.averageConfidence),
      weightedCoveragePercent: kpis.weightedCoveragePercent || 0,
    },
    events,
    categories: [...new Set(events.map((event) => event.category).filter(Boolean))],
    sources: [...new Set(events.map((event) => event.source).filter(Boolean))],
    cities: [...new Set(events.map((event) => `${event.city}/${event.state}`).filter(Boolean))],
  };
}

function buildAdminHeatmap(fixture, hostRadar) {
  return {
    generatedAt: fixture.adminIntelligenceResponse.generatedAt,
    contractMode: 'backend',
    metric: 'demand',
    cells: hostRadar.heatmap.map((cell) => ({
      cellId: cell.cellId,
      label: 'Interlagos/SP',
      city: 'Sao Paulo',
      state: 'SP',
      centerLat: cell.centerLat,
      centerLng: cell.centerLng,
      eventDemandScore: cell.eventDemandScore,
      revenuePotentialCents: cell.revenuePotentialCents,
      eventsCount: cell.eventsCount,
      topEventIds: cell.topEventIds,
      affectedPropertiesCount: cell.affectedPropertiesCount,
      averageConfidence: confidenceToPercent(cell.averageConfidence),
      dominantCategory: cell.dominantCategory,
      supplyCompressionScore: cell.supplyCompressionScore,
      coverageScore: 82,
    })),
  };
}

function buildAdminBlindSpots(fixture, adminIntelligence) {
  const primaryEvent = adminIntelligence.events[0];
  const items = fixture.adminBlindSpotsResponse.groups.map((group) => {
    const isGeo = group.code === 'missing_coordinates';
    return {
      id: group.code,
      kind: isGeo ? 'missing_geocode' : 'no_pricing',
      severity: severity(group.severity),
      title: group.label,
      eventId: group.eventIds?.[0] || primaryEvent?.id,
      eventName: isGeo ? 'Evento sem coordenada' : primaryEvent?.name,
      city: 'Sao Paulo',
      source: isGeo ? 'crawler-web' : primaryEvent?.source,
      demandScore: isGeo ? 74 : primaryEvent?.demandScore,
      revenuePotentialCents: isGeo ? 42000 : primaryEvent?.revenuePotentialCents,
      blockedBy: isGeo
        ? 'latitude/longitude ausentes ou geocode pendente'
        : 'Snapshot de impacto em imoveis ausente',
      recommendedAction: group.nextAction,
      href: isGeo ? '/admin/coverage' : '/admin/events?search=Grande%20Premio%20de%20Sao%20Paulo%202026',
    };
  });
  const summary = { high: 0, medium: 0, low: 0, total: items.length };
  for (const item of items) summary[item.severity] += 1;

  return {
    generatedAt: fixture.adminBlindSpotsResponse.generatedAt,
    contractMode: 'backend',
    summary,
    items,
  };
}

function buildAdminEventsAnalytics(fixture) {
  const items = fixture.catalogResponse.items;
  const primary = items[0];
  return {
    summary: {
      total: items.length,
      ativos: items.length,
      inScope: items.length,
      outOfScope: 0,
      coveragePercent: 100,
      enrichmentPercent: 100,
      coordsMissing: 0,
      relevanceMissing: 0,
    },
    upcoming: { next7d: 1, next30d: items.length, next90d: items.length, megaUpcoming: 1 },
    byCategory: [
      { categoria: 'sports', count: 1 },
      { categoria: 'conference', count: 1 },
    ],
    byCity: [{ cidade: 'Sao Paulo', count: items.length }],
    byRelevance: [
      { bucket: '80-100', count: 1 },
      { bucket: '60-79', count: 1 },
    ],
    topUpcoming: [
      {
        id: primary.id,
        nome: primary.name,
        cidade: primary.city,
        dataInicio: primary.startsAt,
        relevancia: primary.urbanScore,
        categoria: primary.category,
        capacidadeEstimada: 65000,
        raioImpactoKm: 12,
        hasCoords: true,
      },
    ],
    lastCrawlAt: fixture.catalogResponse.generatedAt,
  };
}

function buildAdminEventsList(fixture) {
  return {
    page: 1,
    limit: 50,
    total: fixture.catalogResponse.items.length,
    scope: 'in',
    items: fixture.catalogResponse.items.map((event) => ({
      id: event.id,
      nome: event.name,
      cidade: event.city,
      estado: event.state,
      dataInicio: event.startsAt,
      dataFim: event.endsAt,
      categoria: event.category,
      relevancia: event.urbanScore,
      capacidadeEstimada: event.id === 'evt-gp-sp-2026' ? 65000 : 12000,
      raioImpactoKm: event.id === 'evt-gp-sp-2026' ? 12 : 8,
      venueType: event.id === 'evt-gp-sp-2026' ? 'stadium' : 'convention_center',
      venueCapacity: event.id === 'evt-gp-sp-2026' ? 65000 : 15000,
      source: event.source,
      outOfScope: false,
      pendingGeocode: false,
      ativo: true,
      latitude: event.latitude,
      longitude: event.longitude,
      enrichmentAttempts: 0,
      enrichmentLastError: null,
      crawledUrl: event.crawledUrl,
    })),
  };
}

function buildEventsTimeline(fixture) {
  return {
    days: 30,
    generatedAt: fixture.catalogResponse.generatedAt,
    totalInScope: fixture.catalogResponse.items.length,
    totalOutScope: 0,
    avgPerDay: 0.06,
    peakDay: { day: '2026-06-12', total: 1 },
    buckets: [
      { day: '2026-06-12', inScope: 1, outOfScope: 0 },
      { day: '2026-06-20', inScope: 1, outOfScope: 0 },
    ],
  };
}

function buildFixture() {
  if (!existsSync(fixturePath)) {
    throw new Error(`Fixture nao encontrado: ${fixturePath}`);
  }

  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const hostRadar = buildHostRadar(fixture);
  const eventDetail = {
    ...fixture.eventDetailResponse,
    propertyImpacts: hostRadar.propertyImpacts['evt-gp-sp-2026'],
  };
  const adminIntelligence = buildAdminIntelligence(fixture);

  return {
    generatedAt: fixture.catalogResponse.generatedAt,
    catalog: fixture.catalogResponse,
    hostRadar,
    eventDetail,
    adminIntelligence,
    adminHeatmap: buildAdminHeatmap(fixture, hostRadar),
    adminBlindSpots: buildAdminBlindSpots(fixture, adminIntelligence),
    adminEventsAnalytics: buildAdminEventsAnalytics(fixture),
    adminEventsList: buildAdminEventsList(fixture),
    eventsTimeline: buildEventsTimeline(fixture),
  };
}

async function fulfillJson(route, body, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function mockEventRadarApis(context, fixture) {
  await context.route('https://example.com/**', (route) =>
    route.fulfill({ status: 204, body: '' }),
  );
  await context.route('**/api/auth/session**', (route) =>
    fulfillJson(route, {
      user: { id: 'user-event-radar-direct', email: 'host.event-radar@urbanai.com.br', role: 'ADMIN' },
      expires: '2026-12-31T23:59:59.000Z',
    }),
  );
  await context.route('**/auth/me', (route) =>
    fulfillJson(route, {
      id: 'user-event-radar-direct',
      username: 'Host Event Radar',
      email: 'host.event-radar@urbanai.com.br',
      role: 'ADMIN',
    }),
  );
  await context.route('**/payments/getSubscription', (route) =>
    fulfillJson(route, { status: 'active', plan: 'alpha' }),
  );
  await context.route('**/propriedades/dropdown/list', (route) =>
    fulfillJson(route, [
      {
        id: 'prop-studio-vila-mariana',
        propertyName: 'Studio Vila Mariana',
        userId: 'user-event-radar-direct',
        analisado: 'completed',
        image_url: 'https://example.com/properties/studio.jpg',
        latitude: -23.589,
        longitude: -46.634,
        nome: 'Studio Vila Mariana',
      },
      {
        id: 'prop-loft-paulista',
        propertyName: 'Loft Paulista',
        userId: 'user-event-radar-direct',
        analisado: 'completed',
        image_url: 'https://example.com/properties/loft.jpg',
        latitude: -23.561,
        longitude: -46.656,
        nome: 'Loft Paulista',
      },
    ]),
  );

  await context.route('**/host/events/catalog**', (route) => fulfillJson(route, fixture.catalog));
  await context.route('**/host/events/radar**', (route) => fulfillJson(route, fixture.hostRadar));
  await context.route('**/host/events/heatmap**', (route) =>
    fulfillJson(route, { generatedAt: fixture.generatedAt, cells: fixture.hostRadar.heatmap }),
  );
  await context.route('**/host/events/evt-gp-sp-2026/intelligence**', (route) =>
    fulfillJson(route, {
      event: fixture.eventDetail.event,
      intelligence: fixture.eventDetail.intelligence,
    }),
  );
  await context.route('**/host/events/evt-gp-sp-2026/property-impact**', (route) =>
    fulfillJson(route, {
      eventId: 'evt-gp-sp-2026',
      generatedAt: fixture.generatedAt,
      items: fixture.eventDetail.propertyImpacts,
    }),
  );
  await context.route('**/host/events/evt-gp-sp-2026/simulate-pricing**', (route) => {
    const scenarios = fixture.eventDetail.propertyImpacts[0]?.absorptionScenarios || [];
    return fulfillJson(route, {
      eventId: 'evt-gp-sp-2026',
      propertyId: 'prop-studio-vila-mariana',
      generatedAt: fixture.generatedAt,
      propertyImpact: fixture.eventDetail.propertyImpacts[0],
      recommendedScenario: scenarios.find((scenario) => scenario.recommended) || scenarios[0],
      scenarios,
      guardrails: [
        {
          code: 'HOST_REVIEW_REQUIRED',
          severity: 'warn',
          message: 'Preco acima de 2.5x deve ser revisado antes de aplicar.',
        },
      ],
    });
  });
  await context.route(/\/host\/events\/evt-gp-sp-2026(?:\?.*)?$/, (route) =>
    fulfillJson(route, fixture.eventDetail),
  );

  await context.route('**/admin/events/intelligence**', (route) =>
    fulfillJson(route, fixture.adminIntelligence),
  );
  await context.route('**/admin/events/evt-gp-sp-2026/intelligence**', (route) =>
    fulfillJson(route, {
      generatedAt: fixture.generatedAt,
      contractMode: 'backend',
      event: fixture.adminIntelligence.events[0],
      intelligence: fixture.eventDetail.intelligence,
      operation: {
        geocodeStatus: 'ok',
        enrichmentStatus: 'ok',
        sourceStatus: 'fresh',
        affectedPropertiesCount: 12,
        recommendationsGenerated: 8,
      },
      propertyImpact: fixture.eventDetail.propertyImpacts,
      rawEvent: fixture.adminIntelligence.events[0],
    }),
  );
  await context.route('**/admin/events/evt-gp-sp-2026/property-impact**', (route) =>
    fulfillJson(route, fixture.eventDetail.propertyImpacts),
  );
  await context.route('**/admin/events/heatmap**', (route) =>
    fulfillJson(route, fixture.adminHeatmap),
  );
  await context.route('**/admin/events/blind-spots**', (route) =>
    fulfillJson(route, fixture.adminBlindSpots),
  );
  await context.route('**/admin/events/analytics**', (route) =>
    fulfillJson(route, fixture.adminEventsAnalytics),
  );
  await context.route('**/admin/events/list**', (route) =>
    fulfillJson(route, fixture.adminEventsList),
  );
  await context.route('**/admin/events/timeline**', (route) =>
    fulfillJson(route, fixture.eventsTimeline),
  );
}

async function installBrowserState(context) {
  await context.addInitScript(() => {
    window.localStorage.setItem(
      'urban-ai-consent-v1',
      JSON.stringify({
        essential: true,
        analytics: true,
        marketing: true,
        decidedAt: '2026-05-14T00:00:00.000Z',
        version: 1,
      }),
    );
    window.localStorage.setItem('i18nextLng', 'pt');

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

    if (document.head) hideNextDevTools();
    else window.addEventListener('DOMContentLoaded', hideNextDevTools, { once: true });
  });
}

async function waitForVisibleText(page, matcher, label) {
  const deadline = Date.now() + assertionTimeoutMs;
  let lastCount = 0;

  while (Date.now() < deadline) {
    const matches = page.getByText(matcher, { exact: false });
    lastCount = await matches.count().catch(() => 0);

    for (let index = 0; index < lastCount; index += 1) {
      const candidate = matches.nth(index);
      if (await candidate.isVisible().catch(() => false)) return label;
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Texto esperado nao ficou visivel para "${label}" (${String(matcher)}). Matches: ${lastCount}.`);
}

function routeSlug(path) {
  return path.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root';
}

function ensureCleanPage(bodyText, path) {
  const forbiddenPatterns = [
    /This page could not be found/i,
    /Application error/i,
    /Unhandled Runtime Error/i,
    /Internal Server Error/i,
  ];
  const match = forbiddenPatterns.find((pattern) => pattern.test(bodyText));
  if (match) {
    throw new Error(`${path} exibiu marcador de erro: ${match}`);
  }
}

async function runRouteSmoke(page, routeConfig, index, viewportName, pageErrors) {
  const url = `${baseURL}${routeConfig.path}`;
  const pageErrorStart = pageErrors.length;
  const routeEvidence = {
    viewport: viewportName,
    path: routeConfig.path,
    url,
    assertions: [],
    status: null,
    screenshot: null,
  };

  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: navigationTimeoutMs });
  if (!response) throw new Error(`${routeConfig.path} nao retornou resposta HTTP.`);

  routeEvidence.status = response.status();
  if (routeEvidence.status === 404 || routeEvidence.status >= 500) {
    throw new Error(`${routeConfig.path} retornou HTTP ${routeEvidence.status}.`);
  }

  await page.waitForLoadState('networkidle', { timeout: assertionTimeoutMs }).catch(() => undefined);
  for (const expectation of routeConfig.expectations) {
    routeEvidence.assertions.push(await waitForVisibleText(page, expectation.matcher, expectation.label));
  }

  const bodyText = await page.locator('body').innerText({ timeout: assertionTimeoutMs });
  ensureCleanPage(bodyText, routeConfig.path);

  const routePageErrors = pageErrors.slice(pageErrorStart);
  if (routePageErrors.length) {
    throw new Error(`${routeConfig.path} disparou pageerror: ${routePageErrors.join(' | ')}`);
  }

  const screenshotPath = join(
    outputDir,
    `${viewportName}-${String(index + 1).padStart(2, '0')}-${routeSlug(routeConfig.path)}.png`,
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });
  routeEvidence.screenshot = screenshotPath;

  return routeEvidence;
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  assertSpecNoSkips();
  const fixture = buildFixture();
  const evidence = {
    generatedAt: new Date().toISOString(),
    baseURL,
    outputDir,
    viewportMode,
    mode: 'direct-browser-smoke',
    status: 'running',
    viewports: [],
    routes: [],
    passed: false,
  };
  const evidencePath = join(outputDir, 'event-radar-direct-smoke.json');

  const browser = await chromium.launch({ headless: !headed });
  const routes = [
    {
      path: '/events',
      expectations: [
        { matcher: /Eventos em Sao Paulo/i, label: 'titulo catalogo host' },
        { matcher: /Grande Premio de Sao Paulo 2026/i, label: 'evento principal' },
        { matcher: /fonte oficial|official site/i, label: 'fonte oficial' },
      ],
    },
    {
      path: '/events/evt-gp-sp-2026',
      expectations: [
        { matcher: /Grande Premio de Sao Paulo 2026/i, label: 'titulo detalhe host' },
        { matcher: /Este evento deve aquecer a regiao/i, label: 'interpretacao urban' },
        { matcher: /Studio Vila Mariana/i, label: 'imovel impactado' },
        { matcher: /Conservador|Recomendado|Agressivo|Extremo/i, label: 'curva absorcao' },
      ],
    },
    {
      path: '/event-radar',
      expectations: [
        { matcher: /Oportunidades por evento/i, label: 'titulo radar host' },
        { matcher: /Grande Premio de Sao Paulo 2026/i, label: 'evento no radar host' },
        { matcher: /Studio Vila Mariana/i, label: 'imovel no radar host' },
      ],
    },
    {
      path: '/admin/event-radar',
      expectations: [
        { matcher: /Radar de Demanda/i, label: 'titulo radar admin' },
        { matcher: /Alta demanda sem recomendacao/i, label: 'blind spot demanda' },
        { matcher: /Eventos sem coordenada/i, label: 'blind spot geocode' },
        { matcher: /Grande Premio de Sao Paulo 2026/i, label: 'evento no radar admin' },
      ],
    },
  ];

  try {
    for (const viewport of selectedViewports()) {
      const viewportEvidence = { name: viewport.name, routes: [] };
      evidence.viewports.push(viewportEvidence);
      const context = await browser.newContext({
        baseURL,
        ...viewport.options,
      });
      await installBrowserState(context);
      await mockEventRadarApis(context, fixture);
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error.stack || error.message);
      });

      try {
        for (let index = 0; index < routes.length; index += 1) {
          const result = await runRouteSmoke(page, routes[index], index, viewport.name, pageErrors);
          viewportEvidence.routes.push(result);
          evidence.routes.push(result);
          console.log(
            `[direct-smoke] ${viewport.name} ${result.path}: HTTP ${result.status}; ${result.assertions.length} asserts.`,
          );
        }
      } catch (error) {
        const failureScreenshot = join(outputDir, `failure-${viewport.name}-${Date.now()}.png`);
        await page.screenshot({ path: failureScreenshot, fullPage: true }).catch(() => undefined);
        evidence.failureScreenshot = failureScreenshot;
        throw error;
      } finally {
        await context.close();
      }
    }

    evidence.passed = true;
    evidence.status = 'passed';
    writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
    console.log(`[direct-smoke] OK. Evidencia: ${evidencePath}`);
  } catch (error) {
    evidence.status = 'failed';
    evidence.error = error.stack || error.message;
    writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
    console.error(`[direct-smoke] Falhou. Evidencia: ${evidencePath}`);
    console.error(error.stack || error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`[direct-smoke] Erro inesperado: ${error.stack || error.message}`);
  process.exit(1);
});
