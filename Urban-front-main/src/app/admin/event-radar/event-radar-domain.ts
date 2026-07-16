import type {
  AdminEventRadarBlindSpot,
  AdminEventRadarContractMode,
  AdminEventRadarDetail,
  AdminEventRadarEvent,
  AdminEventRadarHeatmapCell,
  AdminEventRadarHeatmapMetric,
  AdminEventRadarHeatmapResponse,
  EventRadarConfidence,
} from "../../service/api";
import type { AdminBadgeKind } from "../_components";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export const integer = new Intl.NumberFormat("pt-BR");

export const HEATMAP_METRICS: Array<{ value: AdminEventRadarHeatmapMetric; label: string }> = [
  { value: "demand", label: "Demanda" },
  { value: "revenue", label: "Receita" },
  { value: "events", label: "Eventos" },
  { value: "properties", label: "Imóveis" },
  { value: "blind_spots", label: "Blind spots" },
  { value: "coverage", label: "Cobertura" },
];

export type GeoOpsFocus = "all" | "hotspots" | "coverage_gaps" | "missing_geo" | "revenue";

export const GEO_OPS_FOCUS_OPTIONS: Array<{ value: GeoOpsFocus; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "hotspots", label: "Hotspots" },
  { value: "coverage_gaps", label: "Gaps cobertura" },
  { value: "missing_geo", label: "Sem geo" },
  { value: "revenue", label: "Maior receita" },
];

export function formatCents(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return money.format(value / 100);
}

export function formatPriceRange(min?: number | null, max?: number | null) {
  if (min === null || min === undefined) {
    return max === null || max === undefined ? formatCents(null) : `até ${formatCents(max)}`;
  }
  if (max === null || max === undefined) return `desde ${formatCents(min)}`;
  return `${formatCents(min)} - ${formatCents(max)}`;
}

export function formatMultiplier(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}x`;
}

export function formatProbability(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 100)}%`;
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function confidenceLabel(confidence: EventRadarConfidence) {
  if (confidence === "high") return "Alta";
  if (confidence === "medium") return "Média";
  return "Baixa";
}

export function confidenceKind(confidence: EventRadarConfidence): AdminBadgeKind {
  if (confidence === "high") return "success";
  if (confidence === "medium") return "warn";
  return "neutral";
}

export function dataStatusLabel(status?: string | null) {
  if (status === "persisted") return "Persistido";
  if (status === "persisted_or_derived") return "Misto";
  if (status === "derived_from_event_fields") return "Derivado";
  if (status === "derived_from_analise_preco") return "Derivado";
  if (status === "derived_from_events") return "Heatmap derivado";
  if (status === "stub_pending_engine") return "Pendente";
  if (status === "contract_mock") return "Mock";
  if (status === "contract_fallback") return "Fallback";
  return "Sem status";
}

export function dataStatusKind(status?: string | null): AdminBadgeKind {
  if (status === "persisted") return "success";
  if (status === "persisted_or_derived") return "warn";
  if (status === "stub_pending_engine" || status === "contract_mock" || status === "contract_fallback") return "warn";
  if (status?.startsWith("derived_")) return "warn";
  return "neutral";
}

export function shortTrace(value?: string | null) {
  if (!value) return "";
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

export function isEnterpriseEvidenceReady(detail: AdminEventRadarDetail) {
  const status = detail.intelligence.dataStatus ?? detail.event.dataStatus;
  const jobRunId = detail.intelligence.jobRunId ?? detail.event.jobRunId;
  return detail.contractMode === "backend" && status === "persisted" && Boolean(jobRunId);
}

export function severityKind(severity: AdminEventRadarBlindSpot["severity"]): AdminBadgeKind {
  if (severity === "high") return "error";
  if (severity === "medium") return "warn";
  return "neutral";
}

export function actionKind(action: AdminEventRadarDetail["propertyImpact"][number]["recommendedAction"]): AdminBadgeKind {
  if (action === "apply") return "success";
  if (action === "review") return "warn";
  if (action === "simulate") return "accent";
  return "neutral";
}

export function actionLabel(action: AdminEventRadarDetail["propertyImpact"][number]["recommendedAction"]) {
  if (action === "apply") return "Aplicar";
  if (action === "simulate") return "Simular";
  if (action === "review") return "Revisar";
  return "Observar";
}

export function scoreColor(score: number) {
  if (score >= 80) return "var(--admin-accent)";
  if (score >= 60) return "var(--admin-warning)";
  return "var(--admin-text-muted)";
}

export function geoOpsFocusLabel(focus: GeoOpsFocus) {
  const option = GEO_OPS_FOCUS_OPTIONS.find((item) => item.value === focus);
  return option?.label ?? "Todos";
}

export function isEventMissingGeo(event: AdminEventRadarEvent) {
  return event.geocodeStatus !== "ok" || event.latitude === null || event.longitude === null;
}

export function adminCellHasGeo(cell: AdminEventRadarHeatmapCell) {
  return typeof cell.centerLat === "number" && Number.isFinite(cell.centerLat) && typeof cell.centerLng === "number" && Number.isFinite(cell.centerLng);
}

export function adminCellCode(cell: AdminEventRadarHeatmapCell) {
  return cell.h3Index ?? cell.geohash ?? cell.cellId;
}

export function adminCellKind(cell: AdminEventRadarHeatmapCell) {
  if (cell.h3Index) return "H3";
  if (cell.geohash) return "Geohash";
  if (cell.dataStatus === "derived_from_events") return "Derivada";
  return "Célula";
}

export function getAdminCellBounds(cells: AdminEventRadarHeatmapCell[]) {
  const lats = cells.map((cell) => cell.centerLat).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const lngs = cells.map((cell) => cell.centerLng).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return {
    minLat: Math.min(...lats, -23.75),
    maxLat: Math.max(...lats, -23.45),
    minLng: Math.min(...lngs, -46.78),
    maxLng: Math.max(...lngs, -46.55),
  };
}

export function projectAdminCell(value: number, min: number, max: number) {
  if (!Number.isFinite(value) || max === min) return 50;
  return Math.min(86, Math.max(14, ((value - min) / (max - min)) * 72 + 14));
}

export function eventMatchesCell(event: AdminEventRadarEvent, cell: AdminEventRadarHeatmapCell) {
  return sameRegion(event.city, event.state, cell.city, cell.state);
}

export function blindSpotMatchesCell(spot: AdminEventRadarBlindSpot, cell: AdminEventRadarHeatmapCell) {
  return sameRegion(spot.city ?? null, null, cell.city, cell.state);
}

export function sameRegion(city: string | null | undefined, state: string | null | undefined, cellCity: string, cellState: string) {
  const cityMatch = normalizeRegion(city) === normalizeRegion(cellCity);
  const normalizedState = normalizeRegion(state);
  const stateMatch = !normalizedState || normalizedState === normalizeRegion(cellState);
  return cityMatch && stateMatch;
}

export function normalizeRegion(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function heatmapFocusTags(
  cell: AdminEventRadarHeatmapCell,
  value: number,
  max: number,
  missingGeoCount: number,
  regionBlindSpots: number,
  revenueMax: number,
) {
  const tags: GeoOpsFocus[] = [];
  if (value >= max * 0.66 || cell.eventDemandScore >= 75) tags.push("hotspots");
  if (cell.coverageScore < 50 || cell.averageConfidence < 60 || regionBlindSpots > 0) tags.push("coverage_gaps");
  if (missingGeoCount > 0) tags.push("missing_geo");
  if (cell.revenuePotentialCents > 0 && cell.revenuePotentialCents >= Math.max(1, revenueMax * 0.66)) tags.push("revenue");
  return tags;
}

export function heatmapOperationalAction(
  cell: AdminEventRadarHeatmapCell,
  missingGeoCount: number,
  regionBlindSpots: number,
  revenueMax: number,
): { label: string; detail: string; kind: AdminBadgeKind } {
  if (missingGeoCount > 0) {
    return { label: "Corrigir geo", detail: `${missingGeoCount} eventos sem lat/lng`, kind: "error" };
  }
  if (cell.coverageScore < 50) {
    return { label: "Abrir cobertura", detail: `${cell.coverageScore}% cobertura`, kind: "warn" };
  }
  if (regionBlindSpots > 0) {
    return { label: "Resolver bloqueios", detail: `${regionBlindSpots} blind spots`, kind: "warn" };
  }
  if (cell.revenuePotentialCents > 0 && cell.revenuePotentialCents >= Math.max(1, revenueMax * 0.66)) {
    return { label: "Priorizar pricing", detail: formatCents(cell.revenuePotentialCents), kind: "accent" };
  }
  if (cell.eventDemandScore >= 75) {
    return { label: "Monitorar oferta", detail: `score ${cell.eventDemandScore}`, kind: "success" };
  }
  return { label: "Observar", detail: "sem ação crítica", kind: "neutral" };
}

export function heatmapValue(cell: AdminEventRadarHeatmapCell, metric: AdminEventRadarHeatmapMetric) {
  if (metric === "revenue") return cell.revenuePotentialCents;
  if (metric === "events") return cell.eventsCount;
  if (metric === "properties") return cell.affectedPropertiesCount;
  if (metric === "coverage") return 100 - cell.coverageScore;
  if (metric === "blind_spots") return 100 - cell.coverageScore + Math.max(0, 75 - cell.averageConfidence);
  return cell.eventDemandScore;
}

export function topHeatmapCell(heatmap: AdminEventRadarHeatmapResponse | null) {
  if (!heatmap?.cells.length) return null;
  return [...heatmap.cells].sort((a, b) => b.eventDemandScore - a.eventDemandScore)[0] ?? null;
}

export function metricLabel(metric: AdminEventRadarHeatmapMetric) {
  const found = HEATMAP_METRICS.find((item) => item.value === metric);
  return found?.label ?? metric;
}

export function formatHeatmapValue(value: number, metric: AdminEventRadarHeatmapMetric) {
  if (metric === "revenue") return formatCents(value);
  if (metric === "coverage" || metric === "blind_spots") return `${Math.round(value)} pts`;
  return integer.format(value);
}

export function prioritizeEvents(events: AdminEventRadarEvent[]) {
  return [...events].sort((a, b) => {
    const scoreDelta = (b.demandScore ?? -1) - (a.demandScore ?? -1);
    if (scoreDelta !== 0) return scoreDelta;
    const revenueDelta = (b.revenuePotentialCents ?? -1) - (a.revenuePotentialCents ?? -1);
    if (revenueDelta !== 0) return revenueDelta;
    const impactDelta = b.affectedPropertiesCount - a.affectedPropertiesCount;
    if (impactDelta !== 0) return impactDelta;
    return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  });
}

export function uniqueList(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function modeColor(mode: AdminEventRadarContractMode) {
  return mode === "backend" ? "var(--admin-success)" : "var(--admin-warning)";
}
