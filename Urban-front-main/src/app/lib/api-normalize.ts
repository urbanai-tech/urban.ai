import type { AdminProductFunnel } from "../service/api/admin";
import type { MarketIntelResponse, PricingRule, PricingRulesPreviewResponse, PricingRulesResponse, RoiSummary } from "../service/api/pricing";

/**
 * Normalizadores de resposta da API (E2E-09).
 *
 * Telas liam `data.items.map(...)`, `.filter(...)` e `x.toLocaleString()` direto da
 * resposta. Se o backend devolve `null`, `{}` ou um envelope diferente, a tela cai no
 * error boundary. Estes helpers puros garantem arrays/objetos/números seguros nos
 * pontos de leitura, para a tela cair em estado vazio ou erro amigável.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Array seguro: `null`, `undefined`, objeto e string viram `[]`. */
export function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Lista que pode vir crua ou em envelope (`{ data }`, `{ items }`, `{ rows }`, ...).
 * Procura as chaves em ordem; sem nenhuma lista, devolve `[]`.
 */
export function asList<T = unknown>(
  value: unknown,
  keys: ReadonlyArray<string> = ["data", "items", "rows", "results"],
): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!isRecord(value)) return [];
  for (const key of keys) {
    if (Array.isArray(value[key])) return value[key] as T[];
  }
  return [];
}

/** Objeto seguro: tudo que não é objeto simples vira `{}`. */
export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

/** Número finito ou o fallback (padrão 0). Aceita números em string ("12.5"). */
export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

/** Número finito ou `null` (para campos opcionais que mostram "-"). */
export function asNumberOrNull(value: unknown): number | null {
  const parsed = asNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

/** String não vazia ou o fallback. */
export function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

/**
 * Resumo de ROI: só aceita o objeto se tiver os três blocos que a tela lê
 * (`money`, `activity`, `dataQuality`); caso contrário `null`.
 */
export function asRoiSummaryOrNull<T>(value: unknown): T | null {
  if (!isRecord(value)) return null;
  if (!isRecord(value.money) || !isRecord(value.activity) || !isRecord(value.dataQuality)) return null;
  return value as T;
}

/**
 * ROI completo e seguro para a tela: exige `money`, `activity` e `dataQuality` (sem eles não há
 * o que mostrar e a tela cai no erro amigável) e preenche o resto (assinatura, listas, números).
 */
export function normalizeRoiSummary(raw: unknown): RoiSummary | null {
  const base = asRoiSummaryOrNull<Record<string, unknown>>(raw);
  if (!base) return null;
  const money = asRecord(base.money);
  const activity = asRecord(base.activity);
  const quality = asRecord(base.dataQuality);
  const subscription = asRecord(base.subscription);
  const user = asRecord(base.user);
  const confidence = quality.confidence === "high" || quality.confidence === "medium" ? quality.confidence : "low";
  return {
    ...(base as Partial<RoiSummary>),
    windowDays: asNumber(base.windowDays, 30),
    generatedAt: asString(base.generatedAt),
    user: { id: asString(user.id), username: asString(user.username), email: asString(user.email) },
    subscription: {
      monthlyCostCents: asNumber(subscription.monthlyCostCents),
      activePayments: asNumber(subscription.activePayments),
    },
    money: {
      confirmedIncrementalCents: asNumber(money.confirmedIncrementalCents),
      projectedIncrementalCents: asNumber(money.projectedIncrementalCents),
      totalAttributedCents: asNumber(money.totalAttributedCents),
      potentialLostCents: asNumber(money.potentialLostCents),
      netValueCents: asNumber(money.netValueCents),
      roiPercent: asNumberOrNull(money.roiPercent),
      roiMultiple: asNumberOrNull(money.roiMultiple),
    },
    activity: {
      recommendations: asNumber(activity.recommendations),
      accepted: asNumber(activity.accepted),
      applied: asNumber(activity.applied),
      booked: asNumber(activity.booked),
      rejected: asNumber(activity.rejected),
      impactedNights: asNumber(activity.impactedNights),
      acceptanceRatePercent: asNumber(activity.acceptanceRatePercent),
      applicationRatePercent: asNumber(activity.applicationRatePercent),
    },
    dataQuality: {
      confidence,
      label: asString(quality.label, "Dados parciais"),
      explanation: asString(quality.explanation),
    },
    perProperty: asArray(base.perProperty)
      .filter(isRecord)
      .map((row) => ({
        propertyId: typeof row.propertyId === "string" ? row.propertyId : null,
        propertyName: asString(row.propertyName, "Imóvel"),
        recommendations: asNumber(row.recommendations),
        accepted: asNumber(row.accepted),
        applied: asNumber(row.applied),
        booked: asNumber(row.booked),
        impactedNights: asNumber(row.impactedNights),
        confirmedIncrementalCents: asNumber(row.confirmedIncrementalCents),
        projectedIncrementalCents: asNumber(row.projectedIncrementalCents),
        totalAttributedCents: asNumber(row.totalAttributedCents),
        potentialLostCents: asNumber(row.potentialLostCents),
      })),
    recentWins: asArray(base.recentWins)
      .filter(isRecord)
      .map((row, index) => ({
        id: asString(row.id, `win-${index}`),
        propertyName: asString(row.propertyName, "Imóvel"),
        currentPriceCents: asNumber(row.currentPriceCents),
        appliedPriceCents: asNumber(row.appliedPriceCents),
        deltaCents: asNumber(row.deltaCents),
        nights: asNumber(row.nights),
        incrementalCents: asNumber(row.incrementalCents),
        status: asString(row.status),
        createdAt: asString(row.createdAt),
      })),
  };
}

/** Percentis p25/p50/p75 válidos ou `null`. */
function asPercentilesOrNull(value: unknown): { p25: number; p50: number; p75: number } | null {
  if (!isRecord(value)) return null;
  return { p25: asNumber(value.p25), p50: asNumber(value.p50), p75: asNumber(value.p75) };
}

/** Inteligência de mercado com números/listas garantidos; lança se a resposta nem é um objeto. */
export function normalizeMarketIntel(raw: unknown, propertyId = ""): MarketIntelResponse {
  if (!isRecord(raw)) throw new Error("invalid market-intel response");
  return {
    ...(raw as Partial<MarketIntelResponse>),
    propertyId: asString(raw.propertyId, propertyId),
    neighborhood: asString(raw.neighborhood, "sua região"),
    percentile: asNumber(raw.percentile),
    percentileTrend30d: asNumber(raw.percentileTrend30d),
    comparablesCount: asNumber(raw.comparablesCount),
    medianAdr: asNumber(raw.medianAdr),
    medianOccupancy: asNumber(raw.medianOccupancy),
    yourAdr: asNumber(raw.yourAdr),
    yourOccupancy: asNumber(raw.yourOccupancy),
    eventReactivity: asNumber(raw.eventReactivity),
    daily: asArray<Record<string, unknown>>(raw.daily)
      .filter(isRecord)
      .map((point) => ({
        date: asString(point.date),
        yourAdr: asNumber(point.yourAdr),
        medianAdr: asNumber(point.medianAdr),
      })),
    comparables: asArray(raw.comparables),
    adrPercentiles: asPercentilesOrNull(raw.adrPercentiles),
    occupancyPercentiles: asPercentilesOrNull(raw.occupancyPercentiles),
    updatedAt: asString(raw.updatedAt),
  } as MarketIntelResponse;
}

/** Regras de preço: só entradas que são objetos, com `params` sempre objeto. */
export function normalizePricingRules(raw: unknown, propertyId = ""): PricingRulesResponse {
  if (!isRecord(raw)) throw new Error("invalid pricing-rules response");
  return {
    propertyId: asString(raw.propertyId, propertyId),
    rules: asArray(raw.rules)
      .filter(isRecord)
      .map((rule) => ({
        ...(rule as Partial<PricingRule>),
        enabled: Boolean(rule.enabled),
        label: asString(rule.label),
        description: asString(rule.description),
        params: asRecord(rule.params) as Record<string, number>,
      })) as PricingRule[],
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

export function normalizePricingPreview(raw: unknown): PricingRulesPreviewResponse {
  return {
    days: asList<Record<string, unknown>>(raw, ["days", "data", "items"])
      .filter(isRecord)
      .map((day) => ({
        date: asString(day.date),
        basePrice: asNumber(day.basePrice),
        rulesPrice: asNumber(day.rulesPrice),
        appliedRules: asArray(day.appliedRules),
      })) as PricingRulesPreviewResponse["days"],
  };
}

/** Funil admin: números sempre finitos; lança sem objeto para a tela mostrar "Falha ao carregar". */
export function normalizeAdminFunnel(raw: unknown): AdminProductFunnel {
  if (!isRecord(raw)) throw new Error("invalid funnel response");
  const stages = asRecord(raw.stages);
  const rates = asRecord(raw.rates);
  return {
    windowDays: asNumber(raw.windowDays, 30),
    stages: {
      signups: asNumber(stages.signups),
      onboardedWithAirbnbId: asNumber(stages.onboardedWithAirbnbId),
      analysesGenerated: asNumber(stages.analysesGenerated),
      suggestionsAccepted: asNumber(stages.suggestionsAccepted),
      appliedPriceCaptured: asNumber(stages.appliedPriceCaptured),
      activeSubscriptions: asNumber(stages.activeSubscriptions),
      operationModeAuto: asNumber(stages.operationModeAuto),
    },
    rates: {
      acceptanceRatePercent: asNumber(rates.acceptanceRatePercent),
      applicationRatePercent: asNumber(rates.applicationRatePercent),
    },
  };
}
