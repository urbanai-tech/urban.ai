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
import { Address } from './addresses.entity';
import { User } from './user.entity';

export type PortfolioPricingStrategy = 'conservative' | 'balanced' | 'aggressive' | 'ai';

@Entity('portfolio_property_settings')
@Index(['address'], { unique: true })
@Index(['user', 'updatedAt'])
export class PortfolioPropertySetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Address, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'address_id' })
  address: Address;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 24, default: 'balanced' })
  strategy: PortfolioPricingStrategy;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
