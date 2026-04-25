import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { List } from './list.entity';
import { Address } from './addresses.entity';

/**
 * Snapshot diário do preço de UM imóvel (próprio ou comp da vizinhança).
 *
 * Esta tabela é o **coração do dataset proprietário** da Urban AI.
 *
 * Contexto: até hoje só gravávamos preço quando havia análise gerada (ou
 * seja, imóvel × evento próximo). Com `PriceSnapshot` capturamos diariamente
 * o preço de **todos** os imóveis monitorados — próprios E comps que aparecem
 * nas análises — virando histórico contínuo que alimenta:
 *   - Treino XGBoost com séries reais
 *   - Backtesting de qualidade (MAPE) sobre dados próprios
 *   - Detecção de tendência por bairro
 *   - Validação de "+30% receita" (Tier 4 do roadmap F6.1)
 *
 * Origem possível de uma linha:
 *   - 'self_cron': cron diário varre imóveis cadastrados e snapshotea
 *   - 'comp_extraction': comps coletados durante análise foram persistidos
 *   - 'manual_import': import via script (AirROI, Base dos Dados)
 *   - 'stays_sync': sincronização com Stays para imóveis conectados
 *
 * Retenção: indefinida (dataset cresce com o tempo, vira ativo). Quando
 * passar de 12 meses por imóvel + 200 imóveis, atinge o gate do Tier 2.
 */
@Entity('price_snapshots')
@Index(['snapshotDate', 'externalListingId'])
@Index(['list', 'snapshotDate'])
@Index(['address', 'snapshotDate'])
@Index(['origin', 'snapshotDate'])
export class PriceSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Data do snapshot (YYYY-MM-DD UTC). 1 linha = 1 dia × 1 imóvel. */
  @Column({ type: 'date' })
  snapshotDate: string;

  /** Imóvel interno (List) — preenchido para snapshots de imóveis cadastrados. */
  @ManyToOne(() => List, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'list_id' })
  list: List | null;

  /** Endereço associado, para enriquecimento espacial sem precisar do List inteiro. */
  @ManyToOne(() => Address, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'address_id' })
  address: Address | null;

  /**
   * ID externo (Airbnb listingID, AirROI id, etc.). Usado para rastrear
   * comps e imports. Pode coincidir com `list.id_do_anuncio` quando o
   * imóvel próprio também tem o ID Airbnb.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  externalListingId: string | null;

  /** Centavos. Sempre BRL salvo `currency` indicando outra. */
  @Column({ type: 'int' })
  priceCents: number;

  @Column({ type: 'varchar', length: 3, default: 'BRL' })
  currency: string;

  /**
   * Quando aplicável, preço **realmente aplicado** pelo anfitrião após
   * uma recomendação aceita (vs `priceCents` que é o preço observado).
   * Útil para medir MAPE real e o "uplift" praticado.
   */
  @Column({ type: 'int', nullable: true })
  appliedPriceCents: number | null;

  /** Origem deste snapshot (auditoria + filtro em treino). */
  @Column({ type: 'varchar', length: 32 })
  origin: 'self_cron' | 'comp_extraction' | 'manual_import' | 'stays_sync' | string;

  /**
   * Snapshot de features que existiam naquele dia (lat/lng não muda mas
   * eventos próximos sim, então persistir o nº de eventos próximos no dia
   * vira feature temporal valiosa para o ML).
   */
  @Column({ type: 'int', nullable: true })
  nearbyEventsCount: number | null;

  @Column({ type: 'int', nullable: true })
  bedrooms: number | null;

  @Column({ type: 'int', nullable: true })
  bathrooms: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  similarityScore: number | null; // só para origin='comp_extraction'

  @Column({ type: 'varchar', length: 64, nullable: true })
  bairro: string | null;

  /**
   * Marcador de qualidade — true quando o snapshot tem todas as features
   * necessárias para entrar em treino. False = útil para inspeção mas não
   * para fit do modelo.
   */
  @Column({ type: 'boolean', default: false })
  trainingReady: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
