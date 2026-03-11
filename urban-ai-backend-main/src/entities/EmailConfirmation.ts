import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { User } from "./user.entity";

@Entity("email_confirmations")
export class EmailConfirmation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Relação com o usuário (sem precisar alterar User)
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user: User;

  @Column()
  code: string; // código de confirmação

  @Column()
  expiresAt: Date; // expiração do código

  @Column({ default: false })
  confirmed: boolean; // se o código já foi usado

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
