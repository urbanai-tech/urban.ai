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
import { PortfolioActionRun } from './portfolio-action-run.entity';
import { User } from './user.entity';

export type PortfolioActionItemStatus = 'planned' | 'applied' | 'failed' | 'skipped';

@Entity('portfolio_action_items')
@Index(['run', 'status'])
@Index(['user', 'createdAt'])
@Index(['address', 'targetDate'])
@Index(['action', 'createdAt'])
export class PortfolioActionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PortfolioActionRun, (run) => run.items, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'run_id' })
  run: PortfolioActionRun;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Address, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'address_id' })
  address: Address | null;

  @Column({ name: 'property_id', type: 'varchar', length: 36, nullable: true })
  propertyId: string | null;

  @Column({ type: 'date', nullable: true })
  targetDate: string | null;

  @Column({ type: 'varchar', length: 64 })
  action: string;

  @Column({ type: 'varchar', length: 24 })
  status: PortfolioActionItemStatus;

  @Column({ type: 'simple-json', nullable: true })
  before: Record<string, unknown> | null;

  @Column({ type: 'simple-json', nullable: true })
  after: Record<string, unknown> | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimatedLift: number | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
