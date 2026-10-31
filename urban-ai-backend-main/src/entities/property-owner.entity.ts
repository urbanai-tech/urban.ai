import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Proprietário de imóvel(is) cadastrado pelo anfitrião (ADR 0027). NÃO é conta nem usuário:
 * é um terceiro que só recebe o relatório mensal. O anfitrião é quem responde pelo
 * compartilhamento (declaração de base legal registrada em `consent*`).
 *
 * Retenção: some junto com a conta do anfitrião (CASCADE) ou quando o anfitrião o remove.
 */
@Entity('property_owners')
@Index('UQ_property_owners_user_email', ['userId', 'email'], { unique: true })
@Index('UQ_property_owners_unsubscribe_ref', ['unsubscribeRef'], { unique: true })
export class PropertyOwner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  /** Sempre em minúsculas. */
  @Column({ type: 'varchar', length: 254 })
  email: string;

  /** Preferência do anfitrião: enviar o relatório mensal por e-mail. */
  @Column({ name: 'monthly_report_enabled', type: 'boolean', default: true })
  monthlyReportEnabled: boolean;

  /** Versão do texto de declaração aceito pelo anfitrião (ver owner-report.constants). */
  @Column({ name: 'consent_version', type: 'varchar', length: 48 })
  consentVersion: string;

  @Column({ name: 'consent_accepted_at', type: 'datetime', precision: 6 })
  consentAcceptedAt: Date;

  /** IP real (`req.ip`) de quem declarou. */
  @Column({ name: 'consent_ip', type: 'varchar', length: 64, nullable: true })
  consentIp: string | null;

  /** O próprio proprietário pediu para não receber (link de descadastro). O anfitrião não desfaz. */
  @Column({ name: 'unsubscribed_at', type: 'datetime', precision: 6, nullable: true })
  unsubscribedAt: Date | null;

  /** Referência opaca (não é o ID) do token de descadastro; o token só vale com a assinatura HMAC. */
  @Column({ name: 'unsubscribe_ref', type: 'varchar', length: 32 })
  unsubscribeRef: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
