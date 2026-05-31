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

@Entity('push_subscriptions')
@Index('IDX_push_subscriptions_device', ['deviceId'], { unique: true })
@Index('IDX_push_subscriptions_endpoint_hash', ['endpointHash'], { unique: true })
@Index('IDX_push_subscriptions_user_active', ['userId', 'active'])
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 64 })
  deviceId: string;

  @Column({ type: 'varchar', length: 64 })
  deviceSecretHash: string;

  @Column({ type: 'varchar', length: 64 })
  endpointHash: string;

  @Column({ type: 'varchar', length: 2048 })
  endpoint: string;

  @Column({ type: 'varchar', length: 255 })
  p256dh: string;

  @Column({ type: 'varchar', length: 255 })
  auth: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  platform?: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'int', default: 0 })
  failedAttempts: number;

  @Column({ type: 'datetime', nullable: true })
  lastPushAttemptAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lastPushSuccessAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lastPushFailureAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  failureReason?: string | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
