import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';
import { StaysListing } from './stays-listing.entity';
import { AnalisePreco } from './AnalisePreco';

/**
 * Log auditável de cada push de preço feito ao canal externo (Stays/Airbnb).
 *
 * Fonte única para:
 * - Provar ao anfitrião por que o preço mudou em tal data
 * - Atender eventuais disputas com Airbnb ("você aplicou preço sem minha
 *   autorização") — comprovamos consentimento + log da chamada
 * - Métricas de ROI por imóvel (quantas sugestões foram aplicadas vs
 *   ignoradas, quanto o preço realmente variou)
 * - Rollback em caso de acidente (guardamos o preço anterior)
 *
 * Retenção LGPD: 24 meses (ver politica-privacidade-interna.md §7).
 */
@Entity('price_updates')
@Index(['listing', 'targetDate'])
@Index(['user', 'createdAt'])
@Index(['analise'])
export class PriceUpdate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => StaysListing, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'stays_listing_id' })
  listing: StaysListing;

  /**
   * AnalisePreco que originou este push. Nullable porque o usuário pode
   * chamar um push manual fora do fluxo de recomendação.
   */
  @ManyToOne(() => AnalisePreco, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'analise_preco_id' })
  analise: AnalisePreco | null;

  /** Data do calendário a que o preço se aplica (YYYY-MM-DD em UTC). */
  @Column({ type: 'date' })
  targetDate: string;

  @Column({ type: 'int' })
  previousPriceCents: number;

  @Column({ type: 'int' })
  newPriceCents: number;

  /** Moeda ISO 4217 (ex.: BRL). */
  @Column({ type: 'varchar', length: 3, default: 'BRL' })
  currency: string;

  /**
   * Origem da decisão:
   * - ai_auto: modo autônomo, IA empurrou sem confirmação humana
   * - user_accepted: usuário clicou "aplicar" na sugestão do dashboard
   * - user_manual: usuário mudou o preço manualmente via nossa UI
   * - rollback: reverteu um push anterior (referência em rollbackOf)
   */
  @Column({ type: 'varchar', length: 32 })
  origin: 'ai_auto' | 'user_accepted' | 'user_manual' | 'rollback';

  /**
   * Status de execução do push no canal externo:
   * - pending: em fila
   * - success: Stays confirmou
   * - rejected: Stays recusou (ex.: listing inativo, preço fora da faixa)
   * - error: erro de rede/timeout; pode ser reprocessado
   */
  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: 'pending' | 'success' | 'rejected' | 'error';

  @Column({ type: 'varchar', length: 255, nullable: true })
  errorMessage: string | null;

  /** IP de quem iniciou (se user_accepted ou user_manual) — auditoria. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  /** Referência ao PriceUpdate que este rollback está desfazendo. */
  @ManyToOne(() => PriceUpdate, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'rollback_of_id' })
  rollbackOf: PriceUpdate | null;

  /**
   * Idempotency key — constituída por (listingId, targetDate, hash do body).
   * Duas chamadas com a mesma key não resultam em 2 pushes: a segunda
   * retorna o resultado da primeira. Evita retry duplicando atualização.
   */
  @Column({ type: 'varchar', length: 128, unique: true })
  idempotencyKey: string;

  @CreateDateColumn()
  createdAt: Date;
}
