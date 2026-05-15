import * as crypto from 'crypto';
import { Column, CreateDateColumn, Entity, Index, OneToMany, OneToOne, JoinColumn, PrimaryGeneratedColumn, UpdateDateColumn, ValueTransformer } from 'typeorm';
import { User } from './user.entity';
import { StaysListing } from './stays-listing.entity';

const STAYS_TOKEN_PREFIX = 'enc:v1:';

function getEncryptionKey(): Buffer | null {
  const raw = process.env.STAYS_TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;

  const trimmed = raw.trim();
  const decoded =
    /^[a-f0-9]{64}$/i.test(trimmed)
      ? Buffer.from(trimmed, 'hex')
      : Buffer.from(trimmed, 'base64');

  if (decoded.length === 32) {
    return decoded;
  }

  return crypto.createHash('sha256').update(trimmed).digest();
}

function shouldRequireEncryptionKey(): boolean {
  const env = process.env.APP_ENV || process.env.NODE_ENV;
  return env === 'production' || env === 'staging';
}

export const staysTokenTransformer: ValueTransformer = {
  to(value?: string | null): string | null {
    if (!value) return value ?? null;
    if (value.startsWith(STAYS_TOKEN_PREFIX)) return value;

    const key = getEncryptionKey();
    if (!key) {
      if (shouldRequireEncryptionKey()) {
        throw new Error('STAYS_TOKEN_ENCRYPTION_KEY is required to persist Stays tokens');
      }
      return value;
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [
      STAYS_TOKEN_PREFIX.slice(0, -1),
      iv.toString('base64url'),
      tag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join(':');
  },

  from(value?: string | null): string | null {
    if (!value) return value ?? null;
    if (!value.startsWith(STAYS_TOKEN_PREFIX)) return value;

    const key = getEncryptionKey();
    if (!key) {
      throw new Error('STAYS_TOKEN_ENCRYPTION_KEY is required to read encrypted Stays tokens');
    }

    const [, , ivRaw, tagRaw, ciphertextRaw] = value.split(':');
    if (!ivRaw || !tagRaw || !ciphertextRaw) {
      throw new Error('Invalid encrypted Stays token format');
    }

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivRaw, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextRaw, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  },
};

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
  @Column({ type: 'varchar', length: 2048, transformer: staysTokenTransformer })
  accessToken: string;

  @Column({ type: 'datetime', nullable: true })
  tokenExpiresAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  consentAcceptedAt: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  consentVersion: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  consentIp: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  consentUserAgent: string | null;

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
