/**
 * IA-3d — baseline sazonal de demanda para São Paulo.
 *
 * Problema: o eventDemandScore media relevância/público/venue, mas ignorava a
 * data. Um evento médio que cai no Réveillon ou no Carnaval gera MUITO mais
 * demanda de hospedagem que o mesmo evento numa terça morta de fevereiro. Sem
 * baseline, o score subestima esses períodos.
 *
 * Este módulo é PURO (sem dependências externas, sem chaves) e determinístico:
 * calcula feriados móveis a partir da Páscoa e retorna um pequeno acréscimo de
 * pontos (0..10) que o score soma. Baseline 0 para datas comuns => sem regressão.
 *
 * Cobre: feriados nacionais fixos + móveis (Sexta-Santa, Carnaval, Corpus
 * Christi), aniversário de São Paulo (25/01) e janelas de alta temporada
 * (Réveillon/verão, semana de Carnaval, recesso de julho).
 */

export type SeasonalBaseline = {
  /** Pontos a somar ao eventDemandScore (0..MAX_SEASONAL_POINTS). */
  points: number;
  /** Rótulo curto do período (ex.: "Réveillon/Verão", "Carnaval"). */
  label: string | null;
  /** Motivos legíveis (para explicação/drivers). */
  reasons: string[];
};

export const MAX_SEASONAL_POINTS = 10;

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), em UTC. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=março, 4=abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86_400_000);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/** md = mês*100 + dia (ex.: 1o de janeiro = 101, 25 de dezembro = 1225). */
function md(date: Date): number {
  return (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
}

/** Feriados nacionais fixos + municipais de SP (mês*100+dia). */
const FIXED_HOLIDAYS = new Set<number>([
  101, // Confraternização Universal
  125, // Aniversário de São Paulo (municipal)
  421, // Tiradentes
  501, // Dia do Trabalho
  907, // Independência
  1012, // Nossa Senhora Aparecida
  1102, // Finados
  1115, // Proclamação da República
  1120, // Consciência Negra (nacional desde 2024)
  1225, // Natal
]);

/**
 * Retorna os feriados MÓVEIS relevantes de um ano (datas em UTC): Sexta-Santa,
 * Terça de Carnaval e Corpus Christi, derivados da Páscoa.
 */
export function movableHolidays(year: number): { goodFriday: Date; carnivalTuesday: Date; corpusChristi: Date } {
  const easter = easterSunday(year);
  return {
    goodFriday: addDays(easter, -2),
    carnivalTuesday: addDays(easter, -47),
    corpusChristi: addDays(easter, 60),
  };
}

/** É feriado (fixo ou móvel) em SP? */
export function isSpHoliday(date: Date): boolean {
  if (FIXED_HOLIDAYS.has(md(date))) return true;
  const { goodFriday, carnivalTuesday, corpusChristi } = movableHolidays(date.getUTCFullYear());
  return (
    isSameDay(date, goodFriday) ||
    isSameDay(date, carnivalTuesday) ||
    isSameDay(date, corpusChristi)
  );
}

/** Janela de Carnaval: sábado anterior à Quarta-feira de Cinzas (6 dias). */
function isCarnivalWindow(date: Date): boolean {
  const { carnivalTuesday } = movableHolidays(date.getUTCFullYear());
  const start = addDays(carnivalTuesday, -4); // sexta antes
  const end = addDays(carnivalTuesday, 1); // quarta de cinzas
  return date >= start && date <= end;
}

/**
 * Baseline sazonal para uma data. Combina feriado, janelas de alta temporada e
 * proximidade de fim de semana longo. Resultado somável (0..MAX_SEASONAL_POINTS).
 */
export function seasonalDemandBaseline(input: Date | string | null | undefined): SeasonalBaseline {
  const date = input instanceof Date ? input : input ? new Date(input) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return { points: 0, label: null, reasons: [] };
  }

  const reasons: string[] = [];
  let points = 0;
  let label: string | null = null;

  const monthDay = md(date);
  const dow = date.getUTCDay(); // 0=dom, 6=sáb

  // Réveillon + alta temporada de verão (15/dez a 20/jan).
  if (monthDay >= 1215 || monthDay <= 120) {
    points += 8;
    label = 'Réveillon/Verão';
    reasons.push('Alta temporada de verão (Réveillon e férias).');
  }

  // Semana de Carnaval.
  if (isCarnivalWindow(date)) {
    points += 8;
    label = label ?? 'Carnaval';
    reasons.push('Semana de Carnaval.');
  }

  // Recesso de inverno (julho).
  if (date.getUTCMonth() === 6) {
    points += 4;
    label = label ?? 'Recesso de julho';
    reasons.push('Recesso escolar de julho.');
  }

  // Feriado no dia exato.
  if (isSpHoliday(date)) {
    points += 5;
    label = label ?? 'Feriado';
    reasons.push('Feriado em São Paulo.');
  }

  // Fim de semana longo: feriado colado no fim de semana (sex/seg).
  if (!isSpHoliday(date) && (dow === 5 || dow === 1)) {
    const neighbor = dow === 5 ? addDays(date, -1) : addDays(date, 1);
    // heurística leve: fim de semana comum não pontua; só sinaliza proximidade
    // de feriado real via reasons (sem pontos extras para não inflar).
    if (isSpHoliday(neighbor)) {
      points += 3;
      label = label ?? 'Fim de semana prolongado';
      reasons.push('Fim de semana prolongado por feriado.');
    }
  }

  return {
    points: Math.min(points, MAX_SEASONAL_POINTS),
    label,
    reasons,
  };
}
