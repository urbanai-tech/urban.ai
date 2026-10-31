import { MarketConfig } from './market-config';
import { dateKeyAddDays, haversineKm, matchesTypology } from './market-math';
import {
  MARKET_SOURCE_LABELS,
  MARKET_SOURCE_ORDER,
  MarketLicense,
  MarketListingRecord,
  MarketSourceId,
  MarketTarget,
  MarketTypology,
  MarketUse,
} from './market-data.types';

/**
 * Comp set: filtra, deduplica entre fontes e aplica a regra de privacidade
 * (ADR 0028). Tudo puro — as fontes já entregaram os registros.
 */

/** Tolerância de diária para considerar dois registros de fontes diferentes o mesmo anúncio. */
export const SOFT_MATCH_ADR_TOLERANCE = 0.15;

function precedenceOf(source: MarketSourceId): number {
  const index = MARKET_SOURCE_ORDER.indexOf(source);
  return index < 0 ? MARKET_SOURCE_ORDER.length : index;
}

/** Vence a duplicata: maior precedência (fonte primeiro na ordem) e, no empate, a coleta mais recente. */
function compareForWinner(a: MarketListingRecord, b: MarketListingRecord): number {
  const byPrecedence = precedenceOf(a.source) - precedenceOf(b.source);
  if (byPrecedence !== 0) return byPrecedence;
  return String(b.collectedAt ?? '').localeCompare(String(a.collectedAt ?? ''));
}

/** Preenche só os campos que o vencedor não tem, com o dado da fonte perdedora. */
function fillGaps(winner: MarketListingRecord, loser: MarketListingRecord): MarketListingRecord {
  const filled = new Set<MarketSourceId>(winner.filledFrom ?? []);
  const next: MarketListingRecord = { ...winner };
  let changed = false;
  if (next.occupancy == null && loser.occupancy != null) {
    next.occupancy = loser.occupancy;
    next.occupancyIsProxy = loser.occupancyIsProxy;
    changed = true;
  }
  for (const key of ['bedrooms', 'listingType', 'capacity', 'neighborhood'] as const) {
    if (next[key] == null && loser[key] != null) {
      (next as unknown as Record<string, unknown>)[key] = loser[key];
      changed = true;
    }
  }
  if (!next.observations?.length && loser.observations?.length) {
    next.observations = loser.observations;
    changed = true;
  }
  if (changed) {
    filled.add(loser.source);
    next.filledFrom = Array.from(filled);
  }
  return next;
}

function geoBucketKey(record: MarketListingRecord): string | null {
  if (record.bedrooms == null || record.listingType == null) return null; // sem tipologia não casamos
  if (!Number.isFinite(record.latitude) || !Number.isFinite(record.longitude)) return null;
  return [record.latitude.toFixed(4), record.longitude.toFixed(4), record.bedrooms, record.listingType].join('|');
}

function adrClose(a: number | null, b: number | null, tolerance = SOFT_MATCH_ADR_TOLERANCE): boolean {
  if (a == null || b == null || a <= 0 || b <= 0) return false;
  return Math.abs(a - b) / Math.max(a, b) <= tolerance;
}

export interface MergeResult {
  records: MarketListingRecord[];
  duplicatesRemoved: { byId: number; byMatch: number };
}

/**
 * Deduplicação e precedência entre fontes.
 *
 * 1. Mesma `dedupKey` (id do anúncio no Airbnb) = o mesmo anúncio: fica um só, o da fonte de
 *    maior precedência (clientes > dataset licenciado > Inside Airbnb > coleta própria),
 *    empate pela coleta mais recente; campos vazios do vencedor são preenchidos com os dos outros.
 * 2. Sem id em comum, só casamos registros de FONTES DIFERENTES com a mesma posição (4 casas ≈ 11 m),
 *    mesmos quartos e tipo e diária até 15% distante. Dois registros da mesma fonte nunca casam por
 *    posição (um prédio com várias unidades iguais é legítimo).
 */
export function mergeAcrossSources(records: MarketListingRecord[]): MergeResult {
  let byId = 0;
  const groups = new Map<string, MarketListingRecord[]>();
  for (const record of records) {
    const list = groups.get(record.dedupKey);
    if (list) list.push(record);
    else groups.set(record.dedupKey, [record]);
  }
  const survivors: MarketListingRecord[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      survivors.push(group[0]);
      continue;
    }
    const sorted = [...group].sort(compareForWinner);
    let winner = sorted[0];
    for (const loser of sorted.slice(1)) winner = fillGaps(winner, loser);
    byId += group.length - 1;
    survivors.push(winner);
  }

  let byMatch = 0;
  const buckets = new Map<string, MarketListingRecord[]>();
  const loose: MarketListingRecord[] = [];
  for (const record of survivors) {
    const key = geoBucketKey(record);
    if (!key) {
      loose.push(record);
      continue;
    }
    const list = buckets.get(key);
    if (list) list.push(record);
    else buckets.set(key, [record]);
  }
  const merged: MarketListingRecord[] = [...loose];
  for (const bucket of buckets.values()) {
    const kept: MarketListingRecord[] = [];
    for (const record of [...bucket].sort(compareForWinner)) {
      const twinIndex = kept.findIndex((k) => k.source !== record.source && adrClose(k.adr, record.adr));
      if (twinIndex >= 0) {
        kept[twinIndex] = fillGaps(kept[twinIndex], record);
        byMatch += 1;
      } else {
        kept.push(record);
      }
    }
    merged.push(...kept);
  }
  return { records: merged, duplicatesRemoved: { byId, byMatch } };
}

export interface CompSetOptions {
  target: MarketTarget;
  radiusKm: number;
  typology?: MarketTypology | null;
  use: MarketUse;
  config: Pick<MarketConfig, 'minHosts' | 'minExternalListings' | 'externalMaxAgeDays'>;
  /** Hoje em YYYY-MM-DD (injetável nos testes). */
  today: string;
}

export interface PrivacyGroup {
  /** Anfitriões distintos (clientes) ou anúncios distintos (fontes externas), após filtros e dedup. */
  distinct: number;
  required: number;
  qualified: boolean;
}

export interface CompSetSourceSummary {
  source: MarketSourceId;
  label: string;
  /** Anúncios (externas) ou imóveis (clientes) que entraram. */
  listings: number;
  latestCollectedAt: string | null;
  licenses: MarketLicense[];
}

export interface CompSet {
  /** Só registros de grupos que atingiram o mínimo de privacidade. */
  records: MarketListingRecord[];
  privacy: { customers: PrivacyGroup; external: PrivacyGroup };
  insufficient: boolean;
  duplicatesRemoved: { byId: number; byMatch: number };
  excluded: {
    unknownLicense: number;
    internalOnlyLicense: number;
    stale: number;
    self: number;
    outsideRadiusOrTypology: number;
    withoutAdr: number;
  };
  sources: CompSetSourceSummary[];
}

function isOwnListing(record: MarketListingRecord, target: MarketTarget): boolean {
  if (record.ownerKey && record.ownerKey === target.userId) return true;
  if (target.airbnbListingId && record.dedupKey === `abnb:${target.airbnbListingId}`) return true;
  if (record.source === 'customers') return false;
  // Fonte externa sem id em comum: mesmo ponto, mesma tipologia e diária próxima do alvo = o próprio imóvel.
  if (target.latitude == null || target.longitude == null) return false;
  if (record.latitude.toFixed(4) !== target.latitude.toFixed(4)) return false;
  if (record.longitude.toFixed(4) !== target.longitude.toFixed(4)) return false;
  if (target.bedrooms == null || record.bedrooms !== target.bedrooms) return false;
  if (target.listingType && record.listingType && target.listingType !== record.listingType) return false;
  return adrClose(record.adr, target.ownAdr);
}

export function buildCompSet(records: MarketListingRecord[], options: CompSetOptions): CompSet {
  const { target, radiusKm, typology, use, config, today } = options;
  const excluded = {
    unknownLicense: 0,
    internalOnlyLicense: 0,
    stale: 0,
    self: 0,
    outsideRadiusOrTypology: 0,
    withoutAdr: 0,
  };
  const staleBefore = dateKeyAddDays(today, -config.externalMaxAgeDays);
  const eligible: MarketListingRecord[] = [];

  for (const record of records) {
    if (record.license === 'unknown') {
      excluded.unknownLicense += 1;
      continue;
    }
    if (use === 'display' && record.license === 'licensed_internal_only') {
      excluded.internalOnlyLicense += 1;
      continue;
    }
    if (isOwnListing(record, target)) {
      excluded.self += 1;
      continue;
    }
    if (record.adr == null || !(record.adr > 0)) {
      excluded.withoutAdr += 1;
      continue;
    }
    if (target.latitude != null && target.longitude != null) {
      if (haversineKm(target.latitude, target.longitude, record.latitude, record.longitude) > radiusKm) {
        excluded.outsideRadiusOrTypology += 1;
        continue;
      }
    }
    if (!matchesTypology(record, typology)) {
      excluded.outsideRadiusOrTypology += 1;
      continue;
    }
    if (record.source !== 'customers' && (!record.collectedAt || record.collectedAt < staleBefore)) {
      excluded.stale += 1;
      continue;
    }
    eligible.push(record);
  }

  const merged = mergeAcrossSources(eligible);

  const customers = merged.records.filter((r) => r.source === 'customers');
  const external = merged.records.filter((r) => r.source !== 'customers');
  const customersDistinct = new Set(customers.map((r) => r.ownerKey ?? r.dedupKey)).size;
  const externalDistinct = new Set(external.map((r) => r.dedupKey)).size;
  const privacy = {
    customers: {
      distinct: customersDistinct,
      required: config.minHosts,
      qualified: customersDistinct >= config.minHosts,
    },
    external: {
      distinct: externalDistinct,
      required: config.minExternalListings,
      qualified: externalDistinct >= config.minExternalListings,
    },
  };

  const kept = [...(privacy.customers.qualified ? customers : []), ...(privacy.external.qualified ? external : [])];

  const summaries = new Map<MarketSourceId, CompSetSourceSummary>();
  for (const record of kept) {
    const current = summaries.get(record.source) ?? {
      source: record.source,
      label: MARKET_SOURCE_LABELS[record.source],
      listings: 0,
      latestCollectedAt: null,
      licenses: [],
    };
    current.listings += 1;
    if (record.collectedAt && (!current.latestCollectedAt || record.collectedAt > current.latestCollectedAt)) {
      current.latestCollectedAt = record.collectedAt;
    }
    if (!current.licenses.includes(record.license)) current.licenses.push(record.license);
    summaries.set(record.source, current);
  }

  return {
    records: kept,
    privacy,
    insufficient: kept.length === 0,
    duplicatesRemoved: merged.duplicatesRemoved,
    excluded,
    sources: MARKET_SOURCE_ORDER.map((id) => summaries.get(id)).filter(
      (item): item is CompSetSourceSummary => Boolean(item),
    ),
  };
}
