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

export type PricingRuleType =
  | 'weekend_uplift'
  | 'weekday_discount'
  | 'gap_night_filler'
  | 'last_minute'
  | 'length_of_stay'
  | 'min_stay_dynamic'
  | 'occupancy_floor'
  | 'event_uplift';

export type PricingRuleConfigItem = {
  type: PricingRuleType;
  enabled: boolean;
  params: Record<string, number>;
  label: string;
  description: string;
};

@Entity('pricing_rule_configs')
@Index(['address'], { unique: true })
@Index(['user', 'updatedAt'])
export class PricingRuleConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Address, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'address_id' })
  address: Address;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'simple-json' })
  rules: PricingRuleConfigItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
