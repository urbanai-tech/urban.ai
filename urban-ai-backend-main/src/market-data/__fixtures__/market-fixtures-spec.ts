import { MarketConfig } from '../market-config';
import { MarketListingRecord, MarketTarget } from '../market-data.types';

/** Helpers de teste (excluídos do build por terminarem em `spec.ts`; não são suíte de testes). */

export const TARGET: MarketTarget = {
  addressId: 'addr-target',
  userId: 'user-target',
  latitude: -23.5612,
  longitude: -46.6821,
  airbnbListingId: '9999999999',
  bedrooms: 1,
  listingType: 'entire_home',
  capacity: 2,
  ownAdr: 300,
};

export const TEST_CONFIG: Pick<MarketConfig, 'minHosts' | 'minExternalListings' | 'externalMaxAgeDays'> = {
  minHosts: 5,
  minExternalListings: 8,
  externalMaxAgeDays: 548,
};

/** Registro próximo do alvo (~100 m); sobrescreva o que o teste precisa. */
export function rec(overrides: Partial<MarketListingRecord> = {}): MarketListingRecord {
  const id = overrides.sourceListingId ?? `l-${Math.random().toString(36).slice(2, 8)}`;
  const source = overrides.source ?? 'customers';
  return {
    source,
    sourceListingId: id,
    dedupKey: `${source}:${id}`,
    latitude: -23.5615,
    longitude: -46.6825,
    neighborhood: 'Bairro Sintetico A',
    city: 'sao-paulo',
    adr: 300,
    occupancy: 0.7,
    occupancyIsProxy: false,
    bedrooms: 1,
    listingType: 'entire_home',
    capacity: 2,
    collectedAt: '2026-10-20',
    license: source === 'customers' ? 'first_party' : source === 'inside_airbnb' ? 'cc_by_4' : 'licensed_display_aggregate',
    ownerKey: source === 'customers' ? `owner-${id}` : null,
    ...overrides,
  };
}

/** N registros de clientes com anfitriões distintos e diárias 100, 200, … */
export function customers(n: number, adr = (i: number) => 100 * (i + 1)): MarketListingRecord[] {
  return Array.from({ length: n }, (_, i) =>
    rec({
      source: 'customers',
      sourceListingId: `c${i}`,
      adr: adr(i),
      ownerKey: `owner-${i}`,
      // posições distintas: o casamento por posição entre fontes não deve juntar por acaso
      latitude: -23.5615 + 0.0004 * i,
    }),
  );
}

/** N anúncios externos distintos. */
export function externals(
  n: number,
  source: 'licensed_dataset' | 'inside_airbnb' = 'licensed_dataset',
  adr = (i: number) => 200 + 20 * i,
): MarketListingRecord[] {
  return Array.from({ length: n }, (_, i) =>
    rec({
      source,
      sourceListingId: `e${source}${i}`,
      dedupKey: `abnb:${source === 'inside_airbnb' ? 5 : 6}00${i}`,
      adr: adr(i),
      latitude: -23.5615 - 0.0004 * (i + 1) - (source === 'inside_airbnb' ? 0.01 : 0),
    }),
  );
}
