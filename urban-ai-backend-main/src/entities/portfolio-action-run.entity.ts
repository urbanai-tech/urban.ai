import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { PortfolioActionItem } from './portfolio-action-item.entity';

export type PortfolioActionRunStatus = 'running' | 'completed' | 'partial' | 'failed';

export type PortfolioActionRunSummary = {
  applied: number;
  failed: number;
  skipped?: number;
  estimatedLift: number;
  items?: number;
  affectedProperties?: number;
  affectedDates?: number;
};

@Entity('portfolio_action_runs')
@Index(['user', 'createdAt'])
@Index(['action', 'createdAt'])
export class PortfolioActionRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 64 })
  action: string;

  @Column({ type: 'varchar', length: 24, default: 'running' })
  status: PortfolioActionRunStatus;

  @Column({ type: 'simple-json', nullable: true })
  selectedPropertyIds: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  targetDates: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  payload: Record<string, unknown> | null;

  @Column({ type: 'simple-json', nullable: true })
  summary: PortfolioActionRunSummary | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @OneToMany(() => PortfolioActionItem, (item) => item.run)
  items: PortfolioActionItem[];
}
