import { api, enableContractFallback } from "./client";
import { encodeGeoHash } from "./events";


// ================== Admin (F6.3 painel) ==================

export interface AdminOverview {
  users: { total: number; active: number; admins: number };
  product: {
    propertiesRegistered: number;
    eventsTotal: number;
    eventsLast7d: number;
    analysesTotal: number;
    analysesAccepted: number;
    acceptanceRatePercent: number;
  };
  revenue: { activeSubscriptions: number };
  ai: {
    currentTier: string;
    currentStrategy: string;
    reason: string;
    dataset: {
      totalSnapshots: number;
      distinctListings: number;
      distinctDays: number;
      trainingReady: number;
    };
  };
}

export interface AdminPricingStatus {
  activeStrategy: string;
  tier: string;
  reason: string;
  datasetSize: {
    total: number;
    distinctListings: number;
    distinctDays: number;
    trainingReady: number;
  };
  strategyEnvDefault: string;
  bootstrapOnBoot: boolean;
}

export interface AdminDatasetMetrics {
  byOrigin: Array<{ origin: string; count: number }>;
  daysCovered: number;
  topListings: Array<{ listingId: string; snapshots: number }>;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: 'host' | 'admin' | 'support' | string;
  ativo: boolean;
  createdAt: string;
  phone?: string;
  company?: string;
  pricingStrategy?: string;
  operationMode?: string;
  airbnbHostId?: string;
}

export interface AdminUsersResponse {
  data: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const { data } = await api.get<AdminOverview>('/admin/overview');
  return data;
}

export async function fetchAdminPricingStatus(): Promise<AdminPricingStatus> {
  const { data } = await api.get<AdminPricingStatus>('/admin/pricing/status');
  return data;
}

export async function fetchAdminDatasetMetrics(): Promise<AdminDatasetMetrics> {
  const { data } = await api.get<AdminDatasetMetrics>('/admin/dataset/metrics');
  return data;
}

export interface AdminAlphaRecommendation {
  id: string;
  createdAt: string;
  property: {
    listId: string | null;
    addressId: string | null;
    title: string | null;
    manualDailyPrice: number | null;
    averageMonthlyRevenue: number | null;
  };
  event: {
    id: string | null;
    name: string | null;
    city: string | null;
    state: string | null;
    startsAt: string | null;
    source: string | null;
    relevance: number | null;
    expectedAttendance: number | null;
  };
  pricing: {
    current: number;
    suggested: number;
    lift: number | null;
    liftPercent: number;
    recommendation: string | null;
    reason: string | null;
    distanceKm: number;
  };
  lifecycle: {
    accepted: boolean;
    status: string;
    appliedPrice: number | null;
    appliedAt: string | null;
    applicationOrigin: string | null;
  };
  outcome: {
    reservationStatus: 'unknown' | 'booked' | 'not_booked' | 'blocked' | null;
    realRevenue: number | null;
    bookedNights: number | null;
    capturedAt: string | null;
    note: string | null;
  };
  qualityFlags: string[];
}

export interface AdminAlphaDashboard {
  generatedAt: string;
  user: { id: string; email: string; username: string; ativo: boolean; role: string };
  properties: {
    total: number;
    activeAddresses: number;
    completed: number;
    withManualPrice: number;
    withAverageMonthlyRevenue: number;
    totalAverageMonthlyRevenue: number;
  };
  recommendations: {
    total: number;
    accepted: number;
    applied: number;
    feedbackCaptured: number;
    booked: number;
    realRevenue: number;
    potentialDailyLift: number;
    distinctProperties: number;
    distinctEvents: number;
  };
  events: {
    total: number;
    upcoming: number;
    createdLast24h: number;
    qualityFlags: Record<string, number>;
  };
  recentRecommendations: AdminAlphaRecommendation[];
}

export interface AdminAlphaRecommendationsExport {
  generatedAt: string;
  user: { id: string; email: string; username: string };
  total: number;
  rows: AdminAlphaRecommendation[];
}

export async function fetchAdminAlphaDashboard(email: string) {
  const { data } = await api.get<AdminAlphaDashboard>('/admin/alpha/dashboard', { params: { email } });
  return data;
}

export async function fetchAdminAlphaRecommendations(email: string, limit = 250) {
  const { data } = await api.get<AdminAlphaRecommendationsExport>('/admin/alpha/recommendations', {
    params: { email, limit },
  });
  return data;
}

export async function runAdminAlphaReprocess(email: string) {
  const { data } = await api.post<AdminJobRunResponse>('/admin/alpha/reprocess', null, {
    params: { email },
  });
  return data;
}

export interface AdminDatasetDiagnostics {
  generatedAt: string;
  health: 'red' | 'amber' | 'green';
  readiness: 'empty' | 'collecting' | 'training_ready' | 'ground_truth_ready';
  blockers: Array<{
    code: string;
    severity: 'red' | 'amber' | 'green';
    message: string;
    nextAction: string;
  }>;
  tables: {
    priceSnapshots: AdminDatasetMetrics & {
      total: number;
      distinctListings: number;
      distinctDays: number;
      trainingReady: number;
      latestSnapshotDate: string | null;
    };
    occupancyHistory: {
      total: number;
      trainingReady: number;
      latestDate: string | null;
    };
    eventProximityFeatures: {
      total: number;
      latestSnapshotDate: string | null;
    };
  };
  externalDependencies: Record<string, { configured: boolean; status: string; message: string }>;
  lastOwnedListingsSnapshot: unknown | null;
}

export interface AdminJobRunResponse<T = unknown> {
  id: string;
  name: string;
  status: 'running' | 'success' | 'error';
  triggeredByUserId: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  result: T | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetSnapshotResult {
  captured: number;
  skipped: number;
  duplicates: number;
  totalLists: number;
  skippedMissingPrice: number;
  skippedInvalidPrice: number;
  externalDataAvailable: boolean;
  status: string;
  warnings: string[];
}

export type DatasetSnapshotRunResponse = AdminJobRunResponse<DatasetSnapshotResult>;

export interface EventProximitySnapshotResult {
  captured: number;
  skipped: number;
  duplicates: number;
  totalAddresses: number;
  totalEvents: number;
  status: string;
  warnings: string[];
}

export type EventProximitySnapshotRunResponse =
  AdminJobRunResponse<EventProximitySnapshotResult>;

export interface GeocoderRunResult {
  attempted: number;
  succeeded: number;
  failed: number;
  failures: Array<{ id: string; reason: string }>;
}

export interface ResetStaleEnrichmentResult {
  reset: number;
}

export const fetchAdminDatasetDiagnostics = () =>
  api.get<AdminDatasetDiagnostics>('/admin/dataset/diagnostics').then((r) => r.data);

export const runAdminDatasetSnapshot = () =>
  api.post<DatasetSnapshotRunResponse>('/admin/dataset/snapshot/run').then((r) => r.data);

export const runAdminEventProximitySnapshot = () =>
  api
    .post<EventProximitySnapshotRunResponse>('/admin/dataset/event-proximity/run')
    .then((r) => r.data);

export const fetchAdminJobRuns = (limit = 10) =>
  api.get<AdminJobRunResponse[]>('/admin/jobs/runs', { params: { limit } }).then((r) => r.data);

export const runAdminGeocoderJob = (limit = 50) =>
  api
    .post<AdminJobRunResponse<GeocoderRunResult>>('/admin/jobs/geocoder/run', null, {
      params: { limit },
    })
    .then((r) => r.data);

export const runAdminResetStaleEnrichmentJob = () =>
  api
    .post<AdminJobRunResponse<ResetStaleEnrichmentResult>>(
      '/admin/jobs/reset-stale-enrichment/run',
    )
    .then((r) => r.data);

export async function fetchAdminUsers(page = 1, limit = 20): Promise<AdminUsersResponse> {
  const { data } = await api.get<AdminUsersResponse>('/admin/users', {
    params: { page, limit },
  });
  return data;
}

export async function setAdminUserRole(
  userId: string,
  role: 'host' | 'admin' | 'support',
): Promise<{ id: string; role: string }> {
  const { data } = await api.patch(`/admin/users/${userId}/role`, { role });
  return data;
}

export async function setAdminUserActive(
  userId: string,
  ativo: boolean,
): Promise<{ id: string; ativo: boolean }> {
  const { data } = await api.patch(`/admin/users/${userId}/active`, { ativo });
  return data;
}

export interface AdminAuditLog {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown | null;
  after: unknown | null;
  metadata: unknown | null;
  createdAt: string;
}

export interface AdminAuditLogsResponse {
  items: AdminAuditLog[];
  total: number;
  page: number;
  limit: number;
}

export const fetchAdminAuditLogs = (params?: {
  page?: number;
  limit?: number;
  actorUserId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
}) =>
  api
    .get<AdminAuditLogsResponse>('/admin/audit-logs', { params })
    .then((r) => r.data);

// ================== Stays integration (F6.4) ==================

export interface StaysAccountPublic {
  id: string;
  status: 'pending' | 'active' | 'error' | 'disconnected';
  clientId: string;
  lastSyncAt: string | null;
  consentVersion?: string | null;
  consentAcceptedAt: string | null;
}

export interface StaysListingPublic {
  id: string;
  staysListingId: string;
  title: string | null;
  shortAddress: string | null;
  basePriceCents: number | null;
  active: boolean;
  operationMode: 'inherit' | 'notifications' | 'auto';
  propriedadeId: string | null;
}

export interface PriceUpdatePublic {
  id: string;
  targetDate: string;
  previousPriceCents: number;
  newPriceCents: number;
  currency: string;
  origin: 'ai_auto' | 'user_accepted' | 'user_manual' | 'rollback';
  status: 'pending' | 'success' | 'rejected' | 'error';
  errorMessage: string | null;
  createdAt: string;
}

export interface StaysPricePreviewIssue {
  code: string;
  message: string;
}

export interface StaysPricePreview {
  listingId: string;
  staysListingId: string;
  title: string | null;
  targetDate: string;
  previousPriceCents: number;
  newPriceCents: number;
  currency: string;
  diffCents: number;
  diffPercent: number | null;
  maxIncreasePercent: number;
  maxDecreasePercent: number;
  withinGuardrails: boolean;
  readyForPush: boolean;
  blockers: StaysPricePreviewIssue[];
  warnings: StaysPricePreviewIssue[];
  existingPriceUpdateId: string | null;
  idempotentReplay: boolean;
}

export async function staysConnect(
  clientId: string,
  accessToken: string,
  consent: { consentAccepted: boolean; consentVersion: string },
): Promise<StaysAccountPublic> {
  const { data } = await api.post<StaysAccountPublic>('/stays/connect', {
    clientId,
    accessToken,
    consentAccepted: consent.consentAccepted,
    consentVersion: consent.consentVersion,
  });
  return data;
}

export async function staysDisconnect(): Promise<void> {
  await api.delete('/stays/connect');
}

export async function staysSyncListings(): Promise<{ count: number; listings: StaysListingPublic[] }> {
  const { data } = await api.post('/stays/listings/sync');
  return data;
}

export async function staysListListings(): Promise<StaysListingPublic[]> {
  const { data } = await api.get<StaysListingPublic[]>('/stays/listings');
  return data;
}

export async function staysPreviewPrice(input: {
  listingId: string;
  targetDate: string;
  newPriceCents: number;
  previousPriceCents?: number | null;
  currency?: string;
  analisePrecoId?: string;
}): Promise<StaysPricePreview> {
  const { data } = await api.post<StaysPricePreview>('/stays/price/preview', input);
  return data;
}

export async function staysPushPrice(input: {
  listingId: string;
  targetDate: string;
  newPriceCents: number;
  previousPriceCents: number;
  currency?: string;
  analisePrecoId?: string;
}): Promise<PriceUpdatePublic> {
  const { data } = await api.post<PriceUpdatePublic>('/stays/price/push', input);
  return data;
}

export async function staysRollback(priceUpdateId: string): Promise<PriceUpdatePublic> {
  const { data } = await api.post<PriceUpdatePublic>(`/stays/price/${priceUpdateId}/rollback`);
  return data;
}

// ================== Admin v2.8 (eventos, Stays, funnel, qualidade, ocupação) ==================

export interface AdminEventsAnalytics {
  summary: {
    total: number;
    ativos: number;
    inScope: number;
    outOfScope: number;
    coveragePercent: number;
    enrichmentPercent: number;
    coordsMissing: number;
    relevanceMissing: number;
  };
  upcoming: { next7d: number; next30d: number; next90d: number; megaUpcoming: number };
  byCategory: Array<{ categoria: string; count: number }>;
  byCity: Array<{ cidade: string; count: number }>;
  byRelevance: Array<{ bucket: string; count: number }>;
  topUpcoming: Array<{
    id: string;
    nome: string;
    cidade: string;
    dataInicio: string;
    relevancia: number | null;
    categoria: string | null;
    capacidadeEstimada: number | null;
    raioImpactoKm: number | null;
    hasCoords: boolean;
  }>;
  lastCrawlAt: string | null;
}

export interface AdminStaysHealth {
  readiness?: {
    apiBaseConfigured: boolean;
    tokenEncryptionConfigured: boolean;
    betaPrivate: boolean;
    missingEnv: string[];
  };
  accountsByStatus: Array<{ status: string; count: number }>;
  listings: { total: number; active: number; forcedAuto: number };
  pushLast30d: Array<{ status: string; count: number }>;
  recent: Array<{
    id: string;
    targetDate: string;
    previousPriceCents: number;
    newPriceCents: number;
    origin: string;
    status: string;
    errorMessage: string | null;
    createdAt: string;
    userId?: string;
    listingId?: string;
  }>;
}

export interface AdminProductFunnel {
  windowDays: number;
  stages: {
    signups: number;
    onboardedWithAirbnbId: number;
    analysesGenerated: number;
    suggestionsAccepted: number;
    appliedPriceCaptured: number;
    activeSubscriptions: number;
    operationModeAuto: number;
  };
  rates: {
    acceptanceRatePercent: number;
    applicationRatePercent: number;
  };
}

export interface AdminPricingQuality {
  windowDays: number;
  sampleSize: number;
  discarded: number;
  mapePercent: number | null;
  rmse: number | null;
  medianAbsoluteError: number | null;
  qualityGate: { threshold: number; passes: boolean; meetsMinSample: boolean };
}

export interface AdminOccupancyCoverage {
  byStatus: Array<{ status: string; count: number }>;
  byOrigin: Array<{ origin: string; count: number }>;
  distinctListings: number;
}

export interface AdminOccupancyProperty {
  addressId: string;
  listId: string;
  title: string;
  airbnbListingId: string | null;
  userId: string | null;
  userEmail: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  manualDailyPrice: number | null;
  dailyPrice: number | null;
  averageMonthlyRevenue: number | null;
}

export interface ManualOccupancyPayload {
  listId: string;
  date: string;
  status: 'booked' | 'available' | 'blocked' | 'unknown';
  revenueCents?: number | null;
  listedPriceCents?: number | null;
  currency?: string;
}

export interface ManualOccupancyRecord extends ManualOccupancyPayload {
  id: string;
  origin: string;
  trainingReady: boolean;
}

export const fetchAdminEvents = () =>
  api.get<AdminEventsAnalytics>('/admin/events/analytics').then((r) => r.data);
export const fetchAdminStays = () =>
  api.get<AdminStaysHealth>('/admin/stays/health').then((r) => r.data);
export const fetchAdminFunnel = () =>
  api.get<AdminProductFunnel>('/admin/funnel').then((r) => r.data);
export const fetchAdminPricingQuality = () =>
  api.get<AdminPricingQuality>('/admin/pricing/quality').then((r) => r.data);
export const fetchAdminOccupancy = () =>
  api.get<AdminOccupancyCoverage>('/admin/occupancy/coverage').then((r) => r.data);
export const fetchAdminOccupancyProperties = () =>
  api.get<AdminOccupancyProperty[]>('/admin/occupancy/properties').then((r) => r.data);
export const upsertAdminManualOccupancy = (payload: ManualOccupancyPayload) =>
  api.post<ManualOccupancyRecord>('/admin/occupancy/manual', payload).then((r) => r.data);

export interface AdminPriceIntelligenceHealth {
  generatedAt: string;
  health: 'green' | 'amber' | 'red';
  windowDays: number;
  alerts: Array<{ severity: 'red' | 'amber' | 'info'; message: string }>;
  snapshots: {
    total: number;
    last24h: number;
    last7d: number;
    distinctListings: number;
    trainingReady: number;
    latestSnapshotAt: string | null;
  };
  observations: {
    total: number;
    last24h: number;
    last7d: number;
    distinctListings: number;
    trainingReady: number;
    coveragePercent: number;
    latestObservedAt: string | null;
  };
  suggestions: {
    total: number;
    last24h: number;
    last7d: number;
    future: number;
    verified: number;
    verifiedPercent: number;
    accepted: number;
    applied: number;
    pendingVerification: number;
    failedVerification: number;
  };
  jobs: {
    running: number;
    queued: number;
    queueAvailable?: boolean;
    queueUnavailableReason?: string | null;
    failedLast24h: number;
    avgDurationMs: number | null;
    lastRun: AdminJobRunResponse | null;
    lastSuccessAt: string | null;
    recent: AdminJobRunResponse[];
    byName?: Array<{
      name: string;
      total: number;
      successes: number;
      failures: number;
      running: number;
      successRate: number | null;
      avgDurationMs: number | null;
      lastRunAt: string | null;
      lastStatus: AdminJobRunResponse['status'] | null;
      lastSuccessAt: string | null;
      lastFailureAt: string | null;
      lastErrorMessage: string | null;
    }>;
  };
  schema?: {
    ok: boolean;
    checkedAt: string;
    missing: string[];
    checkError: string | null;
  };
  failuresByType: Array<{
    type: string;
    count: number;
    lastSeenAt: string | null;
  }>;
  problematicProperties: Array<{
    addressId: string | null;
    listId: string | null;
    title: string | null;
    userEmail: string | null;
    city: string | null;
    state: string | null;
    severity: 'red' | 'amber' | 'info';
    issue: string;
    lastSnapshotAt: string | null;
    lastObservationAt: string | null;
    suggestionsPending: number;
    failedSuggestions: number;
  }>;
  shortcuts: Array<{
    label: string;
    href: string;
    description?: string | null;
    kind?: 'primary' | 'secondary' | 'ghost';
  }>;
  endpointGaps?: string[];
}

export const fetchAdminPriceIntelligenceHealth = () =>
  api
    .get<AdminPriceIntelligenceHealth>('/admin/price-intelligence/health')
    .then((r) => r.data);

export interface AdminAirbnbPricingAttemptHealth {
  generatedAt: string;
  windowHours: number;
  health: 'green' | 'amber' | 'red';
  schema: {
    available: boolean;
    error: string | null;
  };
  summary: {
    total: number;
    successes: number;
    failures: number;
    pending: number;
    openPending: number;
    stalePending: number;
    avgDurationMs: number | null;
    latestAttemptAt: string | null;
  };
  failuresByReason: Array<{
    reason: string;
    count: number;
    avgDurationMs: number | null;
    lastSeenAt: string | null;
  }>;
  sources: Array<{
    source: string;
    total: number;
    successes: number;
    failures: number;
    pending: number;
    avgDurationMs: number | null;
    latestAttemptAt: string | null;
  }>;
  recent: Array<{
    id: string;
    listingId: string;
    userId: string | null;
    listId: string | null;
    addressId: string | null;
    checkIn: string;
    checkOut: string;
    source: string;
    status: string;
    reason: string | null;
    durationMs: number | null;
    priceTotal: number | null;
    dailyPrice: number | null;
    currency: string;
    finalUrl: string | null;
    metadata: Record<string, unknown> | null;
    startedAt: string | null;
    finishedAt: string | null;
  }>;
}

export const fetchAdminAirbnbPricingAttemptHealth = (windowHours = 24) =>
  api
    .get<AdminAirbnbPricingAttemptHealth>('/admin/airbnb/pricing-attempts/health', {
      params: { windowHours },
    })
    .then((r) => r.data);

// ---- Admin v2.9 (finance + plans-config) ----

export interface AdminFinanceOverview {
  currency: string;
  activeListings: number;
  activePayments: number;
  revenue: {
    mrrCents: number;
    byPlan: Array<{ planName: string; count: number; monthlyCents: number }>;
  };
  costs: {
    totalCents: number;
    fixedCents: number;
    percentualCents: number;
    byCategory: Array<{ category: string; cents: number }>;
  };
  margin: { absoluteCents: number; percent: number };
  perListing: {
    revenueCents: number;
    costCents: number;
    marginCents: number;
    marginPercent: number;
  };
}

export interface AdminCost {
  id: string;
  name: string;
  category: string;
  recurrence: string;
  monthlyCostCents: number;
  percentOfRevenue: number | null;
  description: string | null;
  scalesWithListings: boolean;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPlanConfig {
  id: string;
  name: string;
  title: string;
  price?: string;
  priceAnnual?: string;
  priceMonthly?: string;
  priceQuarterly?: string;
  priceSemestral?: string;
  priceAnnualNew?: string;
  discountQuarterlyPercent?: number;
  discountSemestralPercent?: number;
  discountAnnualPercent?: number;
  propertyLimit?: number | null;
  minProperties?: number | null;
  maxProperties?: number | null;
  maxCheckoutQuantity?: number | null;
  selfServiceEnabled?: boolean;
  sortOrder?: number;
  features: string[];
  highlightBadge?: string | null;
  discountBadge?: string | null;
  isActive: boolean;
  isCustomPrice?: boolean;
  stripePriceIdMonthly?: string;
  stripePriceIdQuarterly?: string;
  stripePriceIdSemestral?: string;
  stripePriceIdAnnualNew?: string;
}

export const fetchAdminFinanceOverview = () =>
  api.get<AdminFinanceOverview>('/admin/finance/overview').then((r) => r.data);

export const fetchAdminCosts = (includeInactive = false) =>
  api
    .get<AdminCost[]>('/admin/finance/costs', { params: { includeInactive } })
    .then((r) => r.data);

export const createAdminCost = (input: {
  name: string;
  category: string;
  recurrence: string;
  monthlyCostCents: number;
  percentOfRevenue?: number;
  description?: string;
  scalesWithListings?: boolean;
  notes?: string;
}) => api.post<AdminCost>('/admin/finance/costs', input).then((r) => r.data);

export const updateAdminCost = (id: string, input: Partial<AdminCost>) =>
  api.patch<AdminCost>(`/admin/finance/costs/${id}`, input).then((r) => r.data);

export const deleteAdminCost = (id: string) =>
  api.delete(`/admin/finance/costs/${id}`).then((r) => r.data);

/**
 * Popula a tabela `platform_costs` com os custos operacionais default da Urban AI
 * (Railway, Stripe, Gemini, Brevo etc.). Idempotente: por padrão NÃO
 * sobrescreve custos já cadastrados — passe `overwrite=true` para resetar.
 */
export const seedAdminCosts = (overwrite = false) =>
  api
    .post<{
      created: number;
      updated: number;
      skipped: number;
      items: Array<{ name: string; action: 'created' | 'updated' | 'skipped' }>;
    }>(`/admin/finance/costs/seed?overwrite=${overwrite ? 'true' : 'false'}`)
    .then((r) => r.data);

export const fetchAdminPlansConfig = () =>
  api.get<AdminPlanConfig[]>('/admin/plans-config').then((r) => r.data);

export const updateAdminPlan = (name: string, input: Partial<AdminPlanConfig>) =>
  api.patch<AdminPlanConfig>(`/admin/plans-config/${name}`, input).then((r) => r.data);

// =================== Stripe sync check ===================

export type StripePriceCycleStatus =
  | 'ok'
  | 'missing'
  | 'not-configured'
  | 'not-found'
  | 'cycle-mismatch'
  | 'inactive'
  | 'currency-mismatch'
  | 'check-error';

export interface StripeSyncEntry {
  planName: string;
  cycle: 'monthly' | 'quarterly' | 'semestral' | 'annual';
  priceId: string | null;
  source: 'plan-entity' | 'env-fallback' | 'missing';
  status: StripePriceCycleStatus;
  details?: string;
  stripeAmountCents?: number;
  stripeCurrency?: string;
  stripeInterval?: string;
  stripeIntervalCount?: number;
  stripeActive?: boolean;
}

export interface StripeSyncReport {
  summary: {
    total: number;
    ok: number;
    missing: number;
    notConfigured: number;
    problems: number;
    stripeKeyConfigured: boolean;
  };
  entries: StripeSyncEntry[];
}

/**
 * Valida que os 8 Stripe Price IDs (matriz F6.5: 2 planos × 4 ciclos) existem
 * na conta Stripe e batem com o ciclo esperado. Útil para detectar faltas
 * antes de um cliente tentar checkout.
 */
export const fetchStripeSyncCheck = () =>
  api.get<StripeSyncReport>('/admin/stripe/sync-check').then((r) => r.data);

// =================== Waitlist (F8 pré-lançamento) ===================

export interface PublicConfig {
  launchMode: 'prelaunch' | 'closed_beta' | 'paid_beta' | 'public';
  prelaunchMode: boolean;
  appEnv: string;
  version: string;
}

/**
 * Configuração pública do ambiente. Usada pelo front para decidir gating
 * (PRELAUNCH_MODE) sem precisar de env var de build-time, que fica ossificada.
 * Mudança no Railway reflete em todos os clients no próximo refresh.
 */
export const fetchPublicConfig = () =>
  api.get<PublicConfig>('/public-config').then((r) => r.data);

export interface WaitlistSignupResult {
  position: number;
  referralCode: string;
  aheadOfYou: number;
  totalSignups: number;
}

export interface WaitlistStatus {
  position: number;
  aheadOfYou: number;
  totalSignups: number;
  referralsCount: number;
  status: 'pending' | 'invited' | 'converted' | 'declined';
}

export const signupWaitlist = (input: {
  email: string;
  name?: string;
  phone?: string;
  source?: string;
  referredBy?: string;
}) =>
  api.post<WaitlistSignupResult>('/waitlist', input).then((r) => r.data);

export const fetchWaitlistStatus = (referralCode: string) =>
  api
    .get<WaitlistStatus>('/waitlist/me', { params: { code: referralCode } })
    .then((r) => r.data);

export interface WaitlistInviteValidation {
  valid: boolean;
  reason?: string;
  email?: string;
  name?: string | null;
  position?: number;
}

export const validateWaitlistInvite = (token: string) =>
  api
    .get<WaitlistInviteValidation>('/waitlist/invite', { params: { token } })
    .then((r) => r.data);

export const acceptWaitlistInvite = (input: {
  token: string;
  username?: string;
  password: string;
}) =>
  api
    .post<{ mode: 'registered'; accessToken: string; user: unknown }>(
      '/auth/waitlist/accept',
      input,
    )
    .then((r) => r.data);

// Admin
export interface WaitlistEntry {
  id: string;
  position: number;
  email: string;
  name: string | null;
  phone: string | null;
  source: string;
  referralCode: string;
  referredBy: string | null;
  referralsCount: number;
  status: 'pending' | 'invited' | 'converted' | 'declined';
  invitedAt: string | null;
  convertedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface WaitlistListResponse {
  page: number;
  limit: number;
  total: number;
  items: WaitlistEntry[];
}

export interface WaitlistStats {
  total: number;
  byStatus: Array<{ status: string; count: number }>;
  bySource: Array<{ source: string; count: number }>;
  topReferrers: Array<{
    email: string;
    referralCode: string;
    referralsCount: number;
    position: number;
  }>;
}

export const fetchAdminWaitlist = (params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}) => api.get<WaitlistListResponse>('/admin/waitlist', { params }).then((r) => r.data);

export const fetchAdminWaitlistStats = () =>
  api.get<WaitlistStats>('/admin/waitlist/stats').then((r) => r.data);

export const inviteWaitlistEntry = (id: string) =>
  api.post<{ ok: true; inviteUrl: string; emailSent: boolean }>(`/admin/waitlist/${id}/invite`).then((r) => r.data);

export const updateWaitlistNotes = (id: string, notes: string | null) =>
  api.patch<WaitlistEntry>(`/admin/waitlist/${id}/notes`, { notes }).then((r) => r.data);

export const deleteWaitlistEntry = (id: string) =>
  api.delete<{ ok: true }>(`/admin/waitlist/${id}`).then((r) => r.data);

// =================== Contato público + admin ===================

export type ContactSubmissionStatus = 'new' | 'in_progress' | 'resolved' | 'archived';
export type ContactSubmissionCategory =
  | 'sales'
  | 'support'
  | 'billing'
  | 'privacy_lgpd'
  | 'stays'
  | 'incident'
  | 'partnership';
export type ContactSubmissionSeverity = 'P0' | 'P1' | 'P2' | 'P3';

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  source: string;
  status: ContactSubmissionStatus;
  category: ContactSubmissionCategory;
  severity: ContactSubmissionSeverity;
  dueAt: string | null;
  resolvedAt: string | null;
  assignedOwner: string | null;
  notes: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactSubmissionListResponse {
  page: number;
  limit: number;
  total: number;
  byStatus?: Array<{ status: ContactSubmissionStatus; count: number }>;
  byCategory?: Array<{ category: ContactSubmissionCategory; count: number }>;
  bySeverity?: Array<{ severity: ContactSubmissionSeverity; count: number }>;
  items: ContactSubmission[];
}

export const createContactSubmission = (input: {
  name: string;
  email: string;
  subject: string;
  message: string;
  source?: string;
}) => api.post<ContactSubmission>('/contact-submissions', input).then((r) => r.data);

export const fetchAdminContactSubmissions = (params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: ContactSubmissionStatus | 'all';
}) =>
  api
    .get<ContactSubmissionListResponse>('/admin/contact-submissions', { params })
    .then((r) => r.data);

export const updateAdminContactSubmission = (
  id: string,
  input: {
    status?: ContactSubmissionStatus;
    category?: ContactSubmissionCategory;
    severity?: ContactSubmissionSeverity;
    assignedOwner?: string | null;
    notes?: string | null;
  },
) =>
  api
    .patch<ContactSubmission>(`/admin/contact-submissions/${id}`, input)
    .then((r) => r.data);

// =================== Admin - Comunicacoes ===================

export type CommunicationChannel = 'email' | 'push' | 'in_app';
export type CommunicationStatus = 'sent' | 'failed' | 'skipped';

export interface CommunicationEvent {
  id: string;
  userId: string | null;
  channel: CommunicationChannel;
  status: CommunicationStatus;
  kind: string | null;
  templateName: string | null;
  recipientEmail: string | null;
  recipientDeviceId: string | null;
  subject: string | null;
  title: string | null;
  provider: string | null;
  providerMessageId: string | null;
  failureReason: string | null;
  metadata?: Record<string, unknown> | null;
  metadataJson?: string | null;
  correlationId: string | null;
  createdAt: string;
}

export interface CommunicationEventListResponse {
  page: number;
  limit: number;
  total: number;
  byChannel: Array<{ channel: CommunicationChannel; count: number }>;
  byStatus: Array<{ status: CommunicationStatus; count: number }>;
  items: CommunicationEvent[];
}

export interface CommunicationSummary {
  windowHours: number;
  totals: Array<{ channel: CommunicationChannel; status: CommunicationStatus; count: number }>;
  recentFailures: CommunicationEvent[];
}

export const fetchAdminCommunications = (params: {
  page?: number;
  limit?: number;
  channel?: CommunicationChannel | 'all';
  status?: CommunicationStatus | 'all';
  kind?: string;
  search?: string;
}) =>
  api
    .get<CommunicationEventListResponse>('/admin/communications', { params })
    .then((r) => r.data);

export const fetchAdminCommunicationSummary = () =>
  api.get<CommunicationSummary>('/admin/communications/summary').then((r) => r.data);

// =================== Eventos - Camada 3 (curadoria manual) ===================

export interface ManualEventInput {
  nome: string;
  dataInicio: string;
  dataFim?: string;
  enderecoCompleto?: string;
  cidade?: string;
  estado?: string;
  latitude?: number | null;
  longitude?: number | null;
  categoria?: string;
  venueType?: string;
  venueCapacity?: number | null;
  expectedAttendance?: number | null;
  linkSiteOficial?: string;
  imagemUrl?: string;
  descricao?: string;
}

export interface IngestResult {
  status: 'created' | 'updated' | 'skipped';
  reason?: string;
  id?: string;
  dedupHash?: string;
}

export interface IngestBatchResponse {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  bySource: Record<string, { created: number; updated: number; skipped: number }>;
  results: IngestResult[];
}

/**
 * Cria/atualiza 1 evento manualmente. Idempotente via dedupHash.
 * Source forçado a 'admin-manual'.
 */
export const createManualEvent = (input: ManualEventInput) =>
  api
    .post<IngestBatchResponse>('/events/ingest', {
      events: [{ ...input, source: 'admin-manual' }],
    })
    .then((r) => r.data);

/**
 * Importa CSV de eventos. Retorna parsedRows + invalidRows + ingest agregado.
 */
export const importCsvEvents = (file: File, sourceLabel?: string) => {
  const fd = new FormData();
  fd.append('file', file);
  if (sourceLabel) fd.append('sourceLabel', sourceLabel);
  return api
    .post<{
      parsedRows: number;
      invalidRows: Array<{ line: number; reason: string }>;
      ingest: IngestBatchResponse;
    }>('/events/import-csv', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};

export type GeocoderReadinessStatus = 'configured' | 'missing_api_key';

export interface GeocoderRunSummary {
  attempted: number;
  succeeded: number;
  failed: number;
  failures: Array<{ id: string; reason: string }>;
}

export interface GeocoderLastRun extends GeocoderRunSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: 'success' | 'partial_failure' | 'failed' | 'error';
  errorMessage?: string;
}

export interface GeocoderStatus {
  pendingGeocode: number;
  readiness?: {
    configured: boolean;
    status: GeocoderReadinessStatus;
    message: string;
    nextAction?: string;
  };
  running?: boolean;
  lastRun?: GeocoderLastRun | null;
}

export const fetchGeocoderStatus = () =>
  api.get<GeocoderStatus>('/events/geocoder/status').then((r) => r.data);

export const runGeocoderNow = (limit = 30) =>
  api
    .post<GeocoderRunSummary>(`/events/geocoder/run?limit=${limit}`)
    .then((r) => r.data);

// =================== Coverage Regions (admin) ===================

export interface CoverageRegion {
  id: string;
  name: string;
  status: 'active' | 'bootstrap' | 'inactive';
  centerLat: number | null;
  centerLng: number | null;
  radiusKm: number | null;
  minLat: number | null;
  maxLat: number | null;
  minLng: number | null;
  maxLng: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoverageStats {
  activeRegions: number;
  bootstrapRegions: number;
  addresses: number;
  addressRadiusKm: number;
}

export const fetchCoverageRegions = () =>
  api.get<CoverageRegion[]>('/admin/coverage').then((r) => r.data);

export const fetchCoverageStats = () =>
  api.get<CoverageStats>('/admin/coverage/stats').then((r) => r.data);

export const createCoverageRegion = (input: Partial<CoverageRegion>) =>
  api.post<CoverageRegion>('/admin/coverage', input).then((r) => r.data);

export const updateCoverageRegion = (id: string, input: Partial<CoverageRegion>) =>
  api.patch<CoverageRegion>(`/admin/coverage/${id}`, input).then((r) => r.data);

export const deleteCoverageRegion = (id: string) =>
  api.delete<{ ok: true }>(`/admin/coverage/${id}`).then((r) => r.data);

export const checkCoveragePoint = (latitude: number, longitude: number) =>
  api
    .post<{ latitude: number; longitude: number; inCoverage: boolean }>(
      '/admin/coverage/check',
      { latitude, longitude },
    )
    .then((r) => r.data);

export const resetStaleEnrichment = () =>
  api
    .post<{ reset: number }>('/admin/coverage/reset-stale-enrichment')
    .then((r) => r.data);

// =================== Events listing + collectors health ===================

export interface EventListItem {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  dataInicio: string;
  dataFim: string;
  categoria: string | null;
  relevancia: number | null;
  capacidadeEstimada: number | null;
  raioImpactoKm: number | null;
  venueType: string | null;
  venueCapacity: number | null;
  expectedAttendance?: number | null;
  venueName?: string | null;
  linkSiteOficial?: string | null;
  imagemUrl?: string | null;
  sourceId?: string | null;
  dedupHash?: string | null;
  source: string | null;
  outOfScope: boolean;
  pendingGeocode: boolean;
  ativo: boolean;
  latitude: number | null;
  longitude: number | null;
  enrichmentAttempts: number;
  enrichmentLastError: string | null;
  crawledUrl: string | null;
  canonicalName?: string | null;
  dedupStatus?: string | null;
  duplicateOfEventId?: string | null;
  identityConfidence?: number | null;
  sourceCount?: number;
  lastSeenAt: string | null;
}

export interface EventsListResponse {
  page: number;
  limit: number;
  total: number;
  scope: 'in' | 'out' | 'all';
  items: EventListItem[];
}

export const fetchAdminEventsList = (params: {
  page?: number;
  limit?: number;
  scope?: 'in' | 'out' | 'all';
  source?: string;
  search?: string;
  upcoming?: boolean;
}) =>
  api
    .get<EventsListResponse>('/admin/events/list', {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 50,
        scope: params.scope ?? 'in',
        source: params.source,
        search: params.search,
        upcoming: params.upcoming ? 'true' : undefined,
      },
    })
    .then((r) => r.data);

export interface CollectorSourceStats {
  source: string;
  total: number;
  last7d: number;
  last24h: number;
  outOfScope: number;
  outOfScopePercent: number;
  canonicalCount?: number;
  duplicateCount?: number;
  duplicateRatePercent?: number;
  sourceLinksCount?: number;
  pendingGeocode: number;
  pendingEnrichment: number;
  enriched: number;
  withErrors: number;
  errorRate: number;
  lastSeen: string | null;
}

export interface CollectorsHealthResponse {
  generatedAt: string;
  sources: CollectorSourceStats[];
}

export const fetchCollectorsHealth = () =>
  api.get<CollectorsHealthResponse>('/admin/events/collectors-health').then((r) => r.data);

// =================== Event dedup review ===================

export type EventDedupCandidateStatus = 'pending' | 'approved' | 'rejected' | 'obsolete';
export type EventDedupConfidenceBand = 'high' | 'medium' | 'low';

export type EventDedupSignal =
  | string
  | {
      key?: string;
      label?: string;
      name?: string;
      value?: unknown;
      score?: number;
      weight?: number;
      matched?: boolean;
      canonicalValue?: unknown;
      duplicateValue?: unknown;
      detail?: string;
      [key: string]: unknown;
    };

export interface EventDedupEventSummary {
  id: string;
  nome: string;
  name?: string | null;
  title?: string | null;
  canonicalName: string | null;
  cidade: string | null;
  city?: string | null;
  estado: string | null;
  state?: string | null;
  dataInicio: string;
  startDate?: string | null;
  startsAt: string | null;
  date?: string | null;
  dataFim: string | null;
  endDate?: string | null;
  enderecoCompleto: string | null;
  address?: string | null;
  venueName?: string | null;
  venueType?: string | null;
  categoria?: string | null;
  category?: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string | null;
  sourceId: string | null;
  dedupHash?: string | null;
  linkSiteOficial?: string | null;
  url?: string | null;
  crawledUrl?: string | null;
  dedupStatus: string | null;
  duplicateOfEventId: string | null;
  sourceCount: number;
  identityConfidence: number | null;
  ativo: boolean;
  [key: string]: unknown;
}

export type EventDedupCandidateEvent = EventDedupEventSummary;

export interface EventDedupCandidate {
  id: string;
  status: EventDedupCandidateStatus;
  confidenceBand: EventDedupConfidenceBand;
  score: number;
  reason: string | null;
  signals: Record<string, unknown> | EventDedupSignal[] | null;
  source: string | null;
  sourceId: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  createdAt: string;
  updatedAt: string;
  canonicalEvent: EventDedupEventSummary | null;
  duplicateEvent: EventDedupEventSummary | null;
}

export interface EventDedupCandidatesResponse {
  page: number;
  limit: number;
  total: number;
  status: EventDedupCandidateStatus | 'all';
  confidenceBand: EventDedupConfidenceBand | 'all';
  items: EventDedupCandidate[];
  summary?: {
    pending?: number;
    approved?: number;
    rejected?: number;
    high?: number;
    medium?: number;
    low?: number;
    avgScore?: number;
    [key: string]: unknown;
  };
}

export interface EventDedupScanResponse {
  generatedAt: string;
  window: { from: string; to: string };
  scanned?: number;
  compared?: number;
  candidates?: number;
  scannedEvents: number;
  reviewPendingEvents: number;
  created: number;
  updated: number;
  skipped: number;
  pendingTotal: number;
  highConfidence?: number;
  mediumConfidence?: number;
  lowConfidence?: number;
  durationMs?: number;
  message?: string;
  items: EventDedupCandidate[];
  [key: string]: unknown;
}

export interface EventDedupCandidatesQuery {
  page?: number;
  limit?: number;
  status?: EventDedupCandidateStatus | 'all';
  confidenceBand?: EventDedupConfidenceBand | 'all';
}

export interface EventDedupScanRequest {
  limit?: number;
  lookbackDays?: number;
  lookaheadDays?: number;
  minScore?: number;
  highScore?: number;
  includeInactive?: boolean;
}

type EventDedupCandidatesRawResponse =
  | EventDedupCandidatesResponse
  | EventDedupCandidate[]
  | {
      data?: EventDedupCandidate[];
      candidates?: EventDedupCandidate[];
      items?: EventDedupCandidate[];
      page?: number;
      limit?: number;
      total?: number;
      status?: EventDedupCandidateStatus | 'all';
      confidenceBand?: EventDedupConfidenceBand | 'all';
      summary?: EventDedupCandidatesResponse['summary'];
    };

function normalizeEventDedupCandidatesResponse(
  raw: EventDedupCandidatesRawResponse,
  params: EventDedupCandidatesQuery,
): EventDedupCandidatesResponse {
  if (Array.isArray(raw)) {
    return {
      page: params.page ?? 1,
      limit: params.limit ?? raw.length,
      total: raw.length,
      status: params.status ?? 'pending',
      confidenceBand: params.confidenceBand ?? 'all',
      items: raw,
    };
  }

  const shaped = raw as {
    data?: EventDedupCandidate[];
    candidates?: EventDedupCandidate[];
    items?: EventDedupCandidate[];
    page?: number;
    limit?: number;
    total?: number;
    status?: EventDedupCandidateStatus | 'all';
    confidenceBand?: EventDedupConfidenceBand | 'all';
    summary?: EventDedupCandidatesResponse['summary'];
  };
  const items = shaped.items ?? shaped.candidates ?? shaped.data ?? [];
  return {
    page: Number(shaped.page ?? params.page ?? 1),
    limit: Number(shaped.limit ?? params.limit ?? items.length),
    total: Number(shaped.total ?? items.length),
    status: shaped.status ?? params.status ?? 'pending',
    confidenceBand: shaped.confidenceBand ?? params.confidenceBand ?? 'all',
    items,
    summary: shaped.summary,
  };
}

export const fetchEventDedupCandidates = async (
  params: EventDedupCandidatesQuery = {},
): Promise<EventDedupCandidatesResponse> => {
  const { data } = await api
    .get<EventDedupCandidatesRawResponse>('/admin/events/dedup/candidates', {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 50,
        status: params.status ?? 'pending',
        confidenceBand: params.confidenceBand ?? 'all',
      },
    });
  return normalizeEventDedupCandidatesResponse(data, params);
};

export const scanEventDedupCandidates = (body: EventDedupScanRequest = {}) =>
  api.post<EventDedupScanResponse>('/admin/events/dedup/scan', body).then((r) => r.data);

export const runEventDedupScan = scanEventDedupCandidates;

export const approveEventDedupCandidate = (id: string) =>
  api
    .post<EventDedupCandidate>(
      `/admin/events/dedup/candidates/${encodeURIComponent(id)}/approve`,
    )
    .then((r) => r.data);

export const rejectEventDedupCandidate = (id: string, reason?: string) =>
  api
    .post<EventDedupCandidate>(
      `/admin/events/dedup/candidates/${encodeURIComponent(id)}/reject`,
      { reason: reason?.trim() || undefined },
    )
    .then((r) => r.data);

// =================== Events timeline ===================

export interface EventsTimelineBucket {
  day: string; // YYYY-MM-DD
  inScope: number;
  outOfScope: number;
}

export interface EventsTimelineResponse {
  days: number;
  generatedAt: string;
  totalInScope: number;
  totalOutScope: number;
  avgPerDay: number;
  peakDay: { day: string; total: number };
  buckets: EventsTimelineBucket[];
}

export const fetchEventsTimeline = (days = 30) =>
  api
    .get<EventsTimelineResponse>('/admin/events/timeline', { params: { days } })
    .then((r) => r.data);

// =================== Admin Event Radar (contrato v0) ===================

export type EventRadarConfidence = 'low' | 'medium' | 'high';
export type AdminEventRadarContractMode = 'backend' | 'contract-fallback';
export type AdminEventRadarScope = 'in' | 'out' | 'all';
export type AdminEventRadarHeatmapMetric =
  | 'demand'
  | 'revenue'
  | 'events'
  | 'properties'
  | 'blind_spots'
  | 'coverage';

export interface AdminEventRadarFilters {
  from?: string;
  to?: string;
  source?: string;
  category?: string;
  scope?: AdminEventRadarScope;
  confidence?: EventRadarConfidence | 'all';
  search?: string;
}

export interface AdminEventRadarKpis {
  demandPotentialScore: number;
  revenuePotentialCents: number;
  highPotentialEvents: number;
  affectedProperties: number;
  recommendationsGenerated: number;
  highPotentialWithoutRecommendation: number;
  averageConfidencePercent: number;
  weightedCoveragePercent: number;
}

export interface AdminEventRadarEvent {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string | null;
  city: string;
  state: string;
  venueName: string | null;
  category: string | null;
  source: string | null;
  sourceId?: string | null;
  dedupHash?: string | null;
  demandScore: number | null;
  revenuePotentialCents: number | null;
  confidence: EventRadarConfidence;
  affectedPropertiesCount: number;
  recommendationsGenerated: number;
  demandRadiusKm: number | null;
  expectedAttendance: number | null;
  geocodeStatus: 'ok' | 'pending' | 'missing';
  enrichmentStatus: 'ok' | 'pending' | 'failed' | 'unknown';
  sourceStatus: 'fresh' | 'stale' | 'unknown';
  officialUrl: string | null;
  crawledUrl: string | null;
  imageUrl?: string | null;
  latitude: number | null;
  longitude: number | null;
  interpretation: string;
  riskFlags: string[];
  dataQualityFlags: string[];
  raw?: Record<string, unknown>;
}

export interface AdminEventRadarResponse {
  generatedAt: string;
  contractMode: AdminEventRadarContractMode;
  endpointGaps?: string[];
  filters: AdminEventRadarFilters;
  kpis: AdminEventRadarKpis;
  events: AdminEventRadarEvent[];
  categories: string[];
  sources: string[];
  cities: string[];
}

export interface AdminEventRadarHeatmapCell {
  cellId: string;
  h3Index?: string | null;
  geohash?: string | null;
  geohashPrecision?: number | null;
  bbox?: [number, number, number, number] | null;
  label: string;
  city: string;
  state: string;
  centerLat: number | null;
  centerLng: number | null;
  eventDemandScore: number;
  revenuePotentialCents: number;
  eventsCount: number;
  topEventIds: string[];
  affectedPropertiesCount: number;
  averageConfidence: number;
  dominantCategory: string | null;
  supplyCompressionScore: number;
  coverageScore: number;
  dataStatus?: string | null;
}

export interface AdminEventRadarHeatmapResponse {
  generatedAt: string;
  contractMode: AdminEventRadarContractMode;
  endpointGaps?: string[];
  metric: AdminEventRadarHeatmapMetric;
  cells: AdminEventRadarHeatmapCell[];
}

export type AdminEventRadarBlindSpotKind =
  | 'no_pricing'
  | 'missing_geocode'
  | 'missing_official_link'
  | 'stale_source'
  | 'duplicate_risk'
  | 'venue_gap'
  | 'low_coverage'
  | 'out_of_scope_high_potential';

export interface AdminEventRadarBlindSpot {
  id: string;
  kind: AdminEventRadarBlindSpotKind;
  severity: 'high' | 'medium' | 'low';
  title: string;
  eventId?: string | null;
  eventName?: string | null;
  city?: string | null;
  source?: string | null;
  demandScore?: number | null;
  revenuePotentialCents?: number | null;
  blockedBy: string;
  recommendedAction: string;
  href?: string | null;
}

export interface AdminEventRadarBlindSpotsResponse {
  generatedAt: string;
  contractMode: AdminEventRadarContractMode;
  endpointGaps?: string[];
  summary: { high: number; medium: number; low: number; total: number };
  items: AdminEventRadarBlindSpot[];
}

export interface AdminEventRadarPropertyImpact {
  propertyId: string;
  propertyName: string;
  hostUserId?: string | null;
  hostEmail?: string | null;
  distanceKm: number | null;
  travelTimeMinutes?: number | null;
  propertyCaptureScore: number | null;
  currentPriceCents: number | null;
  recommendedPriceCents: number | null;
  minAbsorbablePriceCents: number | null;
  maxAbsorbablePriceCents: number | null;
  recommendedMultiplier: number | null;
  maxPlausibleMultiplier: number | null;
  bookingProbability: number | null;
  expectedRevenueCents: number | null;
  expectedIncrementalRevenueCents: number | null;
  confidence: EventRadarConfidence;
  recommendedAction: 'watch' | 'simulate' | 'apply' | 'review';
  mainDrivers?: string[];
}

export interface AdminEventRadarDetail {
  generatedAt: string;
  contractMode: AdminEventRadarContractMode;
  endpointGaps?: string[];
  event: AdminEventRadarEvent;
  intelligence: {
    eventDemandScore: number | null;
    eventRevenuePotentialCents: number | null;
    demandRadiusKm: number | null;
    expectedAttendance: number | null;
    sourceReliabilityScore: number | null;
    confidence: EventRadarConfidence;
    interpretation: string;
    drivers: Array<{ key: string; label: string; weight: number; explanation: string }>;
    riskFlags: string[];
    dataQualityFlags: string[];
    generatedAt: string;
    modelVersion: string;
    metricVersion: string;
    jobRunId?: string | null;
  };
  operation: {
    geocodeStatus: AdminEventRadarEvent['geocodeStatus'];
    enrichmentStatus: AdminEventRadarEvent['enrichmentStatus'];
    sourceStatus: AdminEventRadarEvent['sourceStatus'];
    affectedPropertiesCount: number;
    recommendationsGenerated: number;
  };
  propertyImpact: AdminEventRadarPropertyImpact[];
  rawEvent: Record<string, unknown>;
}

const ADMIN_EVENT_RADAR_FALLBACK_GAPS = [
  'GET /admin/events/intelligence',
  'GET /admin/events/:eventId/intelligence',
  'GET /admin/events/:eventId/property-impact',
  'GET /admin/events/heatmap',
  'GET /admin/events/blind-spots',
  'POST /admin/events/:eventId/recompute-intelligence',
];

function isContractFallbackAllowed(error: unknown): boolean {
  if (!enableContractFallback) return false;
  const status = (error as any)?.response?.status;
  const message = (error as any)?.message;
  const code = (error as any)?.code;
  return status === 404 || status === 501 || message === 'Network Error' || code === 'ERR_NETWORK';
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function confidenceFromScore(score: number): EventRadarConfidence {
  if (score >= 80) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}

function confidenceToPercent(confidence: EventRadarConfidence): number {
  if (confidence === 'high') return 86;
  if (confidence === 'medium') return 64;
  return 38;
}

function inferFallbackDemandScore(event: EventListItem): number {
  const relevance = event.relevancia ?? 35;
  const attendance =
    event.expectedAttendance ??
    event.capacidadeEstimada ??
    event.venueCapacity ??
    0;
  const attendanceBoost = attendance > 0 ? Math.min(24, Math.log10(attendance + 1) * 8) : 0;
  const geoPenalty = event.pendingGeocode || !event.latitude || !event.longitude ? 12 : 0;
  const outOfScopePenalty = event.outOfScope ? 10 : 0;
  return clampPercent(relevance * 0.78 + attendanceBoost - geoPenalty - outOfScopePenalty);
}

function toFallbackRadarEvent(event: EventListItem): AdminEventRadarEvent {
  const demandScore = inferFallbackDemandScore(event);
  const confidence = confidenceFromScore(demandScore);
  const radius = event.raioImpactoKm ?? (demandScore >= 80 ? 8 : demandScore >= 60 ? 5 : 3);
  const affectedPropertiesCount = event.outOfScope
    ? 0
    : Math.max(0, Math.round((demandScore / 100) * radius * 1.35));
  const recommendationsGenerated =
    event.pendingGeocode || affectedPropertiesCount === 0
      ? 0
      : Math.max(0, Math.floor(affectedPropertiesCount * (demandScore >= 75 ? 0.7 : 0.35)));
  const expectedAttendance =
    event.expectedAttendance ?? event.capacidadeEstimada ?? event.venueCapacity ?? null;
  const revenuePotentialCents =
    demandScore > 0
      ? Math.round(demandScore * Math.max(1, affectedPropertiesCount) * 27500)
      : null;
  const hasCoords = Boolean(event.latitude && event.longitude);
  const enrichmentStatus =
    event.relevancia !== null
      ? 'ok'
      : event.enrichmentAttempts > 0
        ? 'failed'
        : 'pending';
  const sourceStatus =
    event.source && event.source.toLowerCase().includes('stale') ? 'stale' : event.source ? 'fresh' : 'unknown';
  const dataQualityFlags = [
    !hasCoords ? 'missing_coordinates' : '',
    !event.crawledUrl && !event.linkSiteOficial ? 'missing_source_url' : '',
    event.pendingGeocode ? 'pending_geocode' : '',
    event.outOfScope ? 'out_of_scope' : '',
  ].filter(Boolean);
  const riskFlags = [
    demandScore >= 75 && recommendationsGenerated === 0 ? 'high_demand_without_pricing' : '',
    enrichmentStatus === 'failed' ? 'enrichment_failed' : '',
  ].filter(Boolean);

  return {
    id: event.id,
    name: event.nome,
    startsAt: event.dataInicio,
    endsAt: event.dataFim ?? null,
    city: event.cidade,
    state: event.estado,
    venueName: event.venueName ?? null,
    category: event.categoria,
    source: event.source,
    sourceId: event.sourceId ?? null,
    dedupHash: event.dedupHash ?? null,
    demandScore,
    revenuePotentialCents,
    confidence,
    affectedPropertiesCount,
    recommendationsGenerated,
    demandRadiusKm: radius,
    expectedAttendance,
    geocodeStatus: hasCoords ? 'ok' : event.pendingGeocode ? 'pending' : 'missing',
    enrichmentStatus,
    sourceStatus,
    officialUrl: event.linkSiteOficial ?? null,
    crawledUrl: event.crawledUrl ?? null,
    imageUrl: event.imagemUrl ?? null,
    latitude: event.latitude,
    longitude: event.longitude,
    interpretation:
      'Fallback contratual: leitura estimada a partir de relevância, capacidade, coordenadas e escopo enquanto o endpoint de inteligência de eventos não está disponível.',
    riskFlags,
    dataQualityFlags,
    raw: event as unknown as Record<string, unknown>,
  };
}

function filterFallbackRadarEvents(
  events: AdminEventRadarEvent[],
  filters: AdminEventRadarFilters,
): AdminEventRadarEvent[] {
  const fromTime = filters.from ? new Date(filters.from).getTime() : null;
  const toTime = filters.to ? new Date(filters.to).getTime() : null;
  const search = filters.search?.trim().toLowerCase();
  return events.filter((event) => {
    const startsAt = new Date(event.startsAt).getTime();
    const outOfScope = event.dataQualityFlags.includes('out_of_scope');
    if (filters.scope === 'in' && outOfScope) return false;
    if (filters.scope === 'out' && !outOfScope) return false;
    if (fromTime !== null && Number.isFinite(startsAt) && startsAt < fromTime) return false;
    if (toTime !== null && Number.isFinite(startsAt) && startsAt > toTime) return false;
    if (filters.category && event.category !== filters.category) return false;
    if (filters.source && event.source !== filters.source) return false;
    if (filters.confidence && filters.confidence !== 'all' && event.confidence !== filters.confidence) return false;
    if (search) {
      const haystack = `${event.name} ${event.city} ${event.category ?? ''} ${event.source ?? ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function buildFallbackRadarResponse(
  analytics: AdminEventsAnalytics,
  listing: EventsListResponse,
  filters: AdminEventRadarFilters,
): AdminEventRadarResponse {
  const generatedAt = new Date().toISOString();
  const events = filterFallbackRadarEvents(
    listing.items.map(toFallbackRadarEvent),
    filters,
  ).sort((a, b) => (b.revenuePotentialCents ?? 0) - (a.revenuePotentialCents ?? 0));
  const kpis: AdminEventRadarKpis = {
    demandPotentialScore: events.reduce((sum, event) => sum + (event.demandScore ?? 0), 0),
    revenuePotentialCents: events.reduce((sum, event) => sum + (event.revenuePotentialCents ?? 0), 0),
    highPotentialEvents: events.filter((event) => (event.demandScore ?? 0) >= 75).length,
    affectedProperties: events.reduce((sum, event) => sum + event.affectedPropertiesCount, 0),
    recommendationsGenerated: events.reduce((sum, event) => sum + event.recommendationsGenerated, 0),
    highPotentialWithoutRecommendation: events.filter(
      (event) => (event.demandScore ?? 0) >= 75 && event.recommendationsGenerated === 0,
    ).length,
    averageConfidencePercent: events.length
      ? Math.round(events.reduce((sum, event) => sum + confidenceToPercent(event.confidence), 0) / events.length)
      : 0,
    weightedCoveragePercent: analytics.summary.coveragePercent,
  };
  return {
    generatedAt,
    contractMode: 'contract-fallback',
    endpointGaps: ADMIN_EVENT_RADAR_FALLBACK_GAPS,
    filters,
    kpis,
    events,
    categories: Array.from(new Set(events.map((event) => event.category).filter(Boolean))) as string[],
    sources: Array.from(new Set(events.map((event) => event.source).filter(Boolean))) as string[],
    cities: Array.from(new Set(events.map((event) => `${event.city}/${event.state}`))).sort(),
  };
}

function buildFallbackHeatmap(
  radar: AdminEventRadarResponse,
  metric: AdminEventRadarHeatmapMetric,
): AdminEventRadarHeatmapResponse {
  const grouped = new Map<string, AdminEventRadarHeatmapCell & { categories: string[] }>();
  for (const event of radar.events) {
    const key = `${event.city}-${event.state}`;
    const existing =
      grouped.get(key) ??
      {
        cellId: key,
        h3Index: null,
        geohash: encodeGeoHash(event.latitude, event.longitude, 5),
        geohashPrecision: 5,
        bbox: null,
        label: `${event.city}/${event.state}`,
        city: event.city,
        state: event.state,
        centerLat: event.latitude,
        centerLng: event.longitude,
        eventDemandScore: 0,
        revenuePotentialCents: 0,
        eventsCount: 0,
        topEventIds: [],
        affectedPropertiesCount: 0,
        averageConfidence: 0,
        dominantCategory: event.category,
        supplyCompressionScore: 0,
        coverageScore: 0,
        dataStatus: 'derived_from_events',
        categories: [],
      };
    existing.eventDemandScore += event.demandScore ?? 0;
    existing.revenuePotentialCents += event.revenuePotentialCents ?? 0;
    existing.eventsCount += 1;
    existing.topEventIds = [...existing.topEventIds, event.id].slice(0, 4);
    existing.affectedPropertiesCount += event.affectedPropertiesCount;
    existing.averageConfidence += confidenceToPercent(event.confidence);
    existing.supplyCompressionScore += Math.min(100, (event.demandScore ?? 0) + event.affectedPropertiesCount * 2);
    existing.coverageScore += event.geocodeStatus === 'ok' ? 100 : event.geocodeStatus === 'pending' ? 45 : 15;
    if (event.category) existing.categories.push(event.category);
    if (!existing.centerLat && event.latitude) existing.centerLat = event.latitude;
    if (!existing.centerLng && event.longitude) existing.centerLng = event.longitude;
    if (!existing.geohash) existing.geohash = encodeGeoHash(existing.centerLat, existing.centerLng, 5);
    grouped.set(key, existing);
  }

  const cells = Array.from(grouped.values()).map((cell) => {
    const categoryCounts = cell.categories.reduce<Record<string, number>>((acc, category) => {
      acc[category] = (acc[category] ?? 0) + 1;
      return acc;
    }, {});
    const dominantCategory =
      Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? cell.dominantCategory;
    return {
      ...cell,
      eventDemandScore: clampPercent(cell.eventDemandScore / Math.max(1, cell.eventsCount)),
      averageConfidence: Math.round(cell.averageConfidence / Math.max(1, cell.eventsCount)),
      supplyCompressionScore: clampPercent(cell.supplyCompressionScore / Math.max(1, cell.eventsCount)),
      coverageScore: clampPercent(cell.coverageScore / Math.max(1, cell.eventsCount)),
      dominantCategory,
      categories: undefined,
    };
  });

  const metricValue = (cell: AdminEventRadarHeatmapCell) => {
    if (metric === 'revenue') return cell.revenuePotentialCents;
    if (metric === 'events') return cell.eventsCount;
    if (metric === 'properties') return cell.affectedPropertiesCount;
    if (metric === 'coverage') return 100 - cell.coverageScore;
    if (metric === 'blind_spots') return 100 - cell.coverageScore + Math.max(0, 75 - cell.averageConfidence);
    return cell.eventDemandScore;
  };

  return {
    generatedAt: radar.generatedAt,
    contractMode: radar.contractMode,
    endpointGaps: radar.endpointGaps,
    metric,
    cells: cells.sort((a, b) => metricValue(b) - metricValue(a)).slice(0, 12),
  };
}

function buildFallbackBlindSpots(radar: AdminEventRadarResponse): AdminEventRadarBlindSpotsResponse {
  const items: AdminEventRadarBlindSpot[] = [];
  for (const event of radar.events) {
    if ((event.demandScore ?? 0) >= 75 && event.recommendationsGenerated === 0) {
      items.push({
        id: `no-pricing-${event.id}`,
        kind: 'no_pricing',
        severity: 'high',
        title: 'Evento de alta demanda sem pricing',
        eventId: event.id,
        eventName: event.name,
        city: event.city,
        source: event.source,
        demandScore: event.demandScore,
        revenuePotentialCents: event.revenuePotentialCents,
        blockedBy: event.geocodeStatus !== 'ok' ? 'Coordenada pendente ou ausente' : 'Snapshot de impacto em imóveis ausente',
        recommendedAction: event.geocodeStatus !== 'ok' ? 'Rodar geocoder e reprocessar inteligência' : 'Gerar event_property_impact e recomendações',
        href: `/admin/events?search=${encodeURIComponent(event.name)}`,
      });
    }
    if (event.geocodeStatus !== 'ok') {
      items.push({
        id: `geo-${event.id}`,
        kind: 'missing_geocode',
        severity: (event.demandScore ?? 0) >= 70 ? 'high' : 'medium',
        title: 'Evento sem coordenada confiável',
        eventId: event.id,
        eventName: event.name,
        city: event.city,
        source: event.source,
        demandScore: event.demandScore,
        revenuePotentialCents: event.revenuePotentialCents,
        blockedBy: 'latitude/longitude ausentes ou geocode pendente',
        recommendedAction: 'Abrir cobertura/geocoder e resolver local antes de gerar pricing',
        href: '/admin/coverage',
      });
    }
    if (!event.officialUrl && !event.crawledUrl) {
      items.push({
        id: `link-${event.id}`,
        kind: 'missing_official_link',
        severity: (event.demandScore ?? 0) >= 70 ? 'medium' : 'low',
        title: 'Evento sem link de validação',
        eventId: event.id,
        eventName: event.name,
        city: event.city,
        source: event.source,
        demandScore: event.demandScore,
        revenuePotentialCents: event.revenuePotentialCents,
        blockedBy: 'link oficial/crawled URL ausente',
        recommendedAction: 'Completar fonte antes de recomendação forte',
        href: `/admin/events?search=${encodeURIComponent(event.name)}`,
      });
    }
    if (event.sourceStatus === 'stale') {
      items.push({
        id: `source-${event.id}`,
        kind: 'stale_source',
        severity: 'medium',
        title: 'Fonte stale em evento relevante',
        eventId: event.id,
        eventName: event.name,
        city: event.city,
        source: event.source,
        demandScore: event.demandScore,
        revenuePotentialCents: event.revenuePotentialCents,
        blockedBy: 'source sem atualização recente',
        recommendedAction: 'Investigar coletor e atualizar snapshot',
        href: '/admin/collectors-health',
      });
    }
  }

  const limited = items
    .sort((a, b) => {
      const severity = { high: 3, medium: 2, low: 1 };
      return severity[b.severity] - severity[a.severity] || (b.revenuePotentialCents ?? 0) - (a.revenuePotentialCents ?? 0);
    })
    .slice(0, 40);
  const summary = limited.reduce(
    (acc, item) => {
      acc[item.severity] += 1;
      acc.total += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0, total: 0 },
  );
  return {
    generatedAt: radar.generatedAt,
    contractMode: radar.contractMode,
    endpointGaps: radar.endpointGaps,
    summary,
    items: limited,
  };
}

function buildFallbackDetail(event: AdminEventRadarEvent): AdminEventRadarDetail {
  return {
    generatedAt: new Date().toISOString(),
    contractMode: 'contract-fallback',
    endpointGaps: ADMIN_EVENT_RADAR_FALLBACK_GAPS,
    event,
    intelligence: {
      eventDemandScore: event.demandScore,
      eventRevenuePotentialCents: event.revenuePotentialCents,
      demandRadiusKm: event.demandRadiusKm,
      expectedAttendance: event.expectedAttendance,
      sourceReliabilityScore: event.sourceStatus === 'fresh' ? 70 : event.sourceStatus === 'stale' ? 35 : null,
      confidence: event.confidence,
      interpretation: event.interpretation,
      drivers: [
        {
          key: 'relevance',
          label: 'Relevância operacional',
          weight: event.demandScore ?? 0,
          explanation: 'Derivada do campo de relevância existente enquanto o snapshot de inteligência não existe.',
        },
        {
          key: 'coverage',
          label: 'Cobertura geografica',
          weight: event.geocodeStatus === 'ok' ? 100 : 35,
          explanation: event.geocodeStatus === 'ok' ? 'Evento possui coordenadas para impacto espacial.' : 'Coordenadas pendentes limitam recomendações.',
        },
        {
          key: 'property-impact',
          label: 'Impacto em imóveis',
          weight: event.affectedPropertiesCount,
          explanation: 'Contagem estimada no fallback; endpoint property-impact deve substituir este bloco.',
        },
      ],
      riskFlags: event.riskFlags,
      dataQualityFlags: event.dataQualityFlags,
      generatedAt: new Date().toISOString(),
      modelVersion: 'contract-fallback-v0',
      metricVersion: 'contract-fallback-v0',
      jobRunId: null,
    },
    operation: {
      geocodeStatus: event.geocodeStatus,
      enrichmentStatus: event.enrichmentStatus,
      sourceStatus: event.sourceStatus,
      affectedPropertiesCount: event.affectedPropertiesCount,
      recommendationsGenerated: event.recommendationsGenerated,
    },
    propertyImpact: [],
    rawEvent: event.raw ?? {},
  };
}

function contractDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

function buildContractFallbackListing(scope: AdminEventRadarScope = 'in'): EventsListResponse {
  const items: EventListItem[] = [
    {
      id: 'contract-sp-festival-ibirapuera',
      nome: 'Festival urbano de música e gastronomia',
      cidade: 'São Paulo',
      estado: 'SP',
      dataInicio: contractDate(8),
      dataFim: contractDate(9),
      categoria: 'música',
      relevancia: 88,
      capacidadeEstimada: 42000,
      raioImpactoKm: 8,
      venueType: 'park',
      venueCapacity: 50000,
      expectedAttendance: 42000,
      venueName: 'Parque Ibirapuera',
      linkSiteOficial: null,
      imagemUrl: null,
      sourceId: 'contract-fallback-001',
      dedupHash: 'contract-fallback-sp-001',
      source: 'contract-fallback',
      outOfScope: false,
      pendingGeocode: false,
      ativo: true,
      latitude: -23.5874,
      longitude: -46.6576,
      enrichmentAttempts: 1,
      enrichmentLastError: null,
      crawledUrl: null,
      lastSeenAt: null,
    },
    {
      id: 'contract-sp-tech-expo',
      nome: 'Congresso internacional de tecnologia',
      cidade: 'São Paulo',
      estado: 'SP',
      dataInicio: contractDate(18),
      dataFim: contractDate(20),
      categoria: 'negócios',
      relevancia: 82,
      capacidadeEstimada: 28000,
      raioImpactoKm: 7,
      venueType: 'expo_center',
      venueCapacity: 35000,
      expectedAttendance: 28000,
      venueName: 'Expo Center Norte',
      linkSiteOficial: null,
      imagemUrl: null,
      sourceId: 'contract-fallback-002',
      dedupHash: 'contract-fallback-sp-002',
      source: 'contract-fallback',
      outOfScope: false,
      pendingGeocode: true,
      ativo: true,
      latitude: null,
      longitude: null,
      enrichmentAttempts: 0,
      enrichmentLastError: null,
      crawledUrl: 'https://example.invalid/event-radar-contract',
      lastSeenAt: null,
    },
    {
      id: 'contract-rj-arena-show',
      nome: 'Show de grande porte na Barra',
      cidade: 'Rio de Janeiro',
      estado: 'RJ',
      dataInicio: contractDate(26),
      dataFim: contractDate(26),
      categoria: 'show',
      relevancia: 79,
      capacidadeEstimada: 18000,
      raioImpactoKm: 6,
      venueType: 'arena',
      venueCapacity: 22000,
      expectedAttendance: 18000,
      venueName: 'Arena da Barra',
      linkSiteOficial: null,
      imagemUrl: null,
      sourceId: 'contract-fallback-003',
      dedupHash: 'contract-fallback-rj-003',
      source: 'contract-fallback',
      outOfScope: false,
      pendingGeocode: false,
      ativo: true,
      latitude: -22.9759,
      longitude: -43.3903,
      enrichmentAttempts: 1,
      enrichmentLastError: null,
      crawledUrl: null,
      lastSeenAt: null,
    },
    {
      id: 'contract-bh-design-week',
      nome: 'Semana de design e economia criativa',
      cidade: 'Belo Horizonte',
      estado: 'MG',
      dataInicio: contractDate(34),
      dataFim: contractDate(37),
      categoria: 'cultura',
      relevancia: 68,
      capacidadeEstimada: 9000,
      raioImpactoKm: 5,
      venueType: 'convention_center',
      venueCapacity: 12000,
      expectedAttendance: 9000,
      venueName: 'Centro de Convenções',
      linkSiteOficial: null,
      imagemUrl: null,
      sourceId: 'contract-fallback-004',
      dedupHash: 'contract-fallback-bh-004',
      source: 'contract-fallback',
      outOfScope: true,
      pendingGeocode: false,
      ativo: true,
      latitude: -19.9245,
      longitude: -43.9352,
      enrichmentAttempts: 1,
      enrichmentLastError: null,
      crawledUrl: 'https://example.invalid/event-radar-contract',
      lastSeenAt: null,
    },
    {
      id: 'contract-campinas-universitario',
      nome: 'Encontro universitário regional',
      cidade: 'Campinas',
      estado: 'SP',
      dataInicio: contractDate(12),
      dataFim: contractDate(13),
      categoria: 'educação',
      relevancia: 57,
      capacidadeEstimada: 6000,
      raioImpactoKm: 4,
      venueType: 'campus',
      venueCapacity: 8000,
      expectedAttendance: 6000,
      venueName: 'Campus universitário',
      linkSiteOficial: null,
      imagemUrl: null,
      sourceId: 'contract-fallback-005',
      dedupHash: 'contract-fallback-cps-005',
      source: 'contract-fallback',
      outOfScope: false,
      pendingGeocode: false,
      ativo: true,
      latitude: -22.8174,
      longitude: -47.0696,
      enrichmentAttempts: 2,
      enrichmentLastError: null,
      crawledUrl: 'https://example.invalid/event-radar-contract',
      lastSeenAt: null,
    },
  ];
  return {
    page: 1,
    limit: items.length,
    total: items.length,
    scope,
    items,
  };
}

function buildContractFallbackAnalytics(listing: EventsListResponse): AdminEventsAnalytics {
  const total = listing.items.length;
  const inScope = listing.items.filter((event) => !event.outOfScope).length;
  const outOfScope = total - inScope;
  const coordsMissing = listing.items.filter((event) => !event.latitude || !event.longitude).length;
  const relevanceMissing = listing.items.filter((event) => event.relevancia === null).length;
  return {
    summary: {
      total,
      ativos: total,
      inScope,
      outOfScope,
      coveragePercent: total ? Math.round(((total - coordsMissing) / total) * 100) : 0,
      enrichmentPercent: total ? Math.round(((total - relevanceMissing) / total) * 100) : 0,
      coordsMissing,
      relevanceMissing,
    },
    upcoming: { next7d: 0, next30d: inScope, next90d: total, megaUpcoming: 2 },
    byCategory: [],
    byCity: [],
    byRelevance: [],
    topUpcoming: [],
    lastCrawlAt: null,
  };
}

export async function fetchAdminEventRadar(
  filters: AdminEventRadarFilters = {},
): Promise<AdminEventRadarResponse> {
  try {
    const { data } = await api.get<AdminEventRadarResponse>('/admin/events/intelligence', {
      params: filters,
    });
    return { ...data, contractMode: data.contractMode ?? 'backend' };
  } catch (error) {
    if (!isContractFallbackAllowed(error)) throw error;
    let analytics: AdminEventsAnalytics;
    let listing: EventsListResponse;
    try {
      [analytics, listing] = await Promise.all([
        fetchAdminEvents(),
        fetchAdminEventsList({
          page: 1,
          limit: 100,
          scope: filters.scope ?? 'in',
          source: filters.source,
          search: filters.search,
          upcoming: true,
        }),
      ]);
    } catch (legacyError) {
      if (!isContractFallbackAllowed(legacyError)) throw legacyError;
      listing = buildContractFallbackListing(filters.scope ?? 'in');
      analytics = buildContractFallbackAnalytics(listing);
    }
    return buildFallbackRadarResponse(analytics, listing, filters);
  }
}

export async function fetchAdminEventRadarHeatmap(params: {
  from?: string;
  to?: string;
  metric?: AdminEventRadarHeatmapMetric;
  source?: string;
  category?: string;
  scope?: AdminEventRadarScope;
  confidence?: EventRadarConfidence | 'all';
  search?: string;
} = {}): Promise<AdminEventRadarHeatmapResponse> {
  const metric = params.metric ?? 'demand';
  try {
    const { data } = await api.get<AdminEventRadarHeatmapResponse>('/admin/events/heatmap', {
      params: { ...params, metric },
    });
    return { ...data, metric, contractMode: data.contractMode ?? 'backend' };
  } catch (error) {
    if (!isContractFallbackAllowed(error)) throw error;
    const radar = await fetchAdminEventRadar(params);
    return buildFallbackHeatmap(radar, metric);
  }
}

export async function fetchAdminEventRadarBlindSpots(
  filters: AdminEventRadarFilters = {},
): Promise<AdminEventRadarBlindSpotsResponse> {
  try {
    const { data } = await api.get<AdminEventRadarBlindSpotsResponse>('/admin/events/blind-spots', {
      params: filters,
    });
    return { ...data, contractMode: data.contractMode ?? 'backend' };
  } catch (error) {
    if (!isContractFallbackAllowed(error)) throw error;
    const radar = await fetchAdminEventRadar(filters);
    return buildFallbackBlindSpots(radar);
  }
}

export async function fetchAdminEventRadarDetail(
  eventId: string,
  seed?: AdminEventRadarEvent,
): Promise<AdminEventRadarDetail> {
  try {
    const [{ data: detail }, impactResult] = await Promise.all([
      api.get<AdminEventRadarDetail>(`/admin/events/${eventId}/intelligence`),
      api
        .get<AdminEventRadarPropertyImpact[]>(`/admin/events/${eventId}/property-impact`)
        .then((r) => r.data)
        .catch((error) => {
          if (isContractFallbackAllowed(error)) return null;
          throw error;
        }),
    ]);
    return {
      ...detail,
      contractMode: detail.contractMode ?? 'backend',
      propertyImpact: impactResult ?? detail.propertyImpact ?? [],
    };
  } catch (error) {
    if (!isContractFallbackAllowed(error)) throw error;
    if (seed) return buildFallbackDetail(seed);
    const listing = await fetchAdminEventsList({ page: 1, limit: 100, scope: 'all', upcoming: true });
    const event = listing.items.find((item) => item.id === eventId);
    if (!event) throw error;
    return buildFallbackDetail(toFallbackRadarEvent(event));
  }
}

export const recomputeAdminEventIntelligence = (eventId: string) =>
  api
    .post<{ ok: boolean; jobRunId?: string | null }>(
      `/admin/events/${eventId}/recompute-intelligence`,
    )
    .then((r) => r.data);
