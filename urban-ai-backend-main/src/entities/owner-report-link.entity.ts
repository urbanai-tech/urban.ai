import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OwnerReport } from './owner-report.entity';

export type OwnerReportLinkOrigin = 'host' | 'email';

/**
 * Link público, somente leitura, de um relatório. O token em si NÃO é guardado: só o SHA-256
 * da parte aleatória (`tokenHash`). Expira (`expiresAt`) e o anfitrião pode revogar
 * (`revokedAt`). Linhas vencidas/revogadas são apagadas depois de 30 dias (ADR 0027).
 */
@Entity('owner_report_links')
@Index('UQ_owner_report_links_token_hash', ['tokenHash'], { unique: true })
@Index('IDX_owner_report_links_report', ['reportId'])
@Index('IDX_owner_report_links_expires', ['expiresAt'])
export class OwnerReportLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'report_id', type: 'varchar', length: 36 })
  reportId: string;

  @ManyToOne(() => OwnerReport, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'report_id' })
  report: OwnerReport;

  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ type: 'varchar', length: 8, default: 'host' })
  origin: OwnerReportLinkOrigin;

  @Column({ name: 'expires_at', type: 'datetime', precision: 6 })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'datetime', precision: 6, nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'view_count', type: 'int', default: 0 })
  viewCount: number;

  @Column({ name: 'first_viewed_at', type: 'datetime', precision: 6, nullable: true })
  firstViewedAt: Date | null;

  @Column({ name: 'last_viewed_at', type: 'datetime', precision: 6, nullable: true })
  lastViewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;
}
