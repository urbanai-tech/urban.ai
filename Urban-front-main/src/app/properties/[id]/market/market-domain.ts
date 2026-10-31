import type {
  MarketCapacityBand,
  MarketDataSourceInfo,
  MarketIntelInput,
  MarketIntelResponse,
  MarketListingType,
  MarketSeasonalityPoint,
  MarketTypologySelection,
} from "../../../service/api/pricing";

/**
 * Regras puras da tela /properties/[id]/market (ADR 0028): filtros de raio e tipologia,
 * selos de fonte e data, tendência, ocupação e o estado "amostra insuficiente" explicado.
 * Sem React: testável com `node --test` (scripts/market-domain.test.mjs).
 */

export const RADIUS_OPTIONS: ReadonlyArray<number> = [1, 2, 3, 4, 5];
export const DEFAULT_RADIUS_KM = 3;
export const MAX_RADIUS_KM = 5;

export const ANY = "any";

export const ROOMS_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: ANY, label: "Qualquer" },
  { value: "0", label: "Studio" },
  { value: "1", label: "1 quarto" },
  { value: "2", label: "2 quartos" },
  { value: "3", label: "3 quartos" },
  { value: "4", label: "4 ou mais" },
];

export const LISTING_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: ANY, label: "Todos" },
  { value: "entire_home", label: "Imóvel inteiro" },
  { value: "private_room", label: "Quarto privativo" },
  { value: "shared_room", label: "Quarto compartilhado" },
  { value: "hotel_room", label: "Quarto de hotel" },
];

export const CAPACITY_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: ANY, label: "Qualquer" },
  { value: "1-2", label: "1 a 2 hóspedes" },
  { value: "3-4", label: "3 a 4 hóspedes" },
  { value: "5-6", label: "5 a 6 hóspedes" },
  { value: "7+", label: "7 ou mais" },
];

/** Estado dos seletores (strings, porque vêm de <select>). */
export type MarketFilters = {
  radiusKm: number;
  rooms: string;
  listingType: string;
  capacity: string;
};

export const DEFAULT_FILTERS: MarketFilters = {
  radiusKm: DEFAULT_RADIUS_KM,
  rooms: ANY,
  listingType: ANY,
  capacity: ANY,
};

export function hasTypologyFilter(filters: MarketFilters): boolean {
  return filters.rooms !== ANY || filters.listingType !== ANY || filters.capacity !== ANY;
}

/** Filtros da tela → parâmetros da API (campos "qualquer" ficam de fora). */
export function filtersToInput(filters: MarketFilters): Pick<MarketIntelInput, "radiusKm" | "rooms" | "listingType" | "capacity"> {
  return {
    radiusKm: filters.radiusKm,
    rooms: filters.rooms === ANY ? null : Number(filters.rooms),
    listingType: filters.listingType === ANY ? null : (filters.listingType as MarketListingType),
    capacity: filters.capacity === ANY ? null : (filters.capacity as MarketCapacityBand),
  };
}

/** "Igual ao meu imóvel": filtros com a tipologia do próprio anúncio (mantém o raio atual). */
export function filtersFromTarget(target: MarketTypologySelection | undefined, radiusKm: number): MarketFilters {
  const rooms = target?.rooms;
  return {
    radiusKm,
    rooms: rooms == null ? ANY : String(Math.min(4, Math.max(0, rooms))),
    listingType: target?.listingType ?? ANY,
    capacity: target?.capacity ?? ANY,
  };
}

/** O imóvel tem alguma tipologia conhecida para usar como filtro? */
export function targetHasTypology(target: MarketTypologySelection | undefined): boolean {
  return Boolean(target && (target.rooms != null || target.listingType || target.capacity));
}

/** "2026-10-01" → "01/10/2026"; entradas inválidas voltam como vieram. */
export function formatCollectedDate(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

const SOURCE_FALLBACK_LABELS: Record<string, string> = {
  customers: "Clientes My Urban",
  licensed_dataset: "Dataset licenciado",
  inside_airbnb: "Inside Airbnb",
  own_scraping: "Coleta própria",
};

function sourceUnit(id: string, listings: number): string {
  if (id === "customers") return listings === 1 ? "imóvel" : "imóveis";
  return listings === 1 ? "anúncio" : "anúncios";
}

export type SourceBadge = { id: string; label: string; detail: string };

/** Um selo por fonte: "Clientes My Urban · 5 imóveis · dados atuais" / "Dataset licenciado · 16 anúncios · coleta 01/10/2026". */
export function sourceBadges(dataSources: MarketDataSourceInfo[] | undefined): SourceBadge[] {
  return (dataSources ?? []).map((source) => {
    const label = source.label || SOURCE_FALLBACK_LABELS[source.id] || source.id;
    const when = source.latestCollectedAt ? `coleta ${formatCollectedDate(source.latestCollectedAt)}` : "dados atuais";
    return {
      id: source.id,
      label,
      detail: `${source.listings} ${sourceUnit(source.id, source.listings)} · ${when}`,
    };
  });
}

/** Origem dos dados em uma frase ("clientes", "dataset licenciado", "Inside Airbnb"). */
export function originPhrase(dataSources: MarketIntelResponse["dataSources"]): string {
  const names = (dataSources ?? []).map((source) => {
    if (source.id === "customers") return "clientes";
    if (source.id === "licensed_dataset") return "dataset licenciado";
    if (source.id === "inside_airbnb") return "Inside Airbnb";
    return source.label || source.id;
  });
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

export type TrendView = {
  kind: "up" | "down" | "flat" | "unavailable";
  /** Texto curto do selo no destaque. */
  label: string;
  /** Explicação (aparece abaixo e no aria-label). */
  hint: string;
};

/** Tendência de 30 dias: indisponível é dito, nunca vira "estável". */
export function trendView(data: Pick<MarketIntelResponse, "trend30d" | "percentileTrend30d">): TrendView {
  const trend = data.trend30d;
  if (trend && !trend.available) {
    return {
      kind: "unavailable",
      label: "tendência indisponível",
      hint: trend.reason || "Ainda não há histórico de preços suficiente nos últimos 60 dias.",
    };
  }
  const points = trend?.percentilePoints ?? data.percentileTrend30d ?? 0;
  const base =
    trend?.ownBasis === "current"
      ? "Considera a sua diária atual; só o mercado se moveu."
      : "Variação do seu percentil nos últimos 30 dias.";
  if (points === 0) return { kind: "flat", label: "estável", hint: base };
  return {
    kind: points > 0 ? "up" : "down",
    label: `${points > 0 ? "+" : ""}${points} pontos`,
    hint: base,
  };
}

export type OccupancyView = { value: string; sub: string; available: boolean };

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Ocupação dos parecidos: indisponível ≠ 0%, e estimativa é rotulada como estimativa. */
export function occupancyView(
  data: Pick<
    MarketIntelResponse,
    "medianOccupancy" | "yourOccupancy" | "occupancyAvailable" | "occupancyIsProxy" | "yourOccupancyAvailable"
  >,
): OccupancyView {
  const own = data.yourOccupancyAvailable === false ? "Sua ocupação ainda sem registro" : `Sua ocupação ${pct(data.yourOccupancy)}`;
  if (data.occupancyAvailable === false) {
    return {
      value: "Indisponível",
      sub: "As fontes desta região não informam ocupação dos parecidos.",
      available: false,
    };
  }
  return {
    value: pct(data.medianOccupancy),
    sub: data.occupancyIsProxy ? `Estimativa pelos dias disponíveis no ano · ${own}` : own,
    available: true,
  };
}

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export type SeasonalityBar = {
  month: number;
  label: string;
  index: number;
  /** 0–100, relativo ao maior índice. */
  heightPct: number;
  /** "+12% vs. média" / "-8% vs. média". */
  delta: string;
};

export function seasonalityBars(points: MarketSeasonalityPoint[] | null | undefined): SeasonalityBar[] {
  const list = (points ?? []).filter((p) => p.month >= 1 && p.month <= 12 && p.index > 0);
  const max = Math.max(...list.map((p) => p.index), 0);
  if (!list.length || max <= 0) return [];
  return list.map((p) => {
    const change = Math.round((p.index - 1) * 100);
    return {
      month: p.month,
      label: MONTH_LABELS[p.month - 1],
      index: p.index,
      heightPct: Math.max(8, Math.round((p.index / max) * 100)),
      delta: change === 0 ? "na média" : `${change > 0 ? "+" : ""}${change}% vs. média`,
    };
  });
}

export type EventEffectView = { value: string; sub: string };

export function eventEffectView(effect: MarketIntelResponse["neighborhoodEventEffect"]): EventEffectView | null {
  if (!effect) return null;
  const sign = effect.upliftPct > 0 ? "+" : "";
  return {
    value: `${sign}${effect.upliftPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
    sub: `Diária mediana do bairro em ${effect.eventDays} dia${effect.eventDays === 1 ? "" : "s"} com evento de alto impacto, contra ${effect.baselineDays} dias sem.`,
  };
}

export type InsufficiencyView = {
  title: string;
  body: string;
  reasons: string[];
  hints: string[];
  /** Próximo raio sugerido (até o máximo) ou null quando já está no máximo. */
  widenTo: number | null;
  canClearTypology: boolean;
};

/**
 * Estado honesto de amostra insuficiente: diz o que falta (anfitriões/anúncios distintos e o
 * mínimo de cada grupo), sem expor ninguém, e oferece o que dá para mudar (raio e tipologia).
 */
export function insufficiencyView(
  data: Pick<MarketIntelResponse, "insufficiency" | "minGroupSize" | "minExternalListings" | "message">,
  filters: MarketFilters,
): InsufficiencyView {
  const info = data.insufficiency;
  const minHosts = data.minGroupSize ?? info?.customers.required ?? 5;
  const minExternal = data.minExternalListings ?? info?.external.required ?? 8;
  const reasons = info?.reasons?.length
    ? info.reasons
    : [`Precisamos de pelo menos ${minHosts} anfitriões ou ${minExternal} anúncios distintos com imóveis parecidos na região.`];
  const widenTo = filters.radiusKm < MAX_RADIUS_KM ? Math.min(MAX_RADIUS_KM, filters.radiusKm + 1) : null;
  const typology = hasTypologyFilter(filters);
  const hints = info?.hints?.length
    ? info.hints
    : [
        ...(widenTo ? [`Aumente o raio de busca (até ${MAX_RADIUS_KM} km).`] : []),
        ...(typology ? ["Afrouxe a tipologia (quartos, tipo de anúncio ou capacidade)."] : []),
      ];
  return {
    title: "Ainda não há amostra suficiente aqui",
    body: `Para não expor nenhum anfitrião, só mostramos o mercado com pelo menos ${minHosts} anfitriões distintos (clientes) ou ${minExternal} anúncios distintos (fontes externas) com imóveis parecidos em até ${filters.radiusKm} km.`,
    reasons,
    hints,
    widenTo,
    canClearTypology: typology,
  };
}
