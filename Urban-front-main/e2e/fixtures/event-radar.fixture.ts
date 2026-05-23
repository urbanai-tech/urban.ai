import type { Page, Route } from '@playwright/test';

const generatedAt = '2026-05-22T12:00:00.000Z';

export const eventRadarFixture = {
  catalogResponse: {
    generatedAt,
    city: 'Sao Paulo',
    state: 'SP',
    filters: {
      from: '2026-06-01',
      to: '2026-06-30',
      category: null,
      nearMyProperties: true,
    },
    items: [
      {
        id: 'evt-gp-sp-2026',
        name: 'Grande Premio de Sao Paulo 2026',
        description: 'Fim de semana de automobilismo com alta procura por hospedagem.',
        startsAt: '2026-06-12T20:00:00.000Z',
        endsAt: '2026-06-14T23:00:00.000Z',
        city: 'Sao Paulo',
        state: 'SP',
        venueName: 'Autodromo de Interlagos',
        address: 'Av. Senador Teotonio Vilela, Interlagos',
        latitude: -23.7036,
        longitude: -46.6997,
        category: 'sports',
        imageUrl: 'https://example.com/events/gp-sp.jpg',
        officialUrl: 'https://example.com/gp-sp',
        source: 'official-site',
        crawledUrl: 'https://example.com/gp-sp/programacao',
        urbanScore: 94,
        demandScore: 91,
        confidence: 'high',
        badges: ['alto impacto', 'fonte oficial', 'demanda aquecida'],
      },
      {
        id: 'evt-expo-tech-2026',
        name: 'Expo Tech Brasil',
        description: 'Congresso de tecnologia no centro de convencoes.',
        startsAt: '2026-06-20T11:00:00.000Z',
        endsAt: '2026-06-22T22:00:00.000Z',
        city: 'Sao Paulo',
        state: 'SP',
        venueName: 'Sao Paulo Expo',
        address: 'Rodovia dos Imigrantes, Vila Agua Funda',
        latitude: -23.6455,
        longitude: -46.6308,
        category: 'conference',
        imageUrl: 'https://example.com/events/expo-tech.jpg',
        officialUrl: 'https://example.com/expo-tech',
        source: 'sympla',
        crawledUrl: 'https://example.com/source/expo-tech',
        urbanScore: 82,
        demandScore: 78,
        confidence: 'medium',
        badges: ['perto de voce', 'evento monitorado'],
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 2,
    },
  },
  hostRadarResponse: {
    generatedAt,
    summary: {
      revenuePotentialCents: 148000,
      relevantEvents: 2,
      opportunityNights: 5,
      impactedProperties: 2,
      averageDemandScore: 85,
    },
    events: [] as unknown[],
    propertyImpacts: {
      'evt-gp-sp-2026': [
        {
          propertyId: 'prop-studio-vila-mariana',
          propertyName: 'Studio Vila Mariana',
          distanceKm: 8.4,
          travelTimeMinutes: 24,
          propertyCaptureScore: 87,
          basePriceCents: 32000,
          currentPriceCents: 42000,
          recommendedPriceCents: 85000,
          minAbsorbablePriceCents: 65000,
          maxAbsorbablePriceCents: 95000,
          recommendedMultiplier: 2.66,
          maxPlausibleMultiplier: 3.1,
          bookingProbability: 0.63,
          expectedRevenueCents: 53550,
          expectedIncrementalRevenueCents: 27150,
          confidence: 'high',
          mainDrivers: ['megaevento', 'raio de alto impacto', 'baixa oferta relativa'],
          recommendedAction: 'simulate',
          affectedNights: ['2026-06-12', '2026-06-13', '2026-06-14'],
          absorptionScenarios: [
            {
              id: 'conservative',
              label: 'Conservador',
              dailyPriceCents: 65000,
              multiplier: 2.03,
              bookingProbability: 0.82,
              expectedRevenueCents: 53300,
              risk: 'low',
              reading: 'Alta chance de capturar demanda.',
            },
            {
              id: 'recommended',
              label: 'Recomendado',
              dailyPriceCents: 85000,
              multiplier: 2.66,
              bookingProbability: 0.63,
              expectedRevenueCents: 53550,
              risk: 'medium',
              reading: 'Melhor equilibrio entre diaria maior e chance de reserva.',
              recommended: true,
            },
            {
              id: 'aggressive',
              label: 'Agressivo',
              dailyPriceCents: 115000,
              multiplier: 3.59,
              bookingProbability: 0.32,
              expectedRevenueCents: 36800,
              risk: 'high',
              reading: 'Pode funcionar se a oferta secar.',
            },
            {
              id: 'extreme',
              label: 'Extremo',
              dailyPriceCents: 140000,
              multiplier: 4.38,
              bookingProbability: 0.14,
              expectedRevenueCents: 19600,
              risk: 'high',
              reading: 'So faz sentido em compressao extrema.',
            },
          ],
        },
      ],
      'evt-expo-tech-2026': [
        {
          propertyId: 'prop-loft-paulista',
          propertyName: 'Loft Paulista',
          distanceKm: 6.2,
          travelTimeMinutes: 21,
          propertyCaptureScore: 72,
          basePriceCents: 41000,
          currentPriceCents: 48000,
          recommendedPriceCents: 72000,
          minAbsorbablePriceCents: 62000,
          maxAbsorbablePriceCents: 88000,
          recommendedMultiplier: 1.76,
          maxPlausibleMultiplier: 2.15,
          bookingProbability: 0.58,
          expectedRevenueCents: 41760,
          expectedIncrementalRevenueCents: 13920,
          confidence: 'medium',
          mainDrivers: ['centro de convencoes', 'publico corporativo', 'lead time bom'],
          recommendedAction: 'watch',
          affectedNights: ['2026-06-20', '2026-06-21'],
          absorptionScenarios: [
            {
              id: 'conservative',
              label: 'Conservador',
              dailyPriceCents: 62000,
              multiplier: 1.51,
              bookingProbability: 0.76,
              expectedRevenueCents: 47120,
              risk: 'low',
              reading: 'Boa faixa para capturar demanda corporativa com risco baixo.',
            },
            {
              id: 'recommended',
              label: 'Recomendado',
              dailyPriceCents: 72000,
              multiplier: 1.76,
              bookingProbability: 0.58,
              expectedRevenueCents: 41760,
              risk: 'medium',
              reading: 'Preco mais forte, mas ainda plausivel para o perfil do evento.',
              recommended: true,
            },
          ],
        },
      ],
    },
    heatmap: [
      {
        cellId: 'sp-interlagos-2026-06-12',
        h3Index: '89a8100d2abffff',
        bbox: null,
        centerLat: -23.7036,
        centerLng: -46.6997,
        dateFrom: '2026-06-12',
        dateTo: '2026-06-14',
        eventDemandScore: 91,
        revenuePotentialCents: 99000,
        eventsCount: 1,
        topEventIds: ['evt-gp-sp-2026'],
        affectedPropertiesCount: 1,
        averageConfidence: 'high',
        dominantCategory: 'sports',
        supplyCompressionScore: 84,
      },
    ],
  },
  eventDetailResponse: {
    event: {} as Record<string, unknown>,
    intelligence: {
      eventDemandScore: 91,
      eventRevenuePotentialCents: 99000,
      demandRadiusKm: 12,
      expectedAttendance: 65000,
      sourceReliabilityScore: 94,
      sourceFreshnessHours: 6,
      confidence: 'high',
      interpretation:
        'Este evento deve aquecer a regiao por 3 noites, com maior impacto em imoveis conectados ao eixo sul e metro.',
      drivers: [
        {
          key: 'attendance',
          label: 'Publico esperado',
          weight: 0.35,
          explanation: 'Publico estimado acima de 60 mil pessoas.',
        },
        {
          key: 'supply_compression',
          label: 'Oferta pressionada',
          weight: 0.25,
          explanation: 'Alta procura esperada em raio de 12 km.',
        },
      ],
      riskFlags: ['extreme_price_dropoff'],
      dataQualityFlags: [],
      generatedAt,
      modelVersion: 'event-demand-v0.1',
      metricVersion: 'radar-metrics-v0.1',
      jobRunId: 'job-event-radar-20260522',
    },
    propertyImpacts: [] as unknown[],
    priceAbsorptionCurves: [
      {
        propertyId: 'prop-studio-vila-mariana',
        affectedNights: ['2026-06-12', '2026-06-13', '2026-06-14'],
        scenarios: [
          {
            scenario: 'conservative',
            label: 'Conservador',
            priceCents: 65000,
            multiplier: 2.03,
            bookingProbability: 0.82,
            expectedRevenueCents: 53300,
            riskLevel: 'low',
            explanation: 'Alta chance de capturar demanda.',
          },
          {
            scenario: 'recommended',
            label: 'Recomendado',
            priceCents: 85000,
            multiplier: 2.66,
            bookingProbability: 0.63,
            expectedRevenueCents: 53550,
            riskLevel: 'medium',
            explanation: 'Melhor equilibrio entre diaria maior e chance de reserva.',
          },
          {
            scenario: 'aggressive',
            label: 'Agressivo',
            priceCents: 115000,
            multiplier: 3.59,
            bookingProbability: 0.32,
            expectedRevenueCents: 36800,
            riskLevel: 'high',
            explanation: 'Pode funcionar se a oferta secar.',
          },
          {
            scenario: 'extreme',
            label: 'Extremo',
            priceCents: 140000,
            multiplier: 4.38,
            bookingProbability: 0.14,
            expectedRevenueCents: 19600,
            riskLevel: 'high',
            explanation: 'So faz sentido em compressao extrema.',
          },
        ],
      },
    ],
  },
  adminIntelligenceResponse: {
    generatedAt,
    contractMode: 'backend',
    filters: {
      from: '2026-06-01',
      to: '2026-06-30',
      scope: 'in',
      confidence: 'all',
    },
    kpis: {
      demandPotentialScore: 173,
      revenuePotentialCents: 280000,
      highPotentialEvents: 7,
      affectedProperties: 34,
      recommendationsGenerated: 21,
      highPotentialWithoutRecommendation: 3,
      averageConfidencePercent: 76,
      weightedCoveragePercent: 76,
    },
    events: [] as unknown[],
    categories: ['sports', 'conference'],
    sources: ['official-site', 'sympla'],
    cities: ['Sao Paulo/SP'],
  },
  adminHeatmapResponse: {
    generatedAt,
    contractMode: 'backend',
    metric: 'demand',
    cells: [
      {
        cellId: 'sp-interlagos-2026-06-12',
        label: 'Interlagos/SP',
        city: 'Sao Paulo',
        state: 'SP',
        centerLat: -23.7036,
        centerLng: -46.6997,
        eventDemandScore: 91,
        revenuePotentialCents: 99000,
        eventsCount: 1,
        topEventIds: ['evt-gp-sp-2026'],
        affectedPropertiesCount: 1,
        averageConfidence: 86,
        dominantCategory: 'sports',
        supplyCompressionScore: 84,
        coverageScore: 82,
      },
    ],
  },
  adminBlindSpotsResponse: {
    generatedAt,
    contractMode: 'backend',
    summary: { high: 1, medium: 1, low: 0, total: 2 },
    items: [
      {
        id: 'no-pricing-evt-gp-sp-2026',
        kind: 'no_pricing',
        severity: 'high',
        title: 'Alta demanda sem recomendacao',
        eventId: 'evt-gp-sp-2026',
        eventName: 'Grande Premio de Sao Paulo 2026',
        city: 'Sao Paulo',
        source: 'official-site',
        demandScore: 91,
        revenuePotentialCents: 99000,
        blockedBy: 'Snapshot de impacto em imoveis ausente',
        recommendedAction: 'Reprocessar inteligencia e verificar disponibilidade dos imoveis impactados.',
        href: '/admin/events?search=Grande%20Premio%20de%20Sao%20Paulo%202026',
      },
      {
        id: 'geo-evt-missing-geo-1',
        kind: 'missing_geocode',
        severity: 'medium',
        title: 'Eventos sem coordenada',
        eventId: 'evt-missing-geo-1',
        eventName: 'Evento sem coordenada',
        city: 'Sao Paulo',
        source: 'crawler-web',
        demandScore: 74,
        revenuePotentialCents: 42000,
        blockedBy: 'latitude/longitude ausentes ou geocode pendente',
        recommendedAction: 'Rodar geocoder e revisar enderecos de venues prioritarios.',
        href: '/admin/coverage',
      },
    ],
  },
};

const [primaryEvent, secondaryEvent] = eventRadarFixture.catalogResponse.items;
const primaryImpact = eventRadarFixture.hostRadarResponse.propertyImpacts['evt-gp-sp-2026'][0];
const secondaryImpact = eventRadarFixture.hostRadarResponse.propertyImpacts['evt-expo-tech-2026'][0];
eventRadarFixture.hostRadarResponse.events = [
  {
    ...primaryEvent,
    intelligence: eventRadarFixture.eventDetailResponse.intelligence,
    impactedProperties: [primaryImpact],
    bestPropertyImpact: primaryImpact,
    eventRevenuePotentialCents: eventRadarFixture.eventDetailResponse.intelligence.eventRevenuePotentialCents,
    demandRadiusKm: eventRadarFixture.eventDetailResponse.intelligence.demandRadiusKm,
    heatLevel: primaryEvent.demandScore,
    interpretation: eventRadarFixture.eventDetailResponse.intelligence.interpretation,
  },
  {
    ...secondaryEvent,
    intelligence: {
      ...eventRadarFixture.eventDetailResponse.intelligence,
      eventDemandScore: 78,
      eventRevenuePotentialCents: 49000,
      confidence: 'medium',
      interpretation: 'Congresso corporativo com demanda concentrada no eixo sul e boa absorcao moderada.',
    },
    impactedProperties: [secondaryImpact],
    bestPropertyImpact: secondaryImpact,
    eventRevenuePotentialCents: 49000,
    demandRadiusKm: 8,
    heatLevel: secondaryEvent.demandScore,
    interpretation: 'Congresso corporativo com demanda concentrada no eixo sul e boa absorcao moderada.',
  },
];
eventRadarFixture.eventDetailResponse.event = primaryEvent;
eventRadarFixture.eventDetailResponse.propertyImpacts =
  eventRadarFixture.hostRadarResponse.propertyImpacts['evt-gp-sp-2026'];
eventRadarFixture.adminIntelligenceResponse.events = [
  {
    id: primaryEvent.id,
    name: primaryEvent.name,
    startsAt: primaryEvent.startsAt,
    endsAt: primaryEvent.endsAt,
    city: primaryEvent.city,
    state: primaryEvent.state,
    venueName: primaryEvent.venueName,
    category: primaryEvent.category,
    source: primaryEvent.source,
    sourceId: 'official-site:gp-sp-2026',
    dedupHash: 'dedup-gp-sp-2026',
    demandScore: primaryEvent.demandScore,
    revenuePotentialCents: eventRadarFixture.eventDetailResponse.intelligence.eventRevenuePotentialCents,
    confidence: primaryEvent.confidence,
    affectedPropertiesCount: 12,
    recommendationsGenerated: 8,
    demandRadiusKm: eventRadarFixture.eventDetailResponse.intelligence.demandRadiusKm,
    expectedAttendance: eventRadarFixture.eventDetailResponse.intelligence.expectedAttendance,
    geocodeStatus: 'ok',
    enrichmentStatus: 'ok',
    sourceStatus: 'fresh',
    officialUrl: primaryEvent.officialUrl,
    crawledUrl: primaryEvent.crawledUrl,
    imageUrl: primaryEvent.imageUrl,
    latitude: primaryEvent.latitude,
    longitude: primaryEvent.longitude,
    interpretation: eventRadarFixture.eventDetailResponse.intelligence.interpretation,
    riskFlags: eventRadarFixture.eventDetailResponse.intelligence.riskFlags,
    dataQualityFlags: [],
    raw: primaryEvent,
  },
];

export const adminEventsAnalyticsFixture = {
  summary: {
    total: 2,
    ativos: 2,
    inScope: 2,
    outOfScope: 0,
    coveragePercent: 100,
    enrichmentPercent: 100,
    coordsMissing: 0,
    relevanceMissing: 0,
  },
  upcoming: { next7d: 1, next30d: 2, next90d: 2, megaUpcoming: 1 },
  byCategory: [
    { categoria: 'sports', count: 1 },
    { categoria: 'conference', count: 1 },
  ],
  byCity: [{ cidade: 'Sao Paulo', count: 2 }],
  byRelevance: [
    { bucket: '80-100', count: 1 },
    { bucket: '60-79', count: 1 },
  ],
  topUpcoming: [
    {
      id: primaryEvent.id,
      nome: primaryEvent.name,
      cidade: primaryEvent.city,
      dataInicio: primaryEvent.startsAt,
      relevancia: primaryEvent.urbanScore,
      categoria: primaryEvent.category,
      capacidadeEstimada: 65000,
      raioImpactoKm: 12,
      hasCoords: true,
    },
  ],
  lastCrawlAt: generatedAt,
};

export const adminEventsListFixture = {
  page: 1,
  limit: 50,
  total: 2,
  scope: 'in',
  items: eventRadarFixture.catalogResponse.items.map((event) => ({
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

export const eventsTimelineFixture = {
  days: 30,
  generatedAt,
  totalInScope: 2,
  totalOutScope: 0,
  avgPerDay: 0.06,
  peakDay: { day: '2026-06-12', total: 1 },
  buckets: [
    { day: '2026-06-12', inScope: 1, outOfScope: 0 },
    { day: '2026-06-20', inScope: 1, outOfScope: 0 },
  ],
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

export async function mockEventRadarApis(page: Page) {
  await page.route('https://example.com/**', (route) =>
    route.fulfill({ status: 204, body: '' }),
  );
  await page.route('**/auth/me', (route) =>
    fulfillJson(route, {
      id: 'user-event-radar-e2e',
      username: 'Host Event Radar',
      email: 'host.event-radar@urbanai.com.br',
      role: 'ADMIN',
    }),
  );
  await page.route('**/payments/getSubscription', (route) =>
    fulfillJson(route, { status: 'active', plan: 'alpha' }),
  );
  await page.route('**/propriedades/dropdown/list', (route) =>
    fulfillJson(route, [
      {
        id: 'prop-studio-vila-mariana',
        propertyName: 'Studio Vila Mariana',
        userId: 'user-event-radar-e2e',
        analisado: 'completed',
        image_url: 'https://example.com/properties/studio.jpg',
        latitude: -23.589,
        longitude: -46.634,
        nome: 'Studio Vila Mariana',
      },
      {
        id: 'prop-loft-paulista',
        propertyName: 'Loft Paulista',
        userId: 'user-event-radar-e2e',
        analisado: 'completed',
        image_url: 'https://example.com/properties/loft.jpg',
        latitude: -23.561,
        longitude: -46.656,
        nome: 'Loft Paulista',
      },
    ]),
  );

  await page.route('**/host/events/catalog**', (route) =>
    fulfillJson(route, eventRadarFixture.catalogResponse),
  );
  await page.route('**/host/events/radar**', (route) =>
    fulfillJson(route, eventRadarFixture.hostRadarResponse),
  );
  await page.route('**/host/events/heatmap**', (route) =>
    fulfillJson(route, { generatedAt, cells: eventRadarFixture.hostRadarResponse.heatmap }),
  );
  await page.route('**/host/events/evt-gp-sp-2026/intelligence**', (route) =>
    fulfillJson(route, {
      event: eventRadarFixture.eventDetailResponse.event,
      intelligence: eventRadarFixture.eventDetailResponse.intelligence,
    }),
  );
  await page.route('**/host/events/evt-gp-sp-2026/property-impact**', (route) =>
    fulfillJson(route, {
      eventId: 'evt-gp-sp-2026',
      generatedAt,
      items: eventRadarFixture.eventDetailResponse.propertyImpacts,
    }),
  );
  await page.route('**/host/events/evt-gp-sp-2026/simulate-pricing**', (route) =>
    fulfillJson(route, {
      eventId: 'evt-gp-sp-2026',
      propertyId: 'prop-studio-vila-mariana',
      generatedAt,
      propertyImpact: eventRadarFixture.eventDetailResponse.propertyImpacts[0],
      recommendedScenario:
        eventRadarFixture.eventDetailResponse.priceAbsorptionCurves[0].scenarios[1],
      scenarios: eventRadarFixture.eventDetailResponse.priceAbsorptionCurves[0].scenarios,
      guardrails: [
        {
          code: 'HOST_REVIEW_REQUIRED',
          severity: 'warn',
          message: 'Preco acima de 2.5x deve ser revisado antes de aplicar.',
        },
      ],
    }),
  );
  await page.route('**/host/events/evt-gp-sp-2026', (route) =>
    fulfillJson(route, eventRadarFixture.eventDetailResponse),
  );

  await page.route('**/admin/events/intelligence**', (route) =>
    fulfillJson(route, eventRadarFixture.adminIntelligenceResponse),
  );
  await page.route('**/admin/events/evt-gp-sp-2026/intelligence**', (route) =>
    fulfillJson(route, {
      generatedAt,
      contractMode: 'backend',
      event: eventRadarFixture.adminIntelligenceResponse.events[0],
      intelligence: eventRadarFixture.eventDetailResponse.intelligence,
      operation: {
        geocodeStatus: 'ok',
        enrichmentStatus: 'ok',
        sourceStatus: 'fresh',
        affectedPropertiesCount: 12,
        recommendationsGenerated: 8,
      },
      propertyImpact: eventRadarFixture.eventDetailResponse.propertyImpacts,
      rawEvent: eventRadarFixture.adminIntelligenceResponse.events[0],
    }),
  );
  await page.route('**/admin/events/evt-gp-sp-2026/property-impact**', (route) =>
    fulfillJson(route, eventRadarFixture.eventDetailResponse.propertyImpacts),
  );
  await page.route('**/admin/events/heatmap**', (route) =>
    fulfillJson(route, eventRadarFixture.adminHeatmapResponse),
  );
  await page.route('**/admin/events/blind-spots**', (route) =>
    fulfillJson(route, eventRadarFixture.adminBlindSpotsResponse),
  );
  await page.route('**/admin/events/analytics**', (route) =>
    fulfillJson(route, adminEventsAnalyticsFixture),
  );
  await page.route('**/admin/events/list**', (route) =>
    fulfillJson(route, adminEventsListFixture),
  );
  await page.route('**/admin/events/timeline**', (route) =>
    fulfillJson(route, eventsTimelineFixture),
  );
}
