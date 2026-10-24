import {
  DEFAULT_KNN_K,
  extractRawFeatures,
  fitKnnScaler,
  haversineKm,
  MAX_KNN_K,
  projectToKm,
  resolveKnnK,
  transformKnnFeatures,
} from './knn-features';
import { PropertyClassifier } from './knn-classifier';

describe('knn-features — projeção geográfica', () => {
  const se = { lat: -23.5505, lng: -46.6333 };

  it('projeção local em km bate com haversine em escala urbana (< 0,5%)', () => {
    const pinheiros = { lat: -23.5614, lng: -46.7016 };
    const tatuape = { lat: -23.5403, lng: -46.5762 };
    const a = projectToKm(pinheiros, se);
    const b = projectToKm(tatuape, se);
    const euclid = Math.hypot(a.xKm - b.xKm, a.yKm - b.yKm);
    const hav = haversineKm(pinheiros, tatuape);
    expect(hav).toBeGreaterThan(12);
    expect(Math.abs(euclid - hav) / hav).toBeLessThan(0.005);
  });

  it('extractRawFeatures rejeita coordenada ausente/inválida e aplica defaults', () => {
    expect(extractRawFeatures({ lat: undefined, lng: -46 })).toBeNull();
    expect(extractRawFeatures({ lat: 123, lng: -46 })).toBeNull();
    expect(extractRawFeatures({ lat: -23.5, lng: -46.6 })).toEqual({
      lat: -23.5,
      lng: -46.6,
      metroDistanceKm: 0.5,
      amenitiesCount: 1,
    });
  });
});

describe('knn-features — scaler z-score ajustado no treino', () => {
  const rows = [
    { lat: -23.55, lng: -46.63, metroDistanceKm: 0.2, amenitiesCount: 5 },
    { lat: -23.60, lng: -46.70, metroDistanceKm: 2.0, amenitiesCount: 30 },
    { lat: -23.52, lng: -46.58, metroDistanceKm: 1.0, amenitiesCount: 12 },
    { lat: -23.57, lng: -46.66, metroDistanceKm: 0.6, amenitiesCount: 40 },
  ];

  it('features transformadas do treino têm média ~0 e desvio ~1 (métricas não-geo)', () => {
    const scaler = fitKnnScaler(rows);
    const t = rows.map((r) => transformKnnFeatures(r, scaler));
    for (const d of [2, 3]) {
      const col = t.map((v) => v[d]);
      const mean = col.reduce((s, v) => s + v, 0) / col.length;
      const sd = Math.sqrt(col.reduce((s, v) => s + (v - mean) ** 2, 0) / col.length);
      expect(mean).toBeCloseTo(0, 6);
      expect(sd).toBeCloseTo(1, 6);
    }
  });

  it('x e y compartilham o mesmo desvio (isotropia: 1 km leste = 1 km norte)', () => {
    const scaler = fitKnnScaler(rows);
    expect(scaler.std[0]).toBe(scaler.std[1]);
    expect(scaler.origin.lat).toBeCloseTo(-23.56, 2);
  });

  it('coluna constante não divide por zero', () => {
    const constant = rows.map((r) => ({ ...r, metroDistanceKm: 0.5 }));
    const scaler = fitKnnScaler(constant);
    expect(scaler.std[2]).toBe(1);
    expect(transformKnnFeatures(constant[0], scaler).every(Number.isFinite)).toBe(true);
  });

  it('amenidades não dominam mais a distância: vizinho geográfico vence', () => {
    // Dois clusters geográficos distantes (~15 km). O ponto consultado está no
    // cluster A, mas tem contagem de amenidades parecida com o cluster B.
    // Sem normalização, 10 amenidades de diferença (unidade inteira) pesam
    // mais que 0,13° (~15 km) — o modelo legado erra; o v2 acerta.
    const train: any[] = [];
    for (let i = 0; i < 6; i++) {
      train.push({ lat: -23.55 + i * 0.002, lng: -46.63 + i * 0.002, metroDistance: 0.5, amenitiesCount: 10 + i, category: 0 });
      train.push({ lat: -23.68 + i * 0.002, lng: -46.76 + i * 0.002, metroDistance: 0.5, amenitiesCount: 20 + i, category: 2 });
    }
    const classifier = new PropertyClassifier();
    classifier.train(train);
    const query = { lat: -23.551, lng: -46.631, metroDistance: 0.5, amenitiesCount: 21 };
    expect(classifier.classifyLegacy(query).categoryId).toBe(2);
    expect(classifier.classify(query).categoryId).toBe(0);
  });
});

describe('knn-features — K configurável', () => {
  it('default 5, limitado ao tamanho do treino e a MAX_KNN_K', () => {
    expect(resolveKnnK(100, undefined)).toBe(DEFAULT_KNN_K);
    expect(resolveKnnK(3, undefined)).toBe(3);
    expect(resolveKnnK(100, '7')).toBe(7);
    expect(resolveKnnK(1000, '999')).toBe(MAX_KNN_K);
    expect(resolveKnnK(100, 'abc')).toBe(DEFAULT_KNN_K);
    expect(resolveKnnK(100, '0')).toBe(DEFAULT_KNN_K);
  });
});
