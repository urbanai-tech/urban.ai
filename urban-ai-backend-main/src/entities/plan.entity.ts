import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Tabela de planos.
 *
 * Modelo de cobrança (F6.5, ago/2026 →): cobrança **por imóvel**, com 4 ciclos
 * (mensal, trimestral, semestral, anual). Mensal é mais caro propositalmente
 * para empurrar para ciclos longos.
 *
 * Os campos `priceMonthly/Quarterly/Semestral/Annual` são valores **por imóvel,
 * por mês**, em string para preservar formato local (R$ 97,00 etc.). O valor
 * total cobrado ao Stripe é price × quantity (Stripe `line_items[].quantity`).
 *
 * Os campos legados `price`, `priceAnnual`, `stripePriceId`, `stripePriceIdAnnual`
 * são mantidos durante a janela de migração (grandfathering).
 */
@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  title: string;

  // ============= Legados (mensal/anual binário, pré-F6.5) =============
  // Mantidos para compatibilidade com Payments existentes; novos checkouts
  // devem usar a matriz de 4 ciclos abaixo.

  @Column({ nullable: true })
  price: string;

  @Column({ nullable: true })
  priceAnnual: string;

  @Column({ nullable: true })
  originalPrice: string;

  @Column({ nullable: true })
  originalPriceAnnual: string;

  @Column({ nullable: true })
  stripePriceId: string;

  @Column({ nullable: true })
  stripePriceIdAnnual: string;

  // ============= Matriz F6.5 (preço por imóvel, por mês equivalente) =============

  @Column({ nullable: true })
  priceMonthly: string;

  @Column({ nullable: true })
  priceQuarterly: string;

  @Column({ nullable: true })
  priceSemestral: string;

  @Column({ nullable: true })
  priceAnnualNew: string;

  @Column({ nullable: true })
  originalPriceMonthly: string;

  @Column({ nullable: true })
  originalPriceQuarterly: string;

  @Column({ nullable: true })
  originalPriceSemestral: string;

  @Column({ nullable: true })
  originalPriceAnnualNew: string;

  @Column({ nullable: true })
  stripePriceIdMonthly: string;

  @Column({ nullable: true })
  stripePriceIdQuarterly: string;

  @Column({ nullable: true })
  stripePriceIdSemestral: string;

  @Column({ nullable: true })
  stripePriceIdAnnualNew: string;

  /** Desconto % aplicado a cada ciclo vs. preço base mensal (apenas display). */
  @Column({ type: 'int', nullable: true })
  discountQuarterlyPercent: number;

  @Column({ type: 'int', nullable: true })
  discountSemestralPercent: number;

  @Column({ type: 'int', nullable: true })
  discountAnnualPercent: number;

  // ============= Display / metadata =============

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

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/** Helper de tipos para os 4 ciclos suportados. */
export type BillingCycle = 'monthly' | 'quarterly' | 'semestral' | 'annual';
