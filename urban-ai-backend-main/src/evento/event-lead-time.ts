/**
 * Lead time de eventos (lógica pura): antecedência, em dias, entre a primeira vez que o evento
 * entrou (`first_seen`) e a data do evento. Mediana e distribuição geral e por fonte, categoria e
 * porte. Sem I/O, para ser testada isoladamente.
 */

export type EventSizeBucket = 'large' | 'medium' | 'small' | 'unknown';

export interface LeadTimeRow {
  firstSeenAt: Date;
  dataInicio: Date;
  source: string | null;
  categoria: string | null;
  venueCapacity: number | null;
  expectedAttendance: number | null;
}

export interface LeadTimeStats {
  count: number;
  medianDays: number | null;
  p25Days: number | null;
  p75Days: number | null;
  meanDays: number | null;
}

export interface LeadTimeBucket {
  key: string;
  label: string;
  count: number;
}

export interface LeadTimeGroup extends LeadTimeStats {
  key: string;
}

export interface LeadTimeReport {
  overall: LeadTimeStats;
  /** Eventos que entraram depois de começar (antecedência negativa): fora das estatísticas. */
  lateDiscovered: number;
  distribution: LeadTimeBucket[];
  bySource: LeadTimeGroup[];
  byCategory: LeadTimeGroup[];
  bySize: LeadTimeGroup[];
}

const DAY_MS = 86_400_000;
/** Porte: público esperado (quando houver) ou capacidade do venue. */
export const LARGE_EVENT_MIN = 10_000;
export const MEDIUM_EVENT_MIN = 2_000;

export const LEAD_TIME_BUCKETS: Array<{ key: string; label: string; min: number; max: number }> = [
  { key: 'd0_6', label: '0 a 6 dias', min: 0, max: 7 },
  { key: 'd7_13', label: '7 a 13 dias', min: 7, max: 14 },
  { key: 'd14_29', label: '14 a 29 dias', min: 14, max: 30 },
  { key: 'd30_59', label: '30 a 59 dias', min: 30, max: 60 },
  { key: 'd60_plus', label: '60 dias ou mais', min: 60, max: Number.POSITIVE_INFINITY },
];

export function eventSizeBucket(row: Pick<LeadTimeRow, 'venueCapacity' | 'expectedAttendance'>): EventSizeBucket {
  const size = Math.max(Number(row.expectedAttendance ?? 0) || 0, Number(row.venueCapacity ?? 0) || 0);
  if (size <= 0) return 'unknown';
  if (size >= LARGE_EVENT_MIN) return 'large';
  if (size >= MEDIUM_EVENT_MIN) return 'medium';
  return 'small';
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Percentil por interpolação linear sobre valores já ordenados. */
export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

export function leadTimeStats(days: number[]): LeadTimeStats {
  if (days.length === 0) {
    return { count: 0, medianDays: null, p25Days: null, p75Days: null, meanDays: null };
  }
  const sorted = [...days].sort((a, b) => a - b);
  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  return {
    count: sorted.length,
    medianDays: round1(percentile(sorted, 50) as number),
    p25Days: round1(percentile(sorted, 25) as number),
    p75Days: round1(percentile(sorted, 75) as number),
    meanDays: round1(mean),
  };
}

/** Antecedência em dias (fracionária); negativa se o evento já tinha começado ao entrar. */
export function leadDays(row: Pick<LeadTimeRow, 'firstSeenAt' | 'dataInicio'>): number | null {
  const start = row.dataInicio?.getTime();
  const seen = row.firstSeenAt?.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(seen)) return null;
  return (start - seen) / DAY_MS;
}

function groupStats(buckets: Map<string, number[]>, limit?: number): LeadTimeGroup[] {
  const groups = [...buckets.entries()].map(([key, days]) => ({ key, ...leadTimeStats(days) }));
  groups.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  return limit ? groups.slice(0, limit) : groups;
}

const SIZE_ORDER: EventSizeBucket[] = ['large', 'medium', 'small', 'unknown'];

export function buildLeadTimeReport(rows: LeadTimeRow[], groupLimit = 15): LeadTimeReport {
  const all: number[] = [];
  let lateDiscovered = 0;
  const bySource = new Map<string, number[]>();
  const byCategory = new Map<string, number[]>();
  const bySize = new Map<string, number[]>();
  const bucketCounts = new Map<string, number>(LEAD_TIME_BUCKETS.map((b) => [b.key, 0]));

  const push = (map: Map<string, number[]>, key: string, value: number) => {
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
  };

  for (const row of rows) {
    const days = leadDays(row);
    if (days === null) continue;
    if (days < 0) {
      lateDiscovered += 1;
      continue;
    }
    all.push(days);
    push(bySource, (row.source ?? '').trim().replace(/_/g, '-').toLowerCase() || '(sem source)', days);
    push(byCategory, (row.categoria ?? '').trim().toLowerCase() || '(sem categoria)', days);
    push(bySize, eventSizeBucket(row), days);
    const bucket = LEAD_TIME_BUCKETS.find((b) => days >= b.min && days < b.max);
    if (bucket) bucketCounts.set(bucket.key, (bucketCounts.get(bucket.key) ?? 0) + 1);
  }

  return {
    overall: leadTimeStats(all),
    lateDiscovered,
    distribution: LEAD_TIME_BUCKETS.map((b) => ({ key: b.key, label: b.label, count: bucketCounts.get(b.key) ?? 0 })),
    bySource: groupStats(bySource, groupLimit),
    byCategory: groupStats(byCategory, groupLimit),
    bySize: groupStats(bySize).sort((a, b) => SIZE_ORDER.indexOf(a.key as EventSizeBucket) - SIZE_ORDER.indexOf(b.key as EventSizeBucket)),
  };
}
