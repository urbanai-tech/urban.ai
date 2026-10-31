import {
  MARKET_CAPACITY_BANDS,
  MARKET_LISTING_TYPES,
  MarketCapacityBand,
  MarketListingRecord,
  MarketListingType,
  MarketTypology,
} from './market-data.types';

/** Funções puras de geografia, estatística e tipologia (sem I/O). */

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Caixa delimitadora (graus) de um raio em km ao redor de um ponto. */
export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const dLat = radiusKm / 111.32;
  const cosLat = Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  const dLng = radiusKm / (111.32 * cosLat);
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

function finiteSorted(values: Array<number | null | undefined>): number[] {
  return values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
}

/** Mediana arredondada para inteiro (mesma regra do market intel original). 0 quando vazio. */
export function medianRounded(values: Array<number | null | undefined>): number {
  const nums = finiteSorted(values);
  if (!nums.length) return 0;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : Math.round((nums[mid - 1] + nums[mid]) / 2);
}

/** Mediana exata; null quando vazio. */
export function medianExact(values: Array<number | null | undefined>): number | null {
  const nums = finiteSorted(values);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

export interface Percentiles {
  p25: number;
  p50: number;
  p75: number;
}

/** p25/p50/p75 por interpolação linear; null quando vazio. */
export function percentiles(values: Array<number | null | undefined>, digits = 0): Percentiles | null {
  const nums = finiteSorted(values);
  if (!nums.length) return null;
  const at = (q: number) => {
    const pos = (nums.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return Number((nums[lo] + (nums[hi] - nums[lo]) * (pos - lo)).toFixed(digits));
  };
  return { p25: at(0.25), p50: at(0.5), p75: at(0.75) };
}

/** Posição de `value` entre os comparáveis (0–100): % de comps com diária ≤ à sua. */
export function percentileRank(value: number, comps: number[]): number {
  if (!comps.length) return 0;
  return Math.round((comps.filter((v) => v <= value).length / comps.length) * 100);
}

export function dateKeyAddDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round(
    (new Date(`${toKey}T00:00:00.000Z`).getTime() - new Date(`${fromKey}T00:00:00.000Z`).getTime()) / 86_400_000,
  );
}

/** Tipo de anúncio normalizado a partir de textos de qualquer fonte ("Entire home/apt", "Apartment"…). */
export function normalizeListingType(raw: unknown): MarketListingType | null {
  const text = String(raw ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
  if (!text) return null;
  if ((MARKET_LISTING_TYPES as readonly string[]).includes(text)) return text as MarketListingType;
  if (text.includes('shared')) return 'shared_room';
  if (text.includes('hotel')) return 'hotel_room';
  if (text.includes('private') || text.includes('privativ') || text.includes('quarto')) return 'private_room';
  if (
    text.includes('entire') ||
    text.includes('inteir') ||
    /(apartment|apartamento|apto|house|casa|loft|studio|kitnet|flat|condo|villa|chalet|cabin)/.test(text)
  ) {
    return 'entire_home';
  }
  return 'other';
}

export function capacityBandOf(capacity: number | null | undefined): MarketCapacityBand | null {
  if (capacity == null || !Number.isFinite(capacity) || capacity < 1) return null;
  if (capacity <= 2) return '1-2';
  if (capacity <= 4) return '3-4';
  if (capacity <= 6) return '5-6';
  return '7+';
}

export function isCapacityBand(value: unknown): value is MarketCapacityBand {
  return (MARKET_CAPACITY_BANDS as readonly string[]).includes(String(value));
}

export function isListingType(value: unknown): value is MarketListingType {
  return (MARKET_LISTING_TYPES as readonly string[]).includes(String(value));
}

/** Há algum filtro de tipologia ativo? */
export function hasTypologyFilter(typology: MarketTypology | undefined | null): boolean {
  return Boolean(typology && (typology.rooms != null || typology.listingType || typology.capacity));
}

/**
 * O registro atende à tipologia pedida? Campo pedido e ausente no registro = não atende
 * (não adivinhamos). `rooms >= 4` significa "4 ou mais".
 */
export function matchesTypology(record: MarketListingRecord, typology: MarketTypology | undefined | null): boolean {
  if (!typology) return true;
  if (typology.rooms != null) {
    if (record.bedrooms == null) return false;
    if (typology.rooms >= 4 ? record.bedrooms < 4 : record.bedrooms !== typology.rooms) return false;
  }
  if (typology.listingType && record.listingType !== typology.listingType) return false;
  if (typology.capacity && capacityBandOf(record.capacity) !== typology.capacity) return false;
  return true;
}
