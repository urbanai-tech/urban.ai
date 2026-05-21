import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PushSubscription } from './push-subscription.entity';
import { User } from './user.entity';

@Entity('push_deliveries')
@Index('IDX_push_deliveries_subscription_pending', ['subscriptionId', 'deliveredAt'])
@Index('IDX_push_deliveries_user_created', ['userId', 'createdAt'])
export class PushDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'subscription_id', type: 'varchar', length: 36 })
  subscriptionId: string;

  @ManyToOne(() => PushSubscription, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscription_id' })
  subscription: PushSubscription;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text' })
  payloadJson: string;

  @Column({ type: 'datetime', nullable: true })
  pushedAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  deliveredAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  failedAt?: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  failureReason?: string | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;
}
