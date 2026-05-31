import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Address } from './addresses.entity';
import { AnalisePreco } from './AnalisePreco';
import { EventPropertyImpact, PriceAbsorptionScenario } from './event-property-impact.entity';
import { EventIntelligenceConfidence, EventIntelligenceDriver, EventIntelligenceSnapshot } from './event-intelligence-snapshot.entity';
import { Event } from './events.entity';
import { List } from './list.entity';
import { PriceUpdate } from './price-update.entity';
import { User } from './user.entity';

export type PricingDecisionStatus =
  | 'draft'
  | 'suggested'
  | 'accepted'
  | 'applied'
  | 'rejected'
  | 'expired'
  | 'superseded';

export type PricingDecisionSnapshotOutcomeStatus =
  | 'unknown'
  | 'booked'
  | 'not_booked'
  | 'blocked'
  | 'pending'
  | 'cancelled';

export type PricingDecisionSnapshotInputSignals = {
  auditTrailVersion: string;
  generatedFrom: string;
  relationIds?: {
    userId?: string | null;
    propertyId?: string | null;
    listId?: string | null;
    eventId?: string | null;
    eventIntelligenceSnapshotId?: string | null;
    eventPropertyImpactId?: string | null;
    analisePrecoId?: string | null;
    priceUpdateId?: string | null;
  };
  pricing?: {
    basePriceCents?: number | null;
    currentPriceCents?: number | null;
    marketReferencePriceCents?: number | null;
    eventDemandScore?: number | null;
    propertyCaptureScore?: number | null;
    supplyCompressionScore?: number | null;
    affectedNights?: number | null;
  };
  selectedScenario?: {
    scenario: string;
    priceCents: number | null;
    multiplier: number | null;
    bookingProbability: number | null;
    expectedRevenueCents: number | null;
    expectedIncrementalRevenueCents?: number | null;
    isRecommended?: boolean;
  } | null;
  outcome?: {
    decisionStatus?: PricingDecisionStatus | null;
    status: PricingDecisionSnapshotOutcomeStatus;
    appliedPriceCents?: number | null;
    expectedRevenueCents?: number | null;
    expectedIncrementalRevenueCents?: number | null;
    realizedRevenueCents?: number | null;
    bookedNights?: number | null;
    reservationGenerated?: boolean | null;
    externalReservationId?: string | null;
    priceAbsorbed?: boolean | null;
    acceptedAt: string | null;
    rejectedAt: string | null;
    appliedAt: string | null;
    recordedAt: string | null;
    source?: string | null;
    sourceDetail?: string | null;
    currency?: string | null;
    priceUpdateId?: string | null;
    priceUpdateStatus?: string | null;
    priceUpdateOrigin?: string | null;
    revenueDeltaCents?: number | null;
    note?: string | null;
  } | null;
  [key: string]: unknown;
};

export type PricingDecisionSnapshotGuardrails = {
  minMultiplier?: number | null;
  maxMultiplier?: number | null;
  maxReducaoPercent?: number | null;
  maxAumentoPercent?: number | null;
  label?: string | null;
  cappedRecommendedPrice?: boolean;
  [key: string]: unknown;
};

@Entity('pricing_decision_snapshots')
@Index(['user', 'targetDate'])
@Index(['event', 'targetDate'])
@Index(['analisePreco'])
@Index(['status', 'createdAt'])
export class PricingDecisionSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Address, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'property_address_id' })
  property: Address | null;

  @ManyToOne(() => List, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'list_id' })
  list: List | null;

  @ManyToOne(() => Event, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'event_id' })
  event: Event | null;

  @ManyToOne(() => EventIntelligenceSnapshot, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'event_intelligence_snapshot_id' })
  eventIntelligenceSnapshot: EventIntelligenceSnapshot | null;

  @ManyToOne(() => EventPropertyImpact, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'event_property_impact_id' })
  eventPropertyImpact: EventPropertyImpact | null;

  @ManyToOne(() => AnalisePreco, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'analise_preco_id' })
  analisePreco: AnalisePreco | null;

  @ManyToOne(() => PriceUpdate, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'price_update_id' })
  priceUpdate: PriceUpdate | null;

  @Column({ type: 'date', nullable: true })
  targetDate: string | null;

  @Column({ type: 'datetime', precision: 6 })
  generatedAt: Date;

  @Column({ type: 'varchar', length: 64, nullable: true })
  jobRunId: string | null;

  @Column({ type: 'varchar', length: 32, default: 'pricing-decision-v0' })
  metricVersion: string;

  @Column({ type: 'varchar', length: 32, default: 'stub-contract-v0' })
  modelVersion: string;

  @Column({ type: 'varchar', length: 32, default: 'event_pricing' })
  decisionType: string;

  @Column({ type: 'int', nullable: true })
  basePriceCents: number | null;

  @Column({ type: 'int', nullable: true })
  currentPriceCents: number | null;

  @Column({ type: 'int', nullable: true })
  recommendedPriceCents: number | null;

  @Column({ type: 'int', nullable: true })
  selectedPriceCents: number | null;

  @Column({ type: 'int', nullable: true })
  appliedPriceCents: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  recommendedMultiplier: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  bookingProbability: number | null;

  @Column({ type: 'int', nullable: true })
  expectedRevenueCents: number | null;

  @Column({ type: 'int', nullable: true })
  expectedIncrementalRevenueCents: number | null;

  @Column({ type: 'varchar', length: 16, default: 'low' })
  confidence: EventIntelligenceConfidence;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: PricingDecisionStatus;

  @Column({ type: 'simple-json', nullable: true })
  inputSignals: PricingDecisionSnapshotInputSignals | null;

  @Column({ type: 'simple-json', nullable: true })
  guardrails: PricingDecisionSnapshotGuardrails | null;

  @Column({ type: 'simple-json', nullable: true })
  drivers: EventIntelligenceDriver[] | string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  priceAbsorptionScenarios: PriceAbsorptionScenario[] | null;

  @Column({ type: 'simple-json', nullable: true })
  riskFlags: string[] | null;

  @Column({ type: 'text', nullable: true })
  explanation: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
