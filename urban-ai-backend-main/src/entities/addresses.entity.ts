

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { ApiProperty } from "@nestjs/swagger";
import { User } from "../entities/user.entity";
import { List } from "./list.entity";

@Entity("addresses")
@Index(["list", "user"]) // Índice composto para consultas rápidas
export class Address {
  @ApiProperty({
    description: "Identificador único do endereço",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ApiProperty({
    description: "CEP do endereço",
    example: "21775-280",
    minLength: 8,
    maxLength: 9,
  })
  @Column({ length: 9 })
  @Index() // Índice para consultas por CEP
  cep: string;

  @ApiProperty({
    description: "Número do imóvel",
    example: "163",
  })
  @Column({ length: 20 })
  numero: string;

  @ApiProperty({
    description: "Logradouro (rua, avenida, etc.)",
    example: "Rua Cidade do Porto",
    required: false,
  })
  @Column({ nullable: true })
  logradouro: string;

  @ApiProperty({
    description: "Bairro",
    example: "Padre Miguel",
    required: false,
  })
  @Column({ nullable: true })
  bairro: string;

  @ApiProperty({
    description: "Cidade",
    example: "Rio de Janeiro",
    required: false,
  })
  @Column({ nullable: true })
  @Index() // Índice para consultas por cidade
  cidade: string;

  @ApiProperty({
    description: "Estado (UF)",
    example: "RJ",
    required: false,
  })
  @Column({ length: 2, nullable: true })
  estado: string;

  @ApiProperty({
    description: "Latitude geográfica do endereço",
    example: -23.54880000,
    required: false,
  })
  @Column({ type: "decimal", precision: 10, scale: 8, nullable: true })
  latitude: number;

  @ApiProperty({
    description: "Longitude geográfica do endereço",
    example: -46.63962000,
    required: false,
  })
  @Column({ type: "decimal", precision: 11, scale: 8, nullable: true })
  longitude: number;

  @ApiProperty({
    description: "Indica se o endereço está ativo",
    example: true,
  })
  @Column({ default: true })
  ativo: boolean;

  @ApiProperty({
    description: "Data de criação do registro",
  })
  @CreateDateColumn()
  created_at: Date;

  @ApiProperty({
    description: "Data da última atualização do registro",
  })
  @UpdateDateColumn()
  updated_at: Date;

  // Relacionamentos
  @ApiProperty({
    description: "Imóvel associado ao endereço",
    type: () => List,
  })
  @ManyToOne(() => List, { eager: true })
  @JoinColumn({ name: "list_id" })
  list: List;

  @ApiProperty({
    description: "Usuário proprietário do endereço",
    type: () => User,
  })
  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: "user_id" })
  user?: User;

  @Column({ type: "varchar", default: "running" })
  analisado: string;

  @Column({ type: "varchar", default: "no_id" })
  idAlertAirb: string;


  // Método utilitário para obter endereço formatado
  getEnderecoCompleto(): string {
    const partes = [
      this.logradouro ? `${this.logradouro}, ${this.numero}` : this.numero,
      this.bairro,
      this.cidade && this.estado
        ? `${this.cidade} - ${this.estado}`
        : this.cidade,
      `CEP: ${this.cep}`,
    ].filter(Boolean);

    return partes.join(", ");
  }

  // Método para verificar se endereço está completo
  isCompleto(): boolean {
    return !!(
      this.cep &&
      this.numero &&
      this.logradouro &&
      this.bairro &&
      this.cidade &&
      this.estado
    );
  }
}

