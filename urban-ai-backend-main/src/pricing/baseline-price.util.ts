/**
 * Seleção do preço-base ("baseline") de um imóvel quando há duas origens possíveis:
 *  - `airbnb`: diária lida do Airbnb (checkout/headless/RapidAPI) — `dailyPrice` com fonte
 *    `airbnb_*` e a data em `pricingInputsUpdatedAt`;
 *  - `host_input`: diária que o anfitrião informou (`manualDailyPrice`) — data em
 *    `hostInputUpdatedAt` (ou, em linhas antigas, `pricingInputsUpdatedAt` quando a fonte
 *    era manual).
 *
 * Regra (ADR 0010):
 *  1. só existe uma origem utilizável -> ela vale (marcando `stale` se for leitura velha);
 *  2. existem as duas -> a leitura do Airbnb só vence se estiver FRESCA e for MAIS NOVA que
 *     a informação do anfitrião; leitura velha nunca derruba o valor do anfitrião;
 *  3. nenhuma -> null (a UI pede o preenchimento manual).
 *
 * Função pura: sem I/O, `now` injetável para teste.
 */
export type BaselineSource = 'airbnb' | 'host_input';

export type BaselineReason =
  | 'host_input_only'
  | 'airbnb_only'
  | 'airbnb_fresh_newer'
  | 'host_input_newer'
  | 'host_input_airbnb_stale'
  | 'none';

export type BaselinePrice = {
  dailyPrice: number | null;
  source: BaselineSource | null;
  updatedAt: Date | null;
  /** true quando a origem escolhida é uma leitura do Airbnb mais velha que a janela de frescor. */
  stale: boolean;
  reason: BaselineReason;
};

/** Janela em que uma leitura do Airbnb ainda é considerada fresca. */
export const AIRBNB_BASELINE_FRESH_DAYS = 14;

const HOST_SOURCES = new Set(['manual', 'manual_backfill', 'host_input', 'admin_manual']);

function positive(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : null;
}

function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeSource(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function isAirbnbPricingSource(value: unknown): boolean {
  return normalizeSource(value).startsWith('airbnb_');
}

export function selectBaselinePrice(
  list: any,
  now: Date = new Date(),
  freshDays: number = AIRBNB_BASELINE_FRESH_DAYS,
): BaselinePrice {
  const source = normalizeSource(list?.pricingInputSource);

  const hostPrice = positive(list?.manualDailyPrice);
  const hostAt =
    toDate(list?.hostInputUpdatedAt) ??
    (HOST_SOURCES.has(source) ? toDate(list?.pricingInputsUpdatedAt) : null);

  const airbnbPrice = isAirbnbPricingSource(source) ? positive(list?.dailyPrice) : null;
  const airbnbAt = airbnbPrice !== null ? toDate(list?.pricingInputsUpdatedAt) : null;
  const airbnbFresh =
    airbnbAt !== null && now.getTime() - airbnbAt.getTime() <= freshDays * 86_400_000;

  if (hostPrice === null && airbnbPrice === null) {
    return { dailyPrice: null, source: null, updatedAt: null, stale: false, reason: 'none' };
  }

  if (hostPrice !== null && airbnbPrice === null) {
    return { dailyPrice: hostPrice, source: 'host_input', updatedAt: hostAt, stale: false, reason: 'host_input_only' };
  }

  if (hostPrice === null && airbnbPrice !== null) {
    return { dailyPrice: airbnbPrice, source: 'airbnb', updatedAt: airbnbAt, stale: !airbnbFresh, reason: 'airbnb_only' };
  }

  // As duas origens existem.
  if (airbnbFresh && airbnbAt && (hostAt === null || airbnbAt.getTime() > hostAt.getTime())) {
    return { dailyPrice: airbnbPrice, source: 'airbnb', updatedAt: airbnbAt, stale: false, reason: 'airbnb_fresh_newer' };
  }

  return {
    dailyPrice: hostPrice,
    source: 'host_input',
    updatedAt: hostAt,
    stale: false,
    reason: airbnbFresh ? 'host_input_newer' : 'host_input_airbnb_stale',
  };
}
