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
import { List } from './list.entity';
import { Address } from './addresses.entity';
import { User } from './user.entity';

/**
 * Histórico de ocupação por imóvel × data.
 *
 * Hoje o motor passa `ocupacaoReferencia: 0` HARDCODED em
 * `propriedade.service.ts:1402`. Sem ocupação real:
 *  - O cálculo de uplift é cego (não dá para dizer "+30% receita real")
 *  - O ML não pode aprender padrões de demanda (sazonalidade, eventos
 *    × ocupação, dia da semana × ocupação)
 *  - F7.1 (3 cases auditados) fica impossível
 *
 * Esta tabela resolve o gap. Cada linha representa "imóvel X no dia Y
 * tinha status Z". Status pode vir de 4 origens:
 *  - 'manual': anfitrião marca via UI (até integração Stays fechar)
 *  - 'stays_sync': importado via Stays Reservations API (F6.4 + Tier 4)
 *  - 'airbnb_calendar': scraping do calendário público do Airbnb (cinza juridicamente — usar com cuidado)
 *  - 'inferred': estimativa via histórico (ex.: nights booked / disponíveis)
 *
 * Retenção: indefinida — é o ground truth da promessa "+30% receita".
 */
@Entity('occupancy_history')
@Index(['list', 'date'], { unique: true })
@Index(['user', 'date'])
@Index(['origin', 'date'])
export class OccupancyHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Data do calendário (YYYY-MM-DD UTC). 1 linha = 1 dia × 1 imóvel. */
  @Column({ type: 'date' })
  date: string;

  @ManyToOne(() => List, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'list_id' })
  list: List;

  @ManyToOne(() => Address, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'address_id' })
  address: Address | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * Status no calendário do anfitrião:
   *  - 'booked': reservado (gerou receita)
   *  - 'available': disponível mas sem reserva
   *  - 'blocked': bloqueado pelo anfitrião (manutenção, uso pessoal)
   *  - 'unknown': sem informação ainda
   */
  @Column({ type: 'varchar', length: 16, default: 'unknown' })
  status: 'booked' | 'available' | 'blocked' | 'unknown';

  /** Receita real daquela noite, em centavos. NULL quando não-bookado ou desconhecido. */
  @Column({ type: 'int', nullable: true })
  revenueCents: number | null;

  /** Preço listado naquele dia (snapshot ligado ao PriceSnapshot). Centavos. */
  @Column({ type: 'int', nullable: true })
  listedPriceCents: number | null;

  @Column({ type: 'varchar', length: 3, default: 'BRL' })
  currency: string;

  /** Origem do dado — auditoria + filtro em treino ML. */
  @Column({ type: 'varchar', length: 32 })
  origin: 'manual' | 'stays_sync' | 'airbnb_calendar' | 'inferred' | string;

  /**
   * Para origin='stays_sync': ID da reserva externa (cross-ref).
   * Útil para reconciliar updates posteriores (cancelamento, alteração).
   */
  @Column({ type: 'varchar', length: 128, nullable: true })
  externalReservationId: string | null;

  /** Quantidade de noites da reserva (1 quando coincide com a data). */
  @Column({ type: 'int', nullable: true })
  nightsBooked: number | null;

  /**
   * Marca se este registro é candidato a entrar em treino ML.
   * Critérios: status='booked' OU 'available' (sabemos que não vendeu).
   * 'unknown' e 'blocked' ficam fora.
   */
  @Column({ type: 'boolean', default: false })
  trainingReady: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
