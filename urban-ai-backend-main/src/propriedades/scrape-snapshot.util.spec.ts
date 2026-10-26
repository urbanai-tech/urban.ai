import { isEmptyScrapeSnapshot } from './scrape-snapshot.util';

describe('isEmptyScrapeSnapshot', () => {
  it('detecta o snapshot vazio devolvido quando a leitura do Airbnb falha', () => {
    expect(
      isEmptyScrapeSnapshot({
        propertyType: 'Desconhecido',
        latitude: null,
        longitude: null,
        bedrooms: 0,
        guestCapacity: 0,
      }),
    ).toBe(true);
    expect(isEmptyScrapeSnapshot(null)).toBe(true);
  });

  it('aceita leituras com algum dado real', () => {
    expect(
      isEmptyScrapeSnapshot({
        propertyType: 'Apartamento',
        latitude: -23.5,
        longitude: -46.6,
        bedrooms: 2,
        guestCapacity: 4,
      }),
    ).toBe(false);
    // sem coordenadas, mas com contagens e tipo: dados parciais ainda valem
    expect(
      isEmptyScrapeSnapshot({
        propertyType: 'Casa',
        latitude: null,
        longitude: null,
        bedrooms: 3,
        guestCapacity: 6,
      }),
    ).toBe(false);
  });
});
