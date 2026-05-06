import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Região de cobertura geográfica do motor de eventos (F6.2 Plus + escala).
 *
 * Define onde o motor "enxerga" eventos. Um evento entra no pricing se:
 *   1. Está dentro do raio de algum Address ativo (default 80km), OU
 *   2. Está dentro de alguma `CoverageRegion` com status `active` ou `bootstrap`
 *
 * Caso contrário, é marcado `outOfScope=true` (preservado no DB pra auditoria
 * e reativação futura, mas ignorado pelo motor + Gemini).
 *
 * Modelo "Híbrido":
 *  - **Default automático**: cobertura segue imóveis cadastrados → quando o
 *    primeiro anfitrião do Rio cadastrar imóvel, eventos do Rio que entrarem
 *    automaticamente passam a ser válidos
 *  - **Override admin**: admin pode marcar regiões manualmente para:
 *    - `bootstrap`: cobrir antes de ter imóvel (estratégia de pré-aquecimento
 *      de dataset antes de abrir cidade)
 *    - `active`: forçar cobertura (ex: Grande SP enquanto temos poucos imóveis)
 *    - `inactive`: parar coleta numa região que não dá ROI
 *
 * Geometria: aceita 2 formatos exclusivos:
 *  - **Centro + raio** (mais simples): `centerLat`, `centerLng`, `radiusKm`
 *  - **Bounding box** (mais preciso): `minLat`, `maxLat`, `minLng`, `maxLng`
 *
 * O `CoverageService` aceita ambos.
 */
@Entity('coverage_regions')
@Index(['status'])
export class CoverageRegion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Nome humano. Ex: "Grande São Paulo", "Rio Metropolitano", "Belo Horizonte". */
  @Column({ type: 'varchar', length: 128 })
  name: string;

  /**
   * Status:
   *   - `active`: cobre eventos agora; eventos dentro entram no motor
   *   - `bootstrap`: cobre antes de ter imóvel cadastrado (pré-aquecimento de
   *     dataset; ainda assim aceita eventos pra construir histórico)
   *   - `inactive`: parou de cobrir; eventos novos viram outOfScope (mas
   *     históricos ficam no DB)
   */
  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: 'active' | 'bootstrap' | 'inactive';

  // ============== Geometria modo 1: centro + raio ==============

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  centerLat: number | null;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  centerLng: number | null;

  /** Raio em km. Pra cobertura padrão: 80km. */
  @Column({ type: 'int', nullable: true })
  radiusKm: number | null;

  // ============== Geometria modo 2: bounding box ==============

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  minLat: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  maxLat: number | null;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  minLng: number | null;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  maxLng: number | null;

  /** Notas internas — justificativa, plano de expansão, links. */
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
