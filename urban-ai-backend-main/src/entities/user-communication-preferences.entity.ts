import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_communication_preferences')
export class UserCommunicationPreferences {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36, unique: true })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'email_pricing', type: 'boolean', default: true })
  emailPricing: boolean;

  @Column({ name: 'push_pricing', type: 'boolean', default: true })
  pushPricing: boolean;

  @Column({ name: 'weekly_report', type: 'boolean', default: true })
  weeklyReport: boolean;

  @Column({ type: 'boolean', default: false })
  marketing: boolean;

  @Column({ name: 'stays_alerts', type: 'boolean', default: true })
  staysAlerts: boolean;

  @Column({ name: 'billing_alerts', type: 'boolean', default: true })
  billingAlerts: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
