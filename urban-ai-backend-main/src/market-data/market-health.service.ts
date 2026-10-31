import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { todaySaoPauloDateKey } from '../common/sp-date';
import { Address } from '../entities/addresses.entity';
import { ExternalListing } from '../entities/external-listing.entity';
import { MarketIngestLog } from '../entities/market-ingest-log.entity';
import { MarketIntelService } from './market-intel.service';
import { resolveMarketConfig } from './market-config';
import { dateKeyAddDays } from './market-math';
import { MarketSourceId } from './market-data.types';
import { marketTargetFromAddress } from './market-target';

const COVERAGE_SAMPLE_LIMIT = 300;
const COVERAGE_CONCURRENCY = 4;
const COVERAGE_CACHE_MS = 5 * 60 * 1000;
export const MARKET_COVERAGE_TARGET = 0.8;
/** Dado mais velho que isto (dias) deixa a fonte "desatualizada" na tela de saúde. */
export const MARKET_STALE_AFTER_DAYS = 45;

export interface MarketHealthSource {
  id: MarketSourceId;
  label: string;
  enabled: boolean;
  reason?: string;
  listings: number;
  lastCollectedAt: string | null;
  stale: boolean;
}

export interface MarketHealthNeighborhood {
  source: MarketSourceId;
  city: string;
  neighborhood: string | null;
  /** Anúncios (externas) ou imóveis (clientes). */
  listings: number;
  /** Só clientes: anfitriões distintos. */
  hosts?: number;
  lastCollectedAt: string | null;
}

export interface MarketHealth {
  generatedAt: string;
  config: { minHosts: number; minExternalListings: number; externalMaxAgeDays: number; scrapingEnabled: boolean };
  sources: MarketHealthSource[];
  neighborhoods: MarketHealthNeighborhood[];
  recentImports: Array<{
    id: string;
    source: string;
    city: string;
    license: string;
    collectedAt: string | null;
    fileName: string | null;
    rowsImported: number;
    rowsSkipped: number;
    observationsImported: number;
    createdAt: string;
  }>;
  coverage: {
    activeProperties: number;
    sampled: number;
    withSufficientCompSet: number;
    /** 0–1 sobre a amostra; null quando não há imóvel com coordenadas. */
    ratio: number | null;
    target: number;
    contributions: Partial<Record<MarketSourceId, number>>;
    cachedAt: string;
  };
}

type CoverageCore = Omit<MarketHealth['coverage'], 'activeProperties'>;

function toDateKey(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function sourceOfExternal(value: string): MarketSourceId {
  return String(value).startsWith('licensed:') ? 'licensed_dataset' : 'inside_airbnb';
}

/**
 * Saúde das fontes de mercado para o admin (ADR 0028): volume por fonte e bairro, última
 * atualização, importações recentes e % de imóveis ativos com comp set suficiente.
 */
@Injectable()
export class MarketHealthService {
  private readonly logger = new Logger(MarketHealthService.name);
  private coverageCache: { at: number; value: CoverageCore } | null = null;

  constructor(
    @InjectRepository(ExternalListing) private readonly listingRepo: Repository<ExternalListing>,
    @InjectRepository(MarketIngestLog) private readonly logRepo: Repository<MarketIngestLog>,
    @InjectRepository(Address) private readonly addressRepo: Repository<Address>,
    private readonly intel: MarketIntelService,
  ) {}

  async health(now: Date = new Date()): Promise<MarketHealth> {
    const config = resolveMarketConfig();
    const today = todaySaoPauloDateKey(now);
    const staleBefore = dateKeyAddDays(today, -MARKET_STALE_AFTER_DAYS);

    const [externalRows, customerRows, activeProperties, logs, coverage] = await Promise.all([
      this.externalVolumes(),
      this.customerVolumes(),
      this.addressRepo.count({ where: { ativo: true } as any }),
      this.logRepo.find({ order: { createdAt: 'DESC' }, take: 10 }),
      this.coverage(now),
    ]);

    const statuses = this.intel.sourceStatuses();
    const volume = new Map<MarketSourceId, { listings: number; last: string | null }>();
    const bump = (id: MarketSourceId, listings: number, last: string | null) => {
      const cur = volume.get(id) ?? { listings: 0, last: null };
      cur.listings += listings;
      if (last && (!cur.last || last > cur.last)) cur.last = last;
      volume.set(id, cur);
    };
    for (const row of externalRows) bump(row.source, row.listings, row.lastCollectedAt);
    for (const row of customerRows) bump('customers', row.listings, row.lastCollectedAt);

    const sources: MarketHealthSource[] = statuses.map((status) => {
      const v = volume.get(status.id);
      return {
        id: status.id,
        label: status.label,
        enabled: status.enabled,
        reason: status.reason,
        listings: v?.listings ?? 0,
        lastCollectedAt: v?.last ?? null,
        // Clientes são sempre "ao vivo"; só fontes importadas ficam desatualizadas.
        stale: status.id !== 'customers' && Boolean(v?.last) && (v?.last as string) < staleBefore,
      };
    });

    const neighborhoods = [...externalRows, ...customerRows]
      .sort((a, b) => b.listings - a.listings)
      .slice(0, 60);

    return {
      generatedAt: now.toISOString(),
      config: {
        minHosts: config.minHosts,
        minExternalListings: config.minExternalListings,
        externalMaxAgeDays: config.externalMaxAgeDays,
        scrapingEnabled: config.scrapingEnabled,
      },
      sources,
      neighborhoods,
      recentImports: logs.map((log) => ({
        id: log.id,
        source: log.source,
        city: log.city,
        license: log.license,
        collectedAt: toDateKey(log.collectedAt),
        fileName: log.fileName,
        rowsImported: log.rowsImported,
        rowsSkipped: log.rowsSkipped,
        observationsImported: log.observationsImported,
        createdAt: log.createdAt.toISOString(),
      })),
      coverage: { activeProperties, ...coverage },
    };
  }

  private async externalVolumes(): Promise<MarketHealthNeighborhood[]> {
    const rows = await this.listingRepo
      .createQueryBuilder('l')
      .select('l.source', 'source')
      .addSelect('l.city', 'city')
      .addSelect('l.neighborhood', 'neighborhood')
      .addSelect('COUNT(*)', 'listings')
      .addSelect('MAX(l.collectedAt)', 'lastCollectedAt')
      .groupBy('l.source')
      .addGroupBy('l.city')
      .addGroupBy('l.neighborhood')
      .getRawMany();
    return rows.map((row) => ({
      source: sourceOfExternal(row.source),
      city: String(row.city),
      neighborhood: row.neighborhood ?? null,
      listings: Number(row.listings) || 0,
      lastCollectedAt: toDateKey(row.lastCollectedAt),
    }));
  }

  private async customerVolumes(): Promise<MarketHealthNeighborhood[]> {
    const rows = await this.addressRepo
      .createQueryBuilder('a')
      .innerJoin('a.list', 'l')
      .leftJoin('a.user', 'u')
      .select('a.cidade', 'city')
      .addSelect('a.bairro', 'neighborhood')
      .addSelect('COUNT(*)', 'listings')
      .addSelect('COUNT(DISTINCT u.id)', 'hosts')
      .where('a.ativo = :ativo', { ativo: true })
      .groupBy('a.cidade')
      .addGroupBy('a.bairro')
      .getRawMany();
    return rows.map((row) => ({
      source: 'customers' as const,
      city: String(row.city ?? ''),
      neighborhood: row.neighborhood ?? null,
      listings: Number(row.listings) || 0,
      hosts: Number(row.hosts) || 0,
      lastCollectedAt: null,
    }));
  }

  /** % de imóveis ativos (amostra) com comp set suficiente. Cacheado: roda uma consulta por imóvel. */
  private async coverage(now: Date): Promise<CoverageCore> {
    if (this.coverageCache && now.getTime() - this.coverageCache.at < COVERAGE_CACHE_MS) {
      return this.coverageCache.value;
    }
    const config = resolveMarketConfig();
    const to = todaySaoPauloDateKey(now);
    const from = dateKeyAddDays(to, -29);
    const addresses = await this.addressRepo
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.list', 'list')
      .leftJoinAndSelect('a.user', 'user')
      .where('a.ativo = :ativo', { ativo: true })
      .andWhere('a.latitude IS NOT NULL')
      .andWhere('a.longitude IS NOT NULL')
      .orderBy('a.updated_at', 'DESC')
      .take(COVERAGE_SAMPLE_LIMIT)
      .getMany();

    let sufficient = 0;
    const contributions: Partial<Record<MarketSourceId, number>> = {};
    for (let i = 0; i < addresses.length; i += COVERAGE_CONCURRENCY) {
      const batch = addresses.slice(i, i + COVERAGE_CONCURRENCY);
      const builds = await Promise.all(
        batch.map(async (address) => {
          try {
            const userId = address.user?.id ?? address.list?.user?.id ?? `address:${address.id}`;
            return await this.intel.build({
              target: marketTargetFromAddress(address, userId),
              city: address.cidade ?? null,
              state: address.estado ?? null,
              from,
              to,
              dates: [],
              radiusKm: config.defaultRadiusKm,
              use: 'display',
              ownOccupancy: null,
              ownDaily: new Map(),
              eventDays: new Set(),
              light: true,
              config,
              today: to,
            });
          } catch (err) {
            this.logger.warn(`Cobertura: falha em address=${address.id}: ${(err as Error).message}`);
            return null;
          }
        }),
      );
      for (const build of builds) {
        if (!build || build.compSet.insufficient) continue;
        sufficient += 1;
        for (const s of build.compSet.sources) contributions[s.source] = (contributions[s.source] ?? 0) + 1;
      }
    }

    const value = {
      sampled: addresses.length,
      withSufficientCompSet: sufficient,
      ratio: addresses.length ? Number((sufficient / addresses.length).toFixed(3)) : null,
      target: MARKET_COVERAGE_TARGET,
      contributions,
      cachedAt: now.toISOString(),
    };
    this.coverageCache = { at: now.getTime(), value };
    return value;
  }
}
