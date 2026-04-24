import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

/**
 * Refresh token persistido para suportar rotation + revogação.
 *
 * Armazenamos apenas o hash (SHA-256) do token bruto — o token em si vive só
 * no cookie httpOnly do cliente. Um leak do banco não vaza sessões ativas.
 *
 * Cada linha pode ser:
 *   - válida (revokedAt NULL e expiresAt > now): usável em /auth/refresh
 *   - rotacionada (revokedAt preenchido com replacedBy pointer — não modelado
 *     explicitamente ainda, mas o campo revokedAt sinaliza o evento)
 *   - expirada naturalmente (expiresAt <= now)
 *   - revogada manualmente (logout, delete user, incident)
 */
@Entity('refresh_tokens')
@Index(['tokenHash'], { unique: true })
@Index(['user', 'revokedAt'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  user: User;

  /** SHA-256 hex do refresh token bruto. 64 chars. */
  @Column({ type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  revokedAt: Date | null;

  /** User-Agent e IP que originou o token — para auditoria. Opcional. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;
}
