import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Histórico de preço/ocupação de um anúncio externo (`external_listing`) — uma linha por
 * anúncio e data de observação. Alimenta sazonalidade, efeito de eventos e a tendência de
 * 30 dias do mercado por bairro (ADR 0028). Datasets sem série temporal não geram linhas aqui.
 */
@Entity('market_listing_observation')
@Index('UQ_market_obs_listing_date', ['externalListingId', 'observedOn'], { unique: true })
@Index('IDX_market_obs_date', ['observedOn'])
export class MarketListingObservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** `external_listing.id` (sem FK: a limpeza de anúncios apaga as observações pelo job, não em cascata). */
  @Column({ type: 'varchar', length: 36 })
  externalListingId: string;

  /** Data da observação (YYYY-MM-DD). */
  @Column({ type: 'date' })
  observedOn: string;

  /** Diária em centavos. */
  @Column({ type: 'int', nullable: true })
  priceCents: number | null;

  /** Ocupação no dia/período (0 a 1). */
  @Column({ type: 'float', nullable: true })
  occupancyRate: number | null;
}
