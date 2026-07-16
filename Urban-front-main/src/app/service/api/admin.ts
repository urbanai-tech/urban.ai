import { api } from "./client";

export * from "./event-radar";


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
