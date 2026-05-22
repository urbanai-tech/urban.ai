import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

export type AskUrbanCitation = {
  id: string;
  label: string;
  url?: string;
};

@Entity('ask_urban_messages')
@Index(['user', 'createdAt'])
@Index(['conversationId'])
export class AskUrbanMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 64 })
  conversationId: string;

  @Column({ type: 'varchar', length: 16 })
  role: 'user' | 'assistant';

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'simple-json', nullable: true })
  citations: AskUrbanCitation[] | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  feedback: 'up' | 'down' | null;

  @CreateDateColumn()
  createdAt: Date;
}
