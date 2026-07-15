import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Repository, IsNull } from 'typeorm';
import { Event } from '../entities/events.entity';
import { EventIdentityService } from '../evento/event-identity.service';
import { haversineKm } from './feature-engineering.service';
import { SP_VENUES, VenueCapacity } from './data/sp-venues';
import { ScheduledJobRunnerService, runScheduledJob } from '../admin-job-runs/scheduled-job-runner.service';

// ============================================================================
// Funções puras de matching (testáveis sem I/O)
// ============================================================================

export type NormalizeFn = (value?: string | null) => string;

export type VenueIndex = {
  /** normalized string (nome ou alias) -> venue */
  byName: Map<string, VenueCapacity>;
  venues: VenueCapacity[];
};

/**
 * Constrói o índice de venues normalizando nome + aliases com a MESMA função
 * usada no matching de eventos (EventIdentityService.normalizeVenue). Em caso de
 * colisão (ex.: aliases do Anhembi que colapsam no mesmo canônico), mantém a
 * MENOR capacidade — conservador, evita superestimar público.
 */
export function buildVenueIndex(normalize: NormalizeFn, venues: VenueCapacity[] = SP_VENUES): VenueIndex {
  const byName = new Map<string, VenueCapacity>();
  const put = (key: string, venue: VenueCapacity) => {
    const k = normalize(key);
    if (!k) return;
    const existing = byName.get(k);
    if (!existing || venue.capacity < existing.capacity) byName.set(k, venue);
  };
  for (const v of venues) {
    put(v.name, v);
    for (const a of v.aliases ?? []) put(a, v);
  }
  return { byName, venues };
}

export type VenueMatch = {
  venue: VenueCapacity;
  method: 'name' | 'geo';
};

/** Distância máxima (km) para casar um evento a um venue por geo. */
export const VENUE_GEO_MAX_KM = 0.4;

/**
 * Resolve o venue de um evento: primeiro por nome normalizado (exato, depois
 * substring nos dois sentidos), depois por proximidade geográfica.
 */
export function matchVenue(
  index: VenueIndex,
  normalizedVenue: string,
  lat?: number | null,
  lng?: number | null,
): VenueMatch | null {
  const nv = (normalizedVenue ?? '').trim();
  if (nv) {
    const exact = index.byName.get(nv);
    if (exact) return { venue: exact, method: 'name' };
    // substring nos dois sentidos: "allianz parque portao 5" ⊇ "allianz parque",
    // ou o nome do venue contém a string curta do evento.
    for (const [key, venue] of index.byName) {
      if (key.length >= 4 && (nv.includes(key) || key.includes(nv))) {
        return { venue, method: 'name' };
      }
    }
  }

  if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
    let best: { venue: VenueCapacity; d: number } | null = null;
    for (const v of index.venues) {
      if (typeof v.lat !== 'number' || typeof v.lng !== 'number') continue;
      const d = haversineKm(lat, lng, v.lat, v.lng);
      if (d <= VENUE_GEO_MAX_KM && (!best || d < best.d)) best = { venue: v, d };
    }
    if (best) return { venue: best.venue, method: 'geo' };
  }

  return null;
}

// ============================================================================
// Serviço
// ============================================================================

/**
 * IA-3c — popula `event.venueCapacity` (e `venueType`, quando ausente) casando
 * o evento a um venue conhecido de São Paulo. Serve de teto estrutural para o
 * eventDemandScore (resolveAttendance já consome venueCapacity).
 *
 * Idempotente: só processa eventos SEM venueCapacity. Cron diário 04:30 BRT
 * (depois do enrichment). `backfillAll` roda sobre TODA a base (paginado) e é
 * exposto para trigger manual.
 */
@Injectable()
export class VenueCapacityService {
  private readonly logger = new Logger(VenueCapacityService.name);
  private index: VenueIndex | null = null;

  constructor(
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    private readonly identity: EventIdentityService,
    @Optional() private readonly scheduledJobRunner?: ScheduledJobRunnerService,
  ) {}

  private getIndex(): VenueIndex {
    if (!this.index) {
      this.index = buildVenueIndex((v) => this.identity.normalizeVenue(v));
    }
    return this.index;
  }

  /** Resolve o venue de um único evento (para uso no enrichment também). */
  resolveForEvent(event: Pick<Event, 'normalizedVenue' | 'local' | 'enderecoCompleto' | 'latitude' | 'longitude'>): VenueMatch | null {
    const venueStr =
      event.normalizedVenue ||
      this.identity.normalizeVenue(
        (event.local as any) ?? event.enderecoCompleto ?? null,
      );
    const lat = typeof event.latitude === 'number' ? event.latitude : Number(event.latitude);
    const lng = typeof event.longitude === 'number' ? event.longitude : Number(event.longitude);
    return matchVenue(this.getIndex(), venueStr, lat, lng);
  }

  /**
   * Backfill de um lote de eventos sem venueCapacity. Retorna contadores.
   */
  async backfillPending(limit = 200): Promise<{ pendentes: number; resolvidos: number }> {
    const rows = await this.eventRepo.find({
      where: { venueCapacity: IsNull() as any },
      take: limit,
      order: { dataInicio: 'DESC' },
    });
    if (rows.length === 0) return { pendentes: 0, resolvidos: 0 };

    let resolvidos = 0;
    for (const event of rows) {
      const match = this.resolveForEvent(event);
      if (!match) continue;
      event.venueCapacity = match.venue.capacity;
      if (!event.venueType) event.venueType = match.venue.venueType;
      await this.eventRepo.save(event);
      resolvidos += 1;
    }
    this.logger.log(`venueCapacity backfill: ${resolvidos}/${rows.length} resolvidos neste lote.`);
    return { pendentes: rows.length, resolvidos };
  }

  /**
   * Roda o backfill sobre TODA a base em lotes até esgotar os pendentes.
   * Usado no trigger manual ("rodar pra todos os eventos que já temos").
   */
  async backfillAll(batch = 200, maxBatches = 500): Promise<{ processados: number; resolvidos: number }> {
    let processados = 0;
    let resolvidos = 0;
    for (let i = 0; i < maxBatches; i += 1) {
      const { pendentes, resolvidos: r } = await this.backfillPending(batch);
      processados += pendentes;
      resolvidos += r;
      // Se um lote não resolveu nenhum, os pendentes restantes são não-casáveis
      // (venue desconhecido) — sair para não girar em falso infinitamente.
      if (pendentes === 0 || r === 0) break;
    }
    this.logger.log(`venueCapacity backfillAll: ${resolvidos} resolvidos de ${processados} processados.`);
    return { processados, resolvidos };
  }

  @Cron('0 30 4 * * *', {
    name: 'venue-capacity-backfill',
    timeZone: 'America/Sao_Paulo',
    waitForCompletion: true,
  })
  async scheduledBackfill(): Promise<void> {
    return runScheduledJob(this.scheduledJobRunner, 'venue-capacity-backfill', async () => {
      await this.backfillPending(300);
    });
  }
}
