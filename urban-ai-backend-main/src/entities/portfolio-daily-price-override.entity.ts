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
import { PortfolioActionRun } from './portfolio-action-run.entity';
import { User } from './user.entity';

@Entity('portfolio_daily_price_overrides')
@Index(['address', 'targetDate'], { unique: true })
@Index(['user', 'targetDate'])
@Index(['actionRun'])
export class PortfolioDailyPriceOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Address, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'address_id' })
  address: Address;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => PortfolioActionRun, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'action_run_id' })
  actionRun: PortfolioActionRun | null;

  @Column({ type: 'date' })
  targetDate: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'varchar', length: 48, default: 'portfolio_manual' })
  source: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
