import { createHash } from 'crypto';
import type { IdentityLike } from './event-reference-normalize';
import { matchReferenceToEvents, type MatchableEvent } from './event-reference-match';
import type { ReferenceVenueConfig } from './event-reference.config';
import { sizeFromCapacity } from './event-reference.config';
import type { EventReferenceSize, EventReferenceStatus } from '../entities/event-reference.entity';
import type { EventCoverageDimension, EventCoverageScope } from '../entities/event-coverage-snapshot.entity';

/**
 * Métricas de cobertura (ADR 0026), puras:
 *  - recall = referências aprovadas encontradas no banco / referências aprovadas;
 *  - precisão = eventos do banco (amostra, em venues da lista) confirmados por uma referência
 *    aprovada ou por um validador externo / tamanho da amostra.
 */

export interface MetricsReference {
  status: EventReferenceStatus;
  dateKey: string;
  category: string | null;
  size: EventReferenceSize;
  venueKey: string | null;
  venueName: string;
  matched: boolean;
}

export interface MetricRow {
  scope: EventCoverageScope;
  dimension: EventCoverageDimension;
  dimensionValue: string;
  referenceTotal: number;
  referenceMatched: number;
  recallPct: number | null;
}

export function pct(part: number, total: number): number | null {
  if (!total) return null;
  return Math.round((part / total) * 10000) / 100;
}

/** Recall por total, porte, categoria e venue, para uma janela de datas (inclusiva). */
export function computeRecallRows(
  refs: MetricsReference[],
  scope: EventCoverageScope,
  window: { fromDateKey: string; toDateKey: string },
): MetricRow[] {
  const approved = refs.filter(
    (r) => r.status === 'aprovado' && r.dateKey >= window.fromDateKey && r.dateKey <= window.toDateKey,
  );
  const buckets = new Map<string, { dimension: EventCoverageDimension; value: string; total: number; matched: number }>();
  const add = (dimension: EventCoverageDimension, value: string, matched: boolean) => {
    const key = `${dimension}:${value}`;
    const bucket = buckets.get(key) ?? { dimension, value, total: 0, matched: 0 };
    bucket.total += 1;
    if (matched) bucket.matched += 1;
    buckets.set(key, bucket);
  };
  for (const ref of approved) {
    add('total', 'all', ref.matched);
    add('size', ref.size, ref.matched);
    add('category', ref.category || 'sem-categoria', ref.matched);
    add('venue', ref.venueKey || ref.venueName.toLowerCase().slice(0, 100), ref.matched);
  }
  return [...buckets.values()]
    .map((b) => ({
      scope,
      dimension: b.dimension,
      dimensionValue: b.value,
      referenceTotal: b.total,
      referenceMatched: b.matched,
      recallPct: pct(b.matched, b.total),
    }))
    .sort((a, b) => a.dimension.localeCompare(b.dimension) || a.dimensionValue.localeCompare(b.dimensionValue));
}

// ---------------------------------------------------------------------------
// Precisão
// ---------------------------------------------------------------------------

export interface PrecisionReference {
  name: string;
  dateKey: string;
  normalizedVenue: string;
  lat?: number | null;
  lng?: number | null;
  status: EventReferenceStatus;
  /** Votos de validadores externos (web) a favor. */
  externalSupport: number;
}

export interface PrecisionEvent extends MatchableEvent {
  categoria?: string | null;
  venueCapacity?: number | null;
}

export type PrecisionClass = 'confirmed' | 'refuted' | 'unverified';

export interface PrecisionRow {
  dimension: EventCoverageDimension;
  dimensionValue: string;
  sample: number;
  confirmed: number;
  refuted: number;
  precisionPct: number | null;
}

/** Resolve o venue da lista a que o evento pertence (nome/alias normalizado ou geo <= 0.5 km). */
export function buildVenueResolver(venues: ReferenceVenueConfig[], identity: IdentityLike) {
  const indexed = venues.map((venue) => ({
    venue,
    names: [venue.name, ...venue.aliases].map((n) => identity.normalizeVenue(n)).filter((n) => n.length >= 4),
  }));
  return (event: MatchableEvent): ReferenceVenueConfig | null => {
    const eventVenue = event.normalizedVenue || identity.normalizeVenue(event.venueName ?? event.enderecoCompleto ?? '');
    if (eventVenue) {
      for (const entry of indexed) {
        if (entry.names.some((n) => eventVenue === n || eventVenue.includes(n))) return entry.venue;
      }
    }
    const lat = Number(event.latitude);
    const lng = Number(event.longitude);
    if (event.latitude != null && event.longitude != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      for (const entry of indexed) {
        const { venue } = entry;
        if (venue.lat == null || venue.lng == null) continue;
        const dLat = ((lat - venue.lat) * Math.PI) / 180;
        const dLng = ((lng - venue.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((venue.lat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        if (km <= 0.5) return venue;
      }
    }
    return null;
  };
}

/** Amostra determinística (hash do id) para não depender da ordem do banco. */
export function deterministicSample<T extends { id: string }>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const rank = (id: string) => createHash('sha1').update(id).digest('hex');
  return [...items].sort((a, b) => rank(a.id).localeCompare(rank(b.id))).slice(0, max);
}

export function classifyEvent(
  event: PrecisionEvent,
  refs: PrecisionReference[],
  identity: IdentityLike,
): PrecisionClass {
  let verdict: PrecisionClass = 'unverified';
  for (const ref of refs) {
    const match = matchReferenceToEvents(
      { name: ref.name, dateKey: ref.dateKey, normalizedVenue: ref.normalizedVenue, lat: ref.lat, lng: ref.lng },
      [event],
      identity,
    );
    if (!match) continue;
    if (ref.status === 'aprovado') return 'confirmed';
    if (ref.status === 'rejeitado') return 'refuted';
    if (ref.externalSupport >= 1) verdict = 'confirmed';
  }
  return verdict;
}

export function computePrecisionRows(
  sample: Array<{ event: PrecisionEvent; venue: ReferenceVenueConfig; cls: PrecisionClass }>,
): PrecisionRow[] {
  const buckets = new Map<string, { dimension: EventCoverageDimension; value: string; sample: number; confirmed: number; refuted: number }>();
  const add = (dimension: EventCoverageDimension, value: string, cls: PrecisionClass) => {
    const key = `${dimension}:${value}`;
    const b = buckets.get(key) ?? { dimension, value, sample: 0, confirmed: 0, refuted: 0 };
    b.sample += 1;
    if (cls === 'confirmed') b.confirmed += 1;
    if (cls === 'refuted') b.refuted += 1;
    buckets.set(key, b);
  };
  for (const { event, venue, cls } of sample) {
    add('total', 'all', cls);
    add('venue', venue.key, cls);
    add('category', (event.categoria || 'sem-categoria').toLowerCase().slice(0, 100), cls);
    add('size', event.venueCapacity ? sizeFromCapacity(event.venueCapacity) : venue.size, cls);
  }
  return [...buckets.values()]
    .map((b) => ({
      dimension: b.dimension,
      dimensionValue: b.value,
      sample: b.sample,
      confirmed: b.confirmed,
      refuted: b.refuted,
      precisionPct: pct(b.confirmed, b.sample),
    }))
    .sort((a, b) => a.dimension.localeCompare(b.dimension) || a.dimensionValue.localeCompare(b.dimensionValue));
}

/** Junta recall (por dimensão) e precisão no formato das linhas de snapshot. */
export function mergeSnapshotRows(
  recallPast: MetricRow[],
  recallNext: MetricRow[],
  precision: PrecisionRow[],
): Array<MetricRow & {
  precisionSample: number | null;
  precisionConfirmed: number | null;
  precisionRefuted: number | null;
  precisionPct: number | null;
}> {
  const precisionByKey = new Map(precision.map((p) => [`${p.dimension}:${p.dimensionValue}`, p]));
  const rows: ReturnType<typeof mergeSnapshotRows> = [];
  const seenNext = new Set<string>();
  for (const row of recallPast) {
    rows.push({ ...row, precisionSample: null, precisionConfirmed: null, precisionRefuted: null, precisionPct: null });
  }
  for (const row of recallNext) {
    const p = precisionByKey.get(`${row.dimension}:${row.dimensionValue}`);
    seenNext.add(`${row.dimension}:${row.dimensionValue}`);
    rows.push({
      ...row,
      precisionSample: p?.sample ?? null,
      precisionConfirmed: p?.confirmed ?? null,
      precisionRefuted: p?.refuted ?? null,
      precisionPct: p?.precisionPct ?? null,
    });
  }
  // Precisão de dimensões que não têm referência aprovada no futuro (ex.: venue sem lista).
  for (const p of precision) {
    if (seenNext.has(`${p.dimension}:${p.dimensionValue}`)) continue;
    rows.push({
      scope: 'next90',
      dimension: p.dimension,
      dimensionValue: p.dimensionValue,
      referenceTotal: 0,
      referenceMatched: 0,
      recallPct: null,
      precisionSample: p.sample,
      precisionConfirmed: p.confirmed,
      precisionRefuted: p.refuted,
      precisionPct: p.precisionPct,
    });
  }
  return rows;
}
