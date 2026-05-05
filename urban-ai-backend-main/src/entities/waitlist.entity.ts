import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Lista de espera de pré-lançamento (F8.2).
 *
 * Quando `PRELAUNCH_MODE=true` no backend, `POST /auth/register` desvia para
 * criar uma `Waitlist` em vez de uma `User`. Com isso conseguimos:
 *  - Mostrar a tela de login real (users existentes seguem entrando)
 *  - Capturar demanda de novos interessados sem expor o sistema
 *  - Construir lista priorizada para o beta fechado da F7
 *
 * `position` é gerado pelo banco via AUTO_INCREMENT — sem race condition entre
 * inscrições simultâneas. Usado para mostrar "você é o #N na fila".
 *
 * `referralCode` é gerado no service ao criar a row (8 chars URL-safe).
 * `referredBy` aponta pro `referralCode` de quem indicou (nullable). Quando
 * usado, sobe a posição efetiva do indicador (lógica no service).
 */
@Entity('waitlist')
@Index(['email'], { unique: true })
@Index(['referralCode'], { unique: true })
@Index(['position'])
@Index(['source'])
export class Waitlist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Posição na fila — INT autoincrement, gerado pelo banco. */
  @Column({ type: 'int', unique: true })
  @Generated('increment')
  position: number;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone: string | null;

  /**
   * Origem do cadastro — útil para medir conversão por canal:
   *  - 'landing-pre' (página /lancamento)
   *  - 'home' (form na home)
   *  - 'campaign-meta', 'campaign-google', 'organic', 'partner-stays', etc.
   */
  @Column({ type: 'varchar', length: 64, default: 'unknown' })
  source: string;

  /** Código próprio da entry, formato URL-safe 8 chars (ex: 'k7m2x9pq'). */
  @Column({ type: 'varchar', length: 16 })
  referralCode: string;

  /** Code de quem indicou esta entry (lookup contra outro `referralCode`). */
  @Column({ type: 'varchar', length: 16, nullable: true })
  referredBy: string | null;

  /**
   * Quantas pessoas usaram o `referralCode` desta entry como `referredBy`.
   * Cache para não precisar COUNT em cada exibição. Recalculado quando uma
   * referral nova chega.
   */
  @Column({ type: 'int', default: 0 })
  referralsCount: number;

  /**
   * Status da entrada:
   *  - 'pending': aguardando convite
   *  - 'invited': admin clicou "Convidar" e magic link foi enviado
   *  - 'converted': user clicou no magic link, virou User real
   *  - 'declined': user pediu pra ser removido (ou bounce de email)
   */
  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: 'pending' | 'invited' | 'converted' | 'declined';

  @Column({ type: 'datetime', nullable: true })
  invitedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  convertedAt: Date | null;

  /**
   * Token único do magic link de convite (NULL até o admin convidar).
   * Expira em 7 dias — checagem feita no controller de aceite.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  inviteToken: string | null;

  @Column({ type: 'datetime', nullable: true })
  inviteTokenExpiresAt: Date | null;

  /** IP de origem do cadastro (auditoria + antifraude). */
  @Column({ type: 'varchar', length: 45, nullable: true })
  signupIp: string | null;

  /** UA do navegador no cadastro. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  /** Notas internas do admin (motivo de prioridade, contexto). */
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
