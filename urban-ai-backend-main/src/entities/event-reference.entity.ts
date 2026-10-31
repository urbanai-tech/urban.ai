import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type EventReferenceStatus = 'candidato' | 'aprovado' | 'rejeitado' | 'conflito';
export type EventReferenceSize = 'grande' | 'medio' | 'pequeno';
export type EventReferenceOrigin = 'csv' | 'curadoria' | 'manual';

/**
 * Lista de referência ("verdade de campo") dos eventos de SP: o que deveria estar no radar.
 * Alimentada por CSV do admin e pela curadoria por agentes (ADR 0026). Só `aprovado` entra nas
 * métricas de recall; `conflito` e `candidato` esperam revisão humana. `fingerprint` (nome
 * normalizado + dia + venue) impede duplicar a mesma referência.
 */
@Entity('event_reference')
@Index('UQ_event_reference_fingerprint', ['fingerprint'], { unique: true })
@Index('IDX_event_reference_status', ['status'])
@Index('IDX_event_reference_date', ['dateKey'])
@Index('IDX_event_reference_venue_date', ['venueKey', 'dateKey'])
export class EventReference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  normalizedName: string;

  /** Chave do venue na configuração de curadoria (ex.: `allianz-parque`); null para venue fora da lista. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  venueKey: string | null;

  @Column({ type: 'varchar', length: 160 })
  venueName: string;

  @Column({ type: 'varchar', length: 255 })
  normalizedVenue: string;

  @Column({ type: 'datetime' })
  startsAt: Date;

  /** Dia do evento no calendário de São Paulo (`YYYY-MM-DD`). */
  @Column({ type: 'varchar', length: 10 })
  dateKey: string;

  @Column({ type: 'varchar', length: 80, default: 'São Paulo' })
  city: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  category: string | null;

  @Column({ type: 'varchar', length: 16, default: 'medio' })
  size: EventReferenceSize;

  @Column({ type: 'varchar', length: 16, default: 'candidato' })
  status: EventReferenceStatus;

  @Column({ type: 'varchar', length: 16, default: 'curadoria' })
  origin: EventReferenceOrigin;

  @Column({ type: 'varchar', length: 64 })
  fingerprint: string;

  /** URLs das evidências (as mesmas dos votos), para auditoria rápida na lista. */
  @Column({ type: 'simple-json', nullable: true })
  evidenceUrls: string[] | null;

  @Column({ type: 'int', default: 0 })
  votesSupport: number;

  @Column({ type: 'int', default: 0 })
  votesAgainst: number;

  /** `auto-consenso` (agentes) ou o id do usuário admin que decidiu. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  approvedBy: string | null;

  @Column({ type: 'datetime', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  decisionNote: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  conflictReason: string | null;

  /** Casamento com `events` (job diário). */
  @Column({ type: 'varchar', length: 36, nullable: true })
  matchedEventId: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  matchScore: number | null;

  @Column({ type: 'datetime', nullable: true })
  matchedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lastMatchCheckAt: Date | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;
}
