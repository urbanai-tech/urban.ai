import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, Repository } from 'typeorm';
import { ExternalListing } from '../entities/external-listing.entity';
import { MarketIngestLog } from '../entities/market-ingest-log.entity';
import { MarketListingObservation } from '../entities/market-listing-observation.entity';
import { parseCsv } from '../knn-engine/inside-airbnb-import.service';
import { deriveCategory } from '../knn-engine/feature-engineering.service';
import { todaySaoPauloDateKey } from '../common/sp-date';
import {
  LicensedColumnMapping,
  MappedLicensedRow,
  mapLicensedRow,
  parseDateKey,
  resolveLicensedMapping,
} from './licensed-dataset.mapping';
import { MarketLicense, UPLOADABLE_LICENSES } from './market-data.types';
import { LICENSED_SOURCE_PREFIX } from './sources/licensed-dataset.source';

export interface LicensedImportOptions {
  /** Rótulo do fornecedor (ex.: airroi, base-dos-dados); vira `licensed:<rótulo>`. */
  datasetLabel: string;
  /** Mercado/cidade (slug). */
  city: string;
  license: MarketLicense;
  /** Data de coleta do arquivo (YYYY-MM-DD) — usada quando o CSV não traz série temporal. */
  collectedAt: string;
  mapping?: LicensedColumnMapping | null;
  fileName?: string | null;
  importedByUserId?: string | null;
  batchSize?: number;
  /** Hoje (testes). */
  today?: string;
}

export interface LicensedImportResult {
  batchId: string;
  source: string;
  parsed: number;
  imported: number;
  skipped: number;
  skippedReasons: Record<string, number>;
  observations: number;
  collectedAt: string;
  warnings: string[];
}

export const LICENSED_MAX_ROWS = 300_000;
const LABEL_RE = /^[a-z0-9][a-z0-9_-]{1,23}$/;
const CITY_RE = /^[a-z0-9][a-z0-9-]{1,47}$/;

interface Aggregated {
  latest: MappedLicensedRow;
  latestDate: string;
  observations: Map<string, MappedLicensedRow>;
}

/**
 * Importa um dataset licenciado (CSV; Parquet deve ser convertido antes) para `external_listing`
 * e `market_listing_observation`, com mapeamento de colunas configurável (ADR 0028). Idempotente
 * por (fonte, id do anúncio) e (anúncio, data). Cada lote guarda licença e data de coleta, e
 * deixa um registro em `market_ingest_log`. Nenhum dado real é versionado: os testes usam uma
 * amostra sintética.
 */
@Injectable()
export class LicensedDatasetImportService {
  private readonly logger = new Logger(LicensedDatasetImportService.name);

  constructor(
    @InjectRepository(ExternalListing) private readonly listingRepo: Repository<ExternalListing>,
    @InjectRepository(MarketListingObservation) private readonly observationRepo: Repository<MarketListingObservation>,
    @InjectRepository(MarketIngestLog) private readonly logRepo: Repository<MarketIngestLog>,
  ) {}

  /** Valida os metadados do lote; lança 400 com a primeira inconsistência. */
  validateOptions(opts: LicensedImportOptions): void {
    if (!LABEL_RE.test(opts.datasetLabel ?? '')) {
      throw new BadRequestException('datasetLabel inválido: use 2–24 caracteres a-z, 0-9, hífen ou sublinhado (ex.: airroi)');
    }
    if (!CITY_RE.test(opts.city ?? '')) {
      throw new BadRequestException('city inválida: use o slug do mercado (ex.: sao-paulo)');
    }
    if (!(UPLOADABLE_LICENSES as readonly string[]).includes(opts.license)) {
      throw new BadRequestException(`license inválida: use ${UPLOADABLE_LICENSES.join(', ')}`);
    }
    const collected = parseDateKey(opts.collectedAt);
    if (!collected) throw new BadRequestException('collectedAt inválida: use YYYY-MM-DD');
    if (collected > (opts.today ?? todaySaoPauloDateKey())) {
      throw new BadRequestException('collectedAt não pode estar no futuro');
    }
  }

  async importCsv(text: string, opts: LicensedImportOptions): Promise<LicensedImportResult> {
    this.validateOptions(opts);
    const rows = parseCsv(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
    if (rows.length < 2) throw new BadRequestException('arquivo vazio ou sem linhas de dados');
    if (rows.length - 1 > LICENSED_MAX_ROWS) {
      throw new BadRequestException(`arquivo excede o limite de ${LICENSED_MAX_ROWS} linhas`);
    }

    const mapping = resolveLicensedMapping(rows[0], opts.mapping);
    if (mapping.errors.length) {
      throw new BadRequestException(`mapeamento inválido: ${mapping.errors.join('; ')}`);
    }

    const source = `${LICENSED_SOURCE_PREFIX}${opts.datasetLabel}`;
    const collectedAt = parseDateKey(opts.collectedAt) as string;
    const batchId = randomUUID();
    const skippedReasons: Record<string, number> = {};
    const byListing = new Map<string, Aggregated>();
    let skipped = 0;

    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r];
      if (!cells || cells.length < 2) continue;
      const result = mapLicensedRow(cells, mapping);
      if (!result.row) {
        skipped += 1;
        const reason = result.reason ?? 'linha inválida';
        skippedReasons[reason] = (skippedReasons[reason] ?? 0) + 1;
        continue;
      }
      const row = result.row;
      const date = row.observedOn ?? collectedAt;
      const current = byListing.get(row.externalId);
      if (!current) {
        byListing.set(row.externalId, {
          latest: row,
          latestDate: date,
          observations: row.observedOn ? new Map([[row.observedOn, row]]) : new Map(),
        });
      } else {
        if (date >= current.latestDate) {
          current.latest = row;
          current.latestDate = date;
        }
        if (row.observedOn) current.observations.set(row.observedOn, row);
      }
    }

    const listings = Array.from(byListing.entries());
    const batchSize = opts.batchSize ?? 500;
    let imported = 0;
    let observations = 0;
    const warnings: string[] = [];

    for (let i = 0; i < listings.length; i += batchSize) {
      const slice = listings.slice(i, i + batchSize);
      const existing = await this.listingRepo.find({
        where: { source, externalId: In(slice.map(([id]) => id)) } as any,
        select: ['id', 'externalId'] as any,
      });
      const idByExternal = new Map(existing.map((row) => [row.externalId, row.id]));

      const values = slice.map(([externalId, agg]) => {
        const row = agg.latest;
        const priceReais = row.priceCents / 100;
        return {
          id: idByExternal.get(externalId) ?? randomUUID(),
          externalId,
          source,
          city: opts.city,
          snapshotDate: new Date(`${agg.latestDate}T00:00:00.000Z`),
          collectedAt: new Date(`${agg.latestDate}T00:00:00.000Z`),
          latitude: row.latitude,
          longitude: row.longitude,
          priceCents: row.priceCents,
          roomType: row.roomType,
          listingType: row.listingType,
          neighborhood: row.neighborhood,
          bedrooms: row.bedrooms,
          accommodates: row.accommodates,
          occupancyRate: row.occupancyRate,
          airbnbListingId: row.airbnbListingId,
          license: opts.license,
          ingestBatchId: batchId,
          category: deriveCategory(priceReais, row.bedrooms),
        };
      });

      await this.listingRepo
        .createQueryBuilder()
        .insert()
        .into(ExternalListing)
        .values(values as any)
        .orUpdate(
          [
            'city', 'snapshotDate', 'collectedAt', 'latitude', 'longitude', 'priceCents', 'roomType',
            'listingType', 'neighborhood', 'bedrooms', 'accommodates', 'occupancyRate', 'airbnbListingId',
            'license', 'ingestBatchId', 'category',
          ],
          ['source', 'externalId'],
        )
        .execute();
      imported += values.length;

      const obsValues = slice.flatMap(([externalId, agg], idx) =>
        Array.from(agg.observations.entries()).map(([observedOn, row]) => ({
          id: randomUUID(),
          externalListingId: values[idx].id,
          observedOn,
          priceCents: row.priceCents,
          occupancyRate: row.occupancyRate,
          _ext: externalId,
        })),
      );
      for (let j = 0; j < obsValues.length; j += 2000) {
        const part = obsValues.slice(j, j + 2000).map(({ _ext, ...rest }) => rest);
        await this.observationRepo
          .createQueryBuilder()
          .insert()
          .into(MarketListingObservation)
          .values(part as any)
          .orUpdate(['priceCents', 'occupancyRate'], ['externalListingId', 'observedOn'])
          .execute();
        observations += part.length;
      }
    }

    if (!imported) warnings.push('Nenhuma linha válida foi importada: confira o mapeamento de colunas.');
    if (skipped > 0) warnings.push(`${skipped} linha(s) puladas; veja o motivo em skippedReasons.`);

    await this.logRepo.save(
      this.logRepo.create({
        source,
        city: opts.city,
        license: opts.license,
        collectedAt: new Date(`${collectedAt}T00:00:00.000Z`),
        fileName: opts.fileName ? opts.fileName.slice(-255) : null,
        rowsParsed: rows.length - 1,
        rowsImported: imported,
        rowsSkipped: skipped,
        observationsImported: observations,
        importedByUserId: opts.importedByUserId ?? null,
      }),
    );

    this.logger.log(
      `Dataset licenciado ${source} (${opts.city}, ${opts.license}): ${imported} anúncios, ${observations} observações, ${skipped} linhas puladas.`,
    );
    return {
      batchId,
      source,
      parsed: rows.length - 1,
      imported,
      skipped,
      skippedReasons,
      observations,
      collectedAt,
      warnings,
    };
  }
}
