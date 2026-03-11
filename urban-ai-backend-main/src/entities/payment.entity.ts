import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './user.entity';


@Entity()
export class Payment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'varchar',
        length: 20,
        default: 'pending',  // padrão como string mesmo
    })
    status: string;

    @Column({ type: 'timestamp', nullable: true })
    expireDate: Date;

    @Column({ type: 'timestamp', nullable: true })
    startDate: Date;

    @Column({ nullable: true })
    customerId: string; // ID do cliente no Stripe (cus_xxx)

    @Column({ nullable: true })
    subscriptionId: string; // ID da subscription no Stripe

    @Column({ type: 'varchar', length: 50, nullable: true })
    mode: string; // Ex: 'subscription', 'payment'

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updatedAt: Date;
}
