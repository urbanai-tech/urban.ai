import type { IdentityLike } from './event-reference-normalize';
import { dayDiff } from './event-reference-normalize';

/**
 * Casamento referência × evento do banco (ADR 0026), reaproveitando as primitivas de
 * identidade do dedup (`EventIdentityService`): nome normalizado por similaridade de tokens,
 * venue canônico (aliases) e proximidade geográfica. Pura e sem I/O.
 */

export interface MatchableEvent {
  id: string;
  nome: string;
  canonicalName?: string | null;
  dataInicio: Date | string;
  normalizedVenue?: string | null;
  venueName?: string | null;
  enderecoCompleto?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

export interface MatchableReference {
  name: string;
  dateKey: string;
  normalizedVenue: string;
  lat?: number | null;
  lng?: number | null;
}

export interface ReferenceMatch {
  eventId: string;
  score: number;
  nameScore: number;
  locationScore: number;
  dayOffset: number;
}

export interface MatchOptions {
  /** Janela de dias entre a data da referência e a do evento (default 1). */
  maxDayOffset: number;
  minName: number;
  minLocation: number;
  minScore: number;
}

export const DEFAULT_MATCH_OPTIONS: MatchOptions = {
  maxDayOffset: 1,
  minName: 0.7,
  minLocation: 0.6,
  minScore: 0.7,
};

function venueSimilarity(identity: IdentityLike, refVenue: string, event: MatchableEvent): number {
  const eventVenue =
    event.normalizedVenue ||
    identity.normalizeVenue(event.venueName ?? event.enderecoCompleto ?? '');
  if (!refVenue || !eventVenue) return 0;
  if (refVenue === eventVenue) return 1;
  if (eventVenue.includes(refVenue) || refVenue.includes(eventVenue)) return 0.9;
  return identity.tokenSetSimilarity(refVenue, eventVenue);
}

function geoSimilarity(ref: MatchableReference, event: MatchableEvent): number {
  const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const lat = toNumber(event.latitude);
  const lng = toNumber(event.longitude);
  if (ref.lat == null || ref.lng == null || lat === null || lng === null) return 0;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat - ref.lat);
  const dLng = toRad(lng - ref.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(ref.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  if (km <= 0.5) return 1;
  if (km <= 1.5) return 0.75;
  return 0;
}

/** Melhor evento do banco para a referência, ou null. */
export function matchReferenceToEvents(
  ref: MatchableReference,
  events: MatchableEvent[],
  identity: IdentityLike,
  options: Partial<MatchOptions> = {},
): ReferenceMatch | null {
  const opts = { ...DEFAULT_MATCH_OPTIONS, ...options };
  let best: ReferenceMatch | null = null;
  for (const event of events) {
    const eventDateKey = identity.eventDateKey(event.dataInicio);
    if (!eventDateKey) continue;
    const offset = Math.abs(dayDiff(eventDateKey, ref.dateKey));
    if (offset > opts.maxDayOffset) continue;

    const nameScore = Math.max(
      identity.tokenSetSimilarity(ref.name, event.nome),
      event.canonicalName ? identity.tokenSetSimilarity(ref.name, event.canonicalName) : 0,
    );
    if (nameScore < opts.minName) continue;

    const locationScore = Math.max(venueSimilarity(identity, ref.normalizedVenue, event), geoSimilarity(ref, event));
    if (locationScore < opts.minLocation) continue;

    const score = Math.round((0.5 * nameScore + 0.3 * locationScore + 0.2 * (offset === 0 ? 1 : 0.5)) * 10000) / 10000;
    if (score < opts.minScore) continue;
    if (!best || score > best.score) {
      best = { eventId: event.id, score, nameScore, locationScore, dayOffset: offset };
    }
  }
  return best;
}
