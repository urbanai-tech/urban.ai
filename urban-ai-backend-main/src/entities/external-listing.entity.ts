import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Comp externo de treino (bootstrap do KNN) — anúncios reais de plataformas
 * públicas (hoje Inside Airbnb, CC BY 4.0). Não são imóveis dos nossos hosts;
 * servem para dar densidade de vizinhos ao classificador enquanto a base
 * própria (Address/List) é pequena. Multi-cidade: `city` separa os mercados.
 *
 * `availability365` é um proxy (ruidoso) de ocupação; `priceCents` + amenidades
 * derivam a `category` (label do KNN) via deriveCategory.
 */
@Entity('external_listing')
@Index('IDX_external_listing_city_geo', ['city', 'latitude', 'longitude'])
@Index('UQ_external_listing_source_ext', ['source', 'externalId'], { unique: true })
@Index('IDX_external_listing_source_collected', ['source', 'collectedAt'])
export class ExternalListing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** ID do anúncio na fonte (para dedup/upsert em reimportações). */
  @Column({ type: 'varchar', length: 32 })
  externalId: string;

  /** 'inside-airbnb' etc. */
  @Column({ type: 'varchar', length: 32, default: 'inside-airbnb' })
  source: string;

  /** Cidade/mercado (ex.: 'sao-paulo', 'rio-de-janeiro'). */
  @Column({ type: 'varchar', length: 48 })
  city: string;

  @Column({ type: 'date', nullable: true })
  snapshotDate: Date | null;

  @Column({ type: 'float' })
  latitude: number;

  @Column({ type: 'float' })
  longitude: number;

  /** Diária em centavos (parseada do preço da fonte). */
  @Column({ type: 'int', nullable: true })
  priceCents: number | null;

  @Column({ type: 'varchar', length: 48, nullable: true })
  roomType: string | null;

  @Column({ type: 'int', nullable: true })
  bedrooms: number | null;

  @Column({ type: 'float', nullable: true })
  bathrooms: number | null;

  @Column({ type: 'int', nullable: true })
  accommodates: number | null;

  @Column({ type: 'int', nullable: true })
  minNights: number | null;

  /** Dias disponíveis no ano — proxy (ruidoso) de ocupação. */
  @Column({ type: 'int', nullable: true })
  availability365: number | null;

  @Column({ type: 'int', nullable: true })
  numReviews: number | null;

  @Column({ type: 'float', nullable: true })
  reviewScore: number | null;

  @Column({ type: 'int', nullable: true })
  amenitiesCount: number | null;

  /** Categoria derivada (Economico/Standard/Premium) — label do KNN. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  category: string | null;

  // ===== Camada de fontes de mercado (ADR 0028) — todas opcionais =====

  /** Bairro conforme a fonte (para métricas e saúde por bairro). */
  @Column({ type: 'varchar', length: 96, nullable: true })
  neighborhood: string | null;

  /** Tipo de anúncio normalizado: entire_home | private_room | shared_room | hotel_room | other. */
  @Column({ type: 'varchar', length: 24, nullable: true })
  listingType: string | null;

  /** Ocupação observada no período (0 a 1), quando a fonte informa; null = só o proxy de availability365. */
  @Column({ type: 'float', nullable: true })
  occupancyRate: number | null;

  /** Id do anúncio no Airbnb, quando a fonte informa — chave de deduplicação entre fontes. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  airbnbListingId: string | null;

  /** Data em que a fonte coletou o dado (YYYY-MM-DD). */
  @Column({ type: 'date', nullable: true })
  collectedAt: Date | null;

  /**
   * Licença do dado: cc_by_4 | licensed_display_aggregate | licensed_internal_only | unknown.
   * Define se pode ser exibido ao cliente (agregado) ou só usado internamente.
   */
  @Column({ type: 'varchar', length: 32, nullable: true })
  license: string | null;

  /** Lote de importação que gravou/atualizou a linha (auditoria). */
  @Column({ type: 'varchar', length: 36, nullable: true })
  ingestBatchId: string | null;
}
