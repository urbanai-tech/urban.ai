import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { StaysAccount } from './stays-account.entity';
import { List } from './list.entity';

/**
 * Ligação 1:1 entre uma `List` (imóvel interno Urban AI) e um listing Stays.
 *
 * Um mesmo usuário pode ter N imóveis, e cada imóvel mapeia para 1 listing
 * Stays (o Stays pode, por sua vez, espelhar para Airbnb + Booking + Vrbo,
 * mas para nós isso é transparente — pushamos preço para o listing Stays
 * e ele replica).
 *
 * Se o anfitrião tiver imóveis na Urban AI que NÃO têm listing Stays
 * correspondente, simplesmente não criamos linha aqui — o modo autônomo
 * é desativado por imóvel, não por conta.
 */
@Entity('stays_listings')
@Index(['staysListingId'], { unique: true })
@Index(['account', 'propriedade'])
export class StaysListing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => StaysAccount, (a) => a.listings, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'stays_account_id' })
  account: StaysAccount;

  /**
   * Imóvel interno Urban AI (entidade List). Nullable = listing Stays que
   * ainda não foi casado com nenhum imóvel Urban AI (pode acontecer se o
   * anfitrião conectou mas ainda não cadastrou o imóvel na Urban AI).
   */
  @ManyToOne(() => List, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'propriedade_id' })
  propriedade: List | null;

  /**
   * ID do listing no Stays (formato Stays — string alfanumérica).
   */
  @Column({ type: 'varchar', length: 64 })
  staysListingId: string;

  /**
   * Dados cacheados da última sync — título, endereço curto, etc.
   * Útil para exibir no painel sem bater na API Stays a cada render.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  shortAddress: string | null;

  @Column({ type: 'int', nullable: true })
  basePriceCents: number | null;

  /**
   * Flag por listing — o anfitrião pode escolher quais imóveis usam o modo
   * autônomo e quais ficam em recomendação manual, independente do
   * `user.operationMode` global (que vira default).
   */
  @Column({ type: 'varchar', length: 32, default: 'inherit' })
  operationMode: 'inherit' | 'notifications' | 'auto';

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
