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
  latitude: number;
  longitude: number;

  // Recomendados
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
    const dedupHash = this.computeDedupHash(
      input.nome,
      dataInicio,
      Number(input.latitude),
      Number(input.longitude),
    );

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
      latitude: Number(input.latitude),
      longitude: Number(input.longitude),
      linkSiteOficial: input.linkSiteOficial ?? null,
      imagem_url: input.imagemUrl ?? null,
      categoria: input.categoria ?? null,
      ativo: true,
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

  /** Retorna mensagem de erro se inválido, ou null se OK. */
  private validate(input: IngestEventInput): string | null {
    if (!input.nome || typeof input.nome !== 'string' || input.nome.trim().length < 2) {
      return 'nome ausente ou muito curto';
    }
    if (!input.dataInicio) return 'dataInicio ausente';
    const date = new Date(input.dataInicio);
    if (Number.isNaN(date.getTime())) return 'dataInicio inválida';

    const lat = Number(input.latitude);
    const lng = Number(input.longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return 'latitude inválida';
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return 'longitude inválida';

    if (!input.source || typeof input.source !== 'string' || input.source.length === 0) {
      return 'source obrigatório (api-football, sympla-api, firecrawl-<site>, admin-manual, etc.)';
    }

    return null;
  }
}
