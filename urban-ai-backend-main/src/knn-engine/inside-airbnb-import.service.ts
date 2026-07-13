import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExternalListing } from '../entities/external-listing.entity';
import { deriveCategory } from './feature-engineering.service';

// ============================================================================
// Funções puras (testáveis sem I/O)
// ============================================================================

/**
 * Parser CSV state-machine (aspas, vírgulas e quebras de linha embutidas +
 * aspas duplas escapadas). Necessário porque o listings.csv do Inside Airbnb
 * tem descrições/amenities com vírgulas e newlines dentro de aspas.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;
  const pushCell = () => {
    row.push(cell);
    cell = '';
  };
  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
    } else if (ch === ',') {
      pushCell();
      i++;
    } else if (ch === '\r') {
      i++;
    } else if (ch === '\n') {
      pushRow();
      i++;
    } else {
      cell += ch;
      i++;
    }
  }
  if (cell.length > 0 || row.length > 0) pushRow();
  return rows;
}

/** "$1,234.00" / "R$ 1.234,00" / "350" → centavos. null se inválido. */
export function parsePriceToCents(raw: string | undefined | null): number | null {
  if (!raw) return null;
  let s = String(raw).replace(/[^\d.,]/g, '').trim();
  if (!s) return null;
  // Formato pt-BR "1.234,00" → tira pontos de milhar, vírgula vira ponto.
  if (/,\d{2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, ''); // formato en "1,234.00"
  const value = Number(s);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

/** Conta amenidades de um campo tipo '["Wifi","Kitchen",...]'. */
export function countAmenities(raw: string | undefined | null): number | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.length;
  } catch {
    // fallback: conta por vírgula
    const inner = String(raw).replace(/^[\[{]|[\]}]$/g, '');
    if (!inner.trim()) return 0;
    return inner.split(',').length;
  }
  return null;
}

function toInt(raw: string | undefined): number | null {
  if (raw === undefined || raw === '') return null;
  const n = parseInt(String(raw).replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function toFloat(raw: string | undefined): number | null {
  if (raw === undefined || raw === '') return null;
  const n = parseFloat(String(raw).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export type MappedListing = Partial<ExternalListing> & {
  externalId: string;
  latitude: number;
  longitude: number;
};

/**
 * Mapeia uma linha do listings.csv (header→valor) para um ExternalListing.
 * Retorna null se faltar id ou geo (inúteis para o KNN).
 */
export function mapInsideAirbnbRow(
  rec: Record<string, string>,
  city: string,
  source = 'inside-airbnb',
  snapshotDate: Date | null = null,
): MappedListing | null {
  const externalId = (rec.id ?? '').trim();
  const latitude = toFloat(rec.latitude);
  const longitude = toFloat(rec.longitude);
  if (!externalId || latitude === null || longitude === null) return null;

  const priceCents = parsePriceToCents(rec.price);
  const amenitiesCount = countAmenities(rec.amenities);
  const bedrooms = toInt(rec.bedrooms);
  const priceReais = priceCents !== null ? priceCents / 100 : null;
  const category = deriveCategory(priceReais, amenitiesCount ?? bedrooms);

  return {
    externalId,
    source,
    city,
    snapshotDate,
    latitude,
    longitude,
    priceCents,
    roomType: rec.room_type?.trim() || null,
    bedrooms,
    bathrooms: toFloat(rec.bathrooms ?? rec.bathrooms_text),
    accommodates: toInt(rec.accommodates),
    minNights: toInt(rec.minimum_nights),
    availability365: toInt(rec.availability_365),
    numReviews: toInt(rec.number_of_reviews),
    reviewScore: toFloat(rec.review_scores_rating),
    amenitiesCount,
    category,
  };
}

// ============================================================================
// Serviço
// ============================================================================

/**
 * Importa comps do Inside Airbnb (listings.csv) para `external_listing`, dando
 * densidade de vizinhos ao KNN (bootstrap do Tier 0→1). Idempotente por
 * (source, externalId, city): reimportar um snapshot atualiza em vez de duplicar.
 */
@Injectable()
export class InsideAirbnbImportService {
  private readonly logger = new Logger(InsideAirbnbImportService.name);

  constructor(
    @InjectRepository(ExternalListing) private readonly repo: Repository<ExternalListing>,
  ) {}

  async importFromCsv(
    text: string,
    opts: { city: string; source?: string; snapshotDate?: Date | null; batchSize?: number },
  ): Promise<{ parsed: number; imported: number; skipped: number }> {
    const source = opts.source ?? 'inside-airbnb';
    const rows = parseCsv(text);
    if (rows.length < 2) return { parsed: 0, imported: 0, skipped: 0 };

    const header = rows[0].map((h) => h.trim());
    const idx = (name: string) => header.indexOf(name);
    const cols = [
      'id', 'latitude', 'longitude', 'price', 'room_type', 'bedrooms', 'bathrooms',
      'bathrooms_text', 'accommodates', 'minimum_nights', 'availability_365',
      'number_of_reviews', 'review_scores_rating', 'amenities',
    ];
    const colIdx: Record<string, number> = {};
    for (const c of cols) colIdx[c] = idx(c);

    let imported = 0;
    let skipped = 0;
    let batch: Array<Partial<ExternalListing>> = [];
    const batchSize = opts.batchSize ?? 500;

    const flush = async () => {
      if (batch.length === 0) return;
      // upsert por (source, externalId, city)
      await this.repo
        .createQueryBuilder()
        .insert()
        .into(ExternalListing)
        .values(batch as any)
        .orUpdate(
          ['latitude', 'longitude', 'priceCents', 'roomType', 'bedrooms', 'bathrooms',
            'accommodates', 'minNights', 'availability365', 'numReviews', 'reviewScore',
            'amenitiesCount', 'category', 'snapshotDate'],
          ['source', 'externalId'],
        )
        .execute();
      imported += batch.length;
      batch = [];
    };

    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r];
      if (!cells || cells.length < 2) continue;
      const rec: Record<string, string> = {};
      for (const c of cols) {
        const at = colIdx[c];
        if (at >= 0) rec[c] = cells[at] ?? '';
      }
      const mapped = mapInsideAirbnbRow(rec, opts.city, source, opts.snapshotDate ?? null);
      if (!mapped) {
        skipped += 1;
        continue;
      }
      batch.push(mapped);
      if (batch.length >= batchSize) await flush();
    }
    await flush();

    this.logger.log(
      `Inside Airbnb import (${opts.city}): ${imported} importados, ${skipped} pulados de ${rows.length - 1} linhas.`,
    );
    return { parsed: rows.length - 1, imported, skipped };
  }
}
