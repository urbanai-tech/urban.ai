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


  @Column({ type: 'boolean', name: 'ativo', nullable: false, default: true })
  ativo: boolean;


  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  company?: string;

  @Column({ nullable: true, default: 'conservative' })
  pricingStrategy?: string; // 'conservative' | 'balanced' | 'aggressive' | 'ai'

  @Column({ nullable: true, default: 'notifications' })
  operationMode?: string; // 'notifications' | 'auto'

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  percentualInicial?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  percentualFinal?: number;

  @Column({ nullable: true })
  airbnbHostId?: string;

  /**
   * Papel do usuário na plataforma.
   *  - 'host' (default): anfitrião comum
   *  - 'admin': operador Urban AI (Gustavo, sócios, contractor)
   *  - 'support': leitura ampla mas sem mutação destrutiva
   *
   * Usado pelo `RolesGuard` para proteger endpoints administrativos.
   * Atribuição manual via SQL ou endpoint admin (após o primeiro admin existir).
   */
  @Column({ type: 'varchar', length: 16, default: 'host' })
  role: 'host' | 'admin' | 'support' | string;

  /**
   * Tracking do drip de onboarding (gap H9 do roadmap).
   * `onboardingDripLastDay` = ultimo dia D{N} enviado (1, 3, 7); null se nenhum.
   * `onboardingDripLastSentAt` = timestamp do ultimo envio bem-sucedido.
   *
   * Usado pelo `OnboardingDripService` para garantir idempotencia entre
   * execucoes diarias do cron e dar observability no admin.
   */
  @Column({ type: 'int', nullable: true, default: null })
  onboardingDripLastDay?: number | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  onboardingDripLastSentAt?: Date | null;
}
