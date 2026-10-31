import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type EventCoverageScope = 'past30' | 'next90';
export type EventCoverageDimension = 'total' | 'category' | 'venue' | 'size';

/**
 * Série histórica diária de recall e precisão (ADR 0026), uma linha por
 * (dia, janela, dimensão, valor). `past30` = referências aprovadas dos últimos 30 dias já
 * realizados (recall "de verdade"); `next90` = as dos próximos 90 dias (antecipação) e é onde
 * fica a precisão da amostra de eventos do banco. Idempotente por dia: reexecutar reescreve.
 */
@Entity('event_coverage_snapshots')
@Index('UQ_event_coverage_snapshots_key', ['snapshotDate', 'scope', 'dimension', 'dimensionValue'], { unique: true })
@Index('IDX_event_coverage_snapshots_date', ['snapshotDate'])
export class EventCoverageSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Dia (São Paulo) da medição. */
  @Column({ type: 'varchar', length: 10 })
  snapshotDate: string;

  @Column({ type: 'varchar', length: 12 })
  scope: EventCoverageScope;

  @Column({ type: 'varchar', length: 12 })
  dimension: EventCoverageDimension;

  @Column({ type: 'varchar', length: 120, default: 'all' })
  dimensionValue: string;

  @Column({ type: 'int', default: 0 })
  referenceTotal: number;

  @Column({ type: 'int', default: 0 })
  referenceMatched: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  recallPct: number | null;

  @Column({ type: 'int', nullable: true })
  precisionSample: number | null;

  @Column({ type: 'int', nullable: true })
  precisionConfirmed: number | null;

  @Column({ type: 'int', nullable: true })
  precisionRefuted: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  precisionPct: number | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;
}
