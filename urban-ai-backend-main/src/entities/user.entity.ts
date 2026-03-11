import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  // …
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Address } from './addresses.entity';
import { Notification } from './notification.entity';


@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;


  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];


  @Column()
  username: string;

  @Column({ unique: true })
  email: string;



  @Column()
  @Exclude()
  password: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  // → Nova coluna para distância em km
  @Column({ type: 'double', name: 'distance_km', nullable: true, default: 30 })
  distanceKm: number;


  @Column({ type: 'boolean', name: 'ativo', nullable: false, default: false })
  ativo: boolean;


  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  company?: string;
}
