import { api } from "./client";

// ================== Cobertura de eventos (D6) ==================
// GET /admin/event-coverage — contrato em urban-ai-backend-main/src/evento/event-coverage-report.service.ts

export type EventCoverageStatus = "ok" | "at_risk" | "insufficient";
export type EventCoverageSourceHealth = "healthy" | "stale" | "zero_yield" | "unmonitored";

export type EventCoverageReasonCode =
  | "below_target"
  | "unhealthy_sources"
  | "low_geocoding"
  | "low_category"
  | "dedup_pending"
  | "source_stale"
  | "source_zero_yield"
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
