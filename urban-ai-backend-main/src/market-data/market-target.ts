import { Address } from '../entities/addresses.entity';
import { List } from '../entities/list.entity';
import { normalizeListingType } from './market-math';
import { MarketTarget } from './market-data.types';

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Diária base do anfitrião (manual > diária > bruto), em reais inteiros; 0 quando não há. */
export function resolveOwnAdr(list: List | null | undefined): number {
  const price = Number(list?.manualDailyPrice ?? list?.dailyPrice ?? list?.raw ?? 0);
  return Number.isFinite(price) && price > 0 ? Math.round(price) : 0;
}

/** Imóvel do anfitrião no formato que as fontes e o comp set entendem. */
export function marketTargetFromAddress(address: Address, userId: string, ownAdr?: number): MarketTarget {
  const list = address.list;
  const airbnbId = String(list?.id_do_anuncio ?? '').trim();
  return {
    addressId: address.id,
    userId,
    latitude: num(address.latitude),
    longitude: num(address.longitude),
    airbnbListingId: airbnbId || null,
    bedrooms: num(list?.quartos),
    listingType: normalizeListingType(list?.propertyType),
    capacity: num(list?.hospedes),
    ownAdr: ownAdr ?? resolveOwnAdr(list),
  };
}
