const confidences = ['low', 'medium', 'high'];
const actions = ['watch', 'simulate', 'apply', 'review'];
const scenarios = ['conservative', 'recommended', 'aggressive', 'extreme'];

const eventItem = {
  id: 'evt-gp-sp-2026',
  name: 'Grande Premio de Sao Paulo 2026',
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
};

const intelligence = {
  eventDemandScore: 91,
  eventRevenuePotentialCents: 99000,
  demandRadiusKm: 12,
  expectedAttendance: 65000,
  sourceReliabilityScore: 94,
  sourceFreshnessHours: 6,
  confidence: 'high',
  interpretation:
    'Este evento deve aquecer a região por 3 noites, com maior impacto em imóveis conectados ao eixo sul e metrô.',
  drivers: [
    {
      key: 'attendance',
      label: 'Público esperado',
      weight: 0.35,
      explanation: 'Público estimado acima de 60 mil pessoas.',
    },
  ],
  riskFlags: ['extreme_price_dropoff'],
  dataQualityFlags: [],
  generatedAt: '2026-05-22T12:00:00.000Z',
  modelVersion: 'event-demand-v0.1',
  metricVersion: 'radar-metrics-v0.1',
  jobRunId: 'job-event-radar-20260522',
};

const propertyImpact = {
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
};

const priceAbsorptionCurve = {
  propertyId: propertyImpact.propertyId,
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
      explanation: 'Melhor equilíbrio entre diária maior e chance de reserva.',
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
      explanation: 'Só faz sentido em compressão extrema.',
    },
  ],
};

function expectScore(value: number | null) {
  expect(value).not.toBeNull();
  expect(value as number).toBeGreaterThanOrEqual(0);
  expect(value as number).toBeLessThanOrEqual(100);
}

function expectProbability(value: number | null) {
  expect(value).not.toBeNull();
  expect(value as number).toBeGreaterThanOrEqual(0);
  expect(value as number).toBeLessThanOrEqual(1);
}

function expectCents(value: number | null) {
  expect(value).not.toBeNull();
  expect(Number.isInteger(value)).toBe(true);
  expect(value as number).toBeGreaterThanOrEqual(0);
}

describe('Event radar contract v0', () => {
  it('defines catalog item fields required by host and admin UIs', () => {
    expect(eventItem).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      startsAt: expect.any(String),
      city: expect.any(String),
      state: expect.any(String),
      badges: expect.any(Array),
    });
    expect(new Date(eventItem.startsAt).toString()).not.toBe('Invalid Date');
    expectScore(eventItem.urbanScore);
    expectScore(eventItem.demandScore);
    expect(confidences).toContain(eventItem.confidence);
    expect(eventItem.officialUrl ?? eventItem.crawledUrl).toEqual(expect.any(String));
  });

  it('requires intelligence metadata, drivers and confidence on every snapshot', () => {
    expectScore(intelligence.eventDemandScore);
    expectCents(intelligence.eventRevenuePotentialCents);
    expectScore(intelligence.sourceReliabilityScore);
    expect(confidences).toContain(intelligence.confidence);
    expect(intelligence.generatedAt).toEqual(expect.any(String));
    expect(intelligence.modelVersion).toEqual(expect.any(String));
    expect(intelligence.metricVersion).toEqual(expect.any(String));
    expect(intelligence.drivers.length).toBeGreaterThan(0);
    expect(intelligence.drivers[0]).toMatchObject({
      key: expect.any(String),
      label: expect.any(String),
      weight: expect.any(Number),
      explanation: expect.any(String),
    });
  });

  it('keeps property impact monetary values in cents and probabilities in 0..1', () => {
    expect(propertyImpact.propertyId).toEqual(expect.any(String));
    expect(propertyImpact.propertyName).toEqual(expect.any(String));
    expectScore(propertyImpact.propertyCaptureScore);
    expectCents(propertyImpact.currentPriceCents);
    expectCents(propertyImpact.recommendedPriceCents);
    expectCents(propertyImpact.minAbsorbablePriceCents);
    expectCents(propertyImpact.maxAbsorbablePriceCents);
    expectProbability(propertyImpact.bookingProbability);
    expect(confidences).toContain(propertyImpact.confidence);
    expect(actions).toContain(propertyImpact.recommendedAction);
    expect(propertyImpact.mainDrivers.length).toBeGreaterThan(0);
  });

  it('returns the four required price absorption scenarios in stable order', () => {
    expect(priceAbsorptionCurve.affectedNights.length).toBeGreaterThan(0);
    expect(priceAbsorptionCurve.scenarios.map((item) => item.scenario)).toEqual(scenarios);

    for (const item of priceAbsorptionCurve.scenarios) {
      expectCents(item.priceCents);
      expectProbability(item.bookingProbability);
      expectCents(item.expectedRevenueCents);
      expect(['low', 'medium', 'high']).toContain(item.riskLevel);
      expect(item.explanation).toEqual(expect.any(String));
    }
  });

  it('defines admin blind spot groups with actionable next steps', () => {
    const blindSpot = {
      code: 'high_demand_without_recommendation',
      label: 'Alta demanda sem recomendação',
      severity: 'critical',
      count: 3,
      eventIds: [eventItem.id],
      nextAction: 'Reprocessar inteligência e verificar disponibilidade dos imóveis impactados.',
    };

    expect(blindSpot).toMatchObject({
      code: expect.any(String),
      label: expect.any(String),
      severity: expect.stringMatching(/^(info|warn|critical)$/),
      count: expect.any(Number),
      eventIds: expect.any(Array),
      nextAction: expect.any(String),
    });
    expect(blindSpot.count).toBeGreaterThan(0);
    expect(blindSpot.eventIds).toContain(eventItem.id);
  });
});
