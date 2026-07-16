import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity("email_confirmations")
export class EmailConfirmation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Relação com o usuário (sem precisar alterar User)
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user: User;

  @Column()
  code: string; // hash versionado; plaintext somente para compatibilidade legada

  @Column({ length: 64, default: "email_confirmation" })
  purpose: string;

  @Column()
  expiresAt: Date; // expiração do código

  @Column({ default: false })
  confirmed: boolean; // se o código já foi usado

  @Column({ type: "int", default: 0 })
  attemptCount: number;

  @Column({ type: "datetime", nullable: true })
  lockedUntil: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
