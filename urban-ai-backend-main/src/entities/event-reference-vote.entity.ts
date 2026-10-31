import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { EventReference } from './event-reference.entity';

export type EventReferenceValidatorKind = 'tavily' | 'serpapi' | 'firecrawl' | 'events_db' | 'judge';
export type EventReferenceVerdict = 'support' | 'confirm' | 'reject' | 'unsure';
export type EventReferenceExtractor = 'gemini' | 'anthropic' | 'none';

/**
 * Voto de um validador sobre uma referência. `validatorKey` é a chave de independência
 * (`web:dominio`, `db:fonte` ou `judge:modelo`): dois votos com a mesma chave valem como um só.
 * O trecho (`snippet`) e a URL ficam gravados para auditoria; nada de dado pessoal.
 */
@Entity('event_reference_votes')
@Index('UQ_event_reference_votes_ref_validator', ['referenceId', 'validatorKey'], { unique: true })
@Index('IDX_event_reference_votes_ref', ['referenceId'])
export class EventReferenceVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  referenceId: string;

  @ManyToOne(() => EventReference, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referenceId' })
  reference: EventReference;

  @Column({ type: 'varchar', length: 160 })
  validatorKey: string;

  @Column({ type: 'varchar', length: 16 })
  validatorKind: EventReferenceValidatorKind;

  @Column({ type: 'varchar', length: 16 })
  verdict: EventReferenceVerdict;

  @Column({ type: 'text', nullable: true })
  sourceUrl: string | null;

  @Column({ type: 'varchar', length: 16, default: 'none' })
  extractor: EventReferenceExtractor;

  @Column({ type: 'varchar', length: 255, nullable: true })
  observedName: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  observedDate: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  observedVenue: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  snippet: string | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;
}
