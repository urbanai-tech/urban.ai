import type {
  AdminEventRadarBlindSpot,
  AdminEventRadarEvent,
  AdminEventRadarHeatmapCell,
  AdminEventRadarHeatmapMetric,
  AdminEventRadarHeatmapResponse,
} from "../../service/api";
import { AdminBadge, AdminEmptyState, type AdminBadgeKind } from "../_components";
import { MiniStat } from "./event-radar-detail";
import {
  adminCellCode,
  adminCellHasGeo,
  adminCellKind,
  blindSpotMatchesCell,
  eventMatchesCell,
  formatCents,
  formatHeatmapValue,
  geoOpsFocusLabel,
  getAdminCellBounds,
  heatmapFocusTags,
  heatmapOperationalAction,
  heatmapValue,
  isEventMissingGeo,
  metricLabel,
  projectAdminCell,
  type GeoOpsFocus,
} from "./event-radar-domain";

export function GeoOpsHeatmapPanel({
  heatmap,
  metric,
  focus,
  events,
  blindSpots,
}: {
  heatmap: AdminEventRadarHeatmapResponse | null;
  metric: AdminEventRadarHeatmapMetric;
  focus: GeoOpsFocus;
  events: AdminEventRadarEvent[];
  blindSpots: AdminEventRadarBlindSpot[];
}) {
  if (!heatmap || heatmap.cells.length === 0) {
    return (
      <AdminEmptyState
        title="Sem células para o heatmap"
        body="Ajuste os filtros para visualizar demanda por região."
      />
    );
  }

  const missingGeoEvents = events.filter(isEventMissingGeo);
  const revenueEvents = [...events]
    .filter((event) => (event.revenuePotentialCents ?? 0) > 0)
    .sort((a, b) => (b.revenuePotentialCents ?? 0) - (a.revenuePotentialCents ?? 0));
  const max = Math.max(...heatmap.cells.map((cell) => heatmapValue(cell, metric)), 1);
  const revenueMax = Math.max(...heatmap.cells.map((cell) => cell.revenuePotentialCents), 0);
  const opsCells = heatmap.cells.map((cell) => {
    const value = heatmapValue(cell, metric);
    const missingGeoCount = missingGeoEvents.filter((event) => eventMatchesCell(event, cell)).length;
    const regionBlindSpots = blindSpots.filter((spot) => blindSpotMatchesCell(spot, cell)).length;
    const action = heatmapOperationalAction(cell, missingGeoCount, regionBlindSpots, revenueMax);

    return {
      cell,
      value,
      intensity: Math.max(0.12, Math.min(0.75, value / max)),
      missingGeoCount,
      regionBlindSpots,
      action,
      tags: heatmapFocusTags(cell, value, max, missingGeoCount, regionBlindSpots, revenueMax),
    };
  });
  const filteredCells = focus === "all" ? opsCells : opsCells.filter((item) => item.tags.includes(focus));
  const topCells = [...opsCells].sort((a, b) => b.value - a.value).slice(0, 3);
  const hotCells = opsCells.filter((item) => item.tags.includes("hotspots")).length;
  const coverageGapCells = opsCells.filter((item) => item.tags.includes("coverage_gaps")).length;
  const revenueCellCount = opsCells.filter((item) => item.tags.includes("revenue")).length;
  const topOpportunityRevenue = revenueEvents
    .slice(0, 5)
    .reduce((sum, event) => sum + (event.revenuePotentialCents ?? 0), 0);

  return (
    <div data-testid="admin-geo-ops-heatmap" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        data-testid="admin-geo-ops-summary"
        style={{
          display: "grid",
          gridTemplateColumns: "var(--event-radar-geo-ops-grid, repeat(4, minmax(0, 1fr)))",
          gap: 10,
        }}
      >
        <GeoOpsStat
          label="Hotspots"
          value={hotCells}
          detail={topCells[0]?.cell.label ?? "sem região quente"}
          kind={hotCells > 0 ? "warn" : "neutral"}
          testId="geo-ops-hotspots"
        />
        <GeoOpsStat
          label="Gaps cobertura"
          value={coverageGapCells}
          detail="malha ou confiança baixa"
          kind={coverageGapCells > 0 ? "error" : "success"}
          testId="geo-ops-coverage-gaps"
        />
        <GeoOpsStat
          label="Eventos sem geo"
          value={missingGeoEvents.length}
          detail="travam heatmap e pricing"
          kind={missingGeoEvents.length > 0 ? "error" : "success"}
          testId="geo-ops-missing-geo"
        />
        <GeoOpsStat
          label="Receita top 5"
          value={formatCents(topOpportunityRevenue)}
          detail={`${revenueCellCount} regiões com upside`}
          kind={revenueCellCount > 0 ? "accent" : "neutral"}
          testId="geo-ops-revenue-opportunities"
        />
      </div>

      <div
        style={{
          padding: "12px 14px",
          border: "1px solid var(--admin-divider)",
          borderRadius: 2,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: "var(--admin-text)", fontSize: 13, fontWeight: 600 }}>
            Métrica: {metricLabel(metric)} / foco: {geoOpsFocusLabel(focus)}
          </p>
          <p style={{ margin: "5px 0 0", color: "var(--admin-text-muted)", fontSize: 12, overflowWrap: "anywhere" }}>
            {filteredCells.length} de {opsCells.length} células visíveis. Cores indicam intensidade; badge indica a próxima ação operacional.
          </p>
        </div>
        <div
          aria-hidden
          style={{
            width: 96,
            height: 8,
            background: "linear-gradient(90deg, rgba(232,80,10,0.06), rgba(232,80,10,0.36))",
            border: "1px solid var(--admin-divider)",
          }}
        />
      </div>

      {filteredCells.length > 0 && (
        <GeoOpsRadarMap items={filteredCells} metric={metric} max={max} />
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "var(--event-radar-hotspots-grid, repeat(3, minmax(0, 1fr)))",
          gap: 10,
        }}
      >
        {topCells.map((item, index) => (
          <div
            key={`${item.cell.cellId}-top`}
            data-testid="admin-geo-hotspot-card"
            style={{
              minWidth: 0,
              padding: "10px 12px",
              border: "1px solid var(--admin-divider)",
              borderRadius: 2,
            }}
          >
            <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 7 }}>
              Hotspot {index + 1}
            </p>
            <p
              style={{
                margin: 0,
                color: "var(--admin-text)",
                fontSize: 13,
                fontWeight: 700,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={item.cell.label}
            >
              {item.cell.label}
            </p>
            <p style={{ margin: "6px 0 0", color: "var(--admin-text-muted)", fontSize: 11, overflowWrap: "anywhere" }}>
              {formatHeatmapValue(item.value, metric)} - {item.cell.eventsCount} eventos - {item.action.label}
            </p>
            <GeoCellMeta cell={item.cell} compact />
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "var(--event-radar-geo-lists-grid, repeat(2, minmax(0, 1fr)))",
          gap: 10,
        }}
      >
        <GeoOpsEventList
          title="Maior receita potencial"
          events={revenueEvents.slice(0, 3)}
          mode="revenue"
          testId="admin-geo-revenue-list"
        />
        <GeoOpsEventList
          title="Eventos sem geo"
          events={missingGeoEvents.slice(0, 3)}
          mode="geo"
          testId="admin-geo-missing-geo-list"
        />
      </div>

      <HeatmapLegend metric={metric} />

      {filteredCells.length === 0 ? (
        <AdminEmptyState
          title="Sem células nesse foco"
          body="Troque o foco Geo Ops ou amplie os filtros para ver regiões operacionais."
        />
      ) : (
        <div
          className="admin-event-radar-heatmap-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "var(--event-radar-heatmap-grid, repeat(auto-fit, minmax(150px, 1fr)))",
            gap: 10,
          }}
        >
          {filteredCells.map((item) => (
            <div
              key={item.cell.cellId}
              data-testid="admin-geo-ops-cell"
              data-cell-id={item.cell.cellId}
              title={`${item.cell.label}: ${metricLabel(metric)} ${formatHeatmapValue(item.value, metric)}`}
              style={{
                minHeight: 158,
                padding: 14,
                border: "1px solid var(--admin-divider)",
                borderTop: `3px solid rgba(232, 80, 10, ${Math.max(0.3, item.intensity)})`,
                borderRadius: 2,
                background: `rgba(232, 80, 10, ${item.intensity * 0.24})`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 12,
                minWidth: 0,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <p className="urban-admin-eyebrow-muted">Valor</p>
                  <span style={{ color: "var(--admin-accent)", fontFamily: "monospace", fontSize: 12 }}>
                    {formatHeatmapValue(item.value, metric)}
                  </span>
                </div>
                <p
                  style={{
                    margin: "10px 0 0",
                    fontSize: 13,
                    color: "var(--admin-text)",
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={item.cell.label}
                >
                  {item.cell.label}
                </p>
                <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--admin-text-muted)", overflowWrap: "anywhere" }}>
                  {item.cell.dominantCategory ?? "categoria mista"}
                </p>
                <GeoCellMeta cell={item.cell} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <AdminBadge kind={item.action.kind}>{item.action.label}</AdminBadge>
                {item.missingGeoCount > 0 && <AdminBadge kind="error">geo {item.missingGeoCount}</AdminBadge>}
                {item.regionBlindSpots > 0 && <AdminBadge kind="warn">spots {item.regionBlindSpots}</AdminBadge>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
                <MiniStat label="Score" value={item.cell.eventDemandScore} />
                <MiniStat label="Eventos" value={item.cell.eventsCount} />
                <MiniStat label="Imóveis" value={item.cell.affectedPropertiesCount} />
                <MiniStat label="Cobertura" value={`${item.cell.coverageScore}%`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GeoOpsRadarMap({
  items,
  metric,
  max,
}: {
  items: Array<{
    cell: AdminEventRadarHeatmapCell;
    value: number;
    intensity: number;
    missingGeoCount: number;
    action: { label: string; detail: string; kind: AdminBadgeKind };
  }>;
  metric: AdminEventRadarHeatmapMetric;
  max: number;
}) {
  const geoItems = items.filter((item) => adminCellHasGeo(item.cell));
  const missingCenterCount = items.length - geoItems.length;
  const bounds = getAdminCellBounds(geoItems.map((item) => item.cell));

  return (
    <div
      data-testid="admin-geo-ops-radar-map"
      style={{
        border: "1px solid var(--admin-divider)",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <div
        className="admin-geo-ops-radar-map-canvas"
        style={{
          minHeight: 300,
          position: "relative",
          background:
            "linear-gradient(0deg, rgba(14,17,22,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(14,17,22,0.035) 1px, transparent 1px), var(--admin-surface-muted)",
          backgroundSize: "32px 32px",
        }}
      >
        <AdminRadarOverlay />
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 8, flexWrap: "wrap", maxWidth: "calc(100% - 24px)" }}>
          <AdminBadge kind="accent">{geoItems.length} células no radar</AdminBadge>
          {missingCenterCount > 0 && <AdminBadge kind="warn">{missingCenterCount} sem centro</AdminBadge>}
        </div>

        {geoItems.length === 0 ? (
          <div
            style={{
              position: "absolute",
              inset: 58,
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              color: "var(--admin-text-muted)",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            Nenhuma célula com centro geográfico neste foco.
          </div>
        ) : (
          geoItems.map((item) => {
            const left = projectAdminCell(item.cell.centerLng as number, bounds.minLng, bounds.maxLng);
            const top = 100 - projectAdminCell(item.cell.centerLat as number, bounds.minLat, bounds.maxLat);
            const size = Math.max(54, Math.min(118, 48 + Math.max(0.12, item.value / max) * 64));

            return (
              <div
                key={`radar-${item.cell.cellId}`}
                data-testid="admin-geo-ops-radar-cell"
                data-cell-code={adminCellCode(item.cell)}
                title={`${item.cell.label}: ${formatHeatmapValue(item.value, metric)} - ${adminCellCode(item.cell)}`}
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  top: `${top}%`,
                  width: size,
                  height: size,
                  transform: "translate(-50%, -50%)",
                  borderRadius: "50%",
                  border: `1px solid rgba(232, 80, 10, ${Math.max(0.28, item.intensity)})`,
                  background: `rgba(232, 80, 10, ${Math.max(0.10, item.intensity * 0.26)})`,
                  color: "var(--admin-accent)",
                  display: "grid",
                  placeItems: "center",
                  textAlign: "center",
                  padding: 8,
                  boxShadow: "0 14px 30px rgba(14, 17, 22, 0.14)",
                }}
              >
                <span style={{ fontFamily: "monospace", fontSize: 17, fontWeight: 800, lineHeight: 1 }}>
                  {formatHeatmapValue(item.value, metric)}
                </span>
                <span style={{ marginTop: 3, fontSize: 9, fontWeight: 700, lineHeight: 1.2 }}>
                  {item.action.label}
                </span>
              </div>
            );
          })
        )}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 10,
          padding: 12,
          borderTop: "1px solid var(--admin-divider)",
        }}
      >
        {items.slice(0, 3).map((item) => (
          <div key={`radar-meta-${item.cell.cellId}`} style={{ minWidth: 0 }}>
            <p style={{ margin: 0, color: "var(--admin-text)", fontSize: 12, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.cell.label}
            </p>
            <p style={{ margin: "4px 0 0", color: "var(--admin-text-muted)", fontSize: 11, overflowWrap: "anywhere" }}>
              {adminCellCode(item.cell)} - {item.missingGeoCount > 0 ? `${item.missingGeoCount} sem geo` : item.action.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminRadarOverlay() {
  return (
    <>
      {[34, 56, 78].map((size) => (
        <span
          key={size}
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: `${size}%`,
            aspectRatio: "1 / 1",
            transform: "translate(-50%, -50%)",
            border: "1px solid var(--admin-divider)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />
      ))}
      <span aria-hidden style={{ position: "absolute", left: 38, right: 38, top: "50%", height: 1, background: "var(--admin-divider)" }} />
      <span aria-hidden style={{ position: "absolute", top: 38, bottom: 38, left: "50%", width: 1, background: "var(--admin-divider)" }} />
    </>
  );
}

function GeoCellMeta({ cell, compact }: { cell: AdminEventRadarHeatmapCell; compact?: boolean }) {
  return (
    <p style={{ margin: compact ? "6px 0 0" : "5px 0 0", fontSize: 10, color: "var(--admin-text-muted)", overflowWrap: "anywhere" }}>
      <span style={{ textTransform: "uppercase", fontWeight: 700 }}>{adminCellKind(cell)}</span>{" "}
      <span style={{ fontFamily: "monospace" }}>{adminCellCode(cell)}</span>
      {!adminCellHasGeo(cell) ? " - sem centro geo" : ""}
    </p>
  );
}

function GeoOpsStat({
  label,
  value,
  detail,
  kind,
  testId,
}: {
  label: string;
  value: string | number;
  detail: string;
  kind: AdminBadgeKind;
  testId: string;
}) {
  return (
    <div data-testid={testId} style={{ minWidth: 0, border: "1px solid var(--admin-divider)", borderRadius: 2, padding: 12 }}>
      <p className="urban-admin-eyebrow-muted">{label}</p>
      <p
        style={{
          margin: "9px 0 8px",
          color: "var(--admin-text)",
          fontFamily: "monospace",
          fontSize: 18,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={String(value)}
      >
        {value}
      </p>
      <AdminBadge kind={kind} style={{ maxWidth: "100%" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail}</span>
      </AdminBadge>
    </div>
  );
}

function GeoOpsEventList({
  title,
  events,
  mode,
  testId,
}: {
  title: string;
  events: AdminEventRadarEvent[];
  mode: "revenue" | "geo";
  testId: string;
}) {
  return (
    <div data-testid={testId} style={{ minWidth: 0, border: "1px solid var(--admin-divider)", borderRadius: 2, padding: 12 }}>
      <p className="urban-admin-eyebrow-muted" style={{ marginBottom: 10 }}>
        {title}
      </p>
      {events.length === 0 ? (
        <p style={{ margin: 0, color: "var(--admin-text-muted)", fontSize: 12 }}>
          Nenhum item neste recorte.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {events.map((event) => (
            <div key={`${mode}-${event.id}`} style={{ minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  color: "var(--admin-text)",
                  fontSize: 12,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={event.name}
              >
                {event.name}
              </p>
              <p style={{ margin: "4px 0 0", color: "var(--admin-text-muted)", fontSize: 11, overflowWrap: "anywhere" }}>
                {event.city}/{event.state} - {mode === "revenue" ? formatCents(event.revenuePotentialCents) : event.geocodeStatus}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BlindSpotOpsSummary({ blindSpots }: { blindSpots: AdminEventRadarBlindSpot[] }) {
  const geo = blindSpots.filter((spot) => spot.kind === "missing_geocode" || spot.kind === "venue_gap").length;
  const pricing = blindSpots.filter((spot) => spot.kind === "no_pricing").length;
  const source = blindSpots.filter(
    (spot) => spot.kind === "missing_official_link" || spot.kind === "stale_source" || spot.kind === "duplicate_risk",
  ).length;
  const coverage = blindSpots.filter(
    (spot) => spot.kind === "low_coverage" || spot.kind === "out_of_scope_high_potential",
  ).length;
  const revenueAtRisk = blindSpots.reduce((sum, spot) => sum + (spot.revenuePotentialCents ?? 0), 0);

  return (
    <div
      data-testid="admin-geo-blindspot-summary"
      style={{
        display: "grid",
        gridTemplateColumns: "var(--event-radar-geo-ops-grid, repeat(4, minmax(0, 1fr)))",
        gap: 10,
        marginBottom: 14,
      }}
    >
      <GeoOpsStat label="Geo/dado" value={geo} detail="corrigir localização" kind={geo > 0 ? "error" : "success"} testId="geo-blindspots-geo" />
      <GeoOpsStat label="Pricing" value={pricing} detail="gerar recomendação" kind={pricing > 0 ? "error" : "success"} testId="geo-blindspots-pricing" />
      <GeoOpsStat label="Fonte" value={source} detail="validar crawler/link" kind={source > 0 ? "warn" : "success"} testId="geo-blindspots-source" />
      <GeoOpsStat label="Receita travada" value={formatCents(revenueAtRisk)} detail={`${coverage} gaps cobertura`} kind={coverage > 0 ? "warn" : "neutral"} testId="geo-blindspots-revenue" />
    </div>
  );
}

function HeatmapLegend({ metric }: { metric: AdminEventRadarHeatmapMetric }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
        color: "var(--admin-text-muted)",
        fontSize: 11,
        borderTop: "1px solid var(--admin-divider)",
        paddingTop: 10,
      }}
    >
      <span>frio</span>
      <div
        aria-hidden
        style={{
          flex: 1,
          height: 6,
          background: "linear-gradient(90deg, rgba(232,80,10,0.06), rgba(232,80,10,0.18), rgba(232,80,10,0.42))",
          border: "1px solid var(--admin-divider)",
        }}
      />
      <span>quente por {metricLabel(metric).toLowerCase()}</span>
    </div>
  );
}
