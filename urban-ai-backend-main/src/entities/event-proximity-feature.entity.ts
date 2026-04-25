import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { List } from './list.entity';
import { Address } from './addresses.entity';

/**
 * Snapshot diário das features de proximidade a eventos para um imóvel.
 *
 * Hoje, quando o cron de análise roda, ele calcula travel time, distância,
 * relevância e USA na hora — depois descarta. Resultado: não temos série
 * temporal de "como o pipeline de eventos evoluiu para um imóvel".
 *
 * Esta tabela persiste, todos os dias, **as features agregadas** que o
 * motor usaria. Vira insumo direto do XGBoost (lag features, agregados
 * temporais) e do LSTM no Tier 4 do moat.
 *
 * Volume: ~N imóveis × 1 dia. Para 5k imóveis em SP = 5k linhas/dia,
 * 1.8M linhas/ano. Tamanho administrável.
 */
@Entity('event_proximity_features')
@Index(['list', 'snapshotDate'], { unique: true })
@Index(['snapshotDate'])
export class EventProximityFeature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Data de cálculo (YYYY-MM-DD UTC). */
  @Column({ type: 'date' })
  snapshotDate: string;

  @ManyToOne(() => List, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'list_id' })
  list: List;

  @ManyToOne(() => Address, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'address_id' })
  address: Address | null;

  // ============ Counts brutos ============

  /** Eventos dentro do raio do imóvel (default 5 km), em janela 7 dias à frente. */
  @Column({ type: 'int', default: 0 })
  eventsNext7d: number;

  /** Eventos em janela 14 dias. */
  @Column({ type: 'int', default: 0 })
  eventsNext14d: number;

  /** Eventos em janela 30 dias. */
  @Column({ type: 'int', default: 0 })
  eventsNext30d: number;

  /** Mega-eventos (relevância >= 80) nos próximos 30 dias. */
  @Column({ type: 'int', default: 0 })
  megaEventsNext30d: number;

  // ============ Métricas agregadas ============

  /** Distância (km) ao evento mais próximo nos próximos 14 dias. NULL se nenhum. */
  @Column({ type: 'decimal', precision: 8, scale: 3, nullable: true })
  closestEventDistanceKm: number | null;

  /** Travel time (min) ao evento mais próximo nos próximos 14 dias. */
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  closestEventTravelMin: number | null;

  /** Score médio de relevância dos eventos no raio (0-100). */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  avgRelevanceScore: number | null;

  /** Score máximo de relevância dos eventos no raio. */
  @Column({ type: 'int', nullable: true })
  maxRelevanceScore: number | null;

  /** Categoria predominante (show, esporte, conferência, etc). */
  @Column({ type: 'varchar', length: 32, nullable: true })
  predominantCategory: string | null;

  // ============ Features de oferta ============

  /**
   * # de imóveis comparáveis (mesma faixa de bedrooms/bairro) cadastrados
   * em SP — proxy de "concorrência local". Snapshot do dia.
   */
  @Column({ type: 'int', nullable: true })
  competitiveSupplyCount: number | null;

  /** Preço mediano dos comparáveis no raio (centavos). */
  @Column({ type: 'int', nullable: true })
  medianCompPriceCents: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
