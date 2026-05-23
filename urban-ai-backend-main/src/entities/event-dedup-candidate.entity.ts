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

export type EventDedupCandidateStatus = 'pending' | 'approved' | 'rejected' | 'obsolete';
export type EventDedupConfidenceBand = 'high' | 'medium' | 'low';

@Entity('event_dedup_candidates')
@Index(['status', 'confidenceBand'])
@Index(['canonicalEventId'])
@Index(['duplicateEventId'])
@Index(['canonicalEventId', 'duplicateEventId'], { unique: true })
export class EventDedupCandidate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  canonicalEventId: string;

  @ManyToOne(() => Event, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'canonicalEventId' })
  canonicalEvent: Event;

  @Column({ type: 'varchar', length: 36 })
  duplicateEventId: string;

  @ManyToOne(() => Event, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'duplicateEventId' })
  duplicateEvent: Event;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: EventDedupCandidateStatus;

  @Column({ type: 'varchar', length: 16, default: 'medium' })
  confidenceBand: EventDedupConfidenceBand;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  score: number;

  @Column({ type: 'varchar', length: 255 })
  reason: string;

  @Column({ type: 'simple-json', nullable: true })
  signals: unknown | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  source: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  sourceId: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  reviewedByUserId: string | null;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reviewReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
