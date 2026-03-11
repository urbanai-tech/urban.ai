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

  // --- Auditoria ---
  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
