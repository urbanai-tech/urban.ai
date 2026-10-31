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
import { PropertyOwner } from './property-owner.entity';

export type OwnerReportEmailStatus = 'pending' | 'sending' | 'sent' | 'failed';

/**
 * Relatório mensal de um proprietário: snapshot do payload (sem IDs internos) + registro
 * do envio por e-mail. `UQ_owner_reports_owner_period` é a chave de idempotência do envio:
 * no máximo um relatório (e um e-mail) por proprietário por mês.
 *
 * Retenção: `OWNER_REPORT_RETENTION_MONTHS` (padrão 12) depois do fim do mês reportado; os
 * links caem em cascata. Ver ADR 0027.
 */
@Entity('owner_reports')
@Index('UQ_owner_reports_owner_period', ['ownerId', 'period'], { unique: true })
@Index('IDX_owner_reports_period', ['period'])
export class OwnerReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'owner_id', type: 'varchar', length: 36 })
  ownerId: string;

  @ManyToOne(() => PropertyOwner, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'owner_id' })
  owner: PropertyOwner;

  /** `YYYY-MM` (mês de calendário de São Paulo). */
  @Column({ type: 'varchar', length: 7 })
  period: string;

  @Column({ name: 'payload_json', type: 'longtext' })
  payloadJson: string;

  @Column({ name: 'payload_version', type: 'int', default: 1 })
  payloadVersion: number;

  @Column({ name: 'generated_at', type: 'datetime', precision: 6 })
  generatedAt: Date;

  @Column({ name: 'email_status', type: 'varchar', length: 16, default: 'pending' })
  emailStatus: OwnerReportEmailStatus;

  @Column({ name: 'email_attempts', type: 'int', default: 0 })
  emailAttempts: number;

  @Column({ name: 'email_sent_at', type: 'datetime', precision: 6, nullable: true })
  emailSentAt: Date | null;

  /** Motivo curto da última falha (sem e-mail nem dado pessoal). */
  @Column({ name: 'email_failure_reason', type: 'varchar', length: 255, nullable: true })
  emailFailureReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
