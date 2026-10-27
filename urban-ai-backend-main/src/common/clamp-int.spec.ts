import { clampInt } from './clamp-int';

describe('clampInt', () => {
  const opts = { min: 1, max: 100, fallback: 30 };

  it('mantém valores válidos dentro do intervalo', () => {
    expect(clampInt(5, opts)).toBe(5);
    expect(clampInt('7', opts)).toBe(7);
  });

  it('limita ao mínimo e ao máximo', () => {
    expect(clampInt(0, opts)).toBe(1);
    expect(clampInt(-10, opts)).toBe(1);
    expect(clampInt(5000, opts)).toBe(100);
  });

  it('trunca decimais', () => {
    expect(clampInt(2.9, opts)).toBe(2);
  });

  it('usa o fallback para NaN, texto, vazio, nulo e infinito', () => {
    expect(clampInt(NaN, opts)).toBe(30);
    expect(clampInt(parseInt('abc', 10), opts)).toBe(30);
    expect(clampInt('', opts)).toBe(30);
    expect(clampInt(undefined, opts)).toBe(30);
    expect(clampInt(null, opts)).toBe(30);
    expect(clampInt(Infinity, opts)).toBe(30);
  });

  it('o fallback também respeita o intervalo', () => {
    expect(clampInt(NaN, { min: 1, max: 10, fallback: 50 })).toBe(10);
  });
});
