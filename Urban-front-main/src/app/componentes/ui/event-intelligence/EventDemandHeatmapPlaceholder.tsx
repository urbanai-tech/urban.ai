"use client";

import React, { useMemo } from "react";
import type { DemandHeatmapCell, HostEventRadarItem } from "@/app/service/api";
import { AppBadge } from "../AppBadge";
import { AppButton } from "../AppButton";
import { AppCard } from "../AppCard";
import * as Icons from "../Icons";
import { formatCompactCurrencyFromCents } from "./formatters";

type EventDemandHeatmapProps = {
  cells: DemandHeatmapCell[];
  events?: HostEventRadarItem[];
  loading?: boolean;
  error?: string | null;
  selectedEventId?: string | null;
  onRetry?: () => void;
  onSelectCell?: (cell: DemandHeatmapCell) => void;
  onSelectEvent?: (eventId: string) => void;
  onOpenEvent?: (eventId: string) => void;
};

type CellViewModel = DemandHeatmapCell & {
  regionLabel: string;
  cityLabel: string;
  cellCode: string;
  cellKind: "h3" | "geohash" | "derived" | "cell";
  score: number;
  potentialCents: number;
  topEvents: HostEventRadarItem[];
  impactedProperties: Array<{ id: string; name: string }>;
  hasGeo: boolean;
};

type CitySummary = {
  key: string;
  city: string;
  state?: string;
  eventsCount: number;
  potentialCents: number;
  impactedPropertiesCount: number;
  noGeoEventsCount: number;
  highDemandEventsCount: number;
};

export function EventDemandHeatmapPlaceholder({
  cells,
  events = [],
  loading,
  error,
  selectedEventId,
  onRetry,
  onSelectCell,
  onSelectEvent,
  onOpenEvent,
}: EventDemandHeatmapProps) {
  const eventsById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const cellsWithStats = useMemo(
    () =>
      cells.map((cell) => {
        const topEvents = cell.topEventIds
          .map((eventId) => eventsById.get(eventId))
          .filter(Boolean) as HostEventRadarItem[];
        const impactedProperties = collectUniqueProperties(topEvents);

        return {
          ...cell,
          regionLabel: regionLabelFromCell(cell),
          cityLabel: cityLabelFromEvents(topEvents),
          cellCode: cellCodeFromCell(cell),
          cellKind: cellKindFromCell(cell),
          score: cell.eventDemandScore ?? 0,
          potentialCents: cell.revenuePotentialCents ?? 0,
          topEvents,
          impactedProperties,
          hasGeo: hasHeatmapGeo(cell),
        };
      }),
    [cells, eventsById],
  );

  const eventsWithoutGeo = useMemo(() => events.filter((event) => !hasEventGeo(event)), [events]);
  const citySummaries = useMemo(() => buildCitySummaries(events), [events]);
  const propertySummaries = useMemo(() => buildPropertySummaries(events), [events]);
  const geoCells = useMemo(() => cellsWithStats.filter((cell) => cell.hasGeo), [cellsWithStats]);
  const cellsWithoutGeo = useMemo(() => cellsWithStats.filter((cell) => !cell.hasGeo), [cellsWithStats]);
  const hotCells = useMemo(
    () =>
      [...cellsWithStats].sort(
        (a, b) => b.score - a.score || b.potentialCents - a.potentialCents || b.eventsCount - a.eventsCount,
      ),
    [cellsWithStats],
  );
  const maxScore = Math.max(...geoCells.map((cell) => cell.score), 1);
  const maxPotential = Math.max(...geoCells.map((cell) => cell.potentialCents), 1);
  const bounds = useMemo(() => getBounds(geoCells), [geoCells]);
  const hasActionableData = cellsWithStats.length > 0 || events.length > 0;

  if (loading) return <HeatmapLoadingState />;
  if (error) return <HeatmapErrorState error={error} onRetry={onRetry} />;

  return (
    <AppCard as="section" variant="default" style={{ padding: 0, overflow: "hidden", minWidth: 0 }}>
      <div
        data-testid="host-event-demand-heatmap-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: 18,
          borderBottom: "1px solid var(--app-divider)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p className="urban-app-eyebrow-muted" style={{ marginBottom: 4 }}>
            HEATMAP DE DEMANDA
          </p>
          <h3 style={{ margin: 0, color: "var(--app-text)", fontSize: 17, fontWeight: 750, letterSpacing: 0 }}>
            Regioes com maior potencial
          </h3>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <AppBadge kind={cellsWithStats.length > 0 ? "accent" : "neutral"}>
            {geoCells.length} celula(s) geo
          </AppBadge>
          {cellsWithoutGeo.length > 0 && <AppBadge kind="warn">{cellsWithoutGeo.length} celula(s) sem centro</AppBadge>}
          {eventsWithoutGeo.length > 0 && <AppBadge kind="warn">{eventsWithoutGeo.length} sem geo</AppBadge>}
        </div>
      </div>

      {!hasActionableData ? (
        <HeatmapEmptyState />
      ) : (
        <>
          <div
            className="event-demand-heatmap-layout"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 0.7fr)",
              gap: 0,
              minWidth: 0,
            }}
          >
            <div
              className="event-demand-heatmap-canvas"
              data-testid="host-event-demand-heatmap"
              style={{
                position: "relative",
                minHeight: 440,
                background:
                  "linear-gradient(0deg, var(--app-divider) 1px, transparent 1px), linear-gradient(90deg, var(--app-divider) 1px, transparent 1px), var(--app-surface-muted)",
                backgroundSize: "34px 34px",
                overflow: "hidden",
                borderRight: "1px solid var(--app-divider)",
              }}
            >
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 26,
                  border: "1px solid var(--app-divider)",
                  borderRadius: 8,
                }}
              />
              <MapLabel citySummaries={citySummaries} />
              <HeatLegend />
              <RadarGridOverlay />

              {geoCells.length === 0 ? (
                <NoGeoCanvas eventsWithoutGeo={eventsWithoutGeo} cellsWithoutGeo={cellsWithoutGeo.length} />
              ) : (
                geoCells.map((cell) => {
                  const left = project(cell.centerLng, bounds.minLng, bounds.maxLng);
                  const top = 100 - project(cell.centerLat, bounds.minLat, bounds.maxLat);
                  const intensity = Math.max(0.34, Math.min(1, cell.score / maxScore));
                  const potentialIntensity = Math.max(0.22, Math.min(1, cell.potentialCents / maxPotential));
                  const size = Math.max(62, Math.min(148, 54 + intensity * 62 + potentialIntensity * 22));
                  const color = heatColor(cell.score);
                  const isSelected = cell.topEventIds.some((eventId) => eventId === selectedEventId);

                  return (
                    <button
                      key={cell.cellId}
                      type="button"
                      className="event-demand-heatmap-cell"
                      data-testid="host-event-demand-heatmap-cell"
                      data-region={cell.regionLabel}
                      data-cell-code={cell.cellCode}
                      onClick={() => onSelectCell?.(cell)}
                      title={`${cell.regionLabel}: ${cell.cellCode}, score ${cell.score}, ${cell.eventsCount} evento(s)`}
                      aria-label={`${cell.regionLabel}, celula ${cell.cellCode}, score de demanda ${cell.score}, ${cell.affectedPropertiesCount} imoveis impactados`}
                      style={{
                        position: "absolute",
                        left: `${left}%`,
                        top: `${top}%`,
                        width: size,
                        height: size,
                        transform: "translate(-50%, -50%)",
                        borderRadius: "50%",
                        border: isSelected ? `2px solid ${color.text}` : `1px solid ${color.border}`,
                        background: color.background,
                        color: color.text,
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
                        boxShadow: isSelected
                          ? "0 0 0 5px var(--app-accent-soft), var(--app-shadow-overlay)"
                          : "var(--app-shadow-elevated)",
                        minWidth: 0,
                      }}
                    >
                      <span style={{ fontSize: 22, fontWeight: 850, lineHeight: 1 }}>{cell.score || "-"}</span>
                      <span style={{ fontSize: 10, fontWeight: 750, lineHeight: 1.2 }}>
                        {cell.affectedPropertiesCount} imovel(is)
                      </span>
                      <span
                        aria-hidden
                        style={{
                          marginTop: 3,
                          fontSize: 9,
                          fontWeight: 750,
                          lineHeight: 1,
                          maxWidth: "80%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cell.cellKind === "h3" ? "h3" : "geo"}
                      </span>
                      <span
                        className="event-demand-heatmap-pin-label"
                        style={{
                          position: "absolute",
                          bottom: -34,
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: 160,
                          color: "var(--app-text)",
                          fontSize: 11,
                          fontWeight: 750,
                          lineHeight: 1.25,
                          textAlign: "center",
                          overflowWrap: "anywhere",
                          pointerEvents: "none",
                        }}
                      >
                        {cell.regionLabel}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div
              data-testid="host-event-demand-heatmap-region-panel"
              style={{ padding: 16, display: "grid", gap: 12, alignContent: "start", minWidth: 0 }}
            >
              <p style={{ margin: 0, color: "var(--app-text)", fontSize: 13, fontWeight: 800 }}>
                Prioridade por regiao
              </p>
              {hotCells.length === 0 ? (
                <CompactEmpty text="Ainda nao ha celulas geograficas para ranquear." />
              ) : (
                hotCells.map((cell) => (
                  <RegionCard
                    key={cell.cellId}
                    cell={cell}
                    selected={cell.topEventIds.some((eventId) => eventId === selectedEventId)}
                    onSelectCell={onSelectCell}
                    onSelectEvent={onSelectEvent}
                    onOpenEvent={onOpenEvent}
                  />
                ))
              )}
            </div>
          </div>

          <div
            className="event-demand-heatmap-insights"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.2fr) minmax(260px, 0.8fr)",
              gap: 16,
              padding: 18,
              borderTop: "1px solid var(--app-divider)",
            }}
          >
            <CityPotentialPanel citySummaries={citySummaries} />
            <ImpactedPropertiesPanel properties={propertySummaries} />
          </div>

          <MissingGeoPanel events={eventsWithoutGeo} onSelectEvent={onSelectEvent} onOpenEvent={onOpenEvent} />
        </>
      )}

      <style>{`
        @media (max-width: 980px) {
          .event-demand-heatmap-layout,
          .event-demand-heatmap-insights {
            grid-template-columns: 1fr !important;
          }
          .event-demand-heatmap-canvas {
            border-right: 0 !important;
            border-bottom: 1px solid var(--app-divider);
          }
        }
        @media (max-width: 640px) {
          .event-demand-heatmap-canvas {
            min-height: 360px !important;
          }
          .event-demand-heatmap-cell {
            max-width: 104px;
            max-height: 104px;
          }
          .event-demand-heatmap-pin-label {
            display: none;
          }
          .event-demand-heatmap-city-grid {
            grid-template-columns: 1fr !important;
          }
          .event-demand-heatmap-radar-label {
            display: none !important;
          }
        }
      `}</style>
    </AppCard>
  );
}

function HeatmapLoadingState() {
  return (
    <AppCard as="section" variant="default" style={{ padding: 18 }}>
      <div data-testid="host-event-demand-heatmap-loading" role="status" aria-live="polite" style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <p className="urban-app-eyebrow-muted" style={{ marginBottom: 4 }}>
              HEATMAP DE DEMANDA
            </p>
            <h3 style={{ margin: 0, color: "var(--app-text)", fontSize: 17, fontWeight: 750 }}>
              Calculando regioes quentes...
            </h3>
          </div>
          <AppBadge kind="neutral">Carregando</AppBadge>
        </div>
        <div
          aria-hidden
          style={{
            minHeight: 280,
            borderRadius: 8,
            border: "1px solid var(--app-divider)",
            background:
              "linear-gradient(90deg, var(--app-surface-muted) 0%, var(--app-surface) 45%, var(--app-surface-muted) 90%)",
          }}
        />
      </div>
    </AppCard>
  );
}

function HeatmapErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <AppCard as="section" variant="default" style={{ padding: 22 }}>
      <div data-testid="host-event-demand-heatmap-error" style={{ display: "flex", gap: 14, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <AppBadge kind="warn">Heatmap indisponivel</AppBadge>
          <h3 style={{ margin: "10px 0 6px", color: "var(--app-text)", fontSize: 17, fontWeight: 750 }}>
            Nao conseguimos carregar as regioes agora
          </h3>
          <p style={{ margin: 0, color: "var(--app-text-muted)", fontSize: 13, lineHeight: 1.55 }}>
            {error}
          </p>
        </div>
        {onRetry && (
          <AppButton type="button" variant="secondary" onClick={onRetry}>
            Tentar de novo
          </AppButton>
        )}
      </div>
    </AppCard>
  );
}

function HeatmapEmptyState() {
  return (
    <div
      data-testid="host-event-demand-heatmap-empty"
      style={{
        minHeight: 320,
        display: "grid",
        placeItems: "center",
        padding: 24,
        textAlign: "center",
        background:
          "linear-gradient(0deg, var(--app-divider) 1px, transparent 1px), linear-gradient(90deg, var(--app-divider) 1px, transparent 1px), var(--app-surface-muted)",
        backgroundSize: "34px 34px",
      }}
    >
      <div style={{ maxWidth: 460 }}>
        <Icons.MapPin size={24} style={{ color: "var(--app-text-dim)" }} />
        <p style={{ margin: "10px 0 4px", color: "var(--app-text)", fontSize: 15, fontWeight: 750 }}>
          Sem regioes quentes neste filtro
        </p>
        <p style={{ margin: 0, color: "var(--app-text-muted)", fontSize: 13, lineHeight: 1.55 }}>
          Amplie o periodo ou remova filtros para ver onde a Urban esta detectando concentracao de demanda.
        </p>
      </div>
    </div>
  );
}

function MapLabel({ citySummaries }: { citySummaries: CitySummary[] }) {
  const label = citySummaries.length === 1 ? citySummaries[0].city : `${citySummaries.length || 1} cidades`;

  return (
    <div
      style={{
        position: "absolute",
        left: 28,
        top: 28,
        padding: "8px 10px",
        borderRadius: 8,
        background: "var(--app-surface-elevated, var(--app-surface))",
        border: "1px solid var(--app-divider)",
        color: "var(--app-text-muted)",
        fontSize: 12,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Icons.MapPin size={14} />
      {label}
    </div>
  );
}

function HeatLegend() {
  const items = [
    { label: "Muito quente", color: "var(--app-accent)" },
    { label: "Aquecida", color: "var(--app-warning)" },
    { label: "Monitorar", color: "var(--app-success)" },
  ];

  return (
    <div
      data-testid="host-event-demand-heatmap-legend"
      style={{
        position: "absolute",
        right: 28,
        bottom: 24,
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        justifyContent: "flex-end",
        maxWidth: "calc(100% - 56px)",
      }}
    >
      {items.map((item) => (
        <span
          key={item.label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            minHeight: 26,
            padding: "0 9px",
            borderRadius: 8,
            background: "var(--app-surface-elevated, var(--app-surface))",
            border: "1px solid var(--app-divider)",
            color: "var(--app-text-muted)",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: 999, background: item.color }} />
          {item.label}
        </span>
      ))}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          minHeight: 26,
          padding: "0 9px",
          borderRadius: 8,
          background: "var(--app-surface-elevated, var(--app-surface))",
          border: "1px solid var(--app-divider)",
          color: "var(--app-text-muted)",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        celula h3/geohash
      </span>
    </div>
  );
}

function RadarGridOverlay() {
  const rings = [34, 54, 74];

  return (
    <>
      {rings.map((size) => (
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
            border: "1px solid var(--app-divider)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />
      ))}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: 44,
          bottom: 44,
          width: 1,
          background: "var(--app-divider)",
          pointerEvents: "none",
        }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: "50%",
          left: 44,
          right: 44,
          height: 1,
          background: "var(--app-divider)",
          pointerEvents: "none",
        }}
      />
      <span
        className="event-demand-heatmap-radar-label"
        style={{
          position: "absolute",
          left: 30,
          bottom: 28,
          color: "var(--app-text-muted)",
          fontSize: 10,
          fontWeight: 750,
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        Radar geo
      </span>
    </>
  );
}

function NoGeoCanvas({
  eventsWithoutGeo,
  cellsWithoutGeo,
}: {
  eventsWithoutGeo: HostEventRadarItem[];
  cellsWithoutGeo: number;
}) {
  return (
    <div
      data-testid="host-event-demand-heatmap-no-cells"
      style={{
        position: "absolute",
        inset: 72,
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        color: "var(--app-text-muted)",
      }}
    >
      <div style={{ maxWidth: 360 }}>
        <Icons.MapPin size={24} />
        <p style={{ margin: "10px 0 4px", color: "var(--app-text)", fontSize: 14, fontWeight: 750 }}>
          Eventos sem celula geografica
        </p>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
          {eventsWithoutGeo.length > 0 || cellsWithoutGeo > 0
            ? "Use a lista sem geo abaixo para priorizar enriquecimento de endereco e centro da celula."
            : "Ha eventos no radar, mas o backend ainda nao retornou celulas de heatmap."}
        </p>
      </div>
    </div>
  );
}

function RegionCard({
  cell,
  selected,
  onSelectCell,
  onSelectEvent,
  onOpenEvent,
}: {
  cell: CellViewModel;
  selected: boolean;
  onSelectCell?: (cell: DemandHeatmapCell) => void;
  onSelectEvent?: (eventId: string) => void;
  onOpenEvent?: (eventId: string) => void;
}) {
  const heat = heatLabel(cell.score);

  return (
    <div
      data-testid="host-event-demand-heatmap-region-row"
      style={{
        border: selected ? "1px solid var(--app-accent)" : "1px solid var(--app-divider)",
        borderRadius: 8,
        padding: 12,
        background: selected ? "var(--app-accent-soft)" : "var(--app-surface)",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: "var(--app-text)", fontSize: 13, fontWeight: 800, overflowWrap: "anywhere" }}>
            {cell.regionLabel}
          </p>
          <p style={{ margin: "3px 0 0", color: "var(--app-text-muted)", fontSize: 11, lineHeight: 1.4 }}>
            {cell.cityLabel} - {cell.dominantCategory ?? "mix de eventos"}
          </p>
          <CellCodePill cell={cell} />
        </div>
        <AppBadge kind={heat.kind}>{heat.label}</AppBadge>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 10 }}>
        <MiniMetric label="Score" value={String(cell.score || "-")} />
        <MiniMetric label="Potencial" value={formatCompactCurrencyFromCents(cell.potentialCents)} />
        <MiniMetric label="Imoveis" value={String(cell.affectedPropertiesCount)} />
      </div>

      {cell.impactedProperties.length > 0 && (
        <p style={{ margin: "10px 0 0", color: "var(--app-text-muted)", fontSize: 11, lineHeight: 1.45 }}>
          Impacta {cell.impactedProperties.slice(0, 2).map((property) => property.name).join(", ")}
          {cell.impactedProperties.length > 2 ? ` +${cell.impactedProperties.length - 2}` : ""}.
        </p>
      )}

      {cell.topEvents.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {cell.topEvents.slice(0, 3).map((event) => (
            <button
              key={event.id}
              type="button"
              data-testid="host-event-demand-heatmap-event-link"
              onClick={() => onSelectEvent?.(event.id)}
              title={event.name}
              style={{
                height: 28,
                padding: "0 9px",
                borderRadius: 8,
                border: "1px solid var(--app-divider-strong)",
                background: selectedEventStyle(event.id, cell, selected),
                color: selected ? "var(--app-accent)" : "var(--app-text-muted)",
                fontSize: 11,
                fontWeight: 750,
                cursor: "pointer",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {event.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <AppButton type="button" size="sm" variant="secondary" onClick={() => onSelectCell?.(cell)}>
          Selecionar
        </AppButton>
        {cell.topEvents[0] && onOpenEvent && (
          <AppButton type="button" size="sm" variant="ghost" onClick={() => onOpenEvent(cell.topEvents[0].id)}>
            Abrir evento
          </AppButton>
        )}
      </div>
    </div>
  );
}

function CellCodePill({ cell }: { cell: CellViewModel }) {
  return (
    <p style={{ margin: "7px 0 0", color: "var(--app-text-muted)", fontSize: 10, lineHeight: 1.35 }}>
      <span style={{ fontWeight: 800, textTransform: "uppercase" }}>{cellKindLabel(cell.cellKind)}</span>{" "}
      <span style={{ fontFamily: "monospace", overflowWrap: "anywhere" }}>{cell.cellCode}</span>
      {!cell.hasGeo ? " - sem centro geo" : ""}
    </p>
  );
}

function CityPotentialPanel({ citySummaries }: { citySummaries: CitySummary[] }) {
  return (
    <div data-testid="host-event-demand-heatmap-city-summary" style={{ minWidth: 0 }}>
      <p style={{ margin: "0 0 10px", color: "var(--app-text)", fontSize: 13, fontWeight: 800 }}>
        Potencial por cidade
      </p>
      {citySummaries.length === 0 ? (
        <CompactEmpty text="Nenhum evento com cidade disponivel neste filtro." />
      ) : (
        <div
          className="event-demand-heatmap-city-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}
        >
          {citySummaries.map((city) => (
            <div
              key={city.key}
              style={{
                border: "1px solid var(--app-divider)",
                borderRadius: 8,
                padding: 12,
                background: "var(--app-surface-muted)",
                minWidth: 0,
              }}
            >
              <p style={{ margin: 0, color: "var(--app-text)", fontSize: 13, fontWeight: 800, overflowWrap: "anywhere" }}>
                {[city.city, city.state].filter(Boolean).join(" / ")}
              </p>
              <p style={{ margin: "5px 0 0", color: "var(--app-text)", fontSize: 18, fontWeight: 850, lineHeight: 1.2 }}>
                {formatCompactCurrencyFromCents(city.potentialCents)}
              </p>
              <p style={{ margin: "5px 0 0", color: "var(--app-text-muted)", fontSize: 11, lineHeight: 1.45 }}>
                {city.eventsCount} evento(s), {city.impactedPropertiesCount} imovel(is), {city.highDemandEventsCount} alta demanda
                {city.noGeoEventsCount > 0 ? `, ${city.noGeoEventsCount} sem geo` : ""}.
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImpactedPropertiesPanel({
  properties,
}: {
  properties: Array<{ id: string; name: string; eventsCount: number; potentialCents: number; bestScore: number }>;
}) {
  return (
    <div data-testid="host-event-demand-heatmap-property-impact" style={{ minWidth: 0 }}>
      <p style={{ margin: "0 0 10px", color: "var(--app-text)", fontSize: 13, fontWeight: 800 }}>
        Imoveis mais expostos
      </p>
      {properties.length === 0 ? (
        <CompactEmpty text="Nenhum imovel impactado retornado para os eventos deste filtro." />
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {properties.slice(0, 4).map((property) => (
            <div
              key={property.id}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: 10,
                alignItems: "center",
                border: "1px solid var(--app-divider)",
                borderRadius: 8,
                padding: 10,
                background: "var(--app-surface-muted)",
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", color: "var(--app-text)", fontSize: 12, fontWeight: 800, overflowWrap: "anywhere" }}>
                  {property.name}
                </span>
                <span style={{ display: "block", marginTop: 3, color: "var(--app-text-muted)", fontSize: 11 }}>
                  {property.eventsCount} evento(s), melhor score {property.bestScore || "-"}
                </span>
              </span>
              <span style={{ color: "var(--app-text)", fontSize: 12, fontWeight: 850 }}>
                {formatCompactCurrencyFromCents(property.potentialCents)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MissingGeoPanel({
  events,
  onSelectEvent,
  onOpenEvent,
}: {
  events: HostEventRadarItem[];
  onSelectEvent?: (eventId: string) => void;
  onOpenEvent?: (eventId: string) => void;
}) {
  if (events.length === 0) return null;

  return (
    <div
      data-testid="host-event-demand-heatmap-missing-geo"
      style={{
        display: "grid",
        gap: 10,
        padding: 18,
        borderTop: "1px solid var(--app-divider)",
        background: "var(--app-surface-muted)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: "var(--app-text)", fontSize: 13, fontWeight: 800 }}>
            Eventos sem geolocalizacao confiavel
          </p>
          <p style={{ margin: "4px 0 0", color: "var(--app-text-muted)", fontSize: 12, lineHeight: 1.45 }}>
            Eles entram no potencial por cidade, mas nao aparecem como bolha no mapa ate receberem latitude e longitude.
          </p>
        </div>
        <AppBadge kind="warn">{events.length} pendente(s)</AppBadge>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        {events.slice(0, 4).map((event) => (
          <div
            key={event.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "center",
              border: "1px solid var(--app-warning)",
              borderRadius: 8,
              padding: 10,
              background: "var(--app-surface)",
              minWidth: 0,
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", color: "var(--app-text)", fontSize: 12, fontWeight: 800, overflowWrap: "anywhere" }}>
                {event.name}
              </span>
              <span style={{ display: "block", marginTop: 3, color: "var(--app-text-muted)", fontSize: 11 }}>
                {event.city || "Cidade nao informada"} - {formatCompactCurrencyFromCents(event.eventRevenuePotentialCents)}
              </span>
            </span>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <AppButton type="button" size="sm" variant="secondary" onClick={() => onSelectEvent?.(event.id)}>
                Selecionar
              </AppButton>
              {onOpenEvent && (
                <AppButton type="button" size="sm" variant="ghost" onClick={() => onOpenEvent(event.id)}>
                  Detalhe
                </AppButton>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: "0 0 2px", color: "var(--app-text-muted)", fontSize: 9, fontWeight: 750, letterSpacing: 1, textTransform: "uppercase" }}>
        {label}
      </p>
      <p style={{ margin: 0, color: "var(--app-text)", fontSize: 12, fontWeight: 850, lineHeight: 1.25, overflowWrap: "anywhere" }}>
        {value}
      </p>
    </div>
  );
}

function CompactEmpty({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        border: "1px dashed var(--app-divider-strong)",
        color: "var(--app-text-muted)",
        fontSize: 12,
        lineHeight: 1.45,
        background: "var(--app-surface-muted)",
      }}
    >
      {text}
    </div>
  );
}

function collectUniqueProperties(events: HostEventRadarItem[]) {
  const properties = new Map<string, string>();
  events.forEach((event) => {
    event.impactedProperties.forEach((impact) => {
      properties.set(impact.propertyId, impact.propertyName);
    });
  });
  return Array.from(properties.entries()).map(([id, name]) => ({ id, name }));
}

function buildCitySummaries(events: HostEventRadarItem[]): CitySummary[] {
  const cityMap = new Map<
    string,
    {
      city: string;
      state?: string;
      eventsCount: number;
      potentialCents: number;
      properties: Set<string>;
      noGeoEventsCount: number;
      highDemandEventsCount: number;
    }
  >();

  events.forEach((event) => {
    const city = event.city || "Cidade nao informada";
    const key = `${city}-${event.state ?? ""}`;
    const current =
      cityMap.get(key) ??
      {
        city,
        state: event.state,
        eventsCount: 0,
        potentialCents: 0,
        properties: new Set<string>(),
        noGeoEventsCount: 0,
        highDemandEventsCount: 0,
      };

    current.eventsCount += 1;
    current.potentialCents += event.eventRevenuePotentialCents ?? 0;
    current.noGeoEventsCount += hasEventGeo(event) ? 0 : 1;
    current.highDemandEventsCount += (event.demandScore ?? event.urbanScore ?? 0) >= 80 ? 1 : 0;
    event.impactedProperties.forEach((impact) => current.properties.add(impact.propertyId));
    cityMap.set(key, current);
  });

  return Array.from(cityMap.entries())
    .map(([key, city]) => ({
      key,
      city: city.city,
      state: city.state,
      eventsCount: city.eventsCount,
      potentialCents: city.potentialCents,
      impactedPropertiesCount: city.properties.size,
      noGeoEventsCount: city.noGeoEventsCount,
      highDemandEventsCount: city.highDemandEventsCount,
    }))
    .sort((a, b) => b.potentialCents - a.potentialCents || b.eventsCount - a.eventsCount);
}

function buildPropertySummaries(events: HostEventRadarItem[]) {
  const propertyMap = new Map<
    string,
    { id: string; name: string; eventIds: Set<string>; potentialCents: number; bestScore: number }
  >();

  events.forEach((event) => {
    const score = event.demandScore ?? event.urbanScore ?? 0;
    event.impactedProperties.forEach((impact) => {
      const current =
        propertyMap.get(impact.propertyId) ??
        {
          id: impact.propertyId,
          name: impact.propertyName,
          eventIds: new Set<string>(),
          potentialCents: 0,
          bestScore: 0,
        };

      current.eventIds.add(event.id);
      current.potentialCents += impact.expectedIncrementalRevenueCents ?? impact.expectedRevenueCents ?? 0;
      current.bestScore = Math.max(current.bestScore, score, impact.propertyCaptureScore ?? 0);
      propertyMap.set(impact.propertyId, current);
    });
  });

  return Array.from(propertyMap.values())
    .map((property) => ({
      id: property.id,
      name: property.name,
      eventsCount: property.eventIds.size,
      potentialCents: property.potentialCents,
      bestScore: Math.round(property.bestScore),
    }))
    .sort((a, b) => b.potentialCents - a.potentialCents || b.bestScore - a.bestScore);
}

function cityLabelFromEvents(events: HostEventRadarItem[]): string {
  if (events.length === 0) return "Cidade nao informada";
  const counts = new Map<string, number>();
  events.forEach((event) => {
    const label = [event.city, event.state].filter(Boolean).join(" / ") || "Cidade nao informada";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Cidade nao informada";
}

function regionLabelFromCell(cell: DemandHeatmapCell): string {
  const pieces = cell.cellId
    .replace(/^h3[-_]?/i, "")
    .split(/[-_]/)
    .filter((part) => part.length > 1 && !/^\d+$/.test(part));

  const withoutState = pieces.length > 2 ? pieces.slice(1) : pieces;
  const label = withoutState.map(titleCase).join(" ").trim();
  return label || cell.dominantCategory || "Regiao monitorada";
}

function cellCodeFromCell(cell: DemandHeatmapCell): string {
  return cell.h3Index ?? cell.geohash ?? cell.cellId;
}

function cellKindFromCell(cell: DemandHeatmapCell): CellViewModel["cellKind"] {
  if (cell.h3Index) return "h3";
  if (cell.geohash) return "geohash";
  if (cell.dataStatus === "derived_from_events") return "derived";
  return "cell";
}

function cellKindLabel(kind: CellViewModel["cellKind"]) {
  if (kind === "h3") return "H3";
  if (kind === "geohash") return "Geohash";
  if (kind === "derived") return "Derivada";
  return "Celula";
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function hasEventGeo(event: HostEventRadarItem): boolean {
  return typeof event.latitude === "number" && Number.isFinite(event.latitude) && typeof event.longitude === "number" && Number.isFinite(event.longitude);
}

function hasHeatmapGeo(cell: DemandHeatmapCell): boolean {
  return Number.isFinite(cell.centerLat) && Number.isFinite(cell.centerLng);
}

function getBounds(cells: CellViewModel[]) {
  const geoCells = cells.filter((cell) => cell.hasGeo);
  const lats = geoCells.map((cell) => cell.centerLat);
  const lngs = geoCells.map((cell) => cell.centerLng);
  return {
    minLat: Math.min(...lats, -23.65),
    maxLat: Math.max(...lats, -23.45),
    minLng: Math.min(...lngs, -46.75),
    maxLng: Math.max(...lngs, -46.55),
  };
}

function project(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 50;
  if (max === min) return 50;
  return Math.min(88, Math.max(12, ((value - min) / (max - min)) * 76 + 12));
}

function heatLabel(score: number): { label: string; kind: "accent" | "warn" | "neutral" } {
  if (score >= 84) return { label: "Muito quente", kind: "accent" };
  if (score >= 74) return { label: "Aquecida", kind: "warn" };
  return { label: "Monitorar", kind: "neutral" };
}

function heatColor(score: number): { background: string; border: string; text: string } {
  if (score >= 84) {
    return {
      background: "var(--app-accent-soft)",
      border: "var(--app-accent)",
      text: "var(--app-accent)",
    };
  }
  if (score >= 74) {
    return {
      background: "var(--app-surface-muted)",
      border: "var(--app-warning)",
      text: "var(--app-warning)",
    };
  }
  return {
    background: "var(--app-surface-muted)",
    border: "var(--app-success)",
    text: "var(--app-success)",
  };
}

function selectedEventStyle(eventId: string, cell: CellViewModel, selected: boolean): string {
  if (!selected) return "var(--app-surface)";
  return cell.topEventIds.includes(eventId) ? "var(--app-accent-soft)" : "var(--app-surface)";
}
