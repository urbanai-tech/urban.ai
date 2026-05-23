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
import { EventIntelligenceConfidence, EventIntelligenceDriver, EventIntelligenceSnapshot } from './event-intelligence-snapshot.entity';
import { Event } from './events.entity';
import { List } from './list.entity';
import { User } from './user.entity';

export type EventPropertyRecommendedAction = 'watch' | 'simulate' | 'apply' | 'review';

export type PriceAbsorptionScenario = {
  scenario: 'conservative' | 'recommended' | 'aggressive' | 'extreme' | string;
  priceCents: number | null;
  multiplier: number | null;
  bookingProbability: number | null;
  expectedRevenueCents: number | null;
  interpretation: string;
};

@Entity('event_property_impacts')
@Index(['event', 'property', 'generatedAt'])
@Index(['jobRunId', 'event', 'property', 'analisePreco'])
@Index(['hostUser', 'generatedAt'])
@Index(['confidence', 'generatedAt'])
@Index(['recommendedAction', 'generatedAt'])
export class EventPropertyImpact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @ManyToOne(() => EventIntelligenceSnapshot, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'event_intelligence_snapshot_id' })
  intelligenceSnapshot: EventIntelligenceSnapshot | null;

  @ManyToOne(() => Address, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_address_id' })
  property: Address;

  @ManyToOne(() => List, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'list_id' })
  list: List | null;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'host_user_id' })
  hostUser: User;

  @ManyToOne(() => AnalisePreco, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'analise_preco_id' })
  analisePreco: AnalisePreco | null;

  @Column({ type: 'datetime', precision: 6 })
  generatedAt: Date;

  @Column({ type: 'varchar', length: 64, nullable: true })
  jobRunId: string | null;

  @Column({ type: 'varchar', length: 32, default: 'property-impact-v0' })
  metricVersion: string;

  @Column({ type: 'varchar', length: 32, default: 'stub-contract-v0' })
  modelVersion: string;

  @Column({ type: 'decimal', precision: 8, scale: 3, nullable: true })
  distanceKm: number | null;

  @Column({ type: 'int', nullable: true })
  travelTimeMinutes: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  propertyCaptureScore: number | null;

  @Column({ type: 'int', nullable: true })
  basePriceCents: number | null;

  @Column({ type: 'int', nullable: true })
  currentPriceCents: number | null;

  @Column({ type: 'int', nullable: true })
  recommendedPriceCents: number | null;

  @Column({ type: 'int', nullable: true })
  minAbsorbablePriceCents: number | null;

  @Column({ type: 'int', nullable: true })
  maxAbsorbablePriceCents: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  recommendedMultiplier: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  maxPlausibleMultiplier: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  bookingProbability: number | null;

  @Column({ type: 'int', nullable: true })
  expectedRevenueCents: number | null;

  @Column({ type: 'int', nullable: true })
  expectedIncrementalRevenueCents: number | null;

  @Column({ type: 'varchar', length: 16, default: 'low' })
  confidence: EventIntelligenceConfidence;

  @Column({ type: 'simple-json', nullable: true })
  mainDrivers: EventIntelligenceDriver[] | string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  priceAbsorptionScenarios: PriceAbsorptionScenario[] | null;

  @Column({ type: 'varchar', length: 16, default: 'watch' })
  recommendedAction: EventPropertyRecommendedAction;

  @Column({ type: 'simple-json', nullable: true })
  riskFlags: string[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
