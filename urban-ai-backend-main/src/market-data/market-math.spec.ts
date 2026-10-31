import { rec } from './__fixtures__/market-fixtures-spec';
import {
  boundingBox,
  capacityBandOf,
  dateKeyAddDays,
  haversineKm,
  matchesTypology,
  medianExact,
  medianRounded,
  normalizeListingType,
  percentileRank,
  percentiles,
} from './market-math';

describe('market-math', () => {
  it('haversine e caixa delimitadora são coerentes (1 km ≈ 0,009°)', () => {
    expect(haversineKm(-23.55, -46.63, -23.55, -46.63)).toBe(0);
    expect(haversineKm(-23.55, -46.63, -23.64, -46.63)).toBeCloseTo(10, 0);
    const box = boundingBox(-23.55, -46.63, 3);
    expect(box.maxLat - box.minLat).toBeCloseTo(2 * (3 / 111.32), 6);
    expect(box.maxLng).toBeGreaterThan(-46.63);
  });

  it('mediana arredondada (legado) e exata', () => {
    expect(medianRounded([])).toBe(0);
    expect(medianRounded([100, 200, 300, 400])).toBe(250);
    expect(medianRounded([100, null, 301, undefined, 200])).toBe(200);
    expect(medianExact([1, 2])).toBe(1.5);
    expect(medianExact([])).toBeNull();
  });

  it('percentis p25/p50/p75 por interpolação, e nulos quando vazio', () => {
    expect(percentiles([100, 200, 300, 400, 500])).toEqual({ p25: 200, p50: 300, p75: 400 });
    expect(percentiles([0.5, 0.7], 2)).toEqual({ p25: 0.55, p50: 0.6, p75: 0.65 });
    expect(percentiles([])).toBeNull();
  });

  it('percentil do anúncio = % de comps com diária ≤ à sua', () => {
    expect(percentileRank(300, [100, 200, 300, 400, 500])).toBe(60);
    expect(percentileRank(50, [100, 200])).toBe(0);
    expect(percentileRank(300, [])).toBe(0);
  });

  it('datas', () => {
    expect(dateKeyAddDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(dateKeyAddDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('normaliza o tipo de anúncio de qualquer fonte', () => {
    expect(normalizeListingType('Entire home/apt')).toBe('entire_home');
    expect(normalizeListingType('Apartment')).toBe('entire_home');
    expect(normalizeListingType('Casa inteira')).toBe('entire_home');
    expect(normalizeListingType('Private room')).toBe('private_room');
    expect(normalizeListingType('Quarto privativo')).toBe('private_room');
    expect(normalizeListingType('Shared room')).toBe('shared_room');
    expect(normalizeListingType('Hotel room')).toBe('hotel_room');
    expect(normalizeListingType('entire_home')).toBe('entire_home');
    expect(normalizeListingType('Barco')).toBe('other');
    expect(normalizeListingType('')).toBeNull();
    expect(normalizeListingType(undefined)).toBeNull();
  });

  it('faixas de capacidade', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 12].map(capacityBandOf)).toEqual(['1-2', '1-2', '3-4', '3-4', '5-6', '5-6', '7+', '7+']);
    expect(capacityBandOf(null)).toBeNull();
    expect(capacityBandOf(0)).toBeNull();
  });

  describe('matchesTypology', () => {
    it('sem filtro tudo passa', () => {
      expect(matchesTypology(rec(), null)).toBe(true);
      expect(matchesTypology(rec(), {})).toBe(true);
    });

    it('quartos exatos, com 4 = "4 ou mais"', () => {
      expect(matchesTypology(rec({ bedrooms: 2 }), { rooms: 2 })).toBe(true);
      expect(matchesTypology(rec({ bedrooms: 3 }), { rooms: 2 })).toBe(false);
      expect(matchesTypology(rec({ bedrooms: 6 }), { rooms: 4 })).toBe(true);
      expect(matchesTypology(rec({ bedrooms: 3 }), { rooms: 4 })).toBe(false);
    });

    it('tipo e capacidade; campo pedido e ausente no registro não casa', () => {
      expect(matchesTypology(rec({ listingType: 'private_room' }), { listingType: 'entire_home' })).toBe(false);
      expect(matchesTypology(rec({ capacity: 4 }), { capacity: '3-4' })).toBe(true);
      expect(matchesTypology(rec({ capacity: 5 }), { capacity: '3-4' })).toBe(false);
      expect(matchesTypology(rec({ bedrooms: null }), { rooms: 1 })).toBe(false);
      expect(matchesTypology(rec({ capacity: null }), { capacity: '1-2' })).toBe(false);
    });

    it('filtros combinam (E)', () => {
      const r = rec({ bedrooms: 2, listingType: 'entire_home', capacity: 4 });
      expect(matchesTypology(r, { rooms: 2, listingType: 'entire_home', capacity: '3-4' })).toBe(true);
      expect(matchesTypology(r, { rooms: 2, listingType: 'private_room', capacity: '3-4' })).toBe(false);
    });
  });
});
