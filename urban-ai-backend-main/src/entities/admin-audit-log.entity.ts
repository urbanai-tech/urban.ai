import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('admin_audit_logs')
@Index(['action', 'createdAt'])
@Index(['actorUserId', 'createdAt'])
@Index(['entityType', 'entityId'])
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  actorUserId: string | null;

  @Column({ type: 'varchar', length: 96 })
  action: string;

  @Column({ type: 'varchar', length: 64 })
  entityType: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  entityId: string | null;

  @Column({ type: 'simple-json', nullable: true })
  before: unknown | null;

  @Column({ type: 'simple-json', nullable: true })
  after: unknown | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: unknown | null;

  @CreateDateColumn()
  createdAt: Date;
}
