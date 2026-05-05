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
  @Index(["source"])
  @Index(["venueType"])
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
    // ⚙️ INTELIGÊNCIA ARTIFICIAL (ENRIQUECIMENTO)
    // =====================================

    @ApiProperty({ description: "Score de relevância do evento calculado pela IA (1 a 100)", required: false })
    @Column("int", { nullable: true })
    relevancia: number;

    @ApiProperty({ description: "Raio gravitacional estimado do evento em km (via IA)", required: false })
    @Column("decimal", { precision: 5, scale: 2, nullable: true })
    raioImpactoKm: number;

    @ApiProperty({ description: "Capacidade estimada de público gerada pela IA", required: false })
    @Column("int", { nullable: true })
    capacidadeEstimada: number;

    // =====================================
    // 🔀 PROCEDÊNCIA / DEDUP (F6.2 Plus — Camada 1/2/3)
    // =====================================

    /**
     * Origem do evento (qual coletor/fonte trouxe). Usado para auditoria
     * e para ponderar confiabilidade no motor de pricing.
     *
     * Convenções:
     *  - 'api-football' (Camada 1 — jogos)
     *  - 'sympla-api', 'eventbrite-api', 'sp-aberta-api' (Camada 1)
     *  - 'firecrawl-<site>' (Camada 2 — ex: 'firecrawl-anhembi')
     *  - 'admin-manual' (Camada 3 — curadoria humana)
     *  - 'admin-csv-import' (Camada 3 — import semestral)
     *  - 'scraper-<spider>' (legado: 'scraper-sympla', 'scraper-eventim', etc.)
     */
    @ApiProperty({ description: "Origem do evento (api-football, sympla-api, firecrawl-anhembi, etc.)", required: false })
    @Column({ type: "varchar", length: 64, nullable: true })
    @Index()
    source: string | null;

    /** ID do evento na fonte externa (fixture_id, eventbrite_id, etc.). */
    @ApiProperty({ description: "ID externo na fonte (fixture_id, eventbrite_id, etc.)", required: false })
    @Column({ type: "varchar", length: 128, nullable: true })
    sourceId: string | null;

    /**
     * Hash SHA-256 para dedup. Calculado em ingest:
     *   sha256(lower(nome) + '|' + dataInicio.toISOString().slice(0,10)
     *          + '|' + round(lat,3) + ',' + round(lng,3))
     *
     * Permite Sympla + Eventbrite + Firecrawl reportarem o mesmo evento sem duplicar.
     * Lat/lng arredondadas a ~100m absorvem pequenas variações entre fontes.
     */
    @ApiProperty({ description: "Hash de dedup — único por nome+data+geo", required: false })
    @Column({ type: "varchar", length: 64, nullable: true, unique: true })
    dedupHash: string | null;

    /** Capacidade física do venue (estádio Allianz = 43kk). Diferente de capacidadeEstimada. */
    @ApiProperty({ description: "Capacidade física do local (do venue, não do evento específico)", required: false })
    @Column({ type: "int", nullable: true })
    venueCapacity: number | null;

    /**
     * Tipo do venue. Usado pelo motor para ponderar relevância:
     *  - 'stadium' (capacidade 30k+) → boost extra
     *  - 'convention_center' → boost médio + público B2B
     *  - 'theater' → boost localizado
     *  - 'bar', 'church', 'outdoor', 'other'
     */
    @ApiProperty({ description: "Tipo do venue (stadium, convention_center, theater, etc.)", required: false })
    @Column({ type: "varchar", length: 64, nullable: true })
    venueType: string | null;

    @ApiProperty({ description: "Público esperado deste evento específico (de bilheteria/inscrição)", required: false })
    @Column({ type: "int", nullable: true })
    expectedAttendance: number | null;

    @ApiProperty({ description: "URL crawlada/fonte original deste evento", required: false })
    @Column("text", { nullable: true })
    crawledUrl: string | null;

    /**
     * Marca eventos que entraram sem lat/lng (geocoding lazy). Cron periódico
     * `EventsGeocoderService` pega rows com pendingGeocode=true e tenta
     * geocodificar via MapsService. Quando bem-sucedido, seta pendingGeocode=false
     * e ativo=true (pronto pro motor usar).
     *
     * Mantém ativo=false enquanto pendente — motor de pricing ignora.
     */
    @ApiProperty({ description: "Flag de geocoding pendente (lazy)", required: false })
    @Column({ type: "boolean", default: false })
    @Index()
    pendingGeocode: boolean;

    // =====================================
    // ⚙️ CONTROLE DO SISTEMA
    // =====================================
  
    @ApiProperty({ description: "Indica se o evento está ativo" })
    @Column({ default: true })
    ativo: boolean;
  
    @ApiProperty({ description: "Data da última coleta/atualização dos dados", required: false })
    @Column("timestamp", { nullable: true })
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
  