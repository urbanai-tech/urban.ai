/**
 * Agregação PURA (sem I/O) do bloco "sua semana" do relatório semanal do anfitrião.
 *
 * Regras de honestidade (produto):
 *  - só conta o que está registrado: recomendação gerada, aceita, aplicada (com o preço
 *    que o anfitrião informou) e resultado que ELE registrou;
 *  - nada de zeros fabricados: contagem 0 vira `null` ("sem dados" no e-mail);
 *  - receita só aparece se o anfitrião registrou `receitaReal` (> 0) — nunca é estimada;
 *  - a semana é a semana de calendário de São Paulo (segunda a domingo), nunca UTC.
 */
import { addDaysToDateKey, saoPauloDayBounds, toSaoPauloDateKey, tryToSaoPauloDateKey } from 'src/common/sp-date';

export type ReportWeek = {
  /** Segunda-feira (SP) que abre a semana reportada, `YYYY-MM-DD`. */
  startKey: string;
  /** Segunda-feira (SP) seguinte, exclusiva, `YYYY-MM-DD`. */
  endKeyExclusive: string;
  start: Date;
  endExclusive: Date;
  /** "11/05 a 17/05". */
  label: string;
};

/**
 * Última semana CHEIA (segunda a domingo, em São Paulo) anterior a `now`.
 * Segunda 08:30 BRT -> a semana que terminou ontem à noite. Quinta -> segunda a domingo anteriores.
 */
export function lastFullSaoPauloWeek(now: Date): ReportWeek {
  const todayKey = toSaoPauloDateKey(now);
  const [y, m, d] = todayKey.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
  const thisMonday = addDaysToDateKey(todayKey, -((dow + 6) % 7));
  const startKey = addDaysToDateKey(thisMonday, -7);
  const lastDayKey = addDaysToDateKey(thisMonday, -1);
  return {
    startKey,
    endKeyExclusive: thisMonday,
    start: saoPauloDayBounds(startKey).start,
    endExclusive: saoPauloDayBounds(thisMonday).start,
    label: `${formatDayMonth(startKey)} a ${formatDayMonth(lastDayKey)}`,
  };
}

/** Segunda-feira (SP) da semana corrente, como instante: a janela da "uma vez por semana". */
export function currentSaoPauloWeekStart(now: Date): Date {
  return lastFullSaoPauloWeek(now).endExclusive;
}

function formatDayMonth(key: string): string {
  const [, month, day] = key.split('-');
  return `${day}/${month}`;
}

/** Linha mínima de `AnalisePreco` (com `evento`) que a agregação lê. */
export type WeeklyAnalysisRow = {
  id: string;
  endereco?: { id?: string | null } | null;
  evento?: { nome?: string | null; dataInicio?: Date | string | null } | null;
  criadoEm?: Date | string | null;
  aceitoEm?: Date | string | null;
  aplicadoEm?: Date | string | null;
  resultadoRegistradoEm?: Date | string | null;
  precoSugerido?: unknown;
  precoAplicado?: unknown;
  reservaStatus?: string | null;
  receitaReal?: unknown;
  noitesReservadas?: unknown;
  status?: string | null;
};

export type WeeklyAppliedItem = {
  eventName: string;
  dateLabel: string;
  suggestedPrice: number | null;
  appliedPrice: number | null;
};

export type WeeklyPendingOutcome = {
  analysisId: string;
  eventName: string;
  dateLabel: string;
  appliedPrice: number | null;
};

export type WeeklyPropertyPerformance = {
  weekLabel: string;
  /** null = sem dados (nenhuma recomendação nova na semana). */
  generated: number | null;
  accepted: number | null;
  applied: number | null;
  appliedItems: WeeklyAppliedItem[];
  outcomesRecorded: number | null;
  /** Soma de `receitaReal` que o anfitrião registrou na semana; null se ninguém registrou. */
  recordedRevenue: number | null;
  recordedNights: number | null;
  pendingOutcomes: WeeklyPendingOutcome[];
  pendingOutcomesTotal: number;
};

const MAX_APPLIED_ITEMS = 5;
const MAX_PENDING_ITEMS = 5;

function toTime(value: unknown): number | null {
  if (!value) return null;
  const time = (value instanceof Date ? value : new Date(value as string)).getTime();
  return Number.isNaN(time) ? null : time;
}

function inWindow(value: unknown, week: ReportWeek): boolean {
  const time = toTime(value);
  return time !== null && time >= week.start.getTime() && time < week.endExclusive.getTime();
}

function positiveNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function nonNegativeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * O anfitrião de fato registrou um resultado? Exige o carimbo de registro E algum dado
 * concreto (reserva booked/not_booked/blocked, receita ou noites). "unknown" sozinho,
 * ou só uma observação, não conta como resultado.
 */
export function hasRecordedOutcome(row: WeeklyAnalysisRow): boolean {
  if (!row.resultadoRegistradoEm) return false;
  const reserva = String(row.reservaStatus ?? '');
  if (reserva === 'booked' || reserva === 'not_booked' || reserva === 'blocked') return true;
  return nonNegativeNumber(row.receitaReal) !== null || nonNegativeNumber(row.noitesReservadas) !== null;
}

function eventDayKey(row: WeeklyAnalysisRow): string | null {
  return tryToSaoPauloDateKey(row.evento?.dataInicio ?? null);
}

function eventDateLabel(row: WeeklyAnalysisRow): string {
  const key = eventDayKey(row);
  return key ? formatDayMonth(key) : 'data a confirmar';
}

/**
 * Aplicada, evento já passou (dia de SP anterior a hoje) e nenhum resultado registrado:
 * é o que o relatório pede para o anfitrião preencher.
 */
export function isOutcomePending(row: WeeklyAnalysisRow, todayKey: string): boolean {
  if (!row.aplicadoEm || positiveNumber(row.precoAplicado) === null) return false;
  if (hasRecordedOutcome(row)) return false;
  const dayKey = eventDayKey(row);
  return dayKey !== null && dayKey < todayKey;
}

/**
 * Agrega por imóvel (`endereco.id`). Só devolve entrada para imóveis que têm ALGO a
 * dizer (atividade na semana ou resultado pendente); os demais ficam de fora e o
 * template mostra "sem dados".
 */
export function aggregateWeeklyPerformance(
  rows: WeeklyAnalysisRow[],
  week: ReportWeek,
  now: Date,
): Map<string, WeeklyPropertyPerformance> {
  const todayKey = toSaoPauloDateKey(now);
  const byProperty = new Map<string, WeeklyAnalysisRow[]>();
  const seen = new Set<string>();
  for (const row of rows) {
    const propertyId = row.endereco?.id;
    if (!propertyId || !row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    const list = byProperty.get(propertyId) ?? [];
    list.push(row);
    byProperty.set(propertyId, list);
  }

  const result = new Map<string, WeeklyPropertyPerformance>();
  for (const [propertyId, propertyRows] of byProperty) {
    const generated = propertyRows.filter((row) => inWindow(row.criadoEm, week)).length;
    const accepted = propertyRows.filter((row) => inWindow(row.aceitoEm, week)).length;
    const appliedRows = propertyRows
      .filter((row) => inWindow(row.aplicadoEm, week) && positiveNumber(row.precoAplicado) !== null)
      .sort((a, b) => (toTime(a.aplicadoEm) ?? 0) - (toTime(b.aplicadoEm) ?? 0));
    const outcomeRows = propertyRows.filter((row) => inWindow(row.resultadoRegistradoEm, week) && hasRecordedOutcome(row));
    const pendingRows = propertyRows
      .filter((row) => isOutcomePending(row, todayKey))
      .sort((a, b) => (eventDayKey(a) ?? '').localeCompare(eventDayKey(b) ?? ''));

    const revenueValues = outcomeRows
      .map((row) => positiveNumber(row.receitaReal))
      .filter((value): value is number => value !== null);
    const nightsValues = outcomeRows
      .map((row) => nonNegativeNumber(row.noitesReservadas))
      .filter((value): value is number => value !== null);

    const performance: WeeklyPropertyPerformance = {
      weekLabel: week.label,
      generated: generated || null,
      accepted: accepted || null,
      applied: appliedRows.length || null,
      appliedItems: appliedRows.slice(0, MAX_APPLIED_ITEMS).map((row) => ({
        eventName: row.evento?.nome || 'Evento',
        dateLabel: eventDateLabel(row),
        suggestedPrice: positiveNumber(row.precoSugerido),
        appliedPrice: positiveNumber(row.precoAplicado),
      })),
      outcomesRecorded: outcomeRows.length || null,
      recordedRevenue: revenueValues.length ? revenueValues.reduce((sum, value) => sum + value, 0) : null,
      recordedNights: nightsValues.length ? nightsValues.reduce((sum, value) => sum + value, 0) : null,
      pendingOutcomes: pendingRows.slice(0, MAX_PENDING_ITEMS).map((row) => ({
        analysisId: row.id,
        eventName: row.evento?.nome || 'Evento',
        dateLabel: eventDateLabel(row),
        appliedPrice: positiveNumber(row.precoAplicado),
      })),
      pendingOutcomesTotal: pendingRows.length,
    };

    const hasAnything =
      performance.generated !== null ||
      performance.accepted !== null ||
      performance.applied !== null ||
      performance.outcomesRecorded !== null ||
      performance.pendingOutcomesTotal > 0;
    if (hasAnything) result.set(propertyId, performance);
  }
  return result;
}
