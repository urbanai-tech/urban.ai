import { hasValidCoordinates, parseCoordinate, parseCoordinates } from './coordinates';

describe('parseCoordinate', () => {
  it.each([null, undefined, '', '   ', NaN, Infinity, -Infinity, 'abc', {}, [], true])(
    'rejeita %p (nunca vira 0)',
    (value) => {
      expect(parseCoordinate(value)).toBeNull();
    },
  );

  it('aceita números e strings numéricas, inclusive "0" e vírgula decimal', () => {
    expect(parseCoordinate(-23.56)).toBe(-23.56);
    expect(parseCoordinate('-46.65')).toBe(-46.65);
    expect(parseCoordinate('-46,65')).toBe(-46.65);
    expect(parseCoordinate('0')).toBe(0);
    expect(parseCoordinate(0)).toBe(0);
  });
});

describe('parseCoordinates / hasValidCoordinates', () => {
  it('aceita coordenadas de São Paulo como número ou string', () => {
    expect(parseCoordinates(-23.5613, -46.6565)).toEqual({ latitude: -23.5613, longitude: -46.6565 });
    expect(parseCoordinates('-23.5613', '-46.6565')).toEqual({ latitude: -23.5613, longitude: -46.6565 });
    expect(hasValidCoordinates(-23.5613, -46.6565)).toBe(true);
    expect(hasValidCoordinates('-23.5613', '-46.6565')).toBe(true);
  });

  it('rejeita null/undefined/vazio de qualquer lado', () => {
    expect(hasValidCoordinates(null, null)).toBe(false);
    expect(hasValidCoordinates(undefined, -46.6)).toBe(false);
    expect(hasValidCoordinates(-23.5, '')).toBe(false);
    expect(hasValidCoordinates(NaN, -46.6)).toBe(false);
  });

  it('rejeita 0,0 exato (Golfo da Guiné), mesmo como "0"', () => {
    expect(hasValidCoordinates(0, 0)).toBe(false);
    expect(hasValidCoordinates('0', '0')).toBe(false);
    expect(hasValidCoordinates(0, 10)).toBe(true);
  });

  it('rejeita fora de faixa (lat ±90, lng ±180)', () => {
    expect(hasValidCoordinates(91, -46)).toBe(false);
    expect(hasValidCoordinates(-91, -46)).toBe(false);
    expect(hasValidCoordinates(-23, -181)).toBe(false);
    expect(hasValidCoordinates(-23, 181)).toBe(false);
    expect(hasValidCoordinates(90, 180)).toBe(true);
  });
});
