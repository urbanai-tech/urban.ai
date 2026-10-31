import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Registro de cada importação de dataset de mercado (licenciado ou Inside Airbnb): quem, quando,
 * de qual arquivo, com qual licença e o resultado. Sustenta a tela de saúde das fontes e a
 * trilha de auditoria de licença (ADR 0028). Não guarda o conteúdo do arquivo.
 */
@Entity('market_ingest_log')
@Index('IDX_market_ingest_source_created', ['source', 'createdAt'])
export class MarketIngestLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Valor de `external_listing.source` gravado (ex.: licensed:airroi, inside-airbnb). */
  @Column({ type: 'varchar', length: 32 })
  source: string;

  /** Mercado/cidade do lote (slug). */
  @Column({ type: 'varchar', length: 48 })
  city: string;

  /** Licença atribuída ao lote. */
  @Column({ type: 'varchar', length: 32 })
  license: string;

  /** Data de coleta declarada do dataset (YYYY-MM-DD). */
  @Column({ type: 'date', nullable: true })
  collectedAt: Date | null;

  /** Nome do arquivo enviado (só o nome, sem caminho). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  @Column({ type: 'int', default: 0 })
  rowsParsed: number;

  @Column({ type: 'int', default: 0 })
  rowsImported: number;

  @Column({ type: 'int', default: 0 })
  rowsSkipped: number;

  @Column({ type: 'int', default: 0 })
  observationsImported: number;

  /** Usuário admin que importou (null para importação por script). */
  @Column({ type: 'varchar', length: 36, nullable: true })
  importedByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
