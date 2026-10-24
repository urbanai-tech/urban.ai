/**
 * Datas de calendário no fuso America/Sao_Paulo.
 *
 * Convenção do Urban AI para eventos (ver docs/runbooks/datas-e-fuso-horario.md):
 *  - Instantes são armazenados em UTC (coluna `datetime` + driver em UTC).
 *  - O "dia" de um evento, de um preço, de uma recomendação ou de uma
 *    auto-aplicação é SEMPRE o dia de calendário em São Paulo — nunca o dia UTC.
 *    Um jogo às 21:30 BRT é 00:30Z do dia seguinte; `toISOString().slice(0, 10)`
 *    devolveria o dia errado.
 *  - Datetime sem offset vindo de coletores é interpretado como horário de
 *    São Paulo; datetime com offset é um instante absoluto; data pura
 *    (`YYYY-MM-DD`) é um evento de dia inteiro em São Paulo.
 *
 * Sem dependência externa: usa Intl.DateTimeFormat com timeZone IANA.
 * (O Brasil não tem horário de verão desde 2019, mas o cálculo via Intl
 * continua correto para datas históricas.)
 */

export const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const NAIVE_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?$/;
const OFFSET_SUFFIX_RE = /(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/;

let dateKeyFormatter: Intl.DateTimeFormat | null = null;
let partsFormatter: Intl.DateTimeFormat | null = null;

function getDateKeyFormatter(): Intl.DateTimeFormat {
  dateKeyFormatter ??= new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return dateKeyFormatter;
}

function getPartsFormatter(): Intl.DateTimeFormat {
  partsFormatter ??= new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return partsFormatter;
}

function toValidDate(input: Date | string | number): Date {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Data inválida: ${String(input)}`);
  }
  return date;
}

/** `YYYY-MM-DD` do instante, no calendário de São Paulo. Lança RangeError se inválido. */
export function toSaoPauloDateKey(input: Date | string | number): string {
  return getDateKeyFormatter().format(toValidDate(input));
}

/** Variante que devolve null em vez de lançar (entrada vazia ou inválida). */
export function tryToSaoPauloDateKey(input: Date | string | number | null | undefined): string | null {
  if (input === null || input === undefined || input === '') return null;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return getDateKeyFormatter().format(date);
}

/**
 * Chave de dia para valores que podem ser data pura OU instante:
 * `YYYY-MM-DD` passa direto (já é um dia de calendário); qualquer outra coisa é
 * tratada como instante e convertida para o dia de São Paulo. null se inválido.
 */
export function toDayKey(input: Date | string | number | null | undefined): string | null {
  if (typeof input === 'string' && DATE_ONLY_RE.test(input.trim())) return input.trim();
  return tryToSaoPauloDateKey(input);
}

/** Dia de hoje (ou de `now`) em São Paulo. */
export function todaySaoPauloDateKey(now: Date = new Date()): string {
  return toSaoPauloDateKey(now);
}

/** Componentes de calendário/relógio de um instante em São Paulo. */
export function saoPauloParts(input: Date | string | number): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = getPartsFormatter().formatToParts(toValidDate(input));
  const read = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

/** Offset (ms) de São Paulo em relação a UTC no instante dado (negativo: atrás de UTC). */
function saoPauloOffsetMs(instant: Date): number {
  const p = saoPauloParts(instant);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncated = Math.floor(instant.getTime() / 1000) * 1000;
  return asUtc - truncated;
}

/**
 * Converte um horário de relógio de São Paulo (sem offset) para o instante UTC.
 * `month` é 1-12.
 */
export function saoPauloLocalToInstant(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): Date {
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  // Duas iterações cobrem transições de offset (relevante só para datas históricas).
  let guess = wallAsUtc - saoPauloOffsetMs(new Date(wallAsUtc));
  guess = wallAsUtc - saoPauloOffsetMs(new Date(guess));
  return new Date(guess);
}

/** Início (00:00:00.000 BRT) e fim (23:59:59.999 BRT) do dia `YYYY-MM-DD` de São Paulo, como instantes. */
export function saoPauloDayBounds(dateKey: string): { start: Date; end: Date } {
  const m = DATE_ONLY_RE.exec(dateKey);
  if (!m) throw new RangeError(`dateKey inválida (esperado YYYY-MM-DD): ${dateKey}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const start = saoPauloLocalToInstant(y, mo, d, 0, 0, 0, 0);
  const end = saoPauloLocalToInstant(y, mo, d, 23, 59, 59, 999);
  return { start, end };
}

/** Soma `days` dias a uma chave `YYYY-MM-DD` (aritmética de calendário, sem fuso). */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const m = DATE_ONLY_RE.exec(dateKey);
  if (!m) throw new RangeError(`dateKey inválida (esperado YYYY-MM-DD): ${dateKey}`);
  const base = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

export interface ParsedEventDateTime {
  /** Instante absoluto (armazenado em UTC). */
  instant: Date;
  /** True se a entrada era só a data (`YYYY-MM-DD`) — evento de dia inteiro em São Paulo. */
  dateOnly: boolean;
  /** Como a entrada foi interpretada. */
  interpretedAs: 'instant' | 'date' | 'sao_paulo_local' | 'offset';
}

/**
 * Normaliza data/hora de ingestão de eventos (política D3):
 *  - `Date`                         → o próprio instante;
 *  - ISO com offset (`Z`/`-03:00`)  → instante absoluto;
 *  - ISO sem offset (`2026-05-10 21:30:00`) → horário de relógio de São Paulo;
 *  - `YYYY-MM-DD`                   → dia inteiro em São Paulo (00:00 BRT; com
 *    `asEndOfDay`, 23:59:59.999 BRT — usado em `dataFim`).
 * Devolve null para entrada vazia ou inválida.
 */
export function parseEventDateTime(
  value: string | Date | null | undefined,
  options: { asEndOfDay?: boolean } = {},
): ParsedEventDateTime | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : { instant: new Date(value.getTime()), dateOnly: false, interpretedAs: 'instant' };
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const dateOnly = DATE_ONLY_RE.exec(raw);
  if (dateOnly) {
    const [y, mo, d] = [Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3])];
    if (!isRealCalendarDate(y, mo, d)) return null;
    const instant = options.asEndOfDay
      ? saoPauloLocalToInstant(y, mo, d, 23, 59, 59, 999)
      : saoPauloLocalToInstant(y, mo, d, 0, 0, 0, 0);
    return { instant, dateOnly: true, interpretedAs: 'date' };
  }

  const naive = NAIVE_DATETIME_RE.exec(raw);
  if (naive) {
    const [y, mo, d, h, mi] = [Number(naive[1]), Number(naive[2]), Number(naive[3]), Number(naive[4]), Number(naive[5])];
    const s = naive[6] ? Number(naive[6]) : 0;
    const ms = naive[7] ? Number(naive[7].slice(0, 3).padEnd(3, '0')) : 0;
    if (!isRealCalendarDate(y, mo, d) || h > 23 || mi > 59 || s > 59) return null;
    return { instant: saoPauloLocalToInstant(y, mo, d, h, mi, s, ms), dateOnly: false, interpretedAs: 'sao_paulo_local' };
  }

  if (OFFSET_SUFFIX_RE.test(raw)) {
    const instant = new Date(raw.replace(' ', 'T'));
    if (!Number.isNaN(instant.getTime())) return { instant, dateOnly: false, interpretedAs: 'offset' };
  }

  return null;
}

export interface NormalizedEventDates {
  dataInicio: Date;
  dataFim: Date;
  /** True se `dataInicio` veio como data pura (evento de dia inteiro). */
  allDay: boolean;
  /** True se `dataFim` foi informada mas era inválida e caiu no fallback. */
  dataFimInvalid: boolean;
}

/**
 * Regra única de normalização de início/fim de evento (usada pelo ingest e pelo
 * script de backfill). `dataFim` ausente → igual ao início (ou fim do dia, se
 * o início for data pura). `dataFim` data pura → fim do dia em São Paulo.
 * Devolve null se `dataInicio` for inválida.
 */
export function normalizeEventDates(
  dataInicio: string | Date | null | undefined,
  dataFim?: string | Date | null,
): NormalizedEventDates | null {
  const start = parseEventDateTime(dataInicio);
  if (!start) return null;
  const end = dataFim ? parseEventDateTime(dataFim, { asEndOfDay: true }) : null;
  const fallbackEnd = start.dateOnly ? parseEventDateTime(dataInicio, { asEndOfDay: true })!.instant : start.instant;
  return {
    dataInicio: start.instant,
    dataFim: end?.instant ?? fallbackEnd,
    allDay: start.dateOnly,
    dataFimInvalid: Boolean(dataFim) && !end,
  };
}

function isRealCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}
