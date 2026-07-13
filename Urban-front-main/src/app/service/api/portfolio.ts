import { api } from "./client";
import { dateAtLocalOffset, formatLocalDate } from "../../lib/date";


// =================== Dashboard summary ===================

export interface DashboardSummary {
  generatedAt: string;
  health: 'green' | 'amber' | 'red';
  alerts: Array<{ severity: 'red' | 'amber' | 'info'; message: string }>;
  events: {
    total: number;
    inScope: number;
    outOfScope: number;
    outOfScopePercent: number;
    pendingGeocode: number;
    pendingEnrichment: number;
    last24h: number;
    last7d: number;
    next7d: number;
    next30d: number;
    megaUpcoming: number;
    distinctSources: number;
  };
  waitlist: {
    total: number;
    pending: number;
    invited: number;
    converted: number;
  };
  coverage: {
    activeRegions: number;
    bootstrapRegions: number;
  };
  pricing: {
    last24h: number;
    last30d: number;
    futureRecommendations: number;
    activeAddresses: number;
    activeWithFuturePricing: number;
    coveragePercent: number;
    appliedPriceCaptured: number;
    invalidLocalityAddresses: number;
  };
  dataset: {
    health: 'green' | 'amber' | 'red';
    readiness: Record<string, boolean>;
    blockers: Array<{ severity: 'red' | 'amber' | 'green'; code: string; message: string; nextAction: string }>;
    priceSnapshots: number;
    occupancyRecords: number;
    eventProximityFeatures: number;
    latestSnapshotDate: string | null;
  };
  billing: {
    activeSubscriptions: number;
    legacyPedingPayments: number;
    stripeSecretConfigured: boolean;
    stripeWebhookConfigured: boolean;
    stripePublishableConfigured?: boolean;
    stripeSecretMode?: 'test' | 'live' | 'unknown' | 'missing';
    stripePublishableMode?: 'test' | 'live' | 'unknown' | 'missing';
    stripeModeMismatch?: boolean;
    byStatus: Array<{ status: string; count: number }>;
  };
  email?: {
    brevoApiKeyConfigured: boolean;
    emailSenderConfigured: boolean;
    senderDomain: string;
    senderUsesUrbanDomain: boolean;
    frontUrlConfigured: boolean;
  };
  stays: {
    accounts: number;
    listings: number;
    priceUpdatesLast30d: number;
    apiBaseConfigured: boolean;
    tokenEncryptionConfigured: boolean;
    betaPrivate: boolean;
  };
  support?: {
    open: number;
    overdue: number;
    p0Open: number;
    lgpdOpen: number;
    supportEmail?: string;
    privacyEmail?: string;
    supportEmailConfigured?: boolean;
    privacyEmailConfigured?: boolean;
    supportEmailDomainOk?: boolean;
    privacyEmailDomainOk?: boolean;
    supportOwnerEmail?: string;
    privacyOwnerEmail?: string;
    supportOwnerConfigured?: boolean;
    privacyOwnerConfigured?: boolean;
    supportOwnerDomainOk?: boolean;
    privacyOwnerDomainOk?: boolean;
  };
  integrationsReadiness?: Record<
    'stripe' | 'email' | 'stays' | 'support',
    {
      label: string;
      status: 'ready' | 'blocked';
      blockers: string[];
      nextAction: string;
    }
  >;
  revenue: {
    activeSubscriptions: number;
  };
  topSources: Array<{ source: string; count: number }>;
  timeline: {
    days: number;
    buckets: Array<{ day: string; inScope: number; outOfScope: number }>;
  };
}

export const fetchDashboardSummary = () =>
  api.get<DashboardSummary>('/admin/dashboard-summary').then((r) => r.data);

// =================== Pace (booked vs expected) ===================

/**
 * Ponto da curva de pace exposto pelo backend (Gap 4 — Dev 1).
 *
 * Contrato esperado quando o endpoint estiver pronto:
 *   GET /properties/:id/pace?targetDateFrom=YYYY-MM-DD&targetDateTo=YYYY-MM-DD
 *   GET /pace/portfolio?targetDateFrom=YYYY-MM-DD&targetDateTo=YYYY-MM-DD
 * Resposta:
 *   { points: [{ date, booked, expected, eventLabel? }, ...] }
 *
 */
export interface PaceApiPoint {
  date: string;
  booked: number;
  expected: number;
  eventLabel?: string | null;
}

export interface PaceApiResponse {
  points: PaceApiPoint[];
}

function isoFromDaysAhead(daysAhead: number): string {
  return formatLocalDate(dateAtLocalOffset(daysAhead));
}

/**
 * fetchPace — busca pace para um imóvel específico ou para o portfólio.
 *
 *
 * Range default: hoje até hoje+60 dias.
 */
export async function fetchPace(
  propertyId?: string,
  options?: { days?: number },
): Promise<PaceApiPoint[]> {
  const days = options?.days ?? 60;

  const targetDateFrom = isoFromDaysAhead(0);
  const targetDateTo = isoFromDaysAhead(days);
  const endpoint = propertyId
    ? `/properties/${encodeURIComponent(propertyId)}/pace`
    : '/pace/portfolio';

  try {
    const { data } = await api.get<PaceApiResponse>(endpoint, {
      params: { targetDateFrom, targetDateTo },
    });
    return data?.points ?? [];
  } catch (err) {
    console.warn('[fetchPace] endpoint indisponível:', err);
    throw err;
  }
}

// =================== Portfolio calendar (Gap 1 — Dev 1 ↔ Dev 2) ===================

/**
 * Contrato B — `/portfolio/calendar` payload (Dev 1 → Dev 2).
 *
 *   GET /portfolio/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   → {
 *       properties: [{
 *         propertyId: string;
 *         name: string;
 *         thumbnail: string | null;
 *         days: [{
 *           date: string;
 *           sugestao: number | null;
 *           atual: number;
 *           evento: { id: string; nome: string; impacto: 'alta' | 'media' } | null;
 *         }];
 *       }]
 *     }
 *
 */
export type PortfolioEventImpact = 'alta' | 'media';

export interface PortfolioEvent {
  id: string;
  nome: string;
  impacto: PortfolioEventImpact;
}

export type PortfolioSignal =
  | number
  | {
      value?: number | null;
      score?: number | null;
      amount?: number | null;
      percent?: number | null;
      percentage?: number | null;
      label?: string | null;
      title?: string | null;
      description?: string | null;
      reason?: string | null;
      [key: string]: unknown;
    };

export interface PortfolioDay {
  date: string;
  sugestao: number | null;
  atual: number;
  base?: number | null;
  evento: PortfolioEvent | null;
  strategyApplied?: unknown;
  opportunity?: PortfolioSignal | null;
  risk?: PortfolioSignal | string | null;
  lift?: PortfolioSignal | null;
  confidence?: PortfolioSignal | string | number | null;
}

export interface PortfolioProperty {
  propertyId: string;
  name: string;
  thumbnail: string | null;
  days: PortfolioDay[];
  strategyApplied?: unknown;
  opportunity?: PortfolioSignal | null;
  risk?: PortfolioSignal | string | null;
  lift?: PortfolioSignal | null;
  confidence?: PortfolioSignal | string | number | null;
}

export interface PortfolioCalendarResponse {
  properties: PortfolioProperty[];
  summary?: Record<string, unknown> | null;
  opportunities?: PortfolioOpportunity[] | null;
  actionRuns?: PortfolioActionRun[] | null;
  range?: { from: string; to: string; days: number } | null;
}

export interface PortfolioCalendarInput {
  from: string;
  to: string;
  propertyIds?: string[];
  strategy?: string;
}

/**
 * fetchPortfolioCalendar — multi-imóvel calendar (Gap 1).
 *
 */
export async function fetchPortfolioCalendar(
  input: PortfolioCalendarInput,
): Promise<PortfolioCalendarResponse> {

  try {
    const { data } = await api.get<PortfolioCalendarResponse>('/portfolio/calendar', {
      params: {
        from: input.from,
        to: input.to,
        propertyIds: input.propertyIds?.join(',') || undefined,
        strategy: input.strategy && input.strategy !== 'todas' ? input.strategy : undefined,
      },
    });
    return data ?? { properties: [] };
  } catch (err) {
    console.warn('[fetchPortfolioCalendar] endpoint indisponível:', err);
    throw err;
  }
}

/**
 * Contrato C — `/portfolio/bulk-action` (Dev 2 → Dev 1).
 *
 *   POST /portfolio/bulk-action
 *   {
 *     propertyIds: string[];
 *     action: 'apply-strategy' | 'set-base-price' | 'accept-suggestions' | string;
 *     payload?: Record<string, unknown>;
 *   }
 *   → { applied: number; failed: { propertyId: string; reason: string }[]; auditLogId: string }
 */
export type PortfolioBulkAction =
  | 'apply-strategy'
  | 'set-base-price'
  | 'set-date-price'
  | 'accept-suggestions'
  | 'apply-internal'
  | string;

export interface PortfolioBulkActionInput {
  propertyIds: string[];
  action: PortfolioBulkAction;
  payload?: Record<string, unknown>;
  dates?: string[];
  from?: string;
  to?: string;
}

export interface PortfolioBulkActionFailure {
  propertyId: string;
  reason: string;
}

export interface PortfolioBulkActionResponse {
  applied?: number;
  failed?: PortfolioBulkActionFailure[];
  auditLogId?: string | null;
  actionRunId?: string | null;
  status?: string;
  summary?: Record<string, unknown> | null;
}

export interface PortfolioActionTarget {
  propertyId: string;
  date?: string;
}

export interface PortfolioActionSnapshot {
  revenue?: number | null;
  totalRevenue?: number | null;
  projectedRevenue?: number | null;
  averagePrice?: number | null;
  changedDays?: number | null;
  changedProperties?: number | null;
  [key: string]: unknown;
}

export interface PortfolioActionSimulationItem {
  propertyId?: string;
  propertyName?: string | null;
  date?: string | null;
  before?: number | Record<string, unknown> | null;
  after?: number | Record<string, unknown> | null;
  status?: string | null;
  estimatedLift?: number | null;
  applied?: boolean;
  reason?: string | null;
  [key: string]: unknown;
}

export interface PortfolioActionSimulationResponse {
  action?: PortfolioBulkAction;
  before?: PortfolioActionSnapshot | null;
  after?: PortfolioActionSnapshot | null;
  applied?: number | PortfolioActionSimulationItem[];
  failed?: PortfolioBulkActionFailure[];
  changes?: PortfolioActionSimulationItem[];
  items?: PortfolioActionSimulationItem[];
  summary?: (PortfolioActionSnapshot & {
    estimatedLift?: number | null;
    affectedProperties?: number | null;
    affectedDates?: number | null;
  }) | null;
  simulated?: boolean;
}

export interface PortfolioOpportunity {
  id?: string;
  propertyId?: string;
  propertyName?: string | null;
  date?: string | null;
  dates?: string[];
  recommendedDates?: string[];
  targetDates?: string[];
  title?: string | null;
  description?: string | null;
  reason?: string | null;
  recommendedAction?: string | null;
  strategyApplied?: unknown;
  opportunity?: PortfolioSignal | null;
  risk?: PortfolioSignal | string | null;
  lift?: PortfolioSignal | null;
  confidence?: PortfolioSignal | string | number | null;
  currentPrice?: number | null;
  suggestedPrice?: number | null;
  [key: string]: unknown;
}

export interface PortfolioActionRun {
  id: string;
  action: PortfolioBulkAction;
  status?: 'simulated' | 'applied' | 'failed' | 'partial' | string;
  applied?: number | null;
  failed?: number | PortfolioBulkActionFailure[] | null;
  auditLogId?: string | null;
  actionRunId?: string | null;
  propertyIds?: string[];
  selectedPropertyIds?: string[];
  targetDates?: string[];
  targets?: PortfolioActionTarget[];
  strategyApplied?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  summary?: Record<string, unknown> | null;
}

export interface PortfolioOpportunitiesResponse {
  range?: { from: string; to: string; days: number } | null;
  summary?: {
    opportunities?: number;
    estimatedLift?: number;
    affectedProperties?: number;
    averageRisk?: number;
    topLift?: number;
    [key: string]: unknown;
  } | null;
  opportunities: PortfolioOpportunity[];
}

export async function fetchPortfolioOpportunities(
  input: PortfolioCalendarInput,
): Promise<PortfolioOpportunitiesResponse> {
  try {
    const { data } = await api.get<PortfolioOpportunitiesResponse>('/portfolio/opportunities', {
      params: {
        from: input.from,
        to: input.to,
        propertyIds: input.propertyIds?.join(',') || undefined,
        strategy: input.strategy && input.strategy !== 'todas' ? input.strategy : undefined,
      },
    });
    return data ?? { opportunities: [] };
  } catch (err) {
    console.warn('[fetchPortfolioOpportunities] endpoint indisponível:', err);
    throw err;
  }
}

export async function simulatePortfolioAction(
  input: PortfolioBulkActionInput,
): Promise<PortfolioActionSimulationResponse> {

  try {
    const { data } = await api.post<PortfolioActionSimulationResponse>(
      '/portfolio/simulate-action',
      input,
    );
    return { ...(data ?? {}), simulated: data?.simulated ?? true };
  } catch (err) {
    console.warn('[simulatePortfolioAction] endpoint indisponível:', err);
    throw err;
  }
}

export async function mutatePortfolioBulkAction(
  input: PortfolioBulkActionInput,
): Promise<PortfolioBulkActionResponse> {

  try {
    const { data } = await api.post<PortfolioBulkActionResponse>('/portfolio/bulk-action', input);
    return data;
  } catch (err) {
    console.warn('[mutatePortfolioBulkAction] endpoint indisponível:', err);
    throw err;
  }
}

export async function fetchPortfolioActionRuns(limit = 8): Promise<PortfolioActionRun[]> {
  try {
    const { data } = await api.get<
      PortfolioActionRun[] | { runs?: PortfolioActionRun[]; items?: PortfolioActionRun[] }
    >('/portfolio/action-runs', {
      params: { limit },
    });
    if (Array.isArray(data)) return data;
    return data?.runs ?? data?.items ?? [];
  } catch (err) {
    const status = (err as any)?.response?.status;
    if (status === 404 || status === 405 || status === 501) {
      console.warn('[fetchPortfolioActionRuns] endpoint indisponível:', err);
      return [];
    }
    throw err;
  }
}
