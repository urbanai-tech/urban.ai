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

    /**
     * Ciclo de cobrança do checkout que originou este Payment (F6.5).
     * Valores possíveis: 'monthly' | 'quarterly' | 'semestral' | 'annual'.
     * Campo legado `mode` continua espelhando o intervalo do Stripe ('month', 'year').
     */
    @Column({ type: 'varchar', length: 32, nullable: true })
    billingCycle: string;

    /**
     * Quantidade de imóveis contratados na assinatura (F6.5).
     * O Stripe cobra `price × listingsContratados`. Se o usuário tentar
     * cadastrar um (N+1)º imóvel, o Paywall oferece upsell de quantity.
     */
    @Column({ type: 'int', nullable: true, default: 1 })
    listingsContratados: number;

    /**
     * Nome do plano persistido para referência (starter | profissional | escala).
     * Útil para joins simples sem precisar pegar o Plan inteiro.
     */
    @Column({ type: 'varchar', length: 64, nullable: true })
    planName: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updatedAt: Date;
}
