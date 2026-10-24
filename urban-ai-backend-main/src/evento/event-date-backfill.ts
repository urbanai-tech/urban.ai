import { normalizeEventDates, toSaoPauloDateKey } from '../common/sp-date';

/**
 * Lógica pura do backfill de datas de eventos (D3). Usada por
 * `scripts/backfill-event-dates-sp.ts` (que cuida de I/O) e testada em
 * `event-date-backfill.spec.ts`.
 *
 * Recalcula o início/fim que a política nova (ver docs/runbooks/datas-e-fuso-horario.md)
 * produziria a partir do payload ORIGINAL guardado em `event_sources.rawPayload`
 * e compara com o que está gravado em `events`.
 */

export type DateBackfillClass =
  | 'unchanged'
  | 'instant_shift' // instante muda, mas o dia de São Paulo permanece
  | 'day_shift' // o dia de calendário de São Paulo muda (o caso que quebra preço/recomendação)
  | 'no_raw_payload'
  | 'unparseable';

export interface DateBackfillInput {
  storedStart: Date;
  storedEnd: Date | null;
  source: string | null;
  rawStart: unknown;
  rawEnd: unknown;
  /**
   * Fontes cujos datetimes SEM offset, no payload legado, eram UTC (ex.:
   * `api-football` antes da correção do coletor). Para elas o texto naive é
   * lido como UTC em vez de horário de São Paulo.
   */
  utcNaiveSources?: readonly string[];
}

export interface DateBackfillDecision {
  classification: DateBackfillClass;
  expectedStart?: Date;
  expectedEnd?: Date;
  storedDayKey?: string;
  expectedDayKey?: string;
}

const NAIVE_RE = /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/;
const HAS_OFFSET_RE = /(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/;

function asLegacyUtc(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const raw = value.trim();
  return NAIVE_RE.test(raw) && !HAS_OFFSET_RE.test(raw) ? `${raw.replace(' ', 'T')}Z` : value;
}

export function classifyEventDateBackfill(input: DateBackfillInput): DateBackfillDecision {
  if (input.rawStart === undefined || input.rawStart === null || input.rawStart === '') {
    return { classification: 'no_raw_payload' };
  }
  const utcNaive = Boolean(input.source && input.utcNaiveSources?.includes(input.source));
  const rawStart = utcNaive ? asLegacyUtc(input.rawStart) : input.rawStart;
  const rawEnd = utcNaive ? asLegacyUtc(input.rawEnd) : input.rawEnd;

  const normalized = normalizeEventDates(rawStart as string | Date, (rawEnd ?? null) as string | Date | null);
  if (!normalized) return { classification: 'unparseable' };

  const storedDayKey = toSaoPauloDateKey(input.storedStart);
  const expectedDayKey = toSaoPauloDateKey(normalized.dataInicio);
  const startSame = input.storedStart.getTime() === normalized.dataInicio.getTime();
  const endSame = !input.storedEnd || input.storedEnd.getTime() === normalized.dataFim.getTime();

  const base = {
    expectedStart: normalized.dataInicio,
    expectedEnd: normalized.dataFim,
    storedDayKey,
    expectedDayKey,
  };
  if (startSame && endSame) return { classification: 'unchanged', ...base };
  if (storedDayKey !== expectedDayKey) return { classification: 'day_shift', ...base };
  return { classification: 'instant_shift', ...base };
}
