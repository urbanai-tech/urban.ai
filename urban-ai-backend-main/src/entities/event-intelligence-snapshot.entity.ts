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
import { Event } from './events.entity';

export type EventIntelligenceConfidence = 'low' | 'medium' | 'high';

export type EventIntelligenceDriver = {
  key: string;
  label: string;
  weight: number;
  explanation: string;
};

@Entity('event_intelligence_snapshots')
@Index(['event', 'generatedAt'])
@Index(['jobRunId', 'event'])
@Index(['confidence', 'generatedAt'])
@Index(['eventDemandScore'])
export class EventIntelligenceSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ type: 'datetime', precision: 6 })
  generatedAt: Date;

  @Column({ type: 'varchar', length: 64, nullable: true })
  jobRunId: string | null;

  @Column({ type: 'varchar', length: 32, default: 'event-demand-v0' })
  metricVersion: string;

  @Column({ type: 'varchar', length: 32, default: 'stub-contract-v0' })
  modelVersion: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  eventDemandScore: number | null;

  @Column({ type: 'int', nullable: true })
  eventRevenuePotentialCents: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  demandRadiusKm: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  sourceReliabilityScore: number | null;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  sourceFreshnessHours: number | null;

  @Column({ type: 'varchar', length: 16, default: 'low' })
  confidence: EventIntelligenceConfidence;

  @Column({ type: 'int', nullable: true })
  expectedAttendance: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  venueType: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ type: 'int', nullable: true })
  leadTimeDays: number | null;

  @Column({ type: 'int', default: 0 })
  overlapEventsCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  supplyCompressionScore: number | null;

  @Column({ type: 'text', nullable: true })
  interpretation: string | null;

  @Column({ type: 'simple-json', nullable: true })
  drivers: EventIntelligenceDriver[] | null;

  @Column({ type: 'simple-json', nullable: true })
  hotRegions: unknown[] | null;

  @Column({ type: 'simple-json', nullable: true })
  riskFlags: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  dataQualityFlags: string[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
