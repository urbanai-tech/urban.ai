import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ContactSubmissionStatus = 'new' | 'in_progress' | 'resolved' | 'archived';
export type ContactSubmissionCategory =
  | 'sales'
  | 'support'
  | 'billing'
  | 'privacy_lgpd'
  | 'stays'
  | 'incident'
  | 'partnership';
export type ContactSubmissionSeverity = 'P0' | 'P1' | 'P2' | 'P3';

@Entity('contact_submissions')
@Index(['status', 'createdAt'])
@Index(['email'])
export class ContactSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 254 })
  email: string;

  @Column({ type: 'varchar', length: 220 })
  subject: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 80, default: 'public-contact' })
  source: string;

  @Column({ type: 'varchar', length: 32, default: 'new' })
  status: ContactSubmissionStatus;

  @Column({ type: 'varchar', length: 32, default: 'support' })
  category: ContactSubmissionCategory;

  @Column({ type: 'varchar', length: 8, default: 'P2' })
  severity: ContactSubmissionSeverity;

  @Column({ type: 'datetime', nullable: true })
  dueAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  assignedOwner: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
