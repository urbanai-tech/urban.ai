import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
  } from "typeorm";
  import { ApiProperty } from "@nestjs/swagger";
  
  @Entity("events")
  @Index(["cidade", "estado"])
  @Index(["latitude", "longitude"])
  @Index(["dataInicio", "dataFim"])
  export class Event {
    // =====================================
    // 🆔 IDENTIFICAÇÃO
    // =====================================
  
    @ApiProperty({
      description: "Identificador único do evento (UUID, gerado automaticamente)",
      example: "123e4567-e89b-12d3-a456-426614174000",
    })
    @PrimaryGeneratedColumn("uuid")
    id: string;
  
    // =====================================
    // 📍 DADOS DO EVENTO
    // =====================================
  
    @ApiProperty({ description: "Nome do evento", example: "Festival de Música Rock in Rio" })
    @Column()
    @Index()
    nome: string;
  
    @ApiProperty({ description: "Descrição detalhada do evento", required: false })
    @Column("text", { nullable: true })
    descricao: string;
  
    // =====================================
    // 📅 DATAS E HORÁRIOS
    // =====================================
  
    @ApiProperty({ description: "Data e hora de início do evento" })
    @Column("datetime")
    @Index()
    dataInicio: Date;
  
    @ApiProperty({ description: "Data e hora de fim do evento" })
    @Column("datetime")
    @Index()
    dataFim: Date;
  
    // =====================================
    // 📍 LOCALIZAÇÃO
    // =====================================
  
    @ApiProperty({ description: "Endereço completo do evento" })
    @Column("text")
    enderecoCompleto: string;
  
    @ApiProperty({ description: "Cidade onde o evento ocorre" })
    @Column()
    @Index()
    cidade: string;
  
    @ApiProperty({ description: "Estado (UF) onde o evento ocorre" })
    @Column({ length: 2 })
    @Index()
    estado: string;
  
    // =====================================
    // 🌍 COORDENADAS GEOGRÁFICAS
    // =====================================
  
    @ApiProperty({ description: "Latitude do local do evento", required: false })
    @Column({ type: "decimal", precision: 10, scale: 8, nullable: true })
    @Index()
    latitude: number;
  
    @ApiProperty({ description: "Longitude do local do evento", required: false })
    @Column({ type: "decimal", precision: 11, scale: 8, nullable: true }) // longitude pode ir até -180.00000000
    @Index()
    longitude: number;
  
    // =====================================
    // 🔗 LINKS E MÍDIA
    // =====================================
  
    @ApiProperty({ description: "Link do site oficial do evento", required: false })
    @Column("text", { nullable: true })
    linkSiteOficial: string;
  
    @ApiProperty({ description: "URL da imagem do evento", required: false })
    @Column("text", { nullable: true })
    imagem_url: string;
  
    // =====================================
    // 📂 CATEGORIZAÇÃO
    // =====================================
  
    @ApiProperty({ description: "Categoria do evento", required: false })
    @Column({ length: 100, nullable: true })
    @Index()
    categoria: string;
  
    // =====================================
    // ⚙️ CONTROLE DO SISTEMA
    // =====================================
  
    @ApiProperty({ description: "Indica se o evento está ativo" })
    @Column({ default: true })
    ativo: boolean;
  
    @ApiProperty({ description: "Data da última coleta/atualização dos dados", required: false })
    @Column("datetime", { nullable: true })
    @Index()
    dataCrawl: Date;
  
    @ApiProperty({ description: "Data de criação do registro" })
    @CreateDateColumn()
    createdAt: Date;
  
    @ApiProperty({ description: "Data da última atualização do registro" })
    @UpdateDateColumn()
    updatedAt: Date;
    endereco: any;
    local: any;
  }
  