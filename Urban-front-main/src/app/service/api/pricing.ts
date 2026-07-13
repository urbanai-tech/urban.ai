import { api } from "./client";
import type { BillingCycle } from "./billing";


export const alterarAceitoSugestao = async (id: string, aceito: boolean) => {
  try {
    const { data } = await api.patch(`/sugestoes-preco/${id}/aceito`, {
      aceito,
    });
    return data;
  } catch (error) {
    console.error(`Erro ao alterar o status de aceito da sugestão ${id}:`, error);
    throw error;
  }
};

export const registrarPrecoAplicadoSugestao = async (
  id: string,
  precoAplicado: number,
  origem:
    | 'manual_dashboard'
    | 'manual_off_platform'
    | 'stays_auto'
    | 'stays_user_accepted' = 'manual_dashboard',
  feedback?: {
    reservaStatus?: 'unknown' | 'booked' | 'not_booked' | 'blocked' | null;
    receitaReal?: number | null;
    noitesReservadas?: number | null;
    feedbackObservacao?: string | null;
  },
) => {
  try {
    const { data } = await api.patch(`/sugestoes-preco/${id}/aplicado`, {
      precoAplicado,
      origem,
      ...feedback,
    });
    return data;
  } catch (error) {
    console.error(`Erro ao registrar o preço aplicado da sugestão ${id}:`, error);
    throw error;
  }
};

export const registrarResultadoSugestao = async (
  id: string,
  feedback: {
    precoAplicado?: number | null;
    reservaStatus?: 'unknown' | 'booked' | 'not_booked' | 'blocked' | null;
    receitaReal?: number | null;
    noitesReservadas?: number | null;
    feedbackObservacao?: string | null;
  },
) => {
  try {
    const { data } = await api.patch(`/sugestoes-preco/${id}/resultado`, feedback);
    return data;
  } catch (error) {
    console.error(`Erro ao registrar resultado da sugestão ${id}:`, error);
    throw error;
  }
};


export interface PercentualPayload {
  percentualInicial: number;
  percentualFinal: number | null;
}

/**
 * Cria ou atualiza os percentuais do usuário.
 * @param payload Objeto com percentualInicial e percentualFinal
 * @returns Dados retornados pela API
 */
export const requestCreateOrUpdatePercentual = async (
  payload: PercentualPayload
) => {
  try {
    const { data } = await api.post('/propriedades/createOrUpdatePercentual', payload);
    return data;
  } catch (error) {
    console.error('Erro ao criar ou atualizar percentuais:', error);
    throw error;
  }
};

export interface PricingQuote {
  quantity: number;
  billingCycle: BillingCycle;
  selfService: boolean;
  contactRequired: boolean;
  planName: string | null;
  planTitle: string;
  minProperties?: number | null;
  maxProperties?: number | null;
  pricePerPropertyMonthly?: number;
  monthlyEquivalentTotal?: number;
  cycleTotal?: number;
  monthsInCycle?: number;
  discountPercent?: number;
}

export const getPricingQuote = async (
  quantity: number,
  billingCycle: BillingCycle = 'annual',
): Promise<PricingQuote> => {
  const { data } = await api.get<PricingQuote>('/plans/quote', {
    params: { quantity, billingCycle },
  });
  return data;
};

// ================== ROI do anfitrião ==================

export type RoiConfidence = 'high' | 'medium' | 'low';

export interface RoiSummary {
  windowDays: number;
  generatedAt: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
  subscription: {
    monthlyCostCents: number;
    activePayments: number;
  };
  money: {
    confirmedIncrementalCents: number;
    projectedIncrementalCents: number;
    totalAttributedCents: number;
    potentialLostCents: number;
    netValueCents: number;
    roiPercent: number | null;
    roiMultiple: number | null;
  };
  activity: {
    recommendations: number;
    accepted: number;
    applied: number;
    booked: number;
    rejected: number;
    impactedNights: number;
    acceptanceRatePercent: number;
    applicationRatePercent: number;
  };
  dataQuality: {
    confidence: RoiConfidence;
    label: string;
    explanation: string;
  };
  perProperty: Array<{
    propertyId: string | null;
    propertyName: string;
    recommendations: number;
    accepted: number;
    applied: number;
    booked: number;
    impactedNights: number;
    confirmedIncrementalCents: number;
    projectedIncrementalCents: number;
    totalAttributedCents: number;
    potentialLostCents: number;
  }>;
  recentWins: Array<{
    id: string;
    propertyName: string;
    currentPriceCents: number;
    appliedPriceCents: number;
    deltaCents: number;
    nights: number;
    incrementalCents: number;
    status: string;
    createdAt: string;
  }>;
}

export interface AdminRoiOverview {
  windowDays: number;
  generatedAt: string;
  totals: {
    users: number;
    usersWithPositiveRoi: number;
    activePayments: number;
    confirmedIncrementalCents: number;
    projectedIncrementalCents: number;
    totalAttributedCents: number;
    subscriptionCostCents: number;
    netValueCents: number;
    roiPercent: number | null;
    roiMultiple: number | null;
    potentialLostCents: number;
    impactedNights: number;
  };
  leaderboard: Array<RoiSummary & { activeListings: number }>;
}

export const fetchMyRoi = (params?: { windowDays?: number; propertyId?: string }) =>
  api
    .get<RoiSummary>('/roi/me', {
      params: {
        windowDays: params?.windowDays ?? 30,
        propertyId: params?.propertyId || undefined,
      },
    })
    .then((r) => r.data);

export const fetchAdminRoi = (params?: { windowDays?: number; limit?: number }) =>
  api
    .get<AdminRoiOverview>('/admin/roi', {
      params: {
        windowDays: params?.windowDays ?? 30,
        limit: params?.limit ?? 25,
      },
    })
    .then((r) => r.data);

// === Gap 2 — Pricing Rules ===
//   POST /properties/:id/pricing-rules/preview  → preview 14d
//   GET  /properties/:id/pricing-rules           → regras atuais
//   PUT  /properties/:id/pricing-rules           → salva (atomic)
//   POST /properties/:id/pricing-rules/copy-from/:sourceId → copia outro

export type PricingRuleType =
  | 'weekend_uplift'
  | 'weekday_discount'
  | 'gap_night_filler'
  | 'last_minute'
  | 'length_of_stay'
  | 'min_stay_dynamic'
  | 'occupancy_floor'
  | 'event_uplift';

export type PricingRule = {
  type: PricingRuleType;
  enabled: boolean;
  params: Record<string, number>;
  label: string;
  description: string;
};

export type PricingRulesResponse = {
  propertyId: string;
  rules: PricingRule[];
  updatedAt: string | null;
};

export type PricingRulesPreviewDay = {
  date: string;
  basePrice: number;
  rulesPrice: number;
  appliedRules: PricingRuleType[];
};

export type PricingRulesPreviewResponse = {
  days: PricingRulesPreviewDay[];
};

export async function fetchPricingRules(propertyId: string): Promise<PricingRulesResponse> {
  try {
    const { data } = await api.get<PricingRulesResponse>(
      `/properties/${propertyId}/pricing-rules`,
    );
    if (!data) throw new Error('empty response');
    return data;
  } catch (err) {
    console.warn('[fetchPricingRules] endpoint indisponível:', err);
    throw err;
  }
}

export async function savePricingRules(
  propertyId: string,
  rules: PricingRule[],
): Promise<PricingRulesResponse> {
  try {
    const { data } = await api.put<PricingRulesResponse>(
      `/properties/${propertyId}/pricing-rules`,
      { rules },
    );
    return data;
  } catch (err) {
    console.error('[savePricingRules] falha ao salvar:', err);
    throw err;
  }
}

export async function previewPricingRules(
  propertyId: string,
  rules: PricingRule[],
): Promise<PricingRulesPreviewResponse> {
  try {
    const { data } = await api.post<PricingRulesPreviewResponse>(
      `/properties/${propertyId}/pricing-rules/preview`,
      { rules },
    );
    return data ?? { days: [] };
  } catch (err) {
    console.warn('[previewPricingRules] endpoint indisponível:', err);
    throw err;
  }
}

export async function copyPricingRulesFromProperty(
  sourceId: string,
  targetId: string,
): Promise<PricingRulesResponse> {
  try {
    const { data } = await api.post<PricingRulesResponse>(
      `/properties/${targetId}/pricing-rules/copy-from/${sourceId}`,
    );
    return data;
  } catch (err) {
    console.error('[copyPricingRulesFromProperty] falha:', err);
    throw err;
  }
}

// === Gap 3 — Market Intel ===
/**
 * Market Intel dashboard (Gap 3 — Track 2, semana 5-6).
 *
 * Endpoint planejado pelo Dev 1:
 *   GET /properties/:id/market-intel?from=&to=
 *   → MarketIntelResponse
 *
 */
export type ComparableProperty = {
  anonymousId: string;
  type: 'apartamento' | 'casa' | 'loft' | 'studio';
  bedrooms: number;
  medianAdr: number;
  occupancy: number;
  distanceKm: number;
  similarityScore: number;
};

export type MarketIntelDailyPoint = {
  date: string;
  yourAdr: number;
  medianAdr: number;
};

export type MarketIntelResponse = {
  propertyId: string;
  neighborhood: string;
  percentile: number;
  percentileTrend30d: number;
  comparablesCount: number;
  medianAdr: number;
  medianOccupancy: number;
  yourAdr: number;
  yourOccupancy: number;
  eventReactivity: number;
  daily: MarketIntelDailyPoint[];
  comparables: ComparableProperty[];
  updatedAt: string;
};

export type MarketIntelInput = {
  propertyId: string;
  from?: string;
  to?: string;
};

/**
 * fetchMarketIntel — comparáveis + percentile + série diária ADR (Gap 3).
 *
 */
export async function fetchMarketIntel(
  input: MarketIntelInput,
): Promise<MarketIntelResponse> {

  try {
    const { data } = await api.get<MarketIntelResponse>(
      `/properties/${encodeURIComponent(input.propertyId)}/market-intel`,
      {
        params: {
          from: input.from,
          to: input.to,
        },
      },
    );
    if (!data) throw new Error('empty response');
    return data;
  } catch (err) {
    console.warn('[fetchMarketIntel] endpoint indisponível:', err);
    throw err;
  }
}
