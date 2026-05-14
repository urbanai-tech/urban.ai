import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('admin_job_runs')
@Index(['name', 'startedAt'])
@Index(['status', 'startedAt'])
@Index(['triggeredByUserId', 'startedAt'])
export class AdminJobRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'varchar', length: 16, default: 'running' })
  status: 'running' | 'success' | 'error';

  @Column({ type: 'varchar', length: 36, nullable: true })
  triggeredByUserId: string | null;

  @Column({ type: 'datetime', precision: 6 })
  startedAt: Date;

  @Column({ type: 'datetime', precision: 6, nullable: true })
  finishedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  durationMs: number | null;

  @Column({ type: 'simple-json', nullable: true })
  result: unknown | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
