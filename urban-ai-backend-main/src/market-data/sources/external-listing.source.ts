import { Repository } from 'typeorm';
import { ExternalListing } from '../../entities/external-listing.entity';
import { MarketListingObservation } from '../../entities/market-listing-observation.entity';
import { resolveMarketConfig } from '../market-config';
import { boundingBox, haversineKm, normalizeListingType } from '../market-math';
import {
  MARKET_LICENSES,
  MarketDataSource,
  MarketLicense,
  MarketListingRecord,
  MarketObservation,
  MarketSourceId,
  MarketSourceQuery,
  MarketSourceResult,
} from '../market-data.types';

export const EXTERNAL_CANDIDATE_LIMIT = 8000;
const OBSERVATIONS_LIMIT = 80_000;
const ID_CHUNK = 1000;

function toDateKey(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Base das fontes que leem `external_listing` (dataset licenciado e Inside Airbnb): mesma consulta
 * geográfica e mesmo mapeamento para `MarketListingRecord`; cada subclasse só diz qual `source`
 * (coluna) lhe pertence e qual o `id`.
 */
export abstract class ExternalListingMarketSource implements MarketDataSource {
  abstract readonly id: MarketSourceId;
  abstract readonly label: string;
  abstract readonly precedence: number;
  /** Cláusula SQL e parâmetro que isolam as linhas desta fonte (`alias` = `l`). */
  protected abstract sourceFilter(): { clause: string; params: Record<string, string> };

  constructor(
    protected readonly listingRepo: Repository<ExternalListing>,
    protected readonly observationRepo: Repository<MarketListingObservation>,
  ) {}

  status() {
    const enabled = resolveMarketConfig().enabledSources.has(this.id);
    return enabled ? { enabled } : { enabled, reason: `fonte desligada (MARKET_SOURCES não inclui ${this.id})` };
  }

  async fetch(query: MarketSourceQuery): Promise<MarketSourceResult> {
    const status = this.status();
    if (!status.enabled) return { records: [], disabledReason: status.reason };
    if (query.latitude == null || query.longitude == null) {
      return { records: [], disabledReason: 'imóvel sem coordenadas' };
    }

    const box = boundingBox(query.latitude, query.longitude, query.radiusKm);
    const filter = this.sourceFilter();
    const rows = await this.listingRepo
      .createQueryBuilder('l')
      .where(filter.clause, filter.params)
      .andWhere('l.latitude BETWEEN :minLat AND :maxLat', { minLat: box.minLat, maxLat: box.maxLat })
      .andWhere('l.longitude BETWEEN :minLng AND :maxLng', { minLng: box.minLng, maxLng: box.maxLng })
      .take(EXTERNAL_CANDIDATE_LIMIT)
      .getMany();

    const nearby = rows.filter(
      (row) =>
        Number.isFinite(Number(row.latitude)) &&
        Number.isFinite(Number(row.longitude)) &&
        haversineKm(query.latitude as number, query.longitude as number, Number(row.latitude), Number(row.longitude)) <=
          query.radiusKm,
    );
    const observations = query.withObservations ? await this.loadObservations(nearby, query) : new Map();
    return {
      records: nearby.map((row) => this.toRecord(row, observations.get(row.id))),
      truncated: rows.length >= EXTERNAL_CANDIDATE_LIMIT,
    };
  }

  private async loadObservations(rows: ExternalListing[], query: MarketSourceQuery) {
    const byListing = new Map<string, MarketObservation[]>();
    let total = 0;
    for (const ids of chunk(
      rows.map((row) => row.id),
      ID_CHUNK,
    )) {
      if (total >= OBSERVATIONS_LIMIT) break;
      const found = await this.observationRepo
        .createQueryBuilder('o')
        .where('o.externalListingId IN (:...ids)', { ids })
        .andWhere('o.observedOn BETWEEN :from AND :to', { from: query.historyFrom, to: query.to })
        .getMany();
      for (const obs of found) {
        const date = toDateKey(obs.observedOn);
        if (!date) continue;
        const list = byListing.get(obs.externalListingId) ?? [];
        list.push({
          date,
          adr: obs.priceCents != null && obs.priceCents > 0 ? Math.round(obs.priceCents / 100) : null,
          occupancy: obs.occupancyRate != null ? clamp01(Number(obs.occupancyRate)) : null,
        });
        byListing.set(obs.externalListingId, list);
        total += 1;
      }
    }
    return byListing;
  }

  protected toRecord(row: ExternalListing, observations: MarketObservation[] | undefined): MarketListingRecord {
    const license: MarketLicense = (MARKET_LICENSES as readonly string[]).includes(String(row.license))
      ? (row.license as MarketLicense)
      : 'unknown';
    const airbnbId = String(row.airbnbListingId ?? '').trim();
    const observed = row.occupancyRate != null ? clamp01(Number(row.occupancyRate)) : null;
    const proxy = row.availability365 != null ? clamp01(1 - Number(row.availability365) / 365) : null;
    return {
      source: this.id,
      sourceListingId: row.externalId,
      dedupKey: airbnbId ? `abnb:${airbnbId}` : `${this.id}:${row.externalId}`,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      neighborhood: row.neighborhood ?? null,
      city: row.city ?? null,
      adr: row.priceCents != null && row.priceCents > 0 ? Math.round(Number(row.priceCents) / 100) : null,
      occupancy: observed ?? proxy,
      occupancyIsProxy: observed == null && proxy != null,
      bedrooms: row.bedrooms ?? null,
      listingType: normalizeListingType(row.listingType ?? row.roomType),
      capacity: row.accommodates ?? null,
      collectedAt: toDateKey(row.collectedAt) ?? toDateKey(row.snapshotDate),
      license,
      observations: observations?.length ? observations : undefined,
    };
  }
}
