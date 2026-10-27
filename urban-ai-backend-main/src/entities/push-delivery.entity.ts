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
@Index('IDX_push_deliveries_deferred', ['deliverAfter'])
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

  /**
   * Push adiado pelo horário de silêncio: só é enviado (e só aparece para o service worker)
   * depois deste instante. Nulo = fluxo normal. O envio zera a coluna de forma atômica.
   */
  @Column({ type: 'datetime', nullable: true })
  deliverAfter: Date | null;

  /** Depois disto o push adiado perde o sentido (ex.: evento já começou) e é descartado. */
  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date | null;

  /** Tag do payload; push adiados com a mesma tag no mesmo dispositivo são colapsados no envio. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  tag: string | null;

  @Column({ type: 'datetime', nullable: true })
  pushedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  failedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  failureReason?: string | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;
}
