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
import { User } from './user.entity';

export type PricingRecommendationDigestStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';

@Entity('pricing_recommendation_digests')
@Index('IDX_pricing_digest_status_scheduled', ['status', 'scheduledFor'])
@Index('IDX_pricing_digest_user_status', ['userId', 'status'])
@Index('IDX_pricing_digest_created', ['createdAt'])
export class PricingRecommendationDigest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'recipient_email', type: 'varchar', length: 254 })
  recipientEmail: string;

  @Column({ name: 'recipient_name', type: 'varchar', length: 160, nullable: true })
  recipientName?: string | null;

  @Column({ name: 'wants_email', type: 'boolean', default: false })
  wantsEmail: boolean;

  @Column({ name: 'wants_push', type: 'boolean', default: false })
  wantsPush: boolean;

  @Column({ name: 'items_json', type: 'longtext' })
  itemsJson: string;

  @Column({ name: 'item_count', type: 'int', default: 0 })
  itemCount: number;

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  status: PricingRecommendationDigestStatus;

  @Column({ name: 'scheduled_for', type: 'datetime', precision: 6 })
  scheduledFor: Date;

  @Column({ name: 'locked_at', type: 'datetime', precision: 6, nullable: true })
  lockedAt: Date | null;

  @Column({ name: 'sent_at', type: 'datetime', precision: 6, nullable: true })
  sentAt: Date | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason?: string | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
