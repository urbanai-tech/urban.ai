import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PricingDecisionSnapshot,
  PricingDecisionSnapshotInputSignals,
  PricingDecisionSnapshotOutcomeStatus,
  PricingDecisionStatus,
} from '../entities/pricing-decision-snapshot.entity';
import { IntelligenceConfidence, PriceAbsorptionCalibrationInput } from './event-pricing-intelligence.service';

export type AbsorptionLearningOutcomeStatus =
  | PricingDecisionSnapshotOutcomeStatus
  | 'host_rejected'
  | 'channel_rejected';

export type AbsorptionLearningRow = {
  snapshotId: string;
  eventId: string | null;
  propertyId: string | null;
  listId: string | null;
  analisePrecoId: string | null;
  priceUpdateId: string | null;
  targetDate: string | null;
  scenario: string;
  confidence: IntelligenceConfidence;
  selectedPriceCents: number | null;
  appliedPriceCents: number | null;
  priceMultiplier: number | null;
  predictedAbsorptionProbability: number;
  actualAbsorbed: boolean | null;
  trainingReady: boolean;
  decisionStatus: PricingDecisionStatus | null;
  outcomeStatus: AbsorptionLearningOutcomeStatus;
  reservationGenerated: boolean | null;
  realizedRevenueCents: number | null;
  expectedRevenueCents: number | null;
  expectedIncrementalRevenueCents: number | null;
  revenueDeltaCents: number | null;
  bookedNights: number | null;
  eventDemandScore: number | null;
  propertyCaptureScore: number | null;
  supplyCompressionScore: number | null;
  affectedNights: number | null;
  source: string | null;
  recordedAt: string | null;
  weight: number;
};

export type AbsorptionCalibrationBucket = {
  key: string;
  sampleSize: number;
  observedAbsorptionRate: number;
  predictedAbsorptionRate: number;
  probabilityDelta: number;
  brierScore: number;
};

export type AbsorptionCalibrationSummary = AbsorptionCalibrationBucket & {
  generatedAt: string;
  trainingRows: number;
  candidateRows: number;
  meanRevenueDeltaCents: number | null;
  byScenario: AbsorptionCalibrationBucket[];
  byConfidence: AbsorptionCalibrationBucket[];
};

export type AbsorptionCalibrationReadinessCriteria = {
  minTotalTrainingRows?: number;
  minRowsPerScenario?: number;
  minRowsPerConfidence?: number;
};

export type AbsorptionCalibrationReadiness = {
  ready: boolean;
  criteria: Required<AbsorptionCalibrationReadinessCriteria>;
  trainingRows: number;
  candidateRows: number;
  gaps: string[];
  scenarioCoverage: AbsorptionCalibrationBucket[];
  confidenceCoverage: AbsorptionCalibrationBucket[];
};

@Injectable()
export class PricingOutcomeLearningService {
  constructor(
    @Optional()
    @InjectRepository(PricingDecisionSnapshot)
    private readonly snapshotRepo?: Repository<PricingDecisionSnapshot>,
  ) {}

  async loadAbsorptionLearningDataset(limit = 5000): Promise<AbsorptionLearningRow[]> {
    if (!this.snapshotRepo) {
      throw new Error('PricingDecisionSnapshot repository is not available for outcome learning.');
    }

    const snapshots = await this.snapshotRepo.find({
      order: { createdAt: 'DESC' },
      take: this.limit(limit, 1, 50_000),
    });
    return this.buildAbsorptionLearningDataset(snapshots);
  }

  buildAbsorptionLearningDataset(
    snapshots: Array<Partial<PricingDecisionSnapshot>>,
  ): AbsorptionLearningRow[] {
    return snapshots
      .map((snapshot) => this.toLearningRow(snapshot))
      .filter((row): row is AbsorptionLearningRow => row !== null);
  }

  summarizeAbsorptionCalibration(rows: AbsorptionLearningRow[]): AbsorptionCalibrationSummary {
    const trainingRows = rows.filter((row) => row.trainingReady);
    const summary = this.bucketSummary('all', trainingRows);
    return {
      ...summary,
      generatedAt: new Date().toISOString(),
      trainingRows: trainingRows.length,
      candidateRows: rows.length,
      meanRevenueDeltaCents: this.meanNullable(
        trainingRows.map((row) => row.revenueDeltaCents),
      ),
      byScenario: this.groupedBuckets(trainingRows, (row) => row.scenario),
      byConfidence: this.groupedBuckets(trainingRows, (row) => row.confidence),
    };
  }

  buildProbabilityCalibration(
    rows: AbsorptionLearningRow[],
    options: { minSampleSize?: number; maxAdjustment?: number; source?: string } = {},
  ): PriceAbsorptionCalibrationInput | null {
    const summary = this.summarizeAbsorptionCalibration(rows);
    const minSampleSize = options.minSampleSize ?? 20;
    if (summary.sampleSize < minSampleSize) return null;
    return {
      predictedAbsorptionRate: summary.predictedAbsorptionRate,
      observedAbsorptionRate: summary.observedAbsorptionRate,
      sampleSize: summary.sampleSize,
      minSampleSize,
      maxAdjustment: options.maxAdjustment ?? 0.12,
      source: options.source ?? 'pricing_decision_snapshot_outcomes',
    };
  }

  evaluateCalibrationReadiness(
    rows: AbsorptionLearningRow[],
    criteria: AbsorptionCalibrationReadinessCriteria = {},
  ): AbsorptionCalibrationReadiness {
    const resolvedCriteria = {
      minTotalTrainingRows: criteria.minTotalTrainingRows ?? 60,
      minRowsPerScenario: criteria.minRowsPerScenario ?? 20,
      minRowsPerConfidence: criteria.minRowsPerConfidence ?? 20,
    };
    const summary = this.summarizeAbsorptionCalibration(rows);
    const gaps: string[] = [];

    if (summary.sampleSize < resolvedCriteria.minTotalTrainingRows) {
      gaps.push(
        `total_training_rows:${summary.sampleSize}/${resolvedCriteria.minTotalTrainingRows}`,
      );
    }

    for (const bucket of summary.byScenario) {
      if (bucket.sampleSize < resolvedCriteria.minRowsPerScenario) {
        gaps.push(
          `scenario:${bucket.key}:${bucket.sampleSize}/${resolvedCriteria.minRowsPerScenario}`,
        );
      }
    }

    for (const bucket of summary.byConfidence) {
      if (bucket.sampleSize < resolvedCriteria.minRowsPerConfidence) {
        gaps.push(
          `confidence:${bucket.key}:${bucket.sampleSize}/${resolvedCriteria.minRowsPerConfidence}`,
        );
      }
    }

    return {
      ready: gaps.length === 0,
      criteria: resolvedCriteria,
      trainingRows: summary.trainingRows,
      candidateRows: summary.candidateRows,
      gaps,
      scenarioCoverage: summary.byScenario,
      confidenceCoverage: summary.byConfidence,
    };
  }

  private toLearningRow(
    snapshot: Partial<PricingDecisionSnapshot>,
  ): AbsorptionLearningRow | null {
    const inputSignals = snapshot.inputSignals;
    const outcome = inputSignals?.outcome ?? null;
    const selectedScenario = inputSignals?.selectedScenario ?? null;
    const pricing = inputSignals?.pricing ?? null;
    const predictedAbsorptionProbability =
      this.numberOrNull(snapshot.bookingProbability) ??
      this.numberOrNull(selectedScenario?.bookingProbability);

    if (!inputSignals || !outcome || predictedAbsorptionProbability === null) return null;

    const relationIds = inputSignals.relationIds ?? {};
    const decisionStatus = outcome.decisionStatus ?? snapshot.status ?? null;
    const actualAbsorbed = this.resolveActualAbsorbed(outcome, decisionStatus);
    const scenario = selectedScenario?.scenario ?? 'unknown';
    const selectedPriceCents =
      this.numberOrNull(snapshot.selectedPriceCents) ??
      this.numberOrNull(selectedScenario?.priceCents);
    const basePriceCents =
      this.numberOrNull(pricing?.basePriceCents) ?? this.numberOrNull(snapshot.basePriceCents);
    const appliedPriceCents =
      this.numberOrNull(outcome.appliedPriceCents) ?? this.numberOrNull(snapshot.appliedPriceCents);

    return {
      snapshotId: snapshot.id ?? 'unknown',
      eventId: relationIds.eventId ?? this.entityId(snapshot.event),
      propertyId: relationIds.propertyId ?? this.entityId(snapshot.property),
      listId: relationIds.listId ?? this.entityId(snapshot.list),
      analisePrecoId: relationIds.analisePrecoId ?? this.entityId(snapshot.analisePreco),
      priceUpdateId: outcome.priceUpdateId ?? relationIds.priceUpdateId ?? this.entityId(snapshot.priceUpdate),
      targetDate: snapshot.targetDate ?? null,
      scenario,
      confidence: (snapshot.confidence ?? 'low') as IntelligenceConfidence,
      selectedPriceCents,
      appliedPriceCents,
      priceMultiplier:
        this.numberOrNull(selectedScenario?.multiplier) ??
        this.multiplier(selectedPriceCents, basePriceCents),
      predictedAbsorptionProbability,
      actualAbsorbed,
      trainingReady: actualAbsorbed !== null,
      decisionStatus,
      outcomeStatus: this.resolveOutcomeStatus(outcome, decisionStatus),
      reservationGenerated: outcome.reservationGenerated ?? null,
      realizedRevenueCents: this.numberOrNull(outcome.realizedRevenueCents),
      expectedRevenueCents:
        this.numberOrNull(outcome.expectedRevenueCents) ??
        this.numberOrNull(snapshot.expectedRevenueCents),
      expectedIncrementalRevenueCents:
        this.numberOrNull(outcome.expectedIncrementalRevenueCents) ??
        this.numberOrNull(snapshot.expectedIncrementalRevenueCents),
      revenueDeltaCents: this.numberOrNull(outcome.revenueDeltaCents),
      bookedNights: this.numberOrNull(outcome.bookedNights),
      eventDemandScore: this.numberOrNull(pricing?.eventDemandScore),
      propertyCaptureScore: this.numberOrNull(pricing?.propertyCaptureScore),
      supplyCompressionScore: this.numberOrNull(pricing?.supplyCompressionScore),
      affectedNights: this.numberOrNull(pricing?.affectedNights),
      source: outcome.source ?? null,
      recordedAt: outcome.recordedAt ?? null,
      weight: this.learningWeight(outcome, actualAbsorbed),
    };
  }

  private resolveActualAbsorbed(
    outcome: NonNullable<PricingDecisionSnapshotInputSignals['outcome']>,
    decisionStatus: PricingDecisionStatus | null,
  ): boolean | null {
    if (outcome.priceAbsorbed === true || outcome.status === 'booked' || outcome.reservationGenerated === true) {
      return true;
    }
    if (decisionStatus === 'rejected' || outcome.status === 'not_booked' || outcome.status === 'cancelled') {
      return false;
    }
    if (outcome.status === 'blocked') return null;
    return null;
  }

  private resolveOutcomeStatus(
    outcome: NonNullable<PricingDecisionSnapshotInputSignals['outcome']>,
    decisionStatus: PricingDecisionStatus | null,
  ): AbsorptionLearningOutcomeStatus {
    if (decisionStatus === 'rejected' && outcome.source === 'price_update') return 'channel_rejected';
    if (decisionStatus === 'rejected') return 'host_rejected';
    return outcome.status;
  }

  private learningWeight(
    outcome: NonNullable<PricingDecisionSnapshotInputSignals['outcome']>,
    actualAbsorbed: boolean | null,
  ): number {
    if (actualAbsorbed === null) return 0;
    if (outcome.source === 'price_update' && outcome.status === 'booked') return 1;
    if (outcome.source === 'analise_preco' && outcome.status === 'booked') return 0.9;
    if (outcome.status === 'not_booked' || outcome.decisionStatus === 'rejected') return 0.8;
    return 0.7;
  }

  private groupedBuckets(
    rows: AbsorptionLearningRow[],
    keyFn: (row: AbsorptionLearningRow) => string,
  ): AbsorptionCalibrationBucket[] {
    const grouped = new Map<string, AbsorptionLearningRow[]>();
    for (const row of rows) {
      const key = keyFn(row);
      grouped.set(key, [...(grouped.get(key) ?? []), row]);
    }
    return [...grouped.entries()]
      .map(([key, groupRows]) => this.bucketSummary(key, groupRows))
      .sort((left, right) => right.sampleSize - left.sampleSize || left.key.localeCompare(right.key));
  }

  private bucketSummary(key: string, rows: AbsorptionLearningRow[]): AbsorptionCalibrationBucket {
    if (!rows.length) {
      return {
        key,
        sampleSize: 0,
        observedAbsorptionRate: 0,
        predictedAbsorptionRate: 0,
        probabilityDelta: 0,
        brierScore: 0,
      };
    }

    const observed = rows.map((row) => (row.actualAbsorbed ? 1 : 0));
    const predicted = rows.map((row) => row.predictedAbsorptionProbability);
    const observedAbsorptionRate = this.roundProbability(this.mean(observed));
    const predictedAbsorptionRate = this.roundProbability(this.mean(predicted));
    const brierScore = this.roundProbability(
      this.mean(rows.map((row, index) => (predicted[index] - observed[index]) ** 2)),
    );

    return {
      key,
      sampleSize: rows.length,
      observedAbsorptionRate,
      predictedAbsorptionRate,
      probabilityDelta: this.roundProbability(observedAbsorptionRate - predictedAbsorptionRate),
      brierScore,
    };
  }

  private mean(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private meanNullable(values: Array<number | null>): number | null {
    const valid = values.filter((value): value is number => value !== null);
    if (!valid.length) return null;
    return Math.round(this.mean(valid));
  }

  private multiplier(priceCents: number | null, basePriceCents: number | null): number | null {
    if (!priceCents || !basePriceCents || basePriceCents <= 0) return null;
    return Number((priceCents / basePriceCents).toFixed(2));
  }

  private numberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private roundProbability(value: number): number {
    return Number(value.toFixed(4));
  }

  private entityId(entity?: { id?: string | null } | null): string | null {
    return entity?.id ?? null;
  }

  private limit(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Math.round(Number(value) || min)));
  }
}
