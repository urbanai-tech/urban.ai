import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Event } from './events.entity';

/** Tipos de registro do histórico de um evento (ver `evento/event-change-detector.ts`). */
export type EventChangeType =
  | 'first_seen'
  | 'rescheduled'
  | 'venue_changed'
  | 'url_changed'
  | 'cancelled'
  | 'postponed'
  | 'possibly_cancelled'
  | 'reappeared';

/**
 * Histórico de mudanças de um evento: a primeira vez que entrou (`first_seen`, base do lead time) e
 * as mudanças relevantes entre ingestões (data, venue, URL, status), além de "possivelmente
 * cancelado" (sumiu da fonte) e "reapareceu". Só acrescenta linhas; o evento nunca é apagado nem
 * duplicado por causa de uma mudança.
 */
@Entity('event_change_history')
@Index('IDX_event_change_history_event', ['eventId', 'detectedAt'])
@Index('IDX_event_change_history_type', ['changeType', 'detectedAt'])
@Index('IDX_event_change_history_detected', ['detectedAt'])
export class EventChangeHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  eventId: string;

  @ManyToOne(() => Event, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column({ type: 'varchar', length: 24 })
  changeType: EventChangeType;

  /** Campo afetado: dataInicio | venue | url | status | lastSeenAt. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  field: string | null;

  @Column({ type: 'text', nullable: true })
  oldValue: string | null;

  @Column({ type: 'text', nullable: true })
  newValue: string | null;

  /** Fonte que originou a observação (quando houve). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  source: string | null;

  @Column({ type: 'datetime', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
  detectedAt: Date;

  @Column({ type: 'simple-json', nullable: true })
  meta: Record<string, unknown> | null;
}
