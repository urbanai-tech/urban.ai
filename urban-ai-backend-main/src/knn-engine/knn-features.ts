/**
 * Engenharia e normalização de features do classificador KNN de imóveis.
 *
 * Problema que isto resolve (auditoria 2026-10-24): o KNN recebia
 * `[lat, lng, metroDistance, amenitiesCount]` crus. Dentro de São Paulo
 * lat/lng variam ~0,3° enquanto amenitiesCount varia de 0 a 50+ — a
 * distância euclidiana era dominada pela contagem de amenidades e a
 * geografia praticamente não pesava (e 1° de longitude ≠ 1° de latitude).
 *
 * Agora:
 *  1. lat/lng são projetados para km (projeção equiretangular local em torno
 *     do centróide do conjunto de treino). Em escala de cidade o erro frente
 *     ao haversine é < 0,5%, e a distância euclidiana entre (x, y) passa a ser
 *     distância real em km.
 *  2. Cada feature é padronizada (z-score) com média/desvio **ajustados no
 *     conjunto de treino**. x e y usam o MESMO desvio (desvio radial agrupado)
 *     para preservar a isotropia — 1 km para leste pesa igual a 1 km para norte.
 *  3. O scaler é parte do modelo serializável (`KnnScaler`), então quem
 *     persistir o modelo persiste junto a normalização usada no treino.
 */

/** Raio médio da Terra em km (mesmo valor usado pelo turf/haversine). */
export const EARTH_RADIUS_KM = 6371.0088;

export const KNN_FEATURE_NAMES = ['xKm', 'yKm', 'metroDistanceKm', 'amenitiesCount'] as const;

export const KNN_FEATURE_DEFAULTS = {
  metroDistanceKm: 0.5,
  amenitiesCount: 1,
};

export interface GeoOrigin {
  lat: number;
  lng: number;
}

export interface KnnScaler {
  version: 'knn-scaler-v1';
  origin: GeoOrigin;
  /** Média de cada feature (ordem de KNN_FEATURE_NAMES). */
  mean: number[];
  /** Desvio de cada feature; nunca 0 (piso de 1e-6 para colunas constantes). */
  std: number[];
}

export interface RawKnnFeatures {
  lat: number;
  lng: number;
  metroDistanceKm: number;
  amenitiesCount: number;
}

const MIN_STD = 1e-6;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Distância haversine em km — referência para validar a projeção. */
export function haversineKm(a: GeoOrigin, b: GeoOrigin): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Projeção equiretangular local: (lat, lng) → (x, y) em km relativos à origem.
 * Distância euclidiana entre pontos projetados ≈ haversine em escala urbana.
 */
export function projectToKm(point: GeoOrigin, origin: GeoOrigin): { xKm: number; yKm: number } {
  const xKm = toRad(point.lng - origin.lng) * Math.cos(toRad(origin.lat)) * EARTH_RADIUS_KM;
  const yKm = toRad(point.lat - origin.lat) * EARTH_RADIUS_KM;
  return { xKm, yKm };
}

/** Extrai features cruas de um objeto de imóvel; null se faltar coordenada. */
export function extractRawFeatures(property: any): RawKnnFeatures | null {
  const lat = Number(property?.lat);
  const lng = Number(property?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  const metroDistance = Number(property?.metroDistance);
  const amenitiesCount = Number(property?.amenitiesCount);
  return {
    lat,
    lng,
    metroDistanceKm:
      Number.isFinite(metroDistance) && metroDistance >= 0
        ? metroDistance
        : KNN_FEATURE_DEFAULTS.metroDistanceKm,
    amenitiesCount:
      Number.isFinite(amenitiesCount) && amenitiesCount >= 0
        ? amenitiesCount
        : KNN_FEATURE_DEFAULTS.amenitiesCount,
  };
}

function toProjectedVector(raw: RawKnnFeatures, origin: GeoOrigin): number[] {
  const { xKm, yKm } = projectToKm(raw, origin);
  return [xKm, yKm, raw.metroDistanceKm, raw.amenitiesCount];
}

function meanOf(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function varianceOf(values: number[], mean: number): number {
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
}

/**
 * Ajusta o scaler no conjunto de treino. Origem = centróide do treino.
 * x/y compartilham o desvio radial agrupado sqrt((var_x + var_y) / 2).
 */
export function fitKnnScaler(rows: RawKnnFeatures[]): KnnScaler {
  if (rows.length === 0) {
    throw new Error('fitKnnScaler: conjunto de treino vazio');
  }
  const origin: GeoOrigin = {
    lat: meanOf(rows.map((r) => r.lat)),
    lng: meanOf(rows.map((r) => r.lng)),
  };
  const projected = rows.map((r) => toProjectedVector(r, origin));
  const dims = projected[0].length;
  const mean: number[] = [];
  const variance: number[] = [];
  for (let d = 0; d < dims; d++) {
    const col = projected.map((v) => v[d]);
    const m = meanOf(col);
    mean.push(m);
    variance.push(varianceOf(col, m));
  }
  const geoStd = Math.sqrt((variance[0] + variance[1]) / 2);
  const std = variance.map((v, d) => {
    const s = d < 2 ? geoStd : Math.sqrt(v);
    return Number.isFinite(s) && s > MIN_STD ? s : 1;
  });
  return { version: 'knn-scaler-v1', origin, mean, std };
}

/** Aplica o scaler (já ajustado) a um vetor cru. */
export function transformKnnFeatures(raw: RawKnnFeatures, scaler: KnnScaler): number[] {
  const v = toProjectedVector(raw, scaler.origin);
  return v.map((value, d) => (value - scaler.mean[d]) / scaler.std[d]);
}

/**
 * K configurável via `PRICING_KNN_K` (default 5, limitado a [1, 25]) e nunca
 * maior que o tamanho do treino. K=3 (antigo) era muito sensível a ruído de
 * rótulo; 5 é o default usual para conjuntos de dezenas a milhares de pontos.
 */
export const DEFAULT_KNN_K = 5;
export const MAX_KNN_K = 25;

export function resolveKnnK(trainingSize: number, envValue = process.env.PRICING_KNN_K): number {
  const parsed = Number.parseInt(String(envValue ?? ''), 10);
  const requested = Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, MAX_KNN_K) : DEFAULT_KNN_K;
  return Math.max(1, Math.min(requested, trainingSize));
}
