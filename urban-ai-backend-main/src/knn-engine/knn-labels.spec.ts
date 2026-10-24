import {
  deriveKnnLabels,
  midRankPercentile,
  normalizeExplicitCategory,
  percentileToCategory,
} from './knn-labels';

describe('knn-labels — rótulo derivado do ADR', () => {
  it('percentil mid-rank e cortes em tercis', () => {
    expect(midRankPercentile([100, 200, 300], 100)).toBeCloseTo(1 / 6);
    expect(midRankPercentile([100, 200, 300], 300)).toBeCloseTo(5 / 6);
    expect(percentileToCategory(0.1)).toBe(0);
    expect(percentileToCategory(0.5)).toBe(1);
    expect(percentileToCategory(0.9)).toBe(2);
  });

  it('usa o percentil DENTRO do bairro quando o grupo é grande o bastante', () => {
    // Jardins caro, Itaquera barato. R$400 é barato nos Jardins e caro em Itaquera.
    const jardins = [400, 600, 700, 800, 900].map((adr) => ({ adr, neighborhoodKey: 'Jardins' }));
    const itaquera = [120, 150, 180, 200, 400].map((adr) => ({ adr, neighborhoodKey: 'Itaquera' }));
    const { labels, stats } = deriveKnnLabels([...jardins, ...itaquera]);
    expect(labels[0]).toMatchObject({ category: 0, labelSource: 'adr_neighborhood' }); // 400 nos Jardins
    expect(labels[9]).toMatchObject({ category: 2, labelSource: 'adr_neighborhood' }); // 400 em Itaquera
    expect(stats.bySource.adr_neighborhood).toBe(10);
    expect(stats.byCategory[1]).toBeGreaterThan(0);
  });

  it('normaliza acento/caixa do bairro e cai para célula geográfica sem bairro', () => {
    const rows = [
      ...[100, 200, 300, 400, 500].map((adr) => ({ adr, neighborhoodKey: 'Consolação' })),
      { adr: 450, neighborhoodKey: 'CONSOLACAO' },
    ];
    const { labels } = deriveKnnLabels(rows);
    expect(labels[5].labelSource).toBe('adr_neighborhood');

    const geo = [100, 200, 300, 400, 500].map((adr, i) => ({ adr, lat: -23.551 + i * 0.001, lng: -46.631 }));
    expect(deriveKnnLabels(geo).labels.every((l) => l.labelSource === 'adr_neighborhood')).toBe(true);
  });

  it('grupo pequeno usa o percentil da cidade', () => {
    const rows = [
      { adr: 100, neighborhoodKey: 'A' },
      { adr: 200, neighborhoodKey: 'B' },
      { adr: 300, neighborhoodKey: 'C' },
      { adr: 400, neighborhoodKey: 'D' },
      { adr: 500, neighborhoodKey: 'E' },
    ];
    const { labels } = deriveKnnLabels(rows);
    expect(labels.map((l) => l.labelSource)).toEqual(Array(5).fill('adr_city'));
    expect(labels.map((l) => l.category)).toEqual([0, 0, 1, 2, 2]);
  });

  it('fallback documentado: sem ADR → categoria explícita → Standard', () => {
    const { labels, stats } = deriveKnnLabels([
      { adr: null, category: 'Premium' },
      { adr: 0, category: 0 },
      { adr: undefined },
    ]);
    expect(labels[0]).toEqual({ category: 2, labelSource: 'explicit_category', percentile: null });
    expect(labels[1]).toEqual({ category: 0, labelSource: 'explicit_category', percentile: null });
    expect(labels[2]).toEqual({ category: 1, labelSource: 'fallback', percentile: null });
    expect(stats.bySource.fallback).toBe(1);
  });

  it('não rotula tudo como Standard quando há preço (regressão do `category ?? 1`)', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ adr: 100 + i * 20, lat: -23.55, lng: -46.63 }));
    const { stats } = deriveKnnLabels(rows);
    expect(stats.byCategory[0]).toBe(10);
    expect(stats.byCategory[1]).toBe(10);
    expect(stats.byCategory[2]).toBe(10);
  });

  it('normalizeExplicitCategory aceita número e texto', () => {
    expect(normalizeExplicitCategory('economico')).toBe(0);
    expect(normalizeExplicitCategory('Standard')).toBe(1);
    expect(normalizeExplicitCategory('2')).toBe(2);
    expect(normalizeExplicitCategory(7)).toBeNull();
    expect(normalizeExplicitCategory('luxo')).toBeNull();
  });
});
