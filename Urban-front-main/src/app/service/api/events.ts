import { api, enableContractFallback } from "./client";
import {
  mockFetchHostEventCatalog,
  mockFetchHostEventDetail,
  mockFetchHostEventHeatmap,
  mockFetchHostEventRadar,
  mockSimulateHostEventPricing,
} from "../hostEventRadarMocks";


export const getEventos = async (
  page = 1,
  limit = 10,
  propriedadeId: string
) => {
  try {
    const response = await api.get('/event', {
      params: { page, limit, propriedadeId },
    });

    return response.data;
  } catch (error) {
    console.error('Erro na requisição de eventos:', error);
    return [];
  }
};

export const getAllEventos = async (page = 1, limit = 10) => {
  try {
    const response = await api.get('/event/all', {
      params: { page, limit },
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar todos os eventos:', error);
    throw error;
  }
};

export const getEventosPorPropriedade = async (
  propriedadeId: string,
  dataInicial: string,
  page = 1,
  limit = 4000
) => {
  try {
    const { data } = await api.get('/propriedades/eventos-analisados-com-price', {
      params: { propriedadeId, page, limit, dataInicial},
    });
    return data;
  } catch (error) {
    console.error('Erro ao buscar eventos por propriedade:', error);
    throw error;
  }
};


export const getEventosAcompanhando = async (
  propriedadeId: string | undefined,
  page = 1,
  limit = 10
) => {
  try {
    const { data } = await api.get('/propriedades/eventos-acompanhando', {
      params: { propriedadeId, page, limit },
    });
    return data;
  } catch (error) {
    console.error('Erro ao buscar eventos por propriedade:', error);
    throw error;
  }
};




export const getEventosForMaps = async (
  propriedadeId: string,
  page = 1,
  limit = 4000,
  raio = 10,
  dataInicial:string,
  dataFinal:string
) => {
  try {
    const { data } = await api.get('/propriedades/eventos-analisados-com-price-para-maps', {
      params: { propriedadeId, page, limit, raio, dataFinal, dataInicial },
    });
    return data;
  } catch (error) {
    console.error('Erro ao buscar eventos por propriedade:', error);
    throw error;
  }
};

// =================== Host event radar (P0 - Maya Host) ===================

export type HostEventConfidence = 'low' | 'medium' | 'high';

export type EventCatalogItem = {
  id: string;
  name: string;
  description?: string | null;
  startsAt: string;
  endsAt: string | null;
  city: string;
  state: string;
  venueName?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category?: string | null;
  imageUrl?: string | null;
  officialUrl?: string | null;
  source?: string | null;
  crawledUrl?: string | null;
  urbanScore: number | null;
  demandScore?: number | null;
  confidence?: HostEventConfidence;
  badges: string[];
};

export type EventDemandDriver = {
  key: string;
  label: string;
  weight: number;
  explanation: string;
};

export type PriceAbsorptionScenario = {
  id: string;
  label: string;
  dailyPriceCents: number | null;
  multiplier: number | null;
  bookingProbability: number | null;
  expectedRevenueCents: number | null;
  risk: 'low' | 'medium' | 'high';
  reading: string;
  recommended?: boolean;
};

export type EventPropertyImpact = {
  propertyId: string;
  propertyName: string;
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
  confidence: HostEventConfidence;
  mainDrivers?: string[];
  affectedNights?: string[];
  recommendedAction: 'watch' | 'simulate' | 'apply' | 'review';
  absorptionScenarios?: PriceAbsorptionScenario[];
};

export type EventIntelligenceDetail = {
  event: EventCatalogItem;
  intelligence: {
    eventDemandScore: number | null;
    eventRevenuePotentialCents: number | null;
    demandRadiusKm: number | null;
    expectedAttendance: number | null;
    sourceReliabilityScore: number | null;
    confidence: HostEventConfidence;
    interpretation: string;
    drivers: EventDemandDriver[];
    riskFlags: string[];
    dataQualityFlags: string[];
    dataStatus?: string | null;
    generatedAt: string;
    modelVersion: string;
    metricVersion: string;
    jobRunId?: string | null;
  };
};

export type DemandHeatmapCell = {
  cellId: string;
  h3Index?: string | null;
  geohash?: string | null;
  geohashPrecision?: number | null;
  bbox?: [number, number, number, number] | null;
  centerLat: number;
  centerLng: number;
  radiusKm?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  eventDemandScore: number | null;
  revenuePotentialCents: number | null;
  eventsCount: number;
  topEventIds: string[];
  affectedPropertiesCount: number;
  averageConfidence: HostEventConfidence;
  dominantCategory?: string | null;
  supplyCompressionScore?: number | null;
  dataStatus?: string | null;
};

export type HostEventRadarItem = EventCatalogItem & {
  intelligence?: EventIntelligenceDetail['intelligence'] | null;
  impactedProperties: EventPropertyImpact[];
  bestPropertyImpact?: EventPropertyImpact | null;
  eventRevenuePotentialCents?: number | null;
  demandRadiusKm?: number | null;
  heatLevel?: number | null;
  interpretation?: string | null;
  dataStatus?: string | null;
};

export type HostEventCatalogFilters = {
  city?: string;
  from?: string;
  to?: string;
  category?: string;
  venue?: string;
  search?: string;
  source?: string;
  confidence?: HostEventConfidence | 'all';
  nearMyProperties?: boolean;
  radiusKm?: string | number;
  highImpact?: boolean;
};

export type HostEventRadarFilters = {
  from?: string;
  to?: string;
  propertyId?: string;
  category?: string;
  radiusKm?: string | number;
  confidence?: HostEventConfidence | 'all';
  eventId?: string;
};

export type HostEventCatalogResponse = {
  generatedAt: string;
  items: EventCatalogItem[];
  total: number;
  cities: string[];
  categories: string[];
  sources: string[];
  mock?: boolean;
};

export type HostEventRadarResponse = {
  generatedAt: string;
  summary: {
    revenuePotentialCents: number;
    relevantEvents: number;
    opportunityNights: number;
    impactedProperties: number;
    averageDemandScore: number | null;
  };
  events: HostEventRadarItem[];
  heatmap: DemandHeatmapCell[];
  mock?: boolean;
};

export type HostEventDetailResponse = EventIntelligenceDetail & {
  propertyImpacts: EventPropertyImpact[];
  relatedEvents?: EventCatalogItem[];
  mock?: boolean;
};

export type HostEventPricingSimulationInput = {
  propertyId?: string;
  scenarioId?: string;
  dailyPriceCents?: number;
};

export type HostEventPricingSimulationResponse = {
  eventId: string;
  propertyImpact: EventPropertyImpact | null;
  mock?: boolean;
};

function isSafeHostEventMockFallback(error: unknown): boolean {
  if (!enableContractFallback) return false;
  const status = (error as any)?.response?.status;
  if (status === 401 || status === 403) return false;
  return !status || status === 404 || status === 501 || status === 503;
}

function warnHostEventMock(endpoint: string, error: unknown) {
  console.warn(`[host-event-radar] usando mock temporário habilitado por NEXT_PUBLIC_ENABLE_CONTRACT_FALLBACK para ${endpoint}`, error);
}

function normalizeNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCents(value: unknown): number | null {
  const parsed = normalizeNumber(value);
  if (parsed === null) return null;
  return parsed > 0 && parsed < 10000 ? Math.round(parsed * 100) : Math.round(parsed);
}

function normalizeConfidence(value: unknown): HostEventConfidence {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return 'medium';
}

function confidencePercent(value: HostEventConfidence | undefined): number {
  if (value === 'high') return 86;
  if (value === 'low') return 38;
  return 64;
}

function confidenceFromPercent(value: number): HostEventConfidence {
  if (value >= 75) return 'high';
  if (value >= 50) return 'medium';
  return 'low';
}

function normalizeCellConfidence(value: unknown, score?: number | null): HostEventConfidence {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  const numeric = normalizeNumber(value);
  if (numeric !== null) return confidenceFromPercent(numeric);
  if (typeof score === 'number') return confidenceFromPercent(score);
  return 'medium';
}

function normalizeBbox(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const parsed = value.map((item) => normalizeNumber(item));
  if (parsed.some((item) => item === null)) return null;
  return parsed as [number, number, number, number];
}

const GEOHASH_BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeGeoHash(latitude?: number | null, longitude?: number | null, precision = 5): string | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  let latRange: [number, number] = [-90, 90];
  let lngRange: [number, number] = [-180, 180];
  let hash = '';
  let bit = 0;
  let ch = 0;
  let evenBit = true;

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngRange[0] + lngRange[1]) / 2;
      if ((longitude as number) >= mid) {
        ch = (ch << 1) + 1;
        lngRange = [mid, lngRange[1]];
      } else {
        ch <<= 1;
        lngRange = [lngRange[0], mid];
      }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if ((latitude as number) >= mid) {
        ch = (ch << 1) + 1;
        latRange = [mid, latRange[1]];
      } else {
        ch <<= 1;
        latRange = [latRange[0], mid];
      }
    }

    evenBit = !evenBit;
    if (bit < 4) {
      bit += 1;
    } else {
      hash += GEOHASH_BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

function normalizeCatalogItem(raw: any): EventCatalogItem {
  return {
    id: String(raw?.id ?? raw?._id ?? raw?.eventId ?? ''),
    name: String(raw?.name ?? raw?.nome ?? raw?.title ?? 'Evento sem nome'),
    description: raw?.description ?? raw?.descricao ?? null,
    startsAt: String(raw?.startsAt ?? raw?.dataInicio ?? raw?.startDate ?? new Date().toISOString()),
    endsAt: raw?.endsAt ?? raw?.dataFim ?? raw?.endDate ?? null,
    city: String(raw?.city ?? raw?.cidade ?? 'São Paulo'),
    state: String(raw?.state ?? raw?.estado ?? 'SP'),
    venueName: raw?.venueName ?? raw?.venue ?? raw?.local ?? null,
    address: raw?.address ?? raw?.enderecoCompleto ?? raw?.endereco ?? null,
    latitude: normalizeNumber(raw?.latitude),
    longitude: normalizeNumber(raw?.longitude),
    category: raw?.category ?? raw?.categoria ?? null,
    imageUrl: raw?.imageUrl ?? raw?.imagem_url ?? raw?.image_url ?? null,
    officialUrl: raw?.officialUrl ?? raw?.linkSiteOficial ?? raw?.official_url ?? null,
    source: raw?.source ?? raw?.fonte ?? null,
    crawledUrl: raw?.crawledUrl ?? raw?.crawled_url ?? null,
    urbanScore: normalizeNumber(raw?.urbanScore ?? raw?.relevancia),
    demandScore: normalizeNumber(raw?.demandScore ?? raw?.eventDemandScore),
    confidence: raw?.confidence ? normalizeConfidence(raw?.confidence) : undefined,
    badges: Array.isArray(raw?.badges) ? raw.badges.map(String) : [],
  };
}

function normalizePropertyImpact(raw: any): EventPropertyImpact {
  return {
    propertyId: String(raw?.propertyId ?? raw?.imovelId ?? raw?.addressId ?? ''),
    propertyName: String(raw?.propertyName ?? raw?.imovel ?? raw?.name ?? 'Imóvel'),
    distanceKm: normalizeNumber(raw?.distanceKm ?? raw?.distanciaKm),
    travelTimeMinutes: normalizeNumber(raw?.travelTimeMinutes ?? raw?.tempoDeslocamentoMin) ?? undefined,
    propertyCaptureScore: normalizeNumber(raw?.propertyCaptureScore ?? raw?.captureScore),
    currentPriceCents: normalizeCents(raw?.currentPriceCents ?? raw?.currentPrice ?? raw?.diariaAtual),
    recommendedPriceCents: normalizeCents(raw?.recommendedPriceCents ?? raw?.recommendedPrice ?? raw?.precoRecomendado),
    minAbsorbablePriceCents: normalizeCents(raw?.minAbsorbablePriceCents ?? raw?.minAbsorbablePrice),
    maxAbsorbablePriceCents: normalizeCents(raw?.maxAbsorbablePriceCents ?? raw?.maxAbsorbablePrice),
    recommendedMultiplier: normalizeNumber(raw?.recommendedMultiplier ?? raw?.multiplicadorRecomendado),
    maxPlausibleMultiplier: normalizeNumber(raw?.maxPlausibleMultiplier ?? raw?.multiplicadorMaximo),
    bookingProbability: normalizeNumber(raw?.bookingProbability ?? raw?.chanceReserva),
    expectedRevenueCents: normalizeCents(raw?.expectedRevenueCents ?? raw?.expectedRevenue),
    expectedIncrementalRevenueCents: normalizeCents(raw?.expectedIncrementalRevenueCents ?? raw?.incrementalRevenue),
    confidence: normalizeConfidence(raw?.confidence),
    mainDrivers: Array.isArray(raw?.mainDrivers) ? raw.mainDrivers.map(String) : [],
    affectedNights: Array.isArray(raw?.affectedNights) ? raw.affectedNights.map(String) : [],
    recommendedAction: raw?.recommendedAction ?? 'simulate',
    absorptionScenarios: Array.isArray(raw?.absorptionScenarios)
      ? raw.absorptionScenarios.map((scenario: any) => ({
          id: String(scenario?.id ?? scenario?.label ?? 'scenario'),
          label: String(scenario?.label ?? 'Cenário'),
          dailyPriceCents: normalizeCents(scenario?.dailyPriceCents ?? scenario?.dailyPrice),
          multiplier: normalizeNumber(scenario?.multiplier),
          bookingProbability: normalizeNumber(scenario?.bookingProbability),
          expectedRevenueCents: normalizeCents(scenario?.expectedRevenueCents ?? scenario?.expectedRevenue),
          risk:
            scenario?.risk === 'low' || scenario?.risk === 'medium' || scenario?.risk === 'high'
              ? scenario.risk
              : 'medium',
          reading: String(scenario?.reading ?? scenario?.leitura ?? ''),
          recommended: Boolean(scenario?.recommended),
        }))
      : undefined,
  };
}

function normalizeRadarItem(raw: any, responseData?: any): HostEventRadarItem {
  const event = normalizeCatalogItem(raw?.event ?? raw);
  const impactsSource =
    raw?.impactedProperties ??
    raw?.propertyImpacts ??
    raw?.impacts ??
    responseData?.propertyImpacts?.[event.id] ??
    [];
  const impactedProperties = Array.isArray(impactsSource)
    ? impactsSource.map(normalizePropertyImpact)
    : [];
  const bestImpactSource = raw?.bestPropertyImpact ?? raw?.bestImpact ?? impactedProperties[0] ?? null;
  const intelligence = raw?.intelligence ?? null;

  return {
    ...event,
    intelligence,
    impactedProperties,
    bestPropertyImpact: bestImpactSource ? normalizePropertyImpact(bestImpactSource) : null,
    eventRevenuePotentialCents: normalizeCents(
      raw?.eventRevenuePotentialCents ??
        raw?.revenuePotential ??
        raw?.expectedIncrementalRevenueCents ??
        intelligence?.eventRevenuePotentialCents,
    ),
    demandRadiusKm: normalizeNumber(raw?.demandRadiusKm ?? intelligence?.demandRadiusKm),
    heatLevel: normalizeNumber(raw?.heatLevel ?? raw?.demandScore ?? raw?.eventDemandScore ?? intelligence?.eventDemandScore),
    interpretation: raw?.interpretation ?? intelligence?.interpretation ?? null,
  };
}

function normalizeHeatmapCell(raw: any): DemandHeatmapCell {
  const centerLat = normalizeNumber(raw?.centerLat ?? raw?.latitude);
  const centerLng = normalizeNumber(raw?.centerLng ?? raw?.longitude);
  const geohashPrecision = Number(raw?.geohashPrecision ?? raw?.geoHashPrecision ?? 5);
  const geohash =
    raw?.geohash ??
    raw?.geoHash ??
    encodeGeoHash(centerLat, centerLng, Number.isFinite(geohashPrecision) ? geohashPrecision : 5);
  const score = normalizeNumber(raw?.eventDemandScore ?? raw?.demandScore);

  return {
    cellId: String(raw?.cellId ?? raw?.id ?? raw?.h3Index ?? geohash ?? 'geo-cell'),
    h3Index: raw?.h3Index ?? raw?.h3 ?? null,
    geohash,
    geohashPrecision: Number.isFinite(geohashPrecision) ? geohashPrecision : 5,
    bbox: normalizeBbox(raw?.bbox),
    centerLat: centerLat ?? 0,
    centerLng: centerLng ?? 0,
    radiusKm: normalizeNumber(raw?.radiusKm),
    dateFrom: raw?.dateFrom ?? raw?.from ?? null,
    dateTo: raw?.dateTo ?? raw?.to ?? null,
    eventDemandScore: score,
    revenuePotentialCents: normalizeCents(raw?.revenuePotentialCents ?? raw?.revenuePotential),
    eventsCount: Number(raw?.eventsCount ?? raw?.count ?? 0),
    topEventIds: Array.isArray(raw?.topEventIds ?? raw?.eventIds)
      ? (raw?.topEventIds ?? raw?.eventIds).map(String)
      : [],
    affectedPropertiesCount: Number(raw?.affectedPropertiesCount ?? raw?.impactedPropertiesCount ?? 0),
    averageConfidence: normalizeCellConfidence(raw?.averageConfidence ?? raw?.averageConfidencePercent, score),
    dominantCategory: raw?.dominantCategory ?? raw?.category ?? null,
    supplyCompressionScore: normalizeNumber(raw?.supplyCompressionScore),
    dataStatus: raw?.dataStatus ?? null,
  };
}

function buildDerivedHostHeatmap(events: HostEventRadarItem[]): DemandHeatmapCell[] {
  const grouped = new Map<
    string,
    {
      geohash: string;
      latTotal: number;
      lngTotal: number;
      scoreTotal: number;
      confidenceTotal: number;
      revenuePotentialCents: number;
      eventIds: string[];
      properties: Set<string>;
      categories: Record<string, number>;
    }
  >();

  events.forEach((event) => {
    const geohash = encodeGeoHash(event.latitude, event.longitude, 5);
    if (!geohash) return;
    const current =
      grouped.get(geohash) ??
      {
        geohash,
        latTotal: 0,
        lngTotal: 0,
        scoreTotal: 0,
        confidenceTotal: 0,
        revenuePotentialCents: 0,
        eventIds: [],
        properties: new Set<string>(),
        categories: {},
      };

    current.latTotal += event.latitude as number;
    current.lngTotal += event.longitude as number;
    current.scoreTotal += event.demandScore ?? event.urbanScore ?? event.heatLevel ?? 0;
    current.confidenceTotal += confidencePercent(event.confidence);
    current.revenuePotentialCents += event.eventRevenuePotentialCents ?? 0;
    current.eventIds.push(event.id);
    event.impactedProperties.forEach((impact) => current.properties.add(impact.propertyId));
    if (event.category) current.categories[event.category] = (current.categories[event.category] ?? 0) + 1;
    grouped.set(geohash, current);
  });

  return Array.from(grouped.values()).map((cell) => {
    const eventsCount = cell.eventIds.length;
    const dominantCategory =
      Object.entries(cell.categories).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return {
      cellId: `geohash-${cell.geohash}`,
      geohash: cell.geohash,
      geohashPrecision: 5,
      h3Index: null,
      bbox: null,
      centerLat: cell.latTotal / eventsCount,
      centerLng: cell.lngTotal / eventsCount,
      radiusKm: null,
      dateFrom: null,
      dateTo: null,
      eventDemandScore: Math.round(cell.scoreTotal / eventsCount),
      revenuePotentialCents: cell.revenuePotentialCents,
      eventsCount,
      topEventIds: cell.eventIds.slice(0, 4),
      affectedPropertiesCount: cell.properties.size,
      averageConfidence: confidenceFromPercent(Math.round(cell.confidenceTotal / eventsCount)),
      dominantCategory,
      supplyCompressionScore: null,
      dataStatus: 'derived_from_events',
    };
  });
}

function completeHostHeatmap(rawCells: DemandHeatmapCell[], events: HostEventRadarItem[]): DemandHeatmapCell[] {
  const coveredEvents = new Set(rawCells.flatMap((cell) => cell.topEventIds));
  const derivedCells = buildDerivedHostHeatmap(events.filter((event) => !coveredEvents.has(event.id)));
  return [...rawCells, ...derivedCells].sort(
    (a, b) =>
      (b.eventDemandScore ?? 0) - (a.eventDemandScore ?? 0) ||
      (b.revenuePotentialCents ?? 0) - (a.revenuePotentialCents ?? 0),
  );
}

function normalizeCatalogResponse(data: any): HostEventCatalogResponse {
  const rawItems = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
  const items: EventCatalogItem[] = rawItems.map(normalizeCatalogItem);
  return {
    generatedAt: String(data?.generatedAt ?? new Date().toISOString()),
    items,
    total: Number(data?.total ?? items.length),
    cities: Array.isArray(data?.cities) ? data.cities.map(String) : Array.from(new Set(items.map((item) => item.city))),
    categories: Array.isArray(data?.categories)
      ? data.categories.map(String)
      : Array.from(new Set(items.map((item) => item.category).filter(Boolean))) as string[],
    sources: Array.isArray(data?.sources)
      ? data.sources.map(String)
      : Array.from(new Set(items.map((item) => item.source).filter(Boolean))) as string[],
  };
}

function normalizeRadarResponse(data: any): HostEventRadarResponse {
  const rawEvents = Array.isArray(data) ? data : data?.events ?? data?.items ?? data?.data ?? [];
  const events: HostEventRadarItem[] = rawEvents.map((raw: any) => normalizeRadarItem(raw, data));
  const rawHeatmap = Array.isArray(data?.heatmap)
    ? data.heatmap
    : Array.isArray(data?.cells)
      ? data.cells
      : [];
  const heatmap = completeHostHeatmap(rawHeatmap.map(normalizeHeatmapCell), events);
  const calculatedRevenue = events.reduce(
    (sum: number, event: HostEventRadarItem) => sum + (event.eventRevenuePotentialCents ?? 0),
    0,
  );
  const calculatedProperties = new Set(
    events.flatMap((event: HostEventRadarItem) =>
      event.impactedProperties.map((impact: EventPropertyImpact) => impact.propertyId),
    ),
  ).size;

  return {
    generatedAt: String(data?.generatedAt ?? new Date().toISOString()),
    summary: {
      revenuePotentialCents: Number(
        data?.summary?.revenuePotentialCents ??
          data?.summary?.estimatedRevenuePotentialCents ??
          data?.summary?.expectedIncrementalRevenueCents ??
          calculatedRevenue,
      ),
      relevantEvents: Number(data?.summary?.relevantEvents ?? data?.summary?.relevantEventsCount ?? events.length),
      opportunityNights: Number(data?.summary?.opportunityNights ?? data?.summary?.opportunityNightsCount ?? 0),
      impactedProperties: Number(
        data?.summary?.impactedProperties ??
          data?.summary?.affectedPropertiesCount ??
          data?.summary?.impactedPropertiesCount ??
          calculatedProperties,
      ),
      averageDemandScore: normalizeNumber(data?.summary?.averageDemandScore ?? data?.summary?.averageDemand),
    },
    events,
    heatmap,
  };
}

function normalizeDetailResponse(data: any, eventId: string): HostEventDetailResponse {
  const event = normalizeCatalogItem(data?.event ?? data);
  const detail: HostEventDetailResponse = {
    event: event.id ? event : { ...event, id: eventId },
    intelligence: data?.intelligence ?? {
      eventDemandScore: normalizeNumber(data?.eventDemandScore),
      eventRevenuePotentialCents: normalizeCents(data?.eventRevenuePotentialCents),
      demandRadiusKm: normalizeNumber(data?.demandRadiusKm),
      expectedAttendance: normalizeNumber(data?.expectedAttendance),
      sourceReliabilityScore: normalizeNumber(data?.sourceReliabilityScore),
      confidence: normalizeConfidence(data?.confidence),
      interpretation: String(data?.interpretation ?? ''),
      drivers: Array.isArray(data?.drivers) ? data.drivers : [],
      riskFlags: Array.isArray(data?.riskFlags) ? data.riskFlags.map(String) : [],
      generatedAt: String(data?.generatedAt ?? new Date().toISOString()),
      modelVersion: String(data?.modelVersion ?? 'unknown'),
      metricVersion: String(data?.metricVersion ?? 'unknown'),
      jobRunId: data?.jobRunId ?? null,
    },
    propertyImpacts: Array.isArray(data?.propertyImpacts)
      ? data.propertyImpacts.map(normalizePropertyImpact)
      : [],
    relatedEvents: Array.isArray(data?.relatedEvents)
      ? data.relatedEvents.map(normalizeCatalogItem)
      : [],
  };
  return detail;
}

export async function fetchHostEventCatalog(
  filters: HostEventCatalogFilters = {},
): Promise<HostEventCatalogResponse> {
  const endpoint = '/host/events/catalog';
  try {
    const { data } = await api.get(endpoint, { params: filters });
    return normalizeCatalogResponse(data);
  } catch (error) {
    if (!isSafeHostEventMockFallback(error)) throw error;
    warnHostEventMock(endpoint, error);
    return mockFetchHostEventCatalog(filters);
  }
}

export async function fetchHostEventRadar(
  filters: HostEventRadarFilters = {},
): Promise<HostEventRadarResponse> {
  const endpoint = '/host/events/radar';
  try {
    const { data } = await api.get(endpoint, { params: filters });
    const response = normalizeRadarResponse(data);
    return filters.eventId
      ? {
          ...response,
          events: response.events.filter((event) => event.id === filters.eventId),
          heatmap: response.heatmap.filter((cell) => cell.topEventIds.includes(filters.eventId as string)),
        }
      : response;
  } catch (error) {
    if (!isSafeHostEventMockFallback(error)) throw error;
    warnHostEventMock(endpoint, error);
    const response = mockFetchHostEventRadar(filters);
    return filters.eventId
      ? {
          ...response,
          events: response.events.filter((event) => event.id === filters.eventId),
          heatmap: response.heatmap.filter((cell) => cell.topEventIds.includes(filters.eventId as string)),
        }
      : response;
  }
}

export async function fetchHostEventDetail(eventId: string): Promise<HostEventDetailResponse> {
  const endpoint = `/host/events/${encodeURIComponent(eventId)}`;
  try {
    const { data } = await api.get(endpoint);
    return normalizeDetailResponse(data, eventId);
  } catch (error) {
    if (!isSafeHostEventMockFallback(error)) throw error;
    warnHostEventMock(endpoint, error);
    return mockFetchHostEventDetail(eventId);
  }
}

export async function fetchHostEventIntelligence(
  eventId: string,
): Promise<EventIntelligenceDetail> {
  const endpoint = `/host/events/${encodeURIComponent(eventId)}/intelligence`;
  try {
    const { data } = await api.get(endpoint);
    return {
      event: normalizeCatalogItem(data?.event ?? data),
      intelligence: data?.intelligence ?? data,
    };
  } catch (error) {
    if (!isSafeHostEventMockFallback(error)) throw error;
    warnHostEventMock(endpoint, error);
    const detail = mockFetchHostEventDetail(eventId);
    return { event: detail.event, intelligence: detail.intelligence };
  }
}

export async function fetchHostEventPropertyImpact(
  eventId: string,
): Promise<EventPropertyImpact[]> {
  const endpoint = `/host/events/${encodeURIComponent(eventId)}/property-impact`;
  try {
    const { data } = await api.get(endpoint);
    const rawItems = Array.isArray(data) ? data : data?.items ?? data?.propertyImpacts ?? [];
    return rawItems.map(normalizePropertyImpact);
  } catch (error) {
    if (!isSafeHostEventMockFallback(error)) throw error;
    warnHostEventMock(endpoint, error);
    return mockFetchHostEventDetail(eventId).propertyImpacts;
  }
}

export async function fetchHostEventHeatmap(
  filters: HostEventRadarFilters = {},
): Promise<DemandHeatmapCell[]> {
  const endpoint = '/host/events/heatmap';
  try {
    const { data } = await api.get(endpoint, { params: filters });
    const rawItems = Array.isArray(data) ? data : data?.items ?? data?.heatmap ?? [];
    return rawItems.map(normalizeHeatmapCell);
  } catch (error) {
    if (!isSafeHostEventMockFallback(error)) throw error;
    warnHostEventMock(endpoint, error);
    return mockFetchHostEventHeatmap();
  }
}

export async function simulateHostEventPricing(
  eventId: string,
  input: HostEventPricingSimulationInput = {},
): Promise<HostEventPricingSimulationResponse> {
  const endpoint = `/host/events/${encodeURIComponent(eventId)}/simulate-pricing`;
  try {
    const { data } = await api.post(endpoint, input);
    return {
      eventId,
      propertyImpact: data?.propertyImpact ? normalizePropertyImpact(data.propertyImpact) : null,
    };
  } catch (error) {
    if (!isSafeHostEventMockFallback(error)) throw error;
    warnHostEventMock(endpoint, error);
    return {
      eventId,
      propertyImpact: mockSimulateHostEventPricing(eventId, input.propertyId),
      mock: true,
    };
  }
}
