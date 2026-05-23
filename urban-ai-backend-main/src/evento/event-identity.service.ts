import { Injectable } from '@nestjs/common';
import { Event } from '../entities/events.entity';

export type EventIdentityMatchKind = 'exact_source' | 'exact_url' | 'strong' | 'review' | 'new';

export interface EventIdentityInput {
  nome?: string | null;
  title?: string | null;
  dataInicio?: string | Date | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  enderecoCompleto?: string | null;
  venue?: string | null;
  venueName?: string | null;
  rawVenue?: string | null;
  linkSiteOficial?: string | null;
  crawledUrl?: string | null;
  url?: string | null;
  source?: string | null;
  sourceId?: string | null;
}

export interface EventIdentityFingerprint {
  normalizedName: string;
  normalizedVenue: string;
  dateKey: string | null;
  geoBucket: string | null;
  canonicalUrl: string | null;
  locationKey: string | null;
  key: string;
}

export interface EventIdentityScore {
  score: number;
  reason: string;
  signals: {
    date: number;
    dateScore?: number;
    name: number;
    nameScore?: number;
    venue: number;
    venueScore?: number;
    geo: number;
    geoScore?: number;
    url: number;
    urlScore?: number;
  };
  kind: EventIdentityMatchKind;
}

type EventIdentityCandidate = EventIdentityInput & Omit<Partial<Event>, keyof EventIdentityInput>;

@Injectable()
export class EventIdentityService {
  private readonly noiseTokens = new Set([
    'agenda',
    'comprar',
    'evento',
    'eventos',
    'eventbrite',
    'gratis',
    'gratuito',
    'ingresso',
    'ingressos',
    'oficial',
    'programacao',
    'programação',
    'sympla',
    'ticket',
    'tickets',
  ]);

  normalizeText(value?: string | null): string {
    if (!value) return '';
    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, ' e ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const tokens = normalized
      .split(' ')
      .filter((token) => (token.length > 1 || token === 'x') && !this.noiseTokens.has(token));

    if (tokens.length === 1 && tokens[0] === 'show') return '';
    return tokens.join(' ');
  }

  normalizeVenue(value?: string | null): string {
    const clean = this.normalizeText(value);
    if (!clean) return '';

    const aliasGroups: Array<{ canonical: string; aliases: string[] }> = [
      {
        canonical: 'allianz parque',
        aliases: ['allianz parque', 'arena palmeiras', 'palestra italia', 'estadio palestra italia'],
      },
      {
        canonical: 'sao paulo expo',
        aliases: ['sao paulo expo', 'sp expo', 'sao paulo exposition'],
      },
      {
        canonical: 'expo center norte',
        aliases: ['expo center norte', 'centro de exposicoes norte', 'centro exposicoes norte'],
      },
      {
        canonical: 'anhembi',
        aliases: ['anhembi', 'distrito anhembi', 'sambodromo do anhembi', 'sambodromo anhembi'],
      },
      {
        canonical: 'morumbi',
        aliases: ['morumbi', 'cicero pompeu de toledo', 'estadio do morumbi'],
      },
      {
        canonical: 'neo quimica arena',
        aliases: ['neo quimica arena', 'itaquera', 'arena corinthians'],
      },
    ];

    for (const group of aliasGroups) {
      if (group.aliases.some((alias) => clean.includes(alias))) return group.canonical;
    }

    return clean;
  }

  canonicalizeUrl(value?: string | null): string | null {
    const raw = value?.trim();
    if (!raw) return null;

    try {
      const url = new URL(raw);
      url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
      url.hash = '';
      url.pathname = url.pathname.replace(/\/+$/, '') || '/';

      const removable = new Set([
        'fbclid',
        'gclid',
        'mc_cid',
        'mc_eid',
        'ref',
        'ref_src',
        'source',
      ]);
      for (const key of Array.from(url.searchParams.keys())) {
        if (key.toLowerCase().startsWith('utm_') || removable.has(key.toLowerCase())) {
          url.searchParams.delete(key);
        }
      }

      url.searchParams.sort();
      return url.toString();
    } catch {
      return this.normalizeText(raw) || null;
    }
  }

  eventDateKey(date?: string | Date | null): string | null {
    if (!date) return null;
    const parsed = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }

  buildFingerprint(input: EventIdentityInput): EventIdentityFingerprint {
    const normalizedName = this.normalizeText(input.nome ?? input.title ?? '');
    const normalizedVenue = this.normalizeVenue(
      input.venueName ?? input.venue ?? input.rawVenue ?? input.enderecoCompleto ?? '',
    );
    const geoBucket = this.geoBucket(input.latitude, input.longitude);
    const locationKey = normalizedVenue ? `venue:${normalizedVenue}` : geoBucket ? `geo:${geoBucket}` : null;
    return {
      normalizedName,
      normalizedVenue,
      dateKey: this.eventDateKey(input.dataInicio),
      geoBucket,
      canonicalUrl: this.canonicalizeUrl(input.url ?? input.linkSiteOficial ?? input.crawledUrl ?? null),
      locationKey,
      key: [normalizedName, this.eventDateKey(input.dataInicio) ?? '', locationKey ?? ''].join('|'),
    };
  }

  tokenSetSimilarity(left?: string | null, right?: string | null): number {
    const leftTokens = new Set(this.normalizeText(left).split(' ').filter(Boolean));
    const rightTokens = new Set(this.normalizeText(right).split(' ').filter(Boolean));
    if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

    const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
    const union = new Set([...leftTokens, ...rightTokens]).size;
    const jaccard = union > 0 ? intersection / union : 0;
    const containment = intersection / Math.min(leftTokens.size, rightTokens.size);
    return Math.max(jaccard, containment * 0.9);
  }

  scoreCandidate(input: EventIdentityInput, existing: EventIdentityCandidate): EventIdentityScore {
    if (this.hasSameSourceIdentity(input, existing)) {
      return {
        score: 1,
        reason: 'exact_source_id',
        signals: this.signals(1, 1, 1, 1, 0),
        kind: 'exact_source',
      };
    }

    const incoming = this.buildFingerprint(input);
    const existingUrl = this.canonicalizeUrl(existing.linkSiteOficial ?? existing.crawledUrl ?? null);
    const existingDateKey = this.eventDateKey(existing.dataInicio);
    const existingName = existing.normalizedName || this.normalizeText(existing.canonicalName || existing.nome);
    const existingVenue =
      existing.normalizedVenue ||
      this.normalizeVenue(
        existing.venueName ?? existing.venue ?? existing.rawVenue ?? (existing as any).local ?? existing.enderecoCompleto ?? '',
      );

    const date = incoming.dateKey && existingDateKey && incoming.dateKey === existingDateKey ? 1 : 0;
    const name = this.tokenSetSimilarity(incoming.normalizedName, existingName);
    const venue = incoming.normalizedVenue && existingVenue
      ? this.tokenSetSimilarity(incoming.normalizedVenue, existingVenue)
      : 0;
    const url = incoming.canonicalUrl && existingUrl && incoming.canonicalUrl === existingUrl ? 1 : 0;
    const geo = this.geoProximityScore(input.latitude, input.longitude, existing.latitude, existing.longitude);

    if (url === 1) {
      return {
        score: 0.99,
        reason: 'exact_canonical_url',
        signals: this.signals(date, name, venue, geo, url),
        kind: 'exact_url',
      };
    }

    const score = Math.min(
      1,
      date * 0.28 + name * 0.34 + Math.max(venue, geo) * 0.26 + Math.min(venue, geo) * 0.12,
    );
    const kind = score >= 0.86 ? 'strong' : score >= 0.74 ? 'review' : 'new';
    const reason = score >= 0.86
      ? 'likely_duplicate'
      : [
          date ? 'same_date' : 'date_mismatch',
          name >= 0.75 ? 'similar_name' : 'weak_name',
          venue >= 0.75 ? 'same_venue' : geo >= 0.75 ? 'near_geo' : 'weak_location',
        ].join('+');

    return {
      score: Math.round(score * 10000) / 10000,
      reason,
      signals: this.signals(date, name, venue, geo, url),
      kind,
    };
  }

  geoBucket(latitude?: number | string | null, longitude?: number | string | null): string | null {
    const lat = this.numberOrNull(latitude);
    const lng = this.numberOrNull(longitude);
    if (lat === null || lng === null) return null;
    return `${Math.round(lat * 1000) / 1000},${Math.round(lng * 1000) / 1000}`;
  }

  hasSameSourceIdentity(input: EventIdentityInput, existing: EventIdentityInput): boolean {
    const inputSource = this.normalizeSource(input.source);
    const existingSource = this.normalizeSource(existing.source);
    const inputSourceId = this.normalizeSourceId(input.sourceId);
    const existingSourceId = this.normalizeSourceId(existing.sourceId);
    return Boolean(inputSource && existingSource && inputSourceId && existingSourceId &&
      inputSource === existingSource && inputSourceId === existingSourceId);
  }

  hasSameCanonicalUrl(input: EventIdentityInput, existing: EventIdentityInput): boolean {
    const inputUrl = this.canonicalizeUrl(input.url ?? input.linkSiteOficial ?? input.crawledUrl ?? null);
    const existingUrl = this.canonicalizeUrl(existing.url ?? existing.linkSiteOficial ?? existing.crawledUrl ?? null);
    return Boolean(inputUrl && existingUrl && inputUrl === existingUrl);
  }

  geoScore(
    input: Pick<EventIdentityInput, 'latitude' | 'longitude'>,
    existing: Pick<EventIdentityInput, 'latitude' | 'longitude'>,
  ): number {
    return this.geoProximityScore(input.latitude, input.longitude, existing.latitude, existing.longitude);
  }

  private geoProximityScore(
    latitudeA?: number | string | null,
    longitudeA?: number | string | null,
    latitudeB?: number | string | null,
    longitudeB?: number | string | null,
  ): number {
    const latA = this.numberOrNull(latitudeA);
    const lngA = this.numberOrNull(longitudeA);
    const latB = this.numberOrNull(latitudeB);
    const lngB = this.numberOrNull(longitudeB);
    if (latA === null || lngA === null || latB === null || lngB === null) return 0;

    const distanceKm = this.distanceKm(latA, lngA, latB, lngB);
    if (distanceKm <= 0.15) return 1;
    if (distanceKm <= 0.5) return 0.85;
    if (distanceKm <= 1.5) return 0.6;
    return 0;
  }

  private distanceKm(latA: number, lngA: number, latB: number, lngB: number): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(latB - latA);
    const dLng = toRad(lngB - lngA);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLng / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private numberOrNull(value?: number | string | null): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private signals(date: number, name: number, venue: number, geo: number, url: number): EventIdentityScore['signals'] {
    return {
      date,
      dateScore: date,
      name,
      nameScore: name,
      venue,
      venueScore: venue,
      geo,
      geoScore: geo,
      url,
      urlScore: url,
    };
  }

  private normalizeSource(value?: string | null): string {
    return this.normalizeText(value).replace(/\s+/g, '-');
  }

  private normalizeSourceId(value?: string | null): string {
    return String(value ?? '').trim().toLowerCase();
  }
}
