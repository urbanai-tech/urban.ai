import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  price: string;

  @Column({ nullable: true })
  originalPrice: string;

  @Column({ nullable: true })
  discountBadge: string;

  @Column({ nullable: true })
  highlightBadge: string;

  @Column({ nullable: true })
  period: string;

  @Column('simple-array')
  features: string[];

  @Column({ type: 'int', nullable: true })
  propertyLimit: number;

  @Column({ default: false })
  isCustomPrice: boolean;

  @Column({ nullable: true })
  stripePriceId: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
