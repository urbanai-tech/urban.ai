/**
 * Formatação de apresentação em pt-BR (Intl), fonte única do app.
 *
 * Só apresentação: nenhuma função aqui altera valores de cálculo. Convenções:
 *  - decimal com vírgula, milhar com ponto ("1.234,5");
 *  - moeda "R$ 310,00" (espaço sem quebra entre o símbolo e o número);
 *  - percentual sem espaço antes do "%" ("12,5%"), com sinal explícito quando
 *    for variação ("+122,6%"); zero nunca leva sinal;
 *  - distância "1,8 km"; multiplicador "2,5x";
 *  - datas no fuso de São Paulo; "YYYY-MM-DD" é dia de calendário (sem
 *    deslocar por fuso).
 *
 * Sem imports de propósito: o módulo é carregado isolado nos testes unitários.
 * Valores ausentes/não finitos devolvem `fallback` (padrão "—") para o chamador
 * decidir o texto do estado vazio.
 */

const LOCALE = "pt-BR";
export const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

type Maybe = number | null | undefined;

function finite(value: Maybe): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

const numberCache = new Map<string, Intl.NumberFormat>();
function numberFormat(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = JSON.stringify(options);
  let fmt = numberCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(LOCALE, options);
    numberCache.set(key, fmt);
  }
  return fmt;
}

/** Normaliza -0 (e arredondamentos para zero) para evitar "-0,0%". */
function noNegativeZero(value: number, digits: number): number {
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return rounded === 0 ? 0 : value;
}

/** Número com `digits` casas fixas: decimal(1.8) -> "1,8". */
export function decimal(value: Maybe, digits = 1, fallback = "—"): string {
  if (!finite(value)) return fallback;
  return numberFormat({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
    noNegativeZero(value, digits),
  );
}

/** Inteiro com separador de milhar: integer(1234.4) -> "1.234". */
export function integer(value: Maybe, fallback = "—"): string {
  if (!finite(value)) return fallback;
  return numberFormat({ maximumFractionDigits: 0 }).format(noNegativeZero(value, 0));
}

/** Moeda com centavos: brl(310) -> "R$ 310,00". */
export function brl(value: Maybe, fallback = "—"): string {
  if (!finite(value)) return fallback;
  return numberFormat({ style: "currency", currency: "BRL" }).format(noNegativeZero(value, 2));
}

/** Moeda sem centavos: brlWhole(310.4) -> "R$ 310". */
export function brlWhole(value: Maybe, fallback = "—"): string {
  if (!finite(value)) return fallback;
  return numberFormat({ style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(
    noNegativeZero(value, 0),
  );
}

/** Sem centavos quando o valor é inteiro: "R$ 450" ou "R$ 450,50". */
export function brlAuto(value: Maybe, fallback = "—"): string {
  if (!finite(value)) return fallback;
  return Number.isInteger(value) ? brlWhole(value, fallback) : brl(value, fallback);
}

/** Moeda a partir de centavos: brlFromCents(31000) -> "R$ 310,00". */
export function brlFromCents(cents: Maybe, fallback = "—"): string {
  return finite(cents) ? brl(cents / 100, fallback) : fallback;
}

/**
 * Moeda compacta para eixos e células apertadas: "R$ 310", "R$ 1,2 mil",
 * "R$ 2 mil", "R$ 1,5 mi". Uma casa decimal só quando ela não é zero.
 */
export function brlCompact(value: Maybe, fallback = "—"): string {
  if (!finite(value)) return fallback;
  const abs = Math.abs(value);
  if (abs < 1000) return brlWhole(value, fallback);
  const sign = value < 0 ? "-" : "";
  const trim = (n: number) => numberFormat({ minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(n);
  if (abs < 1_000_000) return `${sign}R$ ${trim(abs / 1000)} mil`;
  return `${sign}R$ ${trim(abs / 1_000_000)} mi`;
}

/** Percentual (valor já em %): pct(12.46) -> "12,5%". */
export function pct(value: Maybe, digits = 1, fallback = "—"): string {
  if (!finite(value)) return fallback;
  return `${decimal(value, digits)}%`;
}

/** Variação com sinal explícito: pctSigned(122.6) -> "+122,6%"; zero sem sinal. */
export function pctSigned(value: Maybe, digits = 1, fallback = "—"): string {
  if (!finite(value)) return fallback;
  const text = pct(value, digits);
  const isZero = noNegativeZero(value, digits) === 0;
  return value > 0 && !isZero ? `+${text}` : text;
}

/** Distância em km: km(1.84) -> "1,8 km". */
export function km(value: Maybe, digits = 1, fallback = "—"): string {
  if (!finite(value)) return fallback;
  return `${decimal(value, digits)} km`;
}

/** Distância a partir de metros: kmFromMeters(1840) -> "1,8 km". */
export function kmFromMeters(meters: Maybe, digits = 1, fallback = "—"): string {
  return finite(meters) ? km(meters / 1000, digits, fallback) : fallback;
}

/** Multiplicador: multiple(2.46) -> "2,5x". */
export function multiple(value: Maybe, digits = 1, fallback = "—"): string {
  if (!finite(value)) return fallback;
  return `${decimal(value, digits)}x`;
}

// --- datas -----------------------------------------------------------------

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const dateCache = new Map<string, Intl.DateTimeFormat>();
function dateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let fmt = dateCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(LOCALE, options);
    dateCache.set(key, fmt);
  }
  return fmt;
}

/** "YYYY-MM-DD" vira meio-dia UTC (dia de calendário estável em qualquer fuso). */
function toDate(value: string | number | Date | null | undefined): { date: Date; calendarDay: boolean } | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    const m = DATE_ONLY_RE.exec(value);
    if (m) return { date: new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)), calendarDay: true };
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : { date, calendarDay: false };
}

function formatDate(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions,
  fallback: string,
): string {
  const parsed = toDate(value);
  if (!parsed) return fallback;
  const timeZone = parsed.calendarDay ? "UTC" : SAO_PAULO_TIME_ZONE;
  return dateFormat({ ...options, timeZone }).format(parsed.date);
}

/** "30/10/2026" */
export function dateSP(value: string | number | Date | null | undefined, fallback = "—"): string {
  return formatDate(value, { day: "2-digit", month: "2-digit", year: "numeric" }, fallback);
}

/** "30/10" */
export function dateShortSP(value: string | number | Date | null | undefined, fallback = "—"): string {
  return formatDate(value, { day: "2-digit", month: "2-digit" }, fallback);
}

/** "30 de out." (dia e mês por extenso curto, sem ano) */
export function dateMonthSP(value: string | number | Date | null | undefined, fallback = "—"): string {
  return formatDate(value, { day: "numeric", month: "short" }, fallback);
}

/** "30/10/2026 14:05" */
export function dateTimeSP(value: string | number | Date | null | undefined, fallback = "—"): string {
  const day = dateSP(value, "");
  if (!day) return fallback;
  const time = formatDate(value, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }, "");
  return `${day} ${time}`;
}
