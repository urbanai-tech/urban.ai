import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * IA-3b — âncora histórica de eventos recorrentes.
 *
 * Guarda, por evento canônico (chave = nome normalizado, ex.: "ccxp",
 * "lollapalooza brasil", "the town", "virada cultural"), o que já se sabe das
 * edições passadas: público realizado, ocupação real e o multiplicador que
 * funcionou. Assim uma edição NOVA (CCXP 2026) herda a âncora das anteriores
 * em vez de depender só do chute do LLM.
 *
 * Fontes de população:
 *  - `wikidata`  — importador SPARQL (público P1110 de edições anteriores).
 *  - `news`      — extração de notícias (Firecrawl), quando ligado.
 *  - `feedback`  — o próprio loop de resultado (ocupação/multiplicador real),
 *                  que ao longo das temporadas vira a fonte dominante.
 */
@Entity('event_historical_multiplier')
export class EventHistoricalMultiplier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nome normalizado do evento recorrente — chave de junção com events.normalizedName. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  canonicalName: string;

  /** Nome legível (última edição vista). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  displayName: string | null;

  /** Público realizado (mediana/máx das edições conhecidas). */
  @Column({ type: 'int', nullable: true })
  realAttendance: number | null;

  /** Ocupação real média observada nos imóveis durante o evento (0..1). */
  @Column({ type: 'float', nullable: true })
  realOccupancy: number | null;

  /** Multiplicador de preço que efetivamente funcionou (do feedback loop). */
  @Column({ type: 'float', nullable: true })
  realMultiplier: number | null;

  /** Média do eventDemandScore observado. */
  @Column({ type: 'float', nullable: true })
  avgDemandScore: number | null;

  /** Nº de observações agregadas (edições/amostras). */
  @Column({ type: 'int', default: 0 })
  sampleSize: number;

  /** Ano da edição mais recente considerada. */
  @Column({ type: 'int', nullable: true })
  lastYear: number | null;

  /** Origem predominante do dado: 'wikidata' | 'news' | 'feedback'. */
  @Column({ type: 'varchar', length: 16, default: 'wikidata' })
  source: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
