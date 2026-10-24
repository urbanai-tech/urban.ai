/**
 * Derivação de rótulos (Econômico=0 / Standard=1 / Premium=2) para o KNN a
 * partir de dado OBSERVÁVEL — a diária (ADR) do imóvel comparada à dos
 * vizinhos — em vez de `category ?? 1` (que rotulava quase tudo como Standard,
 * auditoria 2026-10-24, `pricing-bootstrap.service.ts`).
 *
 * Regra:
 *  - Agrupa imóveis por bairro (`neighborhoodKey`) ou, na falta, por célula
 *    geográfica de ~2 km (0,02°).
 *  - Se o grupo tem >= `minGroupSize` imóveis com ADR, o percentil é calculado
 *    dentro do grupo (preço relativo ao bairro). Senão, dentro do comp set
 *    inteiro (cidade).
 *  - percentil < 1/3 → 0 (Econômico); < 2/3 → 1 (Standard); senão → 2 (Premium).
 *
 * Fallback documentado (em ordem):
 *  1. Sem ADR válido → usa a categoria explícita do registro, se houver
 *     (número 0/1/2 ou texto 'eco*' / 'prem*' / 'stand*').
 *  2. Sem nada → 1 (Standard), marcado com `labelSource='fallback'` para o
 *     log de treino mostrar quanto do treino é chute.
 */

export type KnnLabelSource = 'adr_neighborhood' | 'adr_city' | 'explicit_category' | 'fallback';

export interface KnnLabelInput {
  lat?: number | null;
  lng?: number | null;
  /** Diária observada (R$ ou centavos — só a ordem importa). */
  adr?: number | null;
  neighborhoodKey?: string | null;
  category?: number | string | null;
}

export interface KnnLabelResult {
  category: 0 | 1 | 2;
  labelSource: KnnLabelSource;
  percentile: number | null;
}

export interface KnnLabelStats {
  total: number;
  bySource: Record<KnnLabelSource, number>;
  byCategory: Record<0 | 1 | 2, number>;
}

export const DEFAULT_MIN_GROUP_SIZE = 5;
const GRID_DEG = 0.02;

function isPositive(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

export function normalizeExplicitCategory(category: unknown): 0 | 1 | 2 | null {
  if (category === null || category === undefined || category === '') return null;
  if (typeof category === 'number') {
    return category === 0 || category === 1 || category === 2 ? category : null;
  }
  const c = String(category).trim().toLowerCase();
  if (c === '0' || c === '1' || c === '2') return Number(c) as 0 | 1 | 2;
  if (c.startsWith('prem')) return 2;
  if (c.startsWith('eco')) return 0;
  if (c.startsWith('stand')) return 1;
  return null;
}

function groupKey(row: KnnLabelInput): string | null {
  const nb = String(row.neighborhoodKey ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (nb) return `nb:${nb}`;
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `grid:${Math.floor(lat / GRID_DEG)}:${Math.floor(lng / GRID_DEG)}`;
}

/** Percentil "mid-rank" de `value` dentro de `sorted` (crescente), em [0, 1]. */
export function midRankPercentile(sorted: number[], value: number): number {
  if (sorted.length <= 1) return 0.5;
  let below = 0;
  let equal = 0;
  for (const v of sorted) {
    if (v < value) below++;
    else if (v === value) equal++;
  }
  return (below + equal / 2) / sorted.length;
}

export function percentileToCategory(p: number): 0 | 1 | 2 {
  if (p < 1 / 3) return 0;
  if (p < 2 / 3) return 1;
  return 2;
}

export function deriveKnnLabels(
  rows: KnnLabelInput[],
  options: { minGroupSize?: number } = {},
): { labels: KnnLabelResult[]; stats: KnnLabelStats } {
  const minGroupSize = Math.max(2, options.minGroupSize ?? DEFAULT_MIN_GROUP_SIZE);
  const cityPrices = rows
    .map((r) => r.adr)
    .filter(isPositive)
    .sort((a, b) => a - b);

  const groups = new Map<string, number[]>();
  for (const r of rows) {
    if (!isPositive(r.adr)) continue;
    const key = groupKey(r);
    if (!key) continue;
    const arr = groups.get(key) ?? [];
    arr.push(r.adr);
    groups.set(key, arr);
  }
  for (const arr of groups.values()) arr.sort((a, b) => a - b);

  const labels = rows.map<KnnLabelResult>((r) => {
    if (isPositive(r.adr)) {
      const key = groupKey(r);
      const group = key ? groups.get(key) : undefined;
      if (group && group.length >= minGroupSize) {
        const p = midRankPercentile(group, r.adr);
        return { category: percentileToCategory(p), labelSource: 'adr_neighborhood', percentile: p };
      }
      if (cityPrices.length >= minGroupSize) {
        const p = midRankPercentile(cityPrices, r.adr);
        return { category: percentileToCategory(p), labelSource: 'adr_city', percentile: p };
      }
    }
    const explicit = normalizeExplicitCategory(r.category);
    if (explicit !== null) {
      return { category: explicit, labelSource: 'explicit_category', percentile: null };
    }
    return { category: 1, labelSource: 'fallback', percentile: null };
  });

  const stats: KnnLabelStats = {
    total: labels.length,
    bySource: { adr_neighborhood: 0, adr_city: 0, explicit_category: 0, fallback: 0 },
    byCategory: { 0: 0, 1: 0, 2: 0 },
  };
  for (const l of labels) {
    stats.bySource[l.labelSource]++;
    stats.byCategory[l.category]++;
  }
  return { labels, stats };
}
