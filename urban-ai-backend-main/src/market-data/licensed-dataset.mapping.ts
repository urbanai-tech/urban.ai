import { normalizeListingType } from './market-math';
import { MarketListingType } from './market-data.types';

/**
 * Mapeamento de colunas de um CSV de dataset licenciado (AirROI, Base dos Dados, AirDNA…
 * convertidos para CSV) para o formato interno. Funções puras, sem I/O.
 */

export const LICENSED_MAPPING_FIELDS = [
  'externalId',
  'latitude',
  'longitude',
  'adr',
  'occupancy',
  'observedDate',
  'neighborhood',
  'roomType',
  'bedrooms',
  'accommodates',
  'airbnbListingId',
  'city',
] as const;

export type LicensedMappingField = (typeof LICENSED_MAPPING_FIELDS)[number];

/** Campos sem os quais a linha não serve. */
export const LICENSED_REQUIRED_FIELDS: readonly LicensedMappingField[] = ['externalId', 'latitude', 'longitude', 'adr'];

export interface LicensedColumnMapping extends Partial<Record<LicensedMappingField, string>> {
  /** `reais` (padrão) ou `cents`: unidade da coluna de diária. */
  adrUnit?: 'reais' | 'cents';
  /** `ratio` (0–1), `percent` (0–100) ou `auto` (padrão: > 1 vira percentual). */
  occupancyScale?: 'ratio' | 'percent' | 'auto';
}

/** Cabeçalhos usados quando o admin não envia mapeamento (colunas opcionais ausentes são ignoradas). */
export const DEFAULT_LICENSED_MAPPING: Required<Pick<LicensedColumnMapping, LicensedMappingField>> = {
  externalId: 'listing_id',
  latitude: 'latitude',
  longitude: 'longitude',
  adr: 'adr',
  occupancy: 'occupancy',
  observedDate: 'date',
  neighborhood: 'neighborhood',
  roomType: 'room_type',
  bedrooms: 'bedrooms',
  accommodates: 'accommodates',
  airbnbListingId: 'airbnb_listing_id',
  city: 'city',
};

export interface ResolvedLicensedMapping {
  /** campo interno → índice da coluna no CSV. */
  columns: Partial<Record<LicensedMappingField, number>>;
  adrUnit: 'reais' | 'cents';
  occupancyScale: 'ratio' | 'percent' | 'auto';
  errors: string[];
}

function normHeader(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Casa o mapeamento (padrão + o do admin) com o cabeçalho do arquivo. Coluna pedida pelo admin e
 * ausente no arquivo é erro; coluna do mapeamento padrão ausente é só ignorada; campo obrigatório
 * sem coluna é erro.
 */
export function resolveLicensedMapping(
  header: string[],
  custom?: LicensedColumnMapping | null,
): ResolvedLicensedMapping {
  const errors: string[] = [];
  const index = new Map<string, number>();
  header.forEach((name, i) => {
    const key = normHeader(name);
    if (key && !index.has(key)) index.set(key, i);
  });
  const columns: Partial<Record<LicensedMappingField, number>> = {};
  for (const field of LICENSED_MAPPING_FIELDS) {
    const requested = custom?.[field];
    if (requested !== undefined && requested !== '') {
      const at = index.get(normHeader(requested));
      if (at === undefined) errors.push(`coluna "${requested}" (campo ${field}) não existe no arquivo`);
      else columns[field] = at;
      continue;
    }
    const fallback = index.get(normHeader(DEFAULT_LICENSED_MAPPING[field]));
    if (fallback !== undefined) columns[field] = fallback;
  }
  for (const field of LICENSED_REQUIRED_FIELDS) {
    if (columns[field] === undefined && !errors.some((e) => e.includes(`campo ${field}`))) {
      errors.push(`campo obrigatório "${field}" sem coluna no arquivo (padrão: ${DEFAULT_LICENSED_MAPPING[field]})`);
    }
  }
  return {
    columns,
    adrUnit: custom?.adrUnit === 'cents' ? 'cents' : 'reais',
    occupancyScale: custom?.occupancyScale ?? 'auto',
    errors,
  };
}

/** Valida o JSON de mapeamento enviado pelo admin: só campos conhecidos, valores texto. */
export function parseLicensedMappingJson(raw: string | undefined | null): LicensedColumnMapping | null {
  if (!raw || !String(raw).trim()) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    throw new Error('mapping não é um JSON válido');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('mapping deve ser um objeto { campo: "coluna" }');
  }
  const allowed = new Set<string>([...LICENSED_MAPPING_FIELDS, 'adrUnit', 'occupancyScale']);
  const out: LicensedColumnMapping = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!allowed.has(key)) throw new Error(`mapping: campo desconhecido "${key}"`);
    if (typeof value !== 'string') throw new Error(`mapping: o valor de "${key}" deve ser texto`);
    if (key === 'adrUnit') {
      if (value !== 'reais' && value !== 'cents') throw new Error('mapping: adrUnit deve ser "reais" ou "cents"');
      out.adrUnit = value;
    } else if (key === 'occupancyScale') {
      if (value !== 'ratio' && value !== 'percent' && value !== 'auto') {
        throw new Error('mapping: occupancyScale deve ser "ratio", "percent" ou "auto"');
      }
      out.occupancyScale = value;
    } else {
      out[key as LicensedMappingField] = value.slice(0, 80);
    }
  }
  return out;
}

export interface MappedLicensedRow {
  externalId: string;
  latitude: number;
  longitude: number;
  priceCents: number;
  occupancyRate: number | null;
  /** YYYY-MM-DD quando o arquivo traz série temporal. */
  observedOn: string | null;
  neighborhood: string | null;
  roomType: string | null;
  listingType: MarketListingType | null;
  bedrooms: number | null;
  accommodates: number | null;
  airbnbListingId: string | null;
  city: string | null;
}

/** `row` preenchida = linha válida; senão `reason` diz por que foi pulada. */
export interface LicensedRowResult {
  row: MappedLicensedRow | null;
  reason: string | null;
}

/** Diária fora desta faixa (R$) é tratada como erro do arquivo, não como dado. */
export const LICENSED_ADR_MIN = 10;
export const LICENSED_ADR_MAX = 50_000;

function parseNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  let s = String(raw).replace(/[^\d.,-]/g, '').trim();
  if (!s) return null;
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    // o último separador é o decimal; o outro é de milhar ("1.234,50" ou "1,234.50")
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    // só vírgula: "1,234" / "12,345,678" = milhar; "350,50" / "-23,5612" = decimal
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseInteger(raw: string | undefined): number | null {
  const n = parseNumber(raw);
  return n === null ? null : Math.round(n);
}

/** Aceita YYYY-MM-DD (com ou sem hora) e DD/MM/YYYY. null se inválida. */
export function parseDateKey(raw: string | undefined): string | null {
  if (!raw) return null;
  const text = String(raw).trim();
  let y: number;
  let m: number;
  let d: number;
  let match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(text))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

export function mapLicensedRow(cells: string[], mapping: ResolvedLicensedMapping): LicensedRowResult {
  const get = (field: LicensedMappingField): string | undefined => {
    const at = mapping.columns[field];
    return at === undefined ? undefined : (cells[at] ?? '').trim();
  };
  const externalId = get('externalId') ?? '';
  if (!externalId) return { row: null, reason: 'sem id do anúncio' };
  const latitude = parseNumber(get('latitude'));
  const longitude = parseNumber(get('longitude'));
  if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return { row: null, reason: 'coordenadas inválidas' };
  }
  if (latitude === 0 && longitude === 0) return { row: null, reason: 'coordenadas inválidas' };

  const adrRaw = parseNumber(get('adr'));
  if (adrRaw === null) return { row: null, reason: 'diária inválida' };
  const adrReais = mapping.adrUnit === 'cents' ? adrRaw / 100 : adrRaw;
  if (!(adrReais >= LICENSED_ADR_MIN && adrReais <= LICENSED_ADR_MAX)) {
    return { row: null, reason: 'diária fora do intervalo plausível' };
  }

  let observedOn: string | null = null;
  if (mapping.columns.observedDate !== undefined) {
    observedOn = parseDateKey(get('observedDate'));
    if (!observedOn) return { row: null, reason: 'data da observação inválida' };
  }

  let occupancyRate: number | null = null;
  const occupancyRaw = parseNumber(get('occupancy'));
  if (occupancyRaw !== null) {
    const asPercent =
      mapping.occupancyScale === 'percent' || (mapping.occupancyScale === 'auto' && occupancyRaw > 1);
    const ratio = asPercent ? occupancyRaw / 100 : occupancyRaw;
    occupancyRate = ratio >= 0 && ratio <= 1 ? Number(ratio.toFixed(4)) : null;
  }

  const airbnbDigits = (get('airbnbListingId') ?? '').replace(/\D/g, '');
  const roomType = get('roomType') ?? '';
  return {
    reason: null,
    row: {
      externalId: externalId.slice(0, 32),
      latitude,
      longitude,
      priceCents: Math.round(adrReais * 100),
      occupancyRate,
      observedOn,
      neighborhood: (get('neighborhood') ?? '').slice(0, 96) || null,
      roomType: roomType.slice(0, 48) || null,
      listingType: normalizeListingType(roomType),
      bedrooms: parseInteger(get('bedrooms')),
      accommodates: parseInteger(get('accommodates')),
      airbnbListingId: airbnbDigits && airbnbDigits.length <= 32 ? airbnbDigits : null,
      city: (get('city') ?? '') || null,
    },
  };
}
