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
import { List } from './list.entity';
import { User } from './user.entity';

export type AirbnbPricingAttemptStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'timeout'
  | 'skipped'
  | string;

@Entity('airbnb_pricing_attempt_logs')
@Index(['listingId', 'checkIn', 'checkOut'])
@Index(['status', 'startedAt'])
@Index(['status', 'reason', 'startedAt'])
@Index(['source', 'startedAt'])
@Index(['userId', 'startedAt'])
@Index(['listId', 'startedAt'])
@Index(['addressId', 'startedAt'])
export class AirbnbPricingAttemptLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128 })
  listingId: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36, nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'list_id', type: 'varchar', length: 36, nullable: true })
  listId: string | null;

  @ManyToOne(() => List, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'list_id' })
  list: List | null;

  @Column({ name: 'address_id', type: 'varchar', length: 36, nullable: true })
  addressId: string | null;

  @ManyToOne(() => Address, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'address_id' })
  address: Address | null;

  @Column({ type: 'date' })
  checkIn: string;

  @Column({ type: 'date' })
  checkOut: string;

  @Column({ type: 'varchar', length: 64, default: 'airbnb_headless' })
  source: string;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: AirbnbPricingAttemptStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @Column({ type: 'int', nullable: true })
  durationMs: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  priceTotal: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  dailyPrice: number | null;

  @Column({ type: 'varchar', length: 3, default: 'BRL' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  finalUrl: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'datetime', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
  startedAt: Date;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  finishedAt: Date | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
