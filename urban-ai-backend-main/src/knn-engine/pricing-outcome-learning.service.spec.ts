import { priceAbsorptionCurve } from './event-pricing-intelligence.service';
import { PricingOutcomeLearningService } from './pricing-outcome-learning.service';

describe('PricingOutcomeLearningService', () => {
  let service: PricingOutcomeLearningService;

  beforeEach(() => {
    service = new PricingOutcomeLearningService();
  });

  function snapshot(overrides: Record<string, unknown> = {}) {
    return {
      id: 'snapshot-1',
      targetDate: '2026-06-10',
      confidence: 'high',
      selectedPriceCents: 45000,
      bookingProbability: 0.7,
      expectedRevenueCents: 90000,
      expectedIncrementalRevenueCents: 24000,
      inputSignals: {
        auditTrailVersion: 'pricing-decision-audit-v0',
        generatedFrom: 'pricing-calculate.service',
        relationIds: {
          eventId: 'event-1',
          propertyId: 'property-1',
          listId: 'list-1',
          analisePrecoId: 'analysis-1',
        },
        pricing: {
          basePriceCents: 30000,
          eventDemandScore: 85,
          propertyCaptureScore: 80,
          supplyCompressionScore: 76,
          affectedNights: 2,
        },
        selectedScenario: {
          scenario: 'recommended',
          priceCents: 45000,
          multiplier: 1.5,
          bookingProbability: 0.7,
          expectedRevenueCents: 90000,
          expectedIncrementalRevenueCents: 24000,
        },
        outcome: {
          decisionStatus: 'applied',
          status: 'booked',
          appliedPriceCents: 45000,
          realizedRevenueCents: 92000,
          bookedNights: 2,
          reservationGenerated: true,
          priceAbsorbed: true,
          source: 'price_update',
          recordedAt: '2026-06-12T12:00:00.000Z',
          revenueDeltaCents: 2000,
        },
      },
      ...overrides,
    };
  }

  it('extracts training rows from pricing decision outcomes', () => {
    const rows = service.buildAbsorptionLearningDataset([
      snapshot(),
      snapshot({
        id: 'snapshot-2',
        bookingProbability: 0.6,
        status: 'rejected',
        inputSignals: {
          ...snapshot().inputSignals,
          outcome: {
            decisionStatus: 'rejected',
            status: 'not_booked',
            reservationGenerated: false,
            priceAbsorbed: false,
            source: 'analise_preco',
            recordedAt: '2026-06-20T12:00:00.000Z',
          },
        },
      }),
      snapshot({
        id: 'snapshot-3',
        inputSignals: {
          ...snapshot().inputSignals,
          outcome: {
            decisionStatus: 'applied',
            status: 'blocked',
            source: 'manual',
          },
        },
      }),
    ] as any);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      snapshotId: 'snapshot-1',
      eventId: 'event-1',
      propertyId: 'property-1',
      scenario: 'recommended',
      predictedAbsorptionProbability: 0.7,
      actualAbsorbed: true,
      trainingReady: true,
      realizedRevenueCents: 92000,
      revenueDeltaCents: 2000,
    });
    expect(rows[1]).toMatchObject({
      snapshotId: 'snapshot-2',
      actualAbsorbed: false,
      outcomeStatus: 'host_rejected',
      trainingReady: true,
    });
    expect(rows[2]).toMatchObject({
      snapshotId: 'snapshot-3',
      actualAbsorbed: null,
      trainingReady: false,
    });
  });

  it('summarizes calibration and produces an engine calibration input', () => {
    const rows = service.buildAbsorptionLearningDataset([
      snapshot({ id: 'booked-1', bookingProbability: 0.7 }),
      snapshot({ id: 'booked-2', bookingProbability: 0.6 }),
      snapshot({
        id: 'not-booked-1',
        bookingProbability: 0.5,
        status: 'rejected',
        inputSignals: {
          ...snapshot().inputSignals,
          outcome: {
            decisionStatus: 'rejected',
            status: 'not_booked',
            reservationGenerated: false,
            priceAbsorbed: false,
            source: 'analise_preco',
          },
        },
      }),
    ] as any);

    const summary = service.summarizeAbsorptionCalibration(rows);
    const calibration = service.buildProbabilityCalibration(rows, {
      minSampleSize: 3,
      maxAdjustment: 0.2,
    });

    expect(summary).toMatchObject({
      sampleSize: 3,
      trainingRows: 3,
      candidateRows: 3,
      observedAbsorptionRate: 0.6667,
      predictedAbsorptionRate: 0.6,
      probabilityDelta: 0.0667,
      meanRevenueDeltaCents: 2000,
    });
    expect(summary.byScenario).toEqual([
      expect.objectContaining({ key: 'recommended', sampleSize: 3 }),
    ]);
    expect(calibration).toMatchObject({
      predictedAbsorptionRate: 0.6,
      observedAbsorptionRate: 0.6667,
      sampleSize: 3,
      minSampleSize: 3,
      maxAdjustment: 0.2,
      source: 'pricing_decision_snapshot_outcomes',
    });
  });

  it('reports calibration readiness gaps before automatic recompute usage', () => {
    const rows = service.buildAbsorptionLearningDataset([
      snapshot({ id: 'booked-1', bookingProbability: 0.7 }),
      snapshot({
        id: 'not-booked-1',
        bookingProbability: 0.5,
        confidence: 'medium',
        status: 'rejected',
        inputSignals: {
          ...snapshot().inputSignals,
          selectedScenario: {
            ...(snapshot().inputSignals as any).selectedScenario,
            scenario: 'conservative',
          },
          outcome: {
            decisionStatus: 'rejected',
            status: 'not_booked',
            reservationGenerated: false,
            priceAbsorbed: false,
            source: 'analise_preco',
          },
        },
      }),
    ] as any);

    const readiness = service.evaluateCalibrationReadiness(rows, {
      minTotalTrainingRows: 3,
      minRowsPerScenario: 2,
      minRowsPerConfidence: 2,
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.gaps).toEqual(
      expect.arrayContaining([
        'total_training_rows:2/3',
        'scenario:conservative:1/2',
        'scenario:recommended:1/2',
        'confidence:high:1/2',
        'confidence:medium:1/2',
      ]),
    );
  });

  it('applies calibration to the absorption curve when outcome sample is ready', () => {
    const uncalibrated = priceAbsorptionCurve({
      basePriceCents: 30000,
      marketReferencePriceCents: 42000,
      eventDemandScore: 82,
      propertyCaptureScore: 78,
      supplyCompressionScore: 75,
      affectedNights: 2,
      confidence: 'high',
    });
    const calibrated = priceAbsorptionCurve({
      basePriceCents: 30000,
      marketReferencePriceCents: 42000,
      eventDemandScore: 82,
      propertyCaptureScore: 78,
      supplyCompressionScore: 75,
      affectedNights: 2,
      confidence: 'high',
      calibration: {
        predictedAbsorptionRate: 0.5,
        observedAbsorptionRate: 0.72,
        sampleSize: 120,
        minSampleSize: 20,
        maxAdjustment: 0.12,
      },
    });

    const uncalibratedRecommended = uncalibrated.scenarios.find(
      (scenario) => scenario.scenario === 'recommended',
    );
    const calibratedRecommended = calibrated.scenarios.find(
      (scenario) => scenario.scenario === 'recommended',
    );

    expect(calibratedRecommended?.bookingProbability).toBeGreaterThan(
      uncalibratedRecommended?.bookingProbability ?? 0,
    );
    expect(calibrated.drivers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'outcome_calibration',
          value: 120,
        }),
      ]),
    );
  });
});
