import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { Event } from '../entities/events.entity';
import { EventDedupCandidate } from '../entities/event-dedup-candidate.entity';
import { EventSource } from '../entities/event-source.entity';
import { CoverageService } from './coverage.service';
import { EventIdentityScore, EventIdentityService } from './event-identity.service';

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
  private readonly AUTO_MATCH_THRESHOLD = 0.86;
  private readonly REVIEW_MATCH_THRESHOLD = 0.74;

  constructor(
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(EventSource) private readonly eventSourceRepo: Repository<EventSource>,
    @InjectRepository(EventDedupCandidate)
    private readonly dedupCandidateRepo: Repository<EventDedupCandidate>,
    private readonly coverage: CoverageService,
    private readonly identity: EventIdentityService,
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
    const bySource = new Map<string, { created: number; updated: number; skipped: number }>();
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const input of items) {
      const result = await this.ingestOne(input);
      results.push(result);

      const sourceKey = input.source ?? 'unknown';
      const sourceSummary = bySource.get(sourceKey) ?? { created: 0, updated: 0, skipped: 0 };
      bySource.set(sourceKey, sourceSummary);
      if (result.status === 'created') {
        created++;
        sourceSummary.created++;
      } else if (result.status === 'updated') {
        updated++;
        sourceSummary.updated++;
      } else {
        skipped++;
        sourceSummary.skipped++;
      }
    }

    return {
      total: items.length,
      created,
      updated,
      skipped,
      bySource: Object.fromEntries(bySource),
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

    const identityResult = await this.resolveIdentity(input, dedupHash, hasGeo);
    if (identityResult) {
      return identityResult;
    }

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
        await this.recordSourceEvidence(existing.id, input, {
          score: 1,
          reason: 'dedup_hash_exact',
          signals: { date: 1, name: 1, venue: 1, geo: hasGeo ? 1 : 0, url: 0 },
          kind: 'strong',
        });
        return { status: 'updated', id: existing.id, dedupHash };
      }
      await this.recordSourceEvidence(existing.id, input, {
        score: 1,
        reason: 'dedup_hash_exact',
        signals: { date: 1, name: 1, venue: 1, geo: hasGeo ? 1 : 0, url: 0 },
        kind: 'strong',
      });
      return { status: 'updated', id: existing.id, dedupHash };
    }

    // Cobertura: SE tem geo, decide outOfScope agora. SE não tem, deixa
    // outOfScope=false e o geocoder cron decide quando resolver lat/lng.
    const fuzzyMatch = await this.findBestIdentityCandidate(input);
    if (fuzzyMatch && fuzzyMatch.score.score >= this.AUTO_MATCH_THRESHOLD) {
      await this.updateCanonicalEvent(fuzzyMatch.event, input, fuzzyMatch.score.reason, fuzzyMatch.score.score);
      await this.recordSourceEvidence(fuzzyMatch.event.id, input, fuzzyMatch.score);
      return { status: 'updated', id: fuzzyMatch.event.id, dedupHash: fuzzyMatch.event.dedupHash ?? dedupHash };
    }

    let outOfScope = false;
    if (hasGeo) {
      const inCoverage = await this.coverage.isWithinCoverage(lat, lng);
      outOfScope = !inCoverage;
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
      // Sem geo OU fora de escopo → motor ignora.
      // Quando tiver geo: ativo só se DENTRO da cobertura.
      ativo: hasGeo && !outOfScope && !(fuzzyMatch && fuzzyMatch.score.score >= this.REVIEW_MATCH_THRESHOLD),
      pendingGeocode: !hasGeo,
      outOfScope,
      dataCrawl: new Date(),
      canonicalName: input.nome.trim().slice(0, 255),
      normalizedName: this.identity.normalizeText(input.nome).slice(0, 255),
      normalizedVenue: this.identity.normalizeVenue(input.enderecoCompleto ?? '').slice(0, 255) || null,
      dedupStatus:
        fuzzyMatch && fuzzyMatch.score.score >= this.REVIEW_MATCH_THRESHOLD
          ? 'review_pending'
          : 'canonical',
      duplicateOfEventId:
        fuzzyMatch && fuzzyMatch.score.score >= this.REVIEW_MATCH_THRESHOLD
          ? fuzzyMatch.event.id
          : null,
      identityConfidence: fuzzyMatch?.score.score ?? 1,
      sourceCount: 0,
      lastSeenAt: new Date(),
      source: input.source,
      sourceId: input.sourceId ?? null,
      dedupHash,
      venueCapacity: input.venueCapacity ?? null,
      venueType: input.venueType ?? null,
      expectedAttendance: input.expectedAttendance ?? null,
      crawledUrl: input.crawledUrl ?? null,
    });

    const saved = await this.eventRepo.save(entity);
    await this.recordSourceEvidence(saved.id, input, fuzzyMatch?.score ?? {
      score: 1,
      reason: 'new_canonical_event',
      signals: { date: 1, name: 1, venue: 0, geo: hasGeo ? 1 : 0, url: 0 },
      kind: 'new',
    });
    if (fuzzyMatch && fuzzyMatch.score.score >= this.REVIEW_MATCH_THRESHOLD) {
      await this.recordDedupCandidate(fuzzyMatch.event, saved, fuzzyMatch.score, input);
    }
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

  private async resolveIdentity(
    input: IngestEventInput,
    dedupHash: string,
    hasGeo: boolean,
  ): Promise<IngestResult | null> {
    const exactSourceMatch = await this.findBySourceIdentity(input);
    if (exactSourceMatch) {
      await this.updateCanonicalEvent(exactSourceMatch, input, 'source_identity_exact', 1);
      await this.recordSourceEvidence(exactSourceMatch.id, input, {
        score: 1,
        reason: 'source_identity_exact',
        signals: { date: 1, name: 1, venue: 1, geo: hasGeo ? 1 : 0, url: 0 },
        kind: 'exact_source',
      });
      return { status: 'updated', id: exactSourceMatch.id, dedupHash: exactSourceMatch.dedupHash ?? dedupHash };
    }

    const exactUrlMatch = await this.findByCanonicalUrl(input);
    if (exactUrlMatch) {
      await this.updateCanonicalEvent(exactUrlMatch, input, 'canonical_url_exact', 0.99);
      await this.recordSourceEvidence(exactUrlMatch.id, input, {
        score: 0.99,
        reason: 'canonical_url_exact',
        signals: { date: 1, name: 1, venue: 1, geo: 0, url: 1 },
        kind: 'exact_url',
      });
      return { status: 'updated', id: exactUrlMatch.id, dedupHash: exactUrlMatch.dedupHash ?? dedupHash };
    }

    return null;
  }

  private async findBySourceIdentity(input: IngestEventInput): Promise<Event | null> {
    const sourceId = input.sourceId?.trim();
    if (!sourceId) return null;
    const source = await this.eventSourceRepo.findOne({
      where: { source: input.source, sourceId },
      relations: ['event'],
    });
    return source?.event ? this.resolveCanonicalEvent(source.event) : null;
  }

  private async findByCanonicalUrl(input: IngestEventInput): Promise<Event | null> {
    const canonicalUrl = this.identity.canonicalizeUrl(input.linkSiteOficial ?? input.crawledUrl ?? null);
    if (!canonicalUrl) return null;
    const source = await this.eventSourceRepo.findOne({
      where: { canonicalUrl },
      relations: ['event'],
    });
    return source?.event ? this.resolveCanonicalEvent(source.event) : null;
  }

  private async findBestIdentityCandidate(
    input: IngestEventInput,
  ): Promise<{ event: Event; score: EventIdentityScore } | null> {
    const dataInicio = new Date(input.dataInicio);
    const start = new Date(dataInicio);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(dataInicio);
    end.setUTCHours(23, 59, 59, 999);

    const qb = this.eventRepo
      .createQueryBuilder('event')
      .where('event.dataInicio BETWEEN :start AND :end', { start, end })
      .andWhere('event.duplicateOfEventId IS NULL')
      .andWhere("(event.dedupStatus IS NULL OR event.dedupStatus = 'canonical')")
      .take(100);

    if (input.cidade) {
      qb.andWhere("(event.cidade = :city OR event.cidade IS NULL OR event.cidade = '')", {
        city: input.cidade,
      });
    }
    if (input.estado) {
      qb.andWhere("(event.estado = :state OR event.estado IS NULL OR event.estado = '')", {
        state: input.estado,
      });
    }

    const candidates = await qb.getMany();
    let best: { event: Event; score: EventIdentityScore } | null = null;
    for (const event of candidates) {
      const score = this.identity.scoreCandidate(input, event);
      if (!best || score.score > best.score.score) best = { event, score };
    }
    return best && best.score.score >= this.REVIEW_MATCH_THRESHOLD ? best : null;
  }

  private async resolveCanonicalEvent(event: Event): Promise<Event> {
    if (event.duplicateOfEventId) {
      const canonical = await this.eventRepo.findOne({ where: { id: event.duplicateOfEventId } });
      if (canonical) return canonical;
    }
    return event;
  }

  private async updateCanonicalEvent(
    existing: Event,
    input: IngestEventInput,
    matchReason: string,
    confidence: number,
  ): Promise<void> {
    const patch: Partial<Event> = {};
    if (!existing.descricao && input.descricao) patch.descricao = input.descricao;
    if (!existing.categoria && input.categoria) patch.categoria = input.categoria;
    if (!existing.linkSiteOficial && input.linkSiteOficial) patch.linkSiteOficial = input.linkSiteOficial;
    if (!existing.imagem_url && input.imagemUrl) patch.imagem_url = input.imagemUrl;
    if (!existing.venueCapacity && input.venueCapacity != null) patch.venueCapacity = input.venueCapacity;
    if (!existing.venueType && input.venueType) patch.venueType = input.venueType;
    if (!existing.expectedAttendance && input.expectedAttendance != null) {
      patch.expectedAttendance = input.expectedAttendance;
    }
    if (!existing.crawledUrl && input.crawledUrl) patch.crawledUrl = input.crawledUrl;
    if (!existing.canonicalName) patch.canonicalName = existing.nome ?? input.nome;
    if (!existing.normalizedName) {
      patch.normalizedName = this.identity.normalizeText(existing.nome ?? input.nome).slice(0, 255);
    }
    if (!existing.normalizedVenue) {
      patch.normalizedVenue = this.identity
        .normalizeVenue(existing.enderecoCompleto || input.enderecoCompleto || '')
        .slice(0, 255) || null;
    }
    if (!existing.dedupStatus) patch.dedupStatus = 'canonical';
    patch.identityConfidence = Math.max(Number(existing.identityConfidence ?? 0), confidence);
    patch.lastSeenAt = new Date();
    patch.dataCrawl = new Date();

    await this.eventRepo.update({ id: existing.id }, patch);
    this.logger.debug(`Event identity match ${matchReason}: ${existing.id}`);
  }

  private async recordSourceEvidence(
    eventId: string,
    input: IngestEventInput,
    match: EventIdentityScore,
  ): Promise<void> {
    const canonicalUrl = this.identity.canonicalizeUrl(input.linkSiteOficial ?? input.crawledUrl ?? null);
    const now = new Date();
    const sourceId = input.sourceId?.trim() || null;
    const existing = sourceId
      ? await this.eventSourceRepo.findOne({ where: { source: input.source, sourceId } })
      : canonicalUrl
        ? await this.eventSourceRepo.findOne({ where: { eventId, source: input.source, canonicalUrl } })
        : null;

    if (existing) {
      await this.eventSourceRepo.update(
        { id: existing.id },
        {
          lastSeenAt: now,
          seenCount: Number(existing.seenCount ?? 0) + 1,
          confidenceScore: match.score,
          matchReason: match.reason,
          rawPayload: input as any,
        } as Partial<EventSource>,
      );
    } else {
      await this.eventSourceRepo.save(
        this.eventSourceRepo.create({
          eventId,
          source: input.source,
          sourceId,
          rawTitle: input.nome?.slice(0, 500) ?? null,
          rawVenue: (input.enderecoCompleto ?? '').slice(0, 255) || null,
          rawAddress: input.enderecoCompleto ?? null,
          rawStartDate: new Date(input.dataInicio),
          rawEndDate: input.dataFim ? new Date(input.dataFim) : null,
          url: input.linkSiteOficial ?? input.crawledUrl ?? null,
          canonicalUrl,
          crawledUrl: input.crawledUrl ?? null,
          rawPayload: input,
          confidenceScore: match.score,
          matchReason: match.reason,
          firstSeenAt: now,
          lastSeenAt: now,
          seenCount: 1,
        }),
      );
    }

    const sourceCount = await this.eventSourceRepo.count({ where: { eventId } });
    await this.eventRepo.update({ id: eventId }, { sourceCount, lastSeenAt: now });
  }

  private async recordDedupCandidate(
    canonical: Event,
    duplicate: Event,
    match: EventIdentityScore,
    input: IngestEventInput,
  ): Promise<void> {
    const existing = await this.dedupCandidateRepo.findOne({
      where: [
        { canonicalEventId: canonical.id, duplicateEventId: duplicate.id },
        { canonicalEventId: duplicate.id, duplicateEventId: canonical.id },
      ],
    });
    if (existing?.status === 'approved' || existing?.status === 'rejected') return;

    const patch: Partial<EventDedupCandidate> = {
      canonicalEventId: canonical.id,
      duplicateEventId: duplicate.id,
      status: 'pending',
      confidenceBand: match.score >= this.AUTO_MATCH_THRESHOLD ? 'high' : 'medium',
      score: match.score,
      reason: match.reason,
      signals: match.signals,
      source: 'ingest_review',
      sourceId: input.sourceId ?? null,
    };

    if (existing) {
      await this.dedupCandidateRepo.update({ id: existing.id }, patch);
      return;
    }

    await this.dedupCandidateRepo.save(this.dedupCandidateRepo.create(patch));
  }
}
