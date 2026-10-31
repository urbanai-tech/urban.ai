import { api } from "./client";

// ================== Lista de referência de eventos (ADR 0026) ==================
// Contratos em urban-ai-backend-main/src/event-reference/*.ts

export type EventReferenceStatus = "candidato" | "aprovado" | "rejeitado" | "conflito";
export type EventReferenceSize = "grande" | "medio" | "pequeno";

export interface EventReferenceVote {
  id: string;
  validatorKey: string;
  validatorKind: "tavily" | "serpapi" | "firecrawl" | "events_db" | "judge";
  verdict: "support" | "confirm" | "reject" | "unsure";
  sourceUrl: string | null;
  extractor: "gemini" | "anthropic" | "none";
  observedName: string | null;
  observedDate: string | null;
  observedVenue: string | null;
  snippet: string | null;
  createdAt: string;
}

export interface EventReferenceItem {
  id: string;
  name: string;
  venueKey: string | null;
  venueName: string;
  startsAt: string;
  dateKey: string;
  city: string;
  category: string | null;
  size: EventReferenceSize;
  status: EventReferenceStatus;
  origin: "csv" | "curadoria" | "manual";
  evidenceUrls: string[];
  votesSupport: number;
  votesAgainst: number;
  approvedBy: string | null;
  approvedAt: string | null;
  decisionNote: string | null;
  conflictReason: string | null;
  matchedEventId: string | null;
  matchedAt: string | null;
}

export interface EventReferenceWithVotes extends EventReferenceItem {
  votes: EventReferenceVote[];
}

export interface EventReferenceList {
  items: EventReferenceItem[];
  total: number;
  page: number;
  limit: number;
}

export interface EventReferenceConfigResponse {
  config: {
    curationEnabled: boolean;
    metricsEnabled: boolean;
    horizonDays: number;
    minAgree: number;
    maxSearchCalls: number;
    maxScrapeCalls: number;
    maxLlmCalls: number;
    maxJudgeCalls: number;
    recallFloorPct: number;
  };
  providers: { tavily: boolean; serpapi: boolean; firecrawl: boolean; gemini: boolean; anthropic: boolean };
  venues: Array<{ key: string; name: string; size: EventReferenceSize; officialUrl: string | null }>;
  venuesSource: "seed" | "file";
  warnings: string[];
  counts: Partial<Record<EventReferenceStatus, number>>;
  csvTemplate: string;
}

export type CoverageScope = "past30" | "next90";
export type CoverageDimension = "total" | "category" | "venue" | "size";

export interface CoverageMetricRow {
  scope: CoverageScope;
  dimension: CoverageDimension;
  dimensionValue: string;
  referenceTotal: number;
  referenceMatched: number;
  recallPct: number | null;
  precisionSample: number | null;
  precisionConfirmed: number | null;
  precisionRefuted: number | null;
  precisionPct: number | null;
}

export interface CoverageSeriesPoint {
  date: string;
  recallPast30Pct: number | null;
  recallNext90Pct: number | null;
  precisionPct: number | null;
  referencePast30: number;
}

export interface EventCoverageMetrics {
  latestDate: string | null;
  floorPct: number;
  rows: CoverageMetricRow[];
  series: CoverageSeriesPoint[];
}

export interface ReferenceImportSummary {
  parsedRows: number;
  created: number;
  updated: number;
  unchanged: number;
  invalidRows: Array<{ line: number; reason: string }>;
}

export interface AdminJobRunLite {
  id: string;
  name: string;
  status: "running" | "success" | "error";
  result: unknown;
  errorMessage: string | null;
}

export interface CurationResultLite {
  venuesProcessed: number;
  venuesTotal: number;
  observations: number;
  referencesCreated: number;
  referencesTouched: number;
  approvedAuto: number;
  conflicts: number;
  candidates: number;
  warnings: string[];
  budgetExhausted: string[];
}

export interface MatchResultLite {
  snapshotDate: string;
  referencesChecked: number;
  matched: number;
  unmatched: number;
  recallPast30Pct: number | null;
  precisionPct: number | null;
  alerted: boolean;
}

export const fetchEventReferences = (params: {
  status?: EventReferenceStatus | "";
  q?: string;
  venueKey?: string;
  page?: number;
  limit?: number;
}) =>
  api
    .get<EventReferenceList>("/admin/event-reference", {
      params: { ...params, status: params.status || undefined, q: params.q || undefined, venueKey: params.venueKey || undefined },
    })
    .then((r) => r.data);

export const fetchEventReferenceConflicts = () =>
  api.get<{ items: EventReferenceWithVotes[] }>("/admin/event-reference/conflicts").then((r) => r.data);

export const fetchEventReferenceConfig = () =>
  api.get<EventReferenceConfigResponse>("/admin/event-reference/config").then((r) => r.data);

export const fetchEventCoverageMetrics = (days = 60) =>
  api.get<EventCoverageMetrics>("/admin/event-reference/metrics", { params: { days } }).then((r) => r.data);

export const fetchMissingReferences = (limit = 20) =>
  api
    .get<{ items: Array<{ id: string; name: string; venueName: string; dateKey: string; size: EventReferenceSize; category: string | null }> }>(
      "/admin/event-reference/missing",
      { params: { limit } },
    )
    .then((r) => r.data);

export const approveEventReference = (id: string, note?: string) =>
  api.post<EventReferenceItem>(`/admin/event-reference/${id}/approve`, { note }).then((r) => r.data);

export const rejectEventReference = (id: string, note?: string) =>
  api.post<EventReferenceItem>(`/admin/event-reference/${id}/reject`, { note }).then((r) => r.data);

export const runEventReferenceCuration = () =>
  api.post<AdminJobRunLite>("/admin/event-reference/curate").then((r) => r.data);

export const runEventCoverageMatch = () =>
  api.post<AdminJobRunLite>("/admin/event-reference/match").then((r) => r.data);

export const importEventReferenceCsv = (file: File, status: "aprovado" | "candidato") => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("status", status);
  return api
    .post<ReferenceImportSummary>("/admin/event-reference/import-csv", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

// ================== Cobertura pública (sem login) ==================

export interface PublicEventCoverage {
  status: "measuring" | "measured";
  measuredAt: string | null;
  measuringSince: string | null;
  daysMeasured: number;
  minWeeks: number;
  recallLargeEventsPct: number | null;
  largeEventsSample: number;
  eventsTracked: number;
  venuesCovered: number;
  message: string;
}
