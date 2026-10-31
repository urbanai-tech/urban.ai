import { api } from "./client";

// ================== Cobertura de eventos (D6) ==================
// GET /admin/event-coverage — contrato em urban-ai-backend-main/src/evento/event-coverage-report.service.ts

export type EventCoverageStatus = "ok" | "at_risk" | "insufficient";
export type EventCoverageSourceHealth = "healthy" | "stale" | "zero_yield" | "never_delivered" | "unmonitored";

export type EventCoverageReasonCode =
  | "below_target"
  | "unhealthy_sources"
  | "low_geocoding"
  | "low_category"
  | "dedup_pending"
  | "source_stale"
  | "source_zero_yield"
  | "source_never_delivered"
  | "no_sources";

export interface EventCoverageReason {
  code: EventCoverageReasonCode;
  severity: "critical" | "warning" | "info";
  message: string;
  source?: string;
}

export interface EventCoverageSource {
  source: string;
  events30d: number;
  lastIngestAt: string | null;
  hoursSinceLastIngest: number | null;
  windowHours: number;
  health: EventCoverageSourceHealth;
  /** Só em `never_delivered`: dias de espera sem nenhum evento entregue. */
  daysWaiting?: number;
}

export interface EventCoverageReport {
  generatedAt: string;
  timezone: "America/Sao_Paulo";
  today: string;
  scope: { description: string; regions: Array<{ name: string; status: string }> };
  target: { events30d: number; minGeocodedPct: number };
  status: EventCoverageStatus;
  reasons: EventCoverageReason[];
  counts: { next7d: number; next30d: number; next90d: number; next30dFromHealthySources: number };
  quality: {
    geocodedPct: number | null;
    withCategoryPct: number | null;
    missingGeocode30d: number;
    missingCategory30d: number;
  };
  duplicatesPendingReview: { total: number; high: number };
  histogram: Array<{ date: string; count: number }>;
  sources: EventCoverageSource[];
}

export const fetchEventCoverage = () =>
  api.get<EventCoverageReport>("/admin/event-coverage").then((r) => r.data);

// ================== Histórico e lead time (EVB) ==================
// GET /admin/event-coverage/changes e /lead-time — contrato em
// urban-ai-backend-main/src/evento/event-change-history.service.ts

export type EventChangeType =
  | "first_seen"
  | "rescheduled"
  | "venue_changed"
  | "url_changed"
  | "cancelled"
  | "postponed"
  | "possibly_cancelled"
  | "reappeared";

export interface EventChangeRow {
  id: string;
  eventId: string;
  eventName: string | null;
  eventDate: string | null;
  changeType: EventChangeType;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  source: string | null;
  detectedAt: string;
}

export interface EventChangesSummary {
  windowDays: number;
  firstSeen: number;
  rescheduled: number;
  venueChanged: number;
  urlChanged: number;
  cancelled: number;
  postponed: number;
  possiblyCancelled: number;
  reappeared: number;
}

export interface EventChangesSeriesPoint {
  date: string;
  firstSeen: number;
  rescheduled: number;
  cancelled: number;
  possiblyCancelled: number;
}

export interface EventChangesReport {
  generatedAt: string;
  timezone: "America/Sao_Paulo";
  config: { enabled: boolean; possiblyCancelledDays: number; applyReschedule: boolean };
  summary: EventChangesSummary;
  series: EventChangesSeriesPoint[];
  recent: EventChangeRow[];
}

export interface EventLeadTimeStats {
  count: number;
  medianDays: number | null;
  p25Days: number | null;
  p75Days: number | null;
  meanDays: number | null;
}

export interface EventLeadTimeGroup extends EventLeadTimeStats {
  key: string;
}

export interface EventLeadTime {
  generatedAt: string;
  windowDays: number;
  sample: number;
  targetMedianDays: number;
  overall: EventLeadTimeStats;
  lateDiscovered: number;
  distribution: Array<{ key: string; label: string; count: number }>;
  bySource: EventLeadTimeGroup[];
  byCategory: EventLeadTimeGroup[];
  bySize: EventLeadTimeGroup[];
}

export const fetchEventChanges = (params: { days?: number; types?: EventChangeType[]; limit?: number } = {}) =>
  api
    .get<EventChangesReport>("/admin/event-coverage/changes", {
      params: {
        days: params.days,
        limit: params.limit,
        types: params.types?.length ? params.types.join(",") : undefined,
      },
    })
    .then((r) => r.data);

export const fetchEventLeadTime = (days?: number) =>
  api.get<EventLeadTime>("/admin/event-coverage/lead-time", { params: { days } }).then((r) => r.data);
