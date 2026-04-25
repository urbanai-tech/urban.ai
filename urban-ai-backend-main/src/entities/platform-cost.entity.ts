import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Custos operacionais da plataforma Urban AI.
 *
 * Cada linha = uma fonte de custo (Railway, Mailersend, Gemini, Stripe,
 * Firecrawl, contractor, marketing, etc.). Permite o `/admin/finance`
 * calcular margem real, custo por imóvel e simular cenários de pricing.
 *
 * Categorias sugeridas:
 *  - 'infra': Railway, Upstash, AWS S3, GCP, Sentry, UptimeRobot
 *  - 'apis': RapidAPI, Gemini, Google Maps, api-football, Firecrawl
 *  - 'comms': Mailersend, SendGrid, WhatsApp Business
 *  - 'payments': Stripe (taxa)
 *  - 'people': contractor dev, agência marketing, suporte
 *  - 'marketing': Google Ads, Meta Ads, mídia direta, design
 *  - 'legal': advogado LGPD pontual, contadores
 *  - 'data': Airbtics, AirDNA, AirROI plano pago
 *  - 'other': eventuais, ajustes
 *
 * Recorrência:
 *  - 'monthly': cobrado todo mês com valor estável (Railway, Mailersend)
 *  - 'usage_based': varia conforme uso (Gemini, Maps); valor é estimativa
 *  - 'one_time': pago uma vez (advogado pontual, audit)
 *  - 'percentual': % de receita (Stripe ~5%; usar `percentOfRevenue`)
 */
@Entity('platform_costs')
@Index(['category', 'active'])
@Index(['recurrence'])
export class PlatformCost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'varchar', length: 32 })
  category: 'infra' | 'apis' | 'comms' | 'payments' | 'people' | 'marketing' | 'legal' | 'data' | 'other' | string;

  @Column({ type: 'varchar', length: 16, default: 'monthly' })
  recurrence: 'monthly' | 'usage_based' | 'one_time' | 'percentual' | string;

  /**
   * Valor mensal em centavos (BRL). Para `usage_based` é estimativa atualizada
   * manualmente pelo admin. Para `one_time`, representa o custo amortizado por
   * mês (ex: R$ 6k de advogado / 12 meses = R$ 500/mês).
   */
  @Column({ type: 'int', default: 0 })
  monthlyCostCents: number;

  /**
   * Para `recurrence='percentual'`: % de receita que vira custo.
   * Ex: Stripe taxa = 4.99 → percentOfRevenue = 4.99
   */
  @Column({ type: 'decimal', precision: 6, scale: 3, nullable: true })
  percentOfRevenue: number | null;

  @Column({ type: 'varchar', length: 3, default: 'BRL' })
  currency: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  /**
   * Indica se o custo escala diretamente com o número de imóveis ativos.
   * Útil para calcular "custo por imóvel". Ex: Mailersend cresce com volume
   * de e-mails (proporcional a usuários, e usuários ~ imóveis).
   */
  @Column({ type: 'boolean', default: false })
  scalesWithListings: boolean;

  /** Notas internas (contrato, fornecedor, próxima renovação) */
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
