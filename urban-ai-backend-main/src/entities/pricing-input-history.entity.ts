import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Address } from './addresses.entity';
import { List } from './list.entity';
import { User } from './user.entity';

@Entity('pricing_input_history')
@Index(['list', 'createdAt'])
@Index(['address', 'createdAt'])
@Index(['user', 'createdAt'])
export class PricingInputHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => List, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'list_id' })
  list: List;

  @ManyToOne(() => Address, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'address_id' })
  address: Address | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'float', nullable: true })
  previousManualDailyPrice: number | null;

  @Column({ type: 'float', nullable: true })
  newManualDailyPrice: number | null;

  @Column({ type: 'float', nullable: true })
  previousAverageMonthlyRevenue: number | null;

  @Column({ type: 'float', nullable: true })
  newAverageMonthlyRevenue: number | null;

  @Column({ type: 'varchar', length: 32, default: 'manual' })
  source: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  changedByUserId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
