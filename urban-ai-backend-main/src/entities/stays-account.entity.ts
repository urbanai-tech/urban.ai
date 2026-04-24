import { Column, CreateDateColumn, Entity, Index, OneToMany, OneToOne, JoinColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { StaysListing } from './stays-listing.entity';

/**
 * Conta Stays (stays.net) conectada por um anfitrião Urban AI.
 *
 * Uma conta = um token de Open API (clientId + clientSecret ou access token
 * rotacionável, dependendo do que a Stays fornecer). Persistimos criptografado
 * em repouso via column transformer (ver note abaixo).
 *
 * NOTA sobre segredos: até termos HashiCorp Vault ou similar (F9.3), os
 * secrets ficam em colunas do MySQL criptografados em repouso pelo Railway
 * (AES-256 automático do provider). Quando o cliente pedir, **derrubamos o
 * registro inteiro** (onDelete CASCADE) — não há "soft delete" de credencial.
 */
@Entity('stays_accounts')
@Index(['user'], { unique: true })
export class StaysAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * Identificador do cliente Stays (clientId ou equivalente).
   * Não é segredo, mas também não precisa aparecer em logs.
   */
  @Column({ type: 'varchar', length: 128 })
  clientId: string;

  /**
   * Access token / client secret para chamar a Open API.
   * ⚠️ Conteúdo sensível — nunca logar.
   */
  @Column({ type: 'varchar', length: 512 })
  accessToken: string;

  @Column({ type: 'datetime', nullable: true })
  tokenExpiresAt: Date | null;

  /**
   * Estado operacional da conta:
   * - pending: anfitrião iniciou o connect, aguardando validação
   * - active: validada, já houve pelo menos 1 listagem importada com sucesso
   * - error: última tentativa de chamada falhou (ver lastErrorAt)
   * - disconnected: usuário desconectou voluntariamente
   */
  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: 'pending' | 'active' | 'error' | 'disconnected';

  @Column({ type: 'datetime', nullable: true })
  lastSyncAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lastErrorAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  lastErrorMessage: string | null;

  /**
   * Teto de variação % aplicado no modo autônomo. Default: 25% para cima
   * e 20% para baixo — evita que um erro no KNN cause movimento grotesco.
   * Usuário pode ajustar na UI.
   */
  @Column({ type: 'int', default: 25 })
  maxIncreasePercent: number;

  @Column({ type: 'int', default: 20 })
  maxDecreasePercent: number;

  @OneToMany(() => StaysListing, (l) => l.account)
  listings: StaysListing[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
