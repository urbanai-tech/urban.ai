import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Event } from './events.entity';          // Corrigido
import { Address } from './addresses.entity';     // Corrigido
import { User } from './user.entity';

@Entity('analise_endereco_evento')
@Index(['evento', 'endereco', 'usuarioProprietario'])
export class AnaliseEnderecoEvento {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evento_id' })
  evento: Event;

  @ManyToOne(() => Address, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'endereco_id' })
  endereco: Address;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_proprietario_id' })
  usuarioProprietario: User;

  @Column({ name: 'distancia_metros', type: 'int' })
  distanciaMetros: number;

  @Column({ name: 'duracao_minutos', type: 'int' })
  duracaoSegundos: number;

  @Column({ name: 'transport_mode', type: 'varchar', length: 50 })
  transportMode: string;

  @Column({ name: 'enviado', type: 'boolean' })
  enviado: boolean;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;
}