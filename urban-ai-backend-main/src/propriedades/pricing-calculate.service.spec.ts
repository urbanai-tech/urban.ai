import { PricingCalculateService } from './pricing-calculate.service';

describe('PricingCalculateService pricing decision audit', () => {
  let service: PricingCalculateService;
  const generatedAt = '2026-06-13T09:00:00.000Z';

  beforeEach(() => {
    service = new PricingCalculateService();
  });

  it('builds an auditable pricing decision snapshot from event pricing inputs', () => {
    const draft = service.criarSnapshotDecisaoPricingEvento({
      user: { id: 'user-1' } as any,
      property: { id: 'property-1', list: { id: 'list-1' } } as any,
      event: { id: 'event-1', dataInicio: new Date('2026-06-10T20:00:00.000Z') } as any,
      eventPropertyImpact: { id: 'impact-1' } as any,
      analisePreco: { id: 'analysis-1' } as any,
      targetDate: '2026-06-10',
      generatedAt,
      jobRunId: 'job-1',
      selectedScenario: 'aggressive',
      priceInput: {
        basePriceCents: 30000,
        currentPriceCents: 30000,
        marketReferencePriceCents: 52000,
        eventDemandScore: 88,
        propertyCaptureScore: 82,
        supplyCompressionScore: 84,
        affectedNights: 2,
        confidence: 'high',
        guardrail: {
          maxMultiplier: 4,
          label: 'host-ai',
        },
      },
    });

    expect(draft.status).toBe('suggested');
    expect(draft.targetDate).toBe('2026-06-10');
    expect(draft.metricVersion).toBe('rules-v0.1');
    expect(draft.modelVersion).toBe('event-pricing-intelligence-v0');
    expect(draft.priceAbsorptionScenarios).toHaveLength(4);
    expect(draft.selectedPriceCents).toBeGreaterThan(draft.currentPriceCents ?? 0);
    expect(draft.inputSignals).toMatchObject({
      auditTrailVersion: 'pricing-decision-audit-v0',
      generatedFrom: 'pricing-calculate.service',
      relationIds: {
        userId: 'user-1',
        propertyId: 'property-1',
        listId: 'list-1',
        eventId: 'event-1',
        eventPropertyImpactId: 'impact-1',
        analisePrecoId: 'analysis-1',
      },
      pricing: {
        eventDemandScore: 88,
        propertyCaptureScore: 82,
        supplyCompressionScore: 84,
        affectedNights: 2,
      },
      selectedScenario: {
        scenario: 'aggressive',
        bookingProbability: expect.any(Number),
        expectedRevenueCents: expect.any(Number),
      },
    });
    expect(draft.guardrails).toMatchObject({
      maxMultiplier: 4,
      label: 'host-ai',
      cappedRecommendedPrice: expect.any(Boolean),
    });
  });

  it('normalizes legacy AnalisePreco money values and links PriceUpdate as an applied decision', () => {
    const draft = service.criarSnapshotDecisaoPricingEvento({
      user: { id: 'user-1' } as any,
      analisePreco: {
        id: 'analysis-1',
        seuPrecoAtual: 250,
        precoSugerido: 750,
        endereco: { id: 'property-1', list: { id: 'list-1' } },
        evento: { id: 'event-1', dataInicio: new Date('2026-07-01T12:00:00.000Z') },
      } as any,
      priceUpdate: { id: 'price-update-1', newPriceCents: 69000 } as any,
      generatedAt,
      priceInput: {
        eventDemandScore: 92,
        propertyCaptureScore: 84,
        supplyCompressionScore: 80,
        confidence: 'high',
      },
    });

    expect(draft.status).toBe('applied');
    expect(draft.currentPriceCents).toBe(25000);
    expect(draft.basePriceCents).toBe(25000);
    expect(draft.appliedPriceCents).toBe(69000);
    expect(draft.inputSignals.relationIds).toMatchObject({
      priceUpdateId: 'price-update-1',
      propertyId: 'property-1',
      eventId: 'event-1',
    });
    expect(draft.inputSignals.pricing?.marketReferencePriceCents).toBe(75000);
  });

  it('creates an outcome patch that preserves the decision trail and stores realized result', () => {
    const draft = service.criarSnapshotDecisaoPricingEvento({
      user: { id: 'user-1' } as any,
      event: { id: 'event-1' } as any,
      priceInput: {
        basePriceCents: 30000,
        currentPriceCents: 30000,
        eventDemandScore: 80,
        propertyCaptureScore: 75,
        supplyCompressionScore: 70,
        affectedNights: 2,
      },
      generatedAt,
    });

    const patch = service.criarPatchOutcomeSnapshotDecisao({
      snapshot: {
        inputSignals: draft.inputSignals,
        selectedPriceCents: draft.selectedPriceCents,
        expectedRevenueCents: 90000,
        riskFlags: ['guardrail_limited'],
        status: 'suggested',
      },
      status: 'booked',
      appliedPriceCents: draft.selectedPriceCents,
      realizedRevenueCents: 112000,
      bookedNights: 2,
      acceptedAt: null,
      appliedAt: null,
      rejectedAt: null,
      recordedAt: '2026-06-12T12:00:00.000Z',
      source: 'channel',
    });

    expect(patch.status).toBe('applied');
    expect(patch.appliedPriceCents).toBe(draft.selectedPriceCents);
    expect(patch.inputSignals.selectedScenario).toEqual(draft.inputSignals.selectedScenario);
    expect(patch.inputSignals.outcome).toMatchObject({
      decisionStatus: 'applied',
      status: 'booked',
      expectedRevenueCents: 90000,
      realizedRevenueCents: 112000,
      bookedNights: 2,
      reservationGenerated: true,
      priceAbsorbed: true,
      recordedAt: '2026-06-12T12:00:00.000Z',
      source: 'channel',
      revenueDeltaCents: 22000,
    });
    expect(patch.riskFlags).toEqual(['guardrail_limited']);
  });

  it('records accepted pending PriceUpdate without treating it as channel-applied yet', () => {
    const patch = service.criarPatchOutcomeSnapshotDecisao({
      snapshot: {
        inputSignals: {
          auditTrailVersion: 'pricing-decision-audit-v0',
          generatedFrom: 'pricing-calculate.service',
        },
        expectedRevenueCents: 120000,
        expectedIncrementalRevenueCents: 30000,
        status: 'suggested',
      },
      priceUpdate: {
        id: 'price-update-accepted-1',
        newPriceCents: 64000,
        currency: 'BRL',
        origin: 'user_accepted',
        status: 'pending',
        createdAt: new Date('2026-06-13T09:00:00.000Z'),
      } as any,
      acceptedAt: null,
      appliedAt: null,
      rejectedAt: null,
      recordedAt: '2026-06-13T09:01:00.000Z',
    });

    expect(patch.status).toBe('accepted');
    expect(patch.appliedPriceCents).toBe(64000);
    expect(patch.expectedRevenueCents).toBe(120000);
    expect(patch.expectedIncrementalRevenueCents).toBe(30000);
    expect(patch.inputSignals.outcome).toMatchObject({
      decisionStatus: 'accepted',
      status: 'unknown',
      appliedPriceCents: 64000,
      expectedRevenueCents: 120000,
      expectedIncrementalRevenueCents: 30000,
      reservationGenerated: false,
      priceAbsorbed: false,
      source: 'price_update',
      sourceDetail: 'user_accepted',
      currency: 'BRL',
      priceUpdateId: 'price-update-accepted-1',
      priceUpdateStatus: 'pending',
      priceUpdateOrigin: 'user_accepted',
      recordedAt: '2026-06-13T09:01:00.000Z',
    });
  });

  it('hydrates booked outcome from AnalisePreco feedback for absorption calibration', () => {
    const patch = service.criarPatchOutcomeSnapshotDecisao({
      snapshot: {
        inputSignals: {
          auditTrailVersion: 'pricing-decision-audit-v0',
          generatedFrom: 'pricing-calculate.service',
        },
        expectedRevenueCents: 110000,
        status: 'suggested',
      },
      analisePreco: {
        status: 'applied_manual',
        aceito: true,
        precoAplicado: 640,
        aplicadoEm: new Date('2026-06-12T18:00:00.000Z'),
        origemAplicacao: 'manual_dashboard',
        reservaStatus: 'booked',
        receitaReal: 1280,
        noitesReservadas: 2,
        resultadoRegistradoEm: new Date('2026-06-15T10:00:00.000Z'),
        feedbackObservacao: 'Reserva confirmada no canal.',
      } as any,
      externalReservationId: 'reservation-123',
      acceptedAt: null,
      appliedAt: null,
      rejectedAt: null,
      recordedAt: null,
    });

    expect(patch.status).toBe('applied');
    expect(patch.appliedPriceCents).toBe(64000);
    expect(patch.inputSignals.outcome).toMatchObject({
      decisionStatus: 'applied',
      status: 'booked',
      appliedPriceCents: 64000,
      expectedRevenueCents: 110000,
      realizedRevenueCents: 128000,
      revenueDeltaCents: 18000,
      bookedNights: 2,
      reservationGenerated: true,
      externalReservationId: 'reservation-123',
      priceAbsorbed: true,
      appliedAt: '2026-06-12T18:00:00.000Z',
      recordedAt: '2026-06-15T10:00:00.000Z',
      source: 'analise_preco',
      sourceDetail: 'manual_dashboard',
      note: 'Reserva confirmada no canal.',
    });
  });

  it('keeps rejected decisions explicit when no booking is generated', () => {
    const patch = service.criarPatchOutcomeSnapshotDecisao({
      snapshot: {
        inputSignals: {
          auditTrailVersion: 'pricing-decision-audit-v0',
          generatedFrom: 'pricing-calculate.service',
        },
        expectedRevenueCents: 80000,
        status: 'suggested',
      },
      analisePreco: {
        status: 'rejected',
        aceito: false,
        rejeitadoEm: new Date('2026-06-12T20:00:00.000Z'),
        reservaStatus: 'not_booked',
        resultadoRegistradoEm: new Date('2026-06-20T10:00:00.000Z'),
        feedbackObservacao: 'Host decidiu manter o preço anterior.',
      } as any,
      acceptedAt: null,
      appliedAt: null,
      rejectedAt: null,
      recordedAt: null,
    });

    expect(patch.status).toBe('rejected');
    expect(patch.inputSignals.outcome).toMatchObject({
      decisionStatus: 'rejected',
      status: 'not_booked',
      expectedRevenueCents: 80000,
      reservationGenerated: false,
      rejectedAt: '2026-06-12T20:00:00.000Z',
      recordedAt: '2026-06-20T10:00:00.000Z',
      source: 'analise_preco',
      note: 'Host decidiu manter o preço anterior.',
    });
    expect(patch.riskFlags).toEqual(['decision_rejected', 'no_booking_after_decision']);
  });
});
