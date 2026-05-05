import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { Event } from '../entities/events.entity';

/**
 * EventsIngestService — F6.2 Plus.
 *
 * Recebedor universal de eventos vindos das 3 camadas de coleta:
 *  - Camada 1: clientes Python que batem em API oficiais (api-football,
 *    Sympla API, Eventbrite, Prefeitura SP)
 *  - Camada 2: pipeline Firecrawl que extrai eventos de sites HTML
 *  - Camada 3: form admin de curadoria + import CSV semestral
 *
 * Todas as fontes batem nesse service via `POST /eventos/ingest` (com role
 * admin), que faz:
 *
 *   1. Validação básica (nome, dataInicio, lat/lng obrigatórios)
 *   2. Cálculo do `dedupHash` = sha256(nome|date|geo)
 *   3. UPSERT por dedupHash (mesmo evento de fontes diferentes não duplica)
 *   4. Retorna status por entrada: created | updated | skipped (invalid)
 *
 * Todas as fontes "concorrem" pelo mesmo registro: a primeira a chegar cria,
 * próximas atualizam campos vazios mas preservam relevancia/raioImpactoKm
 * já calculados pelo Gemini (não bagunça enriquecimento).
 */

export interface IngestEventInput {
  // Obrigatórios
  nome: string;
  dataInicio: string | Date;     // ISO ou Date — data/hora de início

  // Geocoding: SE você não tiver lat/lng, mande `enderecoCompleto` que o
  // backend marca pendingGeocode=true e cron resolve depois. Mande lat/lng
  // direto se já tiver (mais rápido).
  latitude?: number | null;
  longitude?: number | null;

  // Recomendados (necessário pelo menos enderecoCompleto QUANDO lat/lng ausente)
  dataFim?: string | Date | null;
  enderecoCompleto?: string;
  cidade?: string;
  estado?: string;

  // Opcionais — coletor preenche o que tiver
  descricao?: string | null;
  categoria?: string | null;
  linkSiteOficial?: string | null;
  imagemUrl?: string | null;

  // F6.2 Plus — procedência
  source: string;                 // 'api-football' / 'sympla-api' / etc.
  sourceId?: string | null;
  venueCapacity?: number | null;
  venueType?: string | null;      // 'stadium' / 'convention_center' / etc.
  expectedAttendance?: number | null;
  crawledUrl?: string | null;
}

export interface IngestResult {
  status: 'created' | 'updated' | 'skipped';
  reason?: string;                // só preenche em 'skipped'
  id?: string;
  dedupHash?: string;
}

export interface IngestBatchResponse {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  bySource: Record<string, { created: number; updated: number; skipped: number }>;
  results: IngestResult[];
}

@Injectable()
export class EventsIngestService {
  private readonly logger = new Logger(EventsIngestService.name);

  constructor(
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
  ) {}

  /**
   * Ingere um lote de eventos. Idempotente por `dedupHash`.
   *
   * @returns relatório por entrada + agregado por fonte
   */
  async ingestBatch(items: IngestEventInput[]): Promise<IngestBatchResponse> {
    if (!Array.isArray(items)) {
      throw new BadRequestException('payload deve ser um array');
    }
    if (items.length === 0) {
      return {
        total: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        bySource: {},
        results: [],
      };
    }
    if (items.length > 500) {
      throw new BadRequestException('máximo de 500 eventos por batch');
    }

    const results: IngestResult[] = [];
    const bySource: Record<string, { created: number; updated: number; skipped: number }> = {};
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const input of items) {
      const result = await this.ingestOne(input);
      results.push(result);

      const sourceKey = input.source ?? 'unknown';
      if (!bySource[sourceKey]) bySource[sourceKey] = { created: 0, updated: 0, skipped: 0 };
      if (result.status === 'created') {
        created++;
        bySource[sourceKey].created++;
      } else if (result.status === 'updated') {
        updated++;
        bySource[sourceKey].updated++;
      } else {
        skipped++;
        bySource[sourceKey].skipped++;
      }
    }

    return {
      total: items.length,
      created,
      updated,
      skipped,
      bySource,
      results,
    };
  }

  /** Ingere um único evento. Exposto separadamente para testes. */
  async ingestOne(input: IngestEventInput): Promise<IngestResult> {
    const validation = this.validate(input);
    if (validation) {
      return { status: 'skipped', reason: validation };
    }

    const dataInicio = new Date(input.dataInicio);
    const hasGeo = this.hasValidGeo(input);
    const lat = hasGeo ? Number(input.latitude) : 0;  // só pra hash; placeholder se sem geo
    const lng = hasGeo ? Number(input.longitude) : 0;

    // Quando não tem geo, dedup via nome+data+endereço normalizado (não geo)
    // — evita criar 2 entries pro mesmo evento que entram em momentos diferentes,
    // um sem geo e outro com geo.
    const dedupHash = hasGeo
      ? this.computeDedupHash(input.nome, dataInicio, lat, lng)
      : this.computeDedupHashByAddress(input.nome, dataInicio, input.enderecoCompleto ?? '');

    const existing = await this.eventRepo.findOne({ where: { dedupHash } });

    if (existing) {
      // Update conservador: só preenche campos vazios. Não sobrescreve
      // relevancia/raioImpactoKm já calculados pela IA.
      const patch: Partial<Event> = {};
      if (!existing.descricao && input.descricao) patch.descricao = input.descricao;
      if (!existing.categoria && input.categoria) patch.categoria = input.categoria;
      if (!existing.linkSiteOficial && input.linkSiteOficial) patch.linkSiteOficial = input.linkSiteOficial;
      if (!existing.imagem_url && input.imagemUrl) patch.imagem_url = input.imagemUrl;
      if (!existing.venueCapacity && input.venueCapacity != null) patch.venueCapacity = input.venueCapacity;
      if (!existing.venueType && input.venueType) patch.venueType = input.venueType;
      if (!existing.expectedAttendance && input.expectedAttendance != null) patch.expectedAttendance = input.expectedAttendance;
      if (!existing.crawledUrl && input.crawledUrl) patch.crawledUrl = input.crawledUrl;

      patch.dataCrawl = new Date();

      if (Object.keys(patch).length > 1) {
        // > 1 porque sempre tem dataCrawl. Só salva se houve mudança real.
        await this.eventRepo.update({ id: existing.id }, patch);
        return { status: 'updated', id: existing.id, dedupHash };
      }
      return { status: 'updated', id: existing.id, dedupHash };
    }

    const entity = this.eventRepo.create({
      nome: input.nome.trim().slice(0, 255),
      descricao: input.descricao ?? null,
      dataInicio,
      dataFim: input.dataFim ? new Date(input.dataFim) : dataInicio,
      enderecoCompleto: input.enderecoCompleto ?? '',
      cidade: input.cidade ?? '',
      estado: (input.estado ?? 'SP').slice(0, 2).toUpperCase(),
      // Sem geo, salva null e marca pendingGeocode — cron resolve depois
      latitude: hasGeo ? lat : (null as any),
      longitude: hasGeo ? lng : (null as any),
      linkSiteOficial: input.linkSiteOficial ?? null,
      imagem_url: input.imagemUrl ?? null,
      categoria: input.categoria ?? null,
      // Sem geo, fica inativo pro motor até geocoder rodar
      ativo: hasGeo,
      pendingGeocode: !hasGeo,
      dataCrawl: new Date(),
      source: input.source,
      sourceId: input.sourceId ?? null,
      dedupHash,
      venueCapacity: input.venueCapacity ?? null,
      venueType: input.venueType ?? null,
      expectedAttendance: input.expectedAttendance ?? null,
      crawledUrl: input.crawledUrl ?? null,
    });

    const saved = await this.eventRepo.save(entity);
    return { status: 'created', id: saved.id, dedupHash };
  }

  /**
   * Calcula `sha256(lower(nome) | YYYY-MM-DD | lat~3 | lng~3)`.
   * Lat/lng arredondadas a 3 casas (~110m de precisão) absorvem variações
   * pequenas entre fontes que reportam o mesmo evento.
   */
  computeDedupHash(nome: string, dataInicio: Date, lat: number, lng: number): string {
    const cleanName = nome.trim().toLowerCase().replace(/\s+/g, ' ');
    const dateStr = dataInicio.toISOString().slice(0, 10);
    const roundedLat = Math.round(lat * 1000) / 1000;
    const roundedLng = Math.round(lng * 1000) / 1000;
    const key = `${cleanName}|${dateStr}|${roundedLat},${roundedLng}`;
    return createHash('sha256').update(key).digest('hex');
  }

  /**
   * Variante para casos sem lat/lng (geocoding lazy). Usa endereço
   * normalizado como fallback de chave. Quando o geocoder rodar, o
   * dedupHash NÃO muda — fica congelado no hash by-address. Isso garante
   * que ingestões posteriores com lat/lng do MESMO endereço (mesma string)
   * caiam na mesma row.
   */
  computeDedupHashByAddress(nome: string, dataInicio: Date, endereco: string): string {
    const cleanName = nome.trim().toLowerCase().replace(/\s+/g, ' ');
    const cleanAddr = endereco.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200);
    const dateStr = dataInicio.toISOString().slice(0, 10);
    const key = `${cleanName}|${dateStr}|addr:${cleanAddr}`;
    return createHash('sha256').update(key).digest('hex');
  }

  /** True se input tem lat E lng numéricos válidos (não null/undefined/NaN). */
  private hasValidGeo(input: IngestEventInput): boolean {
    if (input.latitude == null || input.longitude == null) return false;
    const lat = Number(input.latitude);
    const lng = Number(input.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (lat < -90 || lat > 90) return false;
    if (lng < -180 || lng > 180) return false;
    return true;
  }

  /** Retorna mensagem de erro se inválido, ou null se OK. */
  private validate(input: IngestEventInput): string | null {
    if (!input.nome || typeof input.nome !== 'string' || input.nome.trim().length < 2) {
      return 'nome ausente ou muito curto';
    }
    if (!input.dataInicio) return 'dataInicio ausente';
    const date = new Date(input.dataInicio);
    if (Number.isNaN(date.getTime())) return 'dataInicio inválida';

    const hasGeo = this.hasValidGeo(input);

    if (!hasGeo) {
      // Permite payload sem geo SE tiver endereço pra geocodificar depois.
      // Marcamos pendingGeocode=true. Sem endereço E sem geo = lixo.
      const addr = (input.enderecoCompleto ?? '').trim();
      if (addr.length < 5) {
        return 'sem latitude/longitude válidas e enderecoCompleto ausente — impossível geocodificar';
      }
    } else {
      // Se vieram, têm que ser válidos (foi checado em hasValidGeo, mas
      // mensagem de erro mais específica se entrou só uma das duas):
      const lat = input.latitude;
      const lng = input.longitude;
      if (lat != null && (Number(lat) < -90 || Number(lat) > 90)) {
        return 'latitude fora de range [-90, 90]';
      }
      if (lng != null && (Number(lng) < -180 || Number(lng) > 180)) {
        return 'longitude fora de range [-180, 180]';
      }
    }

    if (!input.source || typeof input.source !== 'string' || input.source.length === 0) {
      return 'source obrigatório (api-football, sympla-api, firecrawl-<site>, admin-manual, etc.)';
    }

    return null;
  }
}
