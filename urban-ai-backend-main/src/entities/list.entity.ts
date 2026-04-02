// src/entities/list.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { ApiProperty } from "@nestjs/swagger";
import { User } from "./user.entity";

@Entity("list")
export class List {
  @ApiProperty({ description: "Identificador único do registro", example: 1 })
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ApiProperty({ description: "Título do imóvel", example: "Apartamento Copacabana" })
  @Column()
  titulo: string;

  @ApiProperty({ description: "ID do anúncio na API", example: "abc123" })
  @Column()
  id_do_anuncio: string;

  @ApiProperty({
    description: "URL da imagem principal do imóvel",
    example:
      "https://a0.muscache.com/im/pictures/miso/Hosting-1402348664997542800/original/086e1eb7-4e2f-48e9-a299-042f8c794360.jpeg?aki_policy=large",
  })
  @Column({ name: "picture_url", nullable: true })
  pictureUrl: string;

  @ApiProperty({ description: "Indica se o anúncio está ativo", example: true })
  @Column({ default: true })
  ativo: boolean;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: "user_id" })
  user: User;

  // ===== NOVOS CAMPOS DE PREÇO =====
  @ApiProperty({ description: "Preço formatado", example: "R$774" })
  @Column({ nullable: true })
  priceText: string;

  @ApiProperty({ description: "Preço bruto", example: 774 })
  @Column({ type: "float", nullable: true })
  raw: number;

  @ApiProperty({ description: "Moeda do preço", example: "R$" })
  @Column({ nullable: true })
  currency: string;

  @ApiProperty({ description: "Data de check-in", example: "2025-09-26" })
  @Column({ type: "date", nullable: true })
  checkIn: string;

  @ApiProperty({ description: "Data de check-out", example: "2025-09-28" })
  @Column({ type: "date", nullable: true })
  checkOut: string;

  @ApiProperty({ description: "Status do anúncio", example: "disponível" })
  @Column({ nullable: true })
  status: string;

  @ApiProperty({ description: "Preço por diária", example: 387 })
  @Column({ type: "float", nullable: true })
  dailyPrice: number;

  // ===== CAMPOS ADICIONAIS DO RETORNO DA API =====
  @ApiProperty({ description: "Número de hóspedes", example: 2 })
  @Column({ type: "int", nullable: true })
  hospedes: number;

  @ApiProperty({ description: "Número de quartos", example: 1 })
  @Column({ type: "int", nullable: true })
  quartos: number;

  @ApiProperty({ description: "Número de camas", example: 1 })
  @Column({ type: "int", nullable: true })
  camas: number;

  @ApiProperty({ description: "Número de banheiros", example: 1 })
  @Column({ type: "int", nullable: true })
  banheiros: number;

  // ===== CAMPOS DE ENRIQUECIMENTO (SCRAPING DIRETO) =====
  @ApiProperty({ description: "Rating do imóvel no Airbnb", example: 4.65 })
  @Column({ type: "float", nullable: true })
  rating: number;

  @ApiProperty({ description: "Tipo do imóvel", example: "Apartment" })
  @Column({ nullable: true })
  propertyType: string;

  @ApiProperty({ description: "Contagem de amenidades", example: 27 })
  @Column({ type: "int", nullable: true })
  amenitiesCount: number;

  @ApiProperty({ description: "Bairro conforme Airbnb", example: "Asa Norte" })
  @Column({ nullable: true })
  neighborhood: string;

  @ApiProperty({ description: "Número total de reviews", example: 283 })
  @Column({ type: "int", nullable: true })
  reviewCount: number;

  @ApiProperty({ description: "Quando os dados foram scrapeados pela última vez" })
  @Column({ type: "timestamp", nullable: true })
  lastScrapedAt: Date;
}
