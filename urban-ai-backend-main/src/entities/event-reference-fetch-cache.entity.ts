import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Cache por URL/consulta e dia da curadoria (teto de custo, ADR 0026): guarda o resultado já
 * EXTRAÍDO (lista de candidatos em JSON), não o conteúdo da página. Entradas com mais de
 * poucos dias são removidas a cada execução.
 */
@Entity('event_reference_fetch_cache')
@Index('UQ_event_reference_fetch_cache_key', ['cacheKey'], { unique: true })
@Index('IDX_event_reference_fetch_cache_day', ['day'])
export class EventReferenceFetchCache {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** sha1(provedor | url-ou-consulta | dia). */
  @Column({ type: 'varchar', length: 64 })
  cacheKey: string;

  @Column({ type: 'varchar', length: 10 })
  day: string;

  @Column({ type: 'varchar', length: 16 })
  provider: string;

  @Column({ type: 'text' })
  payload: string;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;
}
