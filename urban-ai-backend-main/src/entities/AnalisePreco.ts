import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Address } from './addresses.entity';
import { Event } from './events.entity';
import { User } from './user.entity';

@Entity('analise_preco')
export class AnalisePreco {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // 📌 Endereço principal (sua propriedade)
  @ManyToOne(() => Address, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'endereco_id' })
  endereco: Address;

  // 📌 Evento relacionado
  @ManyToOne(() => Event, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evento_id' })
  evento: Event;

  // 📌 Usuário dono da propriedade
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_proprietario_id' })
  usuarioProprietario: User;

  // --- Resultados do cálculo ---
  @Column({ name: 'distancia_sua_propriedade', type: 'float' })
  distanciaSuaPropriedade: number;

  @Column({ name: 'distancia_propriedade_referencia', type: 'float' })
  distanciaPropriedadeReferencia: number;

  @Column({ name: 'preco_sugerido', type: 'decimal', precision: 10, scale: 2 })
  precoSugerido: number;

  @Column({ name: 'seu_preco_atual', type: 'decimal', precision: 10, scale: 2 })
  seuPrecoAtual: number;

  @Column({ name: 'diferenca_percentual', type: 'decimal', precision: 5, scale: 2 })
  diferencaPercentual: number;

  @Column({ name: 'recomendacao', type: 'varchar', length: 255 })
  recomendacao: string;

  @Column({ type: 'boolean', default: false })
  aceito: boolean;

  /**
   * Preço REAL que o anfitrião aplicou após a sugestão (centavos × 100 = R$).
   * Pode ser igual ao precoSugerido (aceitou cego) ou diferente (ajustou).
   * NULL enquanto o anfitrião não confirmar.
   *
   * Esse campo + `aceito=true` + `criadoEm` formam o ground truth do MAPE
   * real do motor — sem ele, não dá para validar a promessa "+30% receita".
   * Ver F6.1 Tier 3 do roadmap.
   */
  @Column({ name: 'preco_aplicado', type: 'decimal', precision: 10, scale: 2, nullable: true })
  precoAplicado: number | null;

  /** Quando o anfitrião confirmou ter aplicado (data de aceite real). */
  @Column({ name: 'aplicado_em', type: 'timestamp', nullable: true })
  aplicadoEm: Date | null;

  /**
   * Origem da aplicação:
   *  - 'manual_dashboard': anfitrião marcou no nosso dashboard, aplicou no canal sozinho
   *  - 'manual_off_platform': anfitrião disse que aplicou em outro lugar (auto-declaração)
   *  - 'stays_auto': pushado automaticamente via integração Stays (F6.4)
   *  - 'stays_user_accepted': pushado via Stays a partir da aceitação no dashboard
   */
  @Column({ name: 'origem_aplicacao', type: 'varchar', length: 32, nullable: true })
  origemAplicacao: string | null;

  // --- IA Reasoning ---
  @Column({ name: 'motivo_ia', type: 'text', nullable: true })
  motivo_ia: string;

  // --- Auditoria ---
  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
