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
}
