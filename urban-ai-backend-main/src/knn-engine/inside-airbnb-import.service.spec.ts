import {
  parseCsv,
  parsePriceToCents,
  countAmenities,
  mapInsideAirbnbRow,
} from './inside-airbnb-import.service';

describe('inside-airbnb import — helpers puros', () => {
  describe('parseCsv', () => {
    it('lida com campos entre aspas com vírgula e aspas escapadas', () => {
      const csv = 'a,b,c\n1,"x, y","diz ""oi"""\n2,z,w';
      const rows = parseCsv(csv);
      expect(rows[0]).toEqual(['a', 'b', 'c']);
      expect(rows[1]).toEqual(['1', 'x, y', 'diz "oi"']);
      expect(rows[2]).toEqual(['2', 'z', 'w']);
    });

    it('lida com quebra de linha dentro de aspas', () => {
      const csv = 'a,b\n1,"linha1\nlinha2"\n2,ok';
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(3);
      expect(rows[1][1]).toBe('linha1\nlinha2');
    });
  });

  describe('parsePriceToCents', () => {
    it('formato en "$1,234.00" → 123400', () => {
      expect(parsePriceToCents('$1,234.00')).toBe(123400);
    });
    it('formato pt "R$ 1.234,00" → 123400', () => {
      expect(parsePriceToCents('R$ 1.234,00')).toBe(123400);
    });
    it('inteiro simples "350" → 35000', () => {
      expect(parsePriceToCents('350')).toBe(35000);
    });
    it('inválido → null', () => {
      expect(parsePriceToCents('')).toBeNull();
      expect(parsePriceToCents('grátis')).toBeNull();
      expect(parsePriceToCents(null)).toBeNull();
    });
  });

  describe('countAmenities', () => {
    it('conta array JSON', () => {
      expect(countAmenities('["Wifi","Kitchen","Pool"]')).toBe(3);
    });
    it('vazio → 0', () => {
      expect(countAmenities('[]')).toBe(0);
    });
    it('null → null', () => {
      expect(countAmenities(null)).toBeNull();
    });
  });

  describe('mapInsideAirbnbRow', () => {
    it('mapeia uma linha válida e deriva categoria', () => {
      const rec = {
        id: '12345',
        latitude: '-23.56',
        longitude: '-46.65',
        price: '$500.00',
        room_type: 'Entire home/apt',
        bedrooms: '2',
        accommodates: '4',
        minimum_nights: '2',
        availability_365: '180',
        number_of_reviews: '42',
        review_scores_rating: '4.8',
        amenities: '["Wifi","Kitchen","Pool","AC","Parking","Washer","TV","Heating"]',
      };
      const m = mapInsideAirbnbRow(rec, 'sao-paulo');
      expect(m).not.toBeNull();
      expect(m!.externalId).toBe('12345');
      expect(m!.priceCents).toBe(50000);
      expect(m!.amenitiesCount).toBe(8);
      expect(m!.city).toBe('sao-paulo');
      expect(m!.category).toBe('Premium'); // diária 500 + 8 amenidades
    });

    it('descarta linha sem id ou sem geo', () => {
      expect(mapInsideAirbnbRow({ id: '', latitude: '-23', longitude: '-46' }, 'sp')).toBeNull();
      expect(mapInsideAirbnbRow({ id: '1', latitude: '', longitude: '' }, 'sp')).toBeNull();
    });
  });
});
