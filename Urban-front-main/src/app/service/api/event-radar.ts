import { api, enableContractFallback } from "./client";
import { encodeGeoHash } from "./events";

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

export const fetchAdminEvents = () =>
  api.get<AdminEventsAnalytics>('/admin/events/analytics').then((r) => r.data);

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
  dataStatus?: string | null;
  modelVersion?: string | null;
  metricVersion?: string | null;
  jobRunId?: string | null;
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
    dataStatus?: string | null;
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
