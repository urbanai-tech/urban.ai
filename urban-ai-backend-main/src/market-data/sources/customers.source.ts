import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from '../../entities/addresses.entity';
import { List } from '../../entities/list.entity';
import { OccupancyHistory } from '../../entities/occupancy-history.entity';
import { PriceSnapshot } from '../../entities/price-snapshot.entity';
import { boundingBox, haversineKm, medianExact, normalizeListingType } from '../market-math';
import {
  MARKET_SOURCE_LABELS,
  MarketDataSource,
  MarketListingRecord,
  MarketObservation,
  MarketSourceQuery,
  MarketSourceResult,
} from '../market-data.types';

export const CUSTOMERS_CANDIDATE_LIMIT = 5000;
const ID_CHUNK = 1000;

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateKey(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function basePrice(list: List | null | undefined): number {
  const price = Number(list?.manualDailyPrice ?? list?.dailyPrice ?? list?.raw ?? 0);
  return Number.isFinite(price) && price > 0 ? Math.round(price) : 0;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Fonte `customers`: imóveis ATIVOS de outros clientes do My Urban (o que o market intel
 * sempre usou). Filtro geográfico no SQL (caixa delimitadora do raio; fallback cidade+UF
 * quando o alvo não tem coordenadas) e distância exata em memória. Dado primário: tem a
 * maior precedência e o único com ocupação real (`occupancy_history`).
 */
@Injectable()
export class CustomersMarketSource implements MarketDataSource {
  readonly id = 'customers' as const;
  readonly label = MARKET_SOURCE_LABELS.customers;
  readonly precedence = 0;

  constructor(
    @InjectRepository(Address) private readonly addressRepo: Repository<Address>,
    @InjectRepository(PriceSnapshot) private readonly snapshotRepo: Repository<PriceSnapshot>,
    @InjectRepository(OccupancyHistory) private readonly occupancyRepo: Repository<OccupancyHistory>,
  ) {}

  status() {
    return { enabled: true };
  }

  async fetch(query: MarketSourceQuery): Promise<MarketSourceResult> {
    const { latitude, longitude } = query;
    const qb = this.addressRepo
      .createQueryBuilder('address')
      .innerJoinAndSelect('address.list', 'list')
      .leftJoinAndSelect('address.user', 'user')
      .leftJoinAndSelect('list.user', 'listUser')
      .where('address.ativo = :ativo', { ativo: true })
      .andWhere('address.id != :targetId', { targetId: query.excludeAddressId });

    if (latitude != null && longitude != null) {
      const box = boundingBox(latitude, longitude, query.radiusKm);
      qb.andWhere('address.latitude BETWEEN :minLat AND :maxLat', { minLat: box.minLat, maxLat: box.maxLat }).andWhere(
        'address.longitude BETWEEN :minLng AND :maxLng',
        { minLng: box.minLng, maxLng: box.maxLng },
      );
    } else if (query.city && query.state) {
      qb.andWhere('LOWER(address.cidade) = :cidade', { cidade: normalizeText(query.city) }).andWhere(
        'LOWER(address.estado) = :estado',
        { estado: normalizeText(query.state) },
      );
    } else {
      return { records: [] };
    }

    const candidates = await qb.take(CUSTOMERS_CANDIDATE_LIMIT).getMany();
    const nearby = candidates.filter((address) => {
      if (!address.list?.id || address.id === query.excludeAddressId) return false;
      if (this.ownerKey(address) === query.excludeUserId) return false; // só outros clientes
      if (latitude != null && longitude != null) {
        const lat = toNumber(address.latitude);
        const lng = toNumber(address.longitude);
        if (lat == null || lng == null) return false;
        return haversineKm(latitude, longitude, lat, lng) <= query.radiusKm;
      }
      return true;
    });

    const listIds = nearby.map((address) => address.list.id);
    const [snapshots, occupancy] = await Promise.all([
      this.loadSnapshots(listIds, query),
      this.loadOccupancy(listIds, query),
    ]);

    const records = nearby.map((address) => this.toRecord(address, snapshots.get(address.list.id), occupancy.get(address.list.id), query));
    return { records, truncated: candidates.length >= CUSTOMERS_CANDIDATE_LIMIT };
  }

  private ownerKey(address: Address): string {
    return address.user?.id ?? address.list?.user?.id ?? `address:${address.id}`;
  }

  private async loadSnapshots(listIds: string[], query: MarketSourceQuery) {
    const byList = new Map<string, MarketObservation[]>();
    if (!listIds.length) return byList;
    for (const ids of chunk(listIds, ID_CHUNK)) {
      const rows = await this.snapshotRepo
        .createQueryBuilder('snapshot')
        .leftJoinAndSelect('snapshot.list', 'list')
        .where('list.id IN (:...ids)', { ids })
        .andWhere('snapshot.snapshotDate BETWEEN :from AND :to', {
          from: query.withObservations ? query.historyFrom : query.from,
          to: query.to,
        })
        .getMany();
      for (const row of rows) {
        const listId = row.list?.id;
        const date = toDateKey(row.snapshotDate);
        const cents = Number(row.priceCents);
        if (!listId || !date || !Number.isFinite(cents) || cents <= 0) continue;
        const list = byList.get(listId) ?? [];
        list.push({ date, adr: Math.round(cents / 100), occupancy: null });
        byList.set(listId, list);
      }
    }
    return byList;
  }

  private async loadOccupancy(listIds: string[], query: MarketSourceQuery) {
    const byList = new Map<string, { booked: number; denominator: number }>();
    if (!listIds.length) return byList;
    for (const ids of chunk(listIds, ID_CHUNK)) {
      const rows = await this.occupancyRepo
        .createQueryBuilder('occupancy')
        .leftJoinAndSelect('occupancy.list', 'list')
        .where('list.id IN (:...ids)', { ids })
        .andWhere('occupancy.date BETWEEN :from AND :to', { from: query.from, to: query.to })
        .getMany();
      for (const row of rows) {
        const listId = row.list?.id;
        if (!listId || (row.status !== 'booked' && row.status !== 'available')) continue;
        const acc = byList.get(listId) ?? { booked: 0, denominator: 0 };
        acc.denominator += 1;
        if (row.status === 'booked') acc.booked += 1;
        byList.set(listId, acc);
      }
    }
    return byList;
  }

  private toRecord(
    address: Address,
    observations: MarketObservation[] | undefined,
    occupancy: { booked: number; denominator: number } | undefined,
    query: MarketSourceQuery,
  ): MarketListingRecord {
    const list = address.list;
    const inWindow = (observations ?? []).filter((o) => o.date >= query.from && o.date <= query.to);
    const windowMedian = medianExact(inWindow.map((o) => o.adr));
    const adr = windowMedian != null ? Math.round(windowMedian) : basePrice(list) || null;
    const dates = (observations ?? []).map((o) => o.date).sort();
    const airbnbId = String(list?.id_do_anuncio ?? '').trim();
    return {
      source: 'customers',
      sourceListingId: list.id,
      dedupKey: airbnbId ? `abnb:${airbnbId}` : `customers:${list.id}`,
      latitude: toNumber(address.latitude) as number,
      longitude: toNumber(address.longitude) as number,
      neighborhood: address.bairro ?? list?.neighborhood ?? null,
      city: address.cidade ?? null,
      adr,
      occupancy:
        occupancy && occupancy.denominator ? Number((occupancy.booked / occupancy.denominator).toFixed(2)) : null,
      occupancyIsProxy: false,
      bedrooms: toNumber(list?.quartos),
      listingType: normalizeListingType(list?.propertyType),
      capacity: toNumber(list?.hospedes),
      collectedAt: dates.length ? dates[dates.length - 1] : toDateKey(list?.lastScrapedAt),
      license: 'first_party',
      ownerKey: this.ownerKey(address),
      observations: query.withObservations ? observations : undefined,
    };
  }
}
