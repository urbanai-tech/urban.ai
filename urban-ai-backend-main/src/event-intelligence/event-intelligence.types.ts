import { EventIntelligenceConfidence, EventIntelligenceDriver } from '../entities/event-intelligence-snapshot.entity';
import { EventPropertyRecommendedAction, PriceAbsorptionScenario } from '../entities/event-property-impact.entity';

export type EventIntelligenceDataStatus =
  | 'persisted'
  | 'derived_from_event_fields'
  | 'derived_from_analise_preco'
  | 'stub_pending_engine';

export type EventCatalogItem = {
  id: string;
  name: string;
  description?: string | null;
  startsAt: string;
  endsAt: string | null;
  city: string | null;
  state: string | null;
  venueName?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category?: string | null;
  imageUrl?: string | null;
  officialUrl?: string | null;
  crawledUrl?: string | null;
  source?: string | null;
  urbanScore: number | null;
  demandScore?: number | null;
  confidence?: EventIntelligenceConfidence;
  badges: string[];
};

export type EventIntelligencePayload = {
  eventDemandScore: number | null;
  eventRevenuePotentialCents: number | null;
  demandRadiusKm: number | null;
  expectedAttendance: number | null;
  sourceReliabilityScore: number | null;
  sourceFreshnessHours: number | null;
  confidence: EventIntelligenceConfidence;
  interpretation: string;
  drivers: EventIntelligenceDriver[];
  hotRegions: unknown[];
  riskFlags: string[];
  dataQualityFlags: string[];
  generatedAt: string;
  modelVersion: string;
  metricVersion: string;
  jobRunId?: string | null;
  dataStatus: EventIntelligenceDataStatus;
};

export type EventPropertyImpactPayload = {
  propertyId: string;
  propertyName: string;
  listId?: string | null;
  distanceKm: number | null;
  travelTimeMinutes?: number | null;
  propertyCaptureScore: number | null;
  basePriceCents: number | null;
  currentPriceCents: number | null;
  recommendedPriceCents: number | null;
  minAbsorbablePriceCents: number | null;
  maxAbsorbablePriceCents: number | null;
  recommendedMultiplier: number | null;
  maxPlausibleMultiplier: number | null;
  bookingProbability: number | null;
  expectedRevenueCents: number | null;
  expectedIncrementalRevenueCents: number | null;
  confidence: EventIntelligenceConfidence;
  mainDrivers: Array<EventIntelligenceDriver | string>;
  priceAbsorptionScenarios: PriceAbsorptionScenario[];
  recommendedAction: EventPropertyRecommendedAction;
  riskFlags: string[];
  generatedAt: string;
  modelVersion: string;
  metricVersion: string;
  jobRunId?: string | null;
  dataStatus: EventIntelligenceDataStatus;
};

export type HeatmapCellPayload = {
  cellId: string;
  bbox: [number, number, number, number];
  centerLat: number;
  centerLng: number;
  dateFrom: string;
  dateTo: string;
  eventDemandScore: number | null;
  revenuePotentialCents: number | null;
  eventsCount: number;
  topEventIds: string[];
  affectedPropertiesCount: number;
  averageConfidence: EventIntelligenceConfidence;
  dominantCategory: string | null;
  supplyCompressionScore: number | null;
};

export type EventCatalogQuery = {
  city?: string;
  from?: string;
  to?: string;
  category?: string;
  venue?: string;
  search?: string;
  nearMyProperties?: string | boolean;
  confidence?: string;
  propertyId?: string;
  source?: string;
  radiusKm?: string | number;
  highImpact?: string | boolean;
  scope?: 'in' | 'out' | 'all';
  metric?: string;
  limit?: string | number;
};

export type SimulatePricingInput = {
  propertyId?: string;
  targetDate?: string;
  strategy?: 'conservative' | 'recommended' | 'aggressive' | 'extreme' | string;
};
