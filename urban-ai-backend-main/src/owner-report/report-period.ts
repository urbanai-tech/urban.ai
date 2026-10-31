/**
 * Janela mensal do relatório do proprietário, sempre no calendário de São Paulo
 * (nunca UTC) e com a mesma convenção de `weekly-host-report.ts`: início inclusivo,
 * fim exclusivo, chave `YYYY-MM`.
 */
import { addDaysToDateKey, saoPauloDayBounds, toSaoPauloDateKey } from 'src/common/sp-date';

export type ReportPeriod = {
  /** `YYYY-MM`. */
  key: string;
  startKey: string;
  endKeyExclusive: string;
  start: Date;
  endExclusive: Date;
  daysInMonth: number;
  /** "setembro de 2026". */
  label: string;
};

const PERIOD_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MONTHS_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export function isValidPeriodKey(value: unknown): value is string {
  return typeof value === 'string' && PERIOD_RE.test(value) && Number(value.slice(0, 4)) >= 2020;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Soma `delta` meses a uma chave `YYYY-MM` (aritmética de calendário). */
export function shiftPeriodKey(key: string, delta: number): string {
  const match = PERIOD_RE.exec(key);
  if (!match) throw new RangeError(`período inválido (esperado YYYY-MM): ${key}`);
  const index = Number(match[1]) * 12 + (Number(match[2]) - 1) + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** Mês de calendário (SP) que contém `now`. */
export function currentPeriodKey(now: Date): string {
  return toSaoPauloDateKey(now).slice(0, 7);
}

/** Último mês cheio (SP) anterior a `now`: o que o relatório mensal cobre. */
export function previousPeriodKey(now: Date): string {
  return shiftPeriodKey(currentPeriodKey(now), -1);
}

export function periodBounds(key: string): ReportPeriod {
  const match = PERIOD_RE.exec(key);
  if (!match) throw new RangeError(`período inválido (esperado YYYY-MM): ${key}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const startKey = `${key}-01`;
  const endKeyExclusive = `${shiftPeriodKey(key, 1)}-01`;
  return {
    key,
    startKey,
    endKeyExclusive,
    start: saoPauloDayBounds(startKey).start,
    endExclusive: saoPauloDayBounds(endKeyExclusive).start,
    daysInMonth: new Date(Date.UTC(year, month, 0)).getUTCDate(),
    label: `${MONTHS_PT[month - 1]} de ${year}`,
  };
}

/** Último dia (`YYYY-MM-DD`) do mês de `dateKey`. */
export function lastDayOfMonthKey(dateKey: string): string {
  return addDaysToDateKey(`${shiftPeriodKey(dateKey.slice(0, 7), 1)}-01`, -1);
}

function isWeekend(dateKey: string): boolean {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6;
}

/**
 * Dia útil = não é sábado/domingo nem está em `skipDates` (feriados nacionais que a
 * operação listar em `OWNER_REPORT_SKIP_DATES`). Feriados móveis e municipais NÃO são
 * calculados: sem a lista, só o fim de semana conta.
 */
export function isBusinessDay(dateKey: string, skipDates: ReadonlySet<string> = new Set()): boolean {
  return !isWeekend(dateKey) && !skipDates.has(dateKey);
}

/** Posição (1, 2, 3...) de `dateKey` entre os dias úteis do seu mês; null se não for dia útil. */
export function businessDayIndexInMonth(dateKey: string, skipDates: ReadonlySet<string> = new Set()): number | null {
  if (!isBusinessDay(dateKey, skipDates)) return null;
  const day = Number(dateKey.slice(8, 10));
  let index = 0;
  for (let current = 1; current <= day; current += 1) {
    if (isBusinessDay(`${dateKey.slice(0, 7)}-${pad(current)}`, skipDates)) index += 1;
  }
  return index;
}

export function parseSkipDates(raw: string | undefined | null): Set<string> {
  const out = new Set<string>();
  for (const item of String(raw ?? '').split(',')) {
    const value = item.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) out.add(value);
  }
  return out;
}
