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

@Entity('event_sources')
@Index(['eventId'])
@Index(['source'])
@Index(['sourceId'])
@Index(['canonicalUrl'])
@Index(['lastSeenAt'])
@Index(['source', 'sourceId'], { unique: true })
export class EventSource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  eventId: string;

  @ManyToOne(() => Event, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column({ type: 'varchar', length: 64 })
  source: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  sourceId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  rawTitle: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  rawVenue: string | null;

  @Column({ type: 'text', nullable: true })
  rawAddress: string | null;

  @Column({ type: 'datetime', nullable: true })
  rawStartDate: Date | null;

  @Column({ type: 'datetime', nullable: true })
  rawEndDate: Date | null;

  @Column({ type: 'text', nullable: true })
  url: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  canonicalUrl: string | null;

  @Column({ type: 'text', nullable: true })
  crawledUrl: string | null;

  @Column({ type: 'simple-json', nullable: true })
  rawPayload: unknown | null;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  confidenceScore: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  matchReason: string | null;

  @Column({ type: 'datetime', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
  firstSeenAt: Date;

  @Column({ type: 'datetime', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
  lastSeenAt: Date;

  @Column({ type: 'int', default: 1 })
  seenCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
