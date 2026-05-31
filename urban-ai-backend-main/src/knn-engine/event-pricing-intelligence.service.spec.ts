import {
  eventDemandScore,
  priceAbsorptionCurve,
  propertyCaptureScore,
} from './event-pricing-intelligence.service';

describe('event pricing intelligence v0', () => {
  const now = '2026-05-22T12:00:00.000Z';
  const eventStartsAt = '2026-06-16T20:00:00.000Z';
  const eventEndsAt = '2026-06-17T02:00:00.000Z';

  it('scores a nearby mega event and recommends an explainable absorption scenario', () => {
    const demand = eventDemandScore({
      relevancia: 96,
      expectedAttendance: 65000,
      venueCapacity: 70000,
      venueType: 'stadium',
      categoria: 'show',
      raioImpactoKm: 12,
      leadTimeDays: 25,
      startsAt: eventStartsAt,
      source: 'sympla-api',
      sourceFreshnessHours: 4,
      overlapEventsCount: 2,
      now,
    });

    const capture = propertyCaptureScore({
      distanceKm: 1.8,
      travelTimeMinutes: 12,
      eventDemandScore: demand.eventDemandScore,
      demandRadiusKm: demand.demandRadiusKm,
      currentPriceCents: 32000,
      compMedianPriceCents: 39000,
      available: true,
      rating: 4.88,
      reviewCount: 210,
      accommodates: 4,
      bedrooms: 2,
      bathrooms: 1,
      affectedNights: 2,
      eventStartsAt,
      eventEndsAt,
    });

    const curve = priceAbsorptionCurve({
      basePriceCents: 32000,
      marketReferencePriceCents: 39000,
      eventDemandScore: demand.eventDemandScore,
      propertyCaptureScore: capture.propertyCaptureScore,
      supplyCompressionScore: 88,
      affectedNights: capture.affectedNights,
      confidence: 'high',
    });

    expect(demand.eventDemandScore).toBeGreaterThanOrEqual(85);
    expect(demand.confidence).toBe('high');
    expect(capture.propertyCaptureScore).toBeGreaterThanOrEqual(80);
    expect(capture.recommendedAction).toBe('apply');
    expect(curve.maxPlausibleMultiplier).toBeGreaterThanOrEqual(3.5);
    expect(curve.recommendedPriceCents).toBeGreaterThan(32000 * 2);
    expect(curve.scenarios).toHaveLength(4);
    expect(curve.scenarios.some((scenario) => scenario.isRecommended)).toBe(true);
    expect(curve.interpretation).toContain('sem promessa de reserva');
  });

  it('keeps a medium event far from the property modest and action-oriented', () => {
    const demand = eventDemandScore({
      relevancia: 58,
      expectedAttendance: 2200,
      venueType: 'theater',
      categoria: 'cultura',
      leadTimeDays: 18,
      startsAt: eventStartsAt,
      source: 'firecrawl-theater',
      sourceFreshnessHours: 48,
      now,
    });

    const capture = propertyCaptureScore({
      distanceKm: 9,
      travelTimeMinutes: 55,
      eventDemandScore: demand.eventDemandScore,
      demandRadiusKm: demand.demandRadiusKm,
      currentPriceCents: 28000,
      compMedianPriceCents: 26000,
      available: true,
      rating: 4.4,
      reviewCount: 34,
      accommodates: 2,
      eventStartsAt,
      eventEndsAt,
    });

    const curve = priceAbsorptionCurve({
      basePriceCents: 28000,
      marketReferencePriceCents: 26000,
      eventDemandScore: demand.eventDemandScore,
      propertyCaptureScore: capture.propertyCaptureScore,
      supplyCompressionScore: 35,
      affectedNights: 1,
      confidence: capture.confidence,
    });

    expect(demand.eventDemandScore).toBeLessThan(70);
    expect(capture.propertyCaptureScore).toBeLessThan(45);
    expect(['watch', 'review']).toContain(capture.recommendedAction);
    expect(curve.recommendedMultiplier).toBeLessThan(2);
    expect(curve.riskFlags).toContain('weak_property_capture');
  });

  it('marks low confidence when source, relevance and attendance are missing', () => {
    const demand = eventDemandScore({
      venueType: null,
      categoria: null,
      startsAt: '2026-06-10T20:00:00.000Z',
      now,
    });

    expect(demand.confidence).toBe('low');
    expect(demand.riskFlags).toContain('low_confidence');
    expect(demand.dataQualityFlags).toEqual(
      expect.arrayContaining([
        'missing_relevance',
        'missing_attendance',
        'missing_source',
      ]),
    );
  });

  it('uses capacidadeEstimada as attendance fallback without pretending precision', () => {
    const demand = eventDemandScore({
      relevancia: 74,
      capacidadeEstimada: 12000,
      venueType: 'convention_center',
      categoria: 'conference',
      leadTimeDays: 40,
      startsAt: eventStartsAt,
      source: 'admin-manual',
      sourceFreshnessHours: 12,
      now,
    });

    expect(demand.expectedAttendance).toBe(12000);
    expect(demand.dataQualityFlags).toContain('attendance_from_capacidadeEstimada');
    expect(demand.dataQualityFlags).not.toContain('missing_attendance');
    expect(demand.confidence).toBe('high');
  });

  it('caps every scenario when host guardrail is lower than plausible demand', () => {
    const curve = priceAbsorptionCurve({
      basePriceCents: 50000,
      marketReferencePriceCents: 65000,
      eventDemandScore: 96,
      propertyCaptureScore: 92,
      supplyCompressionScore: 90,
      affectedNights: 2,
      confidence: 'high',
      guardrail: {
        minMultiplier: 0.9,
        maxMultiplier: 1.5,
        label: 'perfil moderado',
      },
    });

    expect(curve.maxPlausibleMultiplier).toBeGreaterThan(3);
    expect(curve.maxAbsorbablePriceCents).toBe(75000);
    expect(curve.riskFlags).toContain('guardrail_limited');
    expect(curve.scenarios.every((scenario) => scenario.cappedByGuardrail)).toBe(true);
    expect(curve.scenarios.every((scenario) => scenario.priceCents <= 75000)).toBe(true);
  });

  it('keeps the extreme scenario probabilistic and risk-tagged', () => {
    const curve = priceAbsorptionCurve({
      basePriceCents: 30000,
      marketReferencePriceCents: 36000,
      eventDemandScore: 99,
      propertyCaptureScore: 95,
      supplyCompressionScore: 95,
      affectedNights: 1,
      confidence: 'high',
    });

    const aggressive = curve.scenarios.find((scenario) => scenario.scenario === 'aggressive');
    const extreme = curve.scenarios.find((scenario) => scenario.scenario === 'extreme');

    expect(extreme).toBeDefined();
    expect(aggressive).toBeDefined();
    expect(extreme!.multiplier).toBeGreaterThanOrEqual(4);
    expect(extreme!.bookingProbability).toBeLessThan(aggressive!.bookingProbability);
    expect(extreme!.riskFlags).toContain('extreme_price_risk');
    expect(extreme!.explanation).toContain('risco de vacância alto');
  });
});
