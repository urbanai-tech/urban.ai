import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'title_button', nullable: true })
  titleButton?: string;

  @Column({ name: 'redirect_to', nullable: true })
  redirectTo?: string;

  @Column({ type: 'boolean', default: false })
  sent: boolean;

  @Column({ type: 'boolean', default: false })
  opened: boolean;

  @Column({ type: 'boolean', name: 'send_email', default: false })
  sendEmail: boolean;

  // Relacionamento: cada notificação pertence a um usuário
  @ManyToOne(() => User, (user) => user.notifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
