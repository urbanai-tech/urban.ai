"use client";

import React, { useMemo } from "react";
import type { DemandHeatmapCell, HostEventRadarItem } from "@/app/service/api";
import { AppBadge } from "../AppBadge";
import { AppButton } from "../AppButton";
import { AppCard } from "../AppCard";
import * as Icons from "../Icons";
import { formatCompactCurrencyFromCents } from "./formatters";
import styles from "./EventDemandHeatmapPlaceholder.module.css";

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
    <AppCard as="section" variant="default" className={styles.heatmapCard}>
      <div
        data-testid="host-event-demand-heatmap-header"
        className={styles.heatmapHeader}
      >
        <div className={styles.shrinkableBlock}>
          <p className={`urban-app-eyebrow-muted ${styles.appEyebrowMuted}`}>
            HEATMAP DE DEMANDA
          </p>
          <h3 className={styles.headerSubheading}>
            Regiões com maior potencial
          </h3>
        </div>
        <div className={styles.headerBadgeRow}>
          <AppBadge kind={cellsWithStats.length > 0 ? "accent" : "neutral"}>
            {geoCells.length} {geoCells.length === 1 ? "célula geo" : "células geo"}
          </AppBadge>
          {cellsWithoutGeo.length > 0 && (
            <AppBadge kind="warn">
              {cellsWithoutGeo.length} {cellsWithoutGeo.length === 1 ? "célula sem centro" : "células sem centro"}
            </AppBadge>
          )}
          {eventsWithoutGeo.length > 0 && <AppBadge kind="warn">{eventsWithoutGeo.length} sem geo</AppBadge>}
        </div>
      </div>

      {!hasActionableData ? (
        <HeatmapEmptyState />
      ) : (
        <>
          <div
            className={`event-demand-heatmap-layout ${styles.heatmapLayout}`}
          >
            <div
              className={`event-demand-heatmap-canvas ${styles.heatmapCanvas}`}
              data-testid="host-event-demand-heatmap"
            >
              <div
                aria-hidden
                className={styles.canvasFrame}
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
                      className={`event-demand-heatmap-cell ${styles.heatCell}`}
                      data-testid="host-event-demand-heatmap-cell"
                      data-region={cell.regionLabel}
                      data-cell-code={cell.cellCode}
                      onClick={() => onSelectCell?.(cell)}
                      title={`${cell.regionLabel}: ${cell.cellCode}, score ${cell.score}, ${cell.eventsCount} ${cell.eventsCount === 1 ? "evento" : "eventos"}`}
                      aria-label={`${cell.regionLabel}, célula ${cell.cellCode}, score de demanda ${cell.score}, ${cell.affectedPropertiesCount} ${cell.affectedPropertiesCount === 1 ? "imóvel impactado" : "imóveis impactados"}`}
                      style={{ left: `${left}%`, top: `${top}%`, width: size, height: size, border: isSelected ? `2px solid ${color.text}` : `1px solid ${color.border}`, background: color.background, color: color.text, boxShadow: isSelected ? "0 0 0 5px var(--app-accent-soft), var(--app-shadow-overlay)" : "var(--app-shadow-elevated)" }}
                    >
                      <span className={styles.heatCellScore}>{cell.score || "-"}</span>
                      <span className={styles.heatCellLevel}>
                        {cell.affectedPropertiesCount === 1 ? "1 imóvel" : `${cell.affectedPropertiesCount} imóveis`}
                      </span>
                      <span
                        aria-hidden
                        className={styles.heatCellRegionName}
                      >
                        {cell.cellKind === "h3" ? "h3" : "geo"}
                      </span>
                      <span
                        className={`event-demand-heatmap-pin-label ${styles.heatCellPinLabel}`}
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
              className={styles.regionPanel}
            >
              <p className={styles.panelTitle}>
                Prioridade por região
              </p>
              {hotCells.length === 0 ? (
                <CompactEmpty text="Ainda não há células geograficas para ranquear." />
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
            className={`event-demand-heatmap-insights ${styles.insightsGrid}`}
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
    <AppCard as="section" variant="default" className={styles.loadingStateCard}>
      <div data-testid="host-event-demand-heatmap-loading" role="status" aria-live="polite" className={styles.loadingContent}>
        <div className={styles.heatmapLoadingStateRow}>
          <div>
            <p className={`urban-app-eyebrow-muted ${styles.appEyebrowMuted}`}>
              HEATMAP DE DEMANDA
            </p>
            <h3 className={styles.heatmapLoadingStateSubheading}>
              Calculando regiões quentes…
            </h3>
          </div>
          <AppBadge kind="neutral">Carregando</AppBadge>
        </div>
        <div
          aria-hidden
          className={styles.heatmapLoadingStatePanel}
        />
      </div>
    </AppCard>
  );
}

function HeatmapErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <AppCard as="section" variant="default" className={styles.errorStateCard}>
      <div data-testid="host-event-demand-heatmap-error" className={styles.errorHeaderRow}>
        <div className={styles.shrinkableBlock}>
          <AppBadge kind="warn">Heatmap indisponível</AppBadge>
          <h3 className={styles.heatmapErrorStateSubheading}>
            Não conseguimos carregar as regiões agora
          </h3>
          <p className={styles.heatmapErrorStateText}>
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
      className={styles.emptyStateCanvas}
    >
      <div className={styles.heatmapEmptyStateBox}>
        <Icons.MapPin size={24} className={styles.emptyStateIcon} />
        <p className={styles.heatmapEmptyStateText}>
          Sem regiões quentes neste filtro
        </p>
        <p className={styles.heatmapErrorStateText}>
          Amplie o período ou remova filtros para ver onde a Urban está detectando concentração de demanda.
        </p>
      </div>
    </div>
  );
}

function MapLabel({ citySummaries }: { citySummaries: CitySummary[] }) {
  const label = citySummaries.length === 1 ? citySummaries[0].city : `${citySummaries.length || 1} cidades`;

  return (
    <div
      className={styles.mapNoticeLabel}
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
      className={styles.heatLegend}
    >
      {items.map((item) => (
        <span
          key={item.label}
          className={styles.heatLegendLabel}
        >
          <span className={styles.heatLegendDot} style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
      <span
        className={styles.heatLegendNote}
      >
        célula h3/geohash
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
          className={styles.radarRing} style={{ width: `${size}%` }}
        />
      ))}
      <span
        aria-hidden
        className={styles.radarVerticalLine}
      />
      <span
        aria-hidden
        className={styles.radarHorizontalLine}
      />
      <span
        className={`event-demand-heatmap-radar-label ${styles.radarCaption}`}
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
      className={styles.noGeoCanvas}
    >
      <div className={styles.noGeoCanvasBox}>
        <Icons.MapPin size={24} />
        <p className={styles.noGeoCanvasText}>
          Eventos sem célula geografica
        </p>
        <p className={styles.noGeoCanvasHint}>
          {eventsWithoutGeo.length > 0 || cellsWithoutGeo > 0
            ? "Use a lista sem geo abaixo para priorizar enriquecimento de endereço e centro da célula."
            : "Há eventos no radar, mas o backend ainda não retornou células de heatmap."}
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
      className={`${styles.regionCard} ${selected ? styles.regionCardSelected : styles.regionCardIdle}`}
    >
      <div className={styles.regionCardHeader}>
        <div className={styles.shrinkableBlock}>
          <p className={styles.regionCardName}>
            {cell.regionLabel}
          </p>
          <p className={styles.regionCardSubtitle}>
            {cell.cityLabel} - {cell.dominantCategory ?? "mix de eventos"}
          </p>
          <CellCodePill cell={cell} />
        </div>
        <AppBadge kind={heat.kind}>{heat.label}</AppBadge>
      </div>

      <div className={styles.regionCardGrid}>
        <MiniMetric label="Score" value={String(cell.score || "-")} />
        <MiniMetric label="Potencial" value={formatCompactCurrencyFromCents(cell.potentialCents)} />
        <MiniMetric label="Imóveis" value={String(cell.affectedPropertiesCount)} />
      </div>

      {cell.impactedProperties.length > 0 && (
        <p className={styles.regionCardImpactNote}>
          Impacta {cell.impactedProperties.slice(0, 2).map((property) => property.name).join(", ")}
          {cell.impactedProperties.length > 2 ? ` +${cell.impactedProperties.length - 2}` : ""}.
        </p>
      )}

      {cell.topEvents.length > 0 && (
        <div className={styles.regionCardEventLinks}>
          {cell.topEvents.slice(0, 3).map((event) => (
            <button
              key={event.id}
              type="button"
              data-testid="host-event-demand-heatmap-event-link"
              onClick={() => onSelectEvent?.(event.id)}
              title={event.name}
              className={styles.regionCardEventLink} style={{ background: selectedEventStyle(event.id, cell, selected), color: selected ? "var(--app-accent)" : "var(--app-text-muted)" }}
            >
              {event.name}
            </button>
          ))}
        </div>
      )}

      <div className={styles.regionCardActions}>
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
    <p className={styles.cellCodeLine}>
      <span className={styles.cellCodeKind}>{cellKindLabel(cell.cellKind)}</span>{" "}
      <span className={styles.cellCodeValue}>{cell.cellCode}</span>
      {!cell.hasGeo ? " - sem centro geo" : ""}
    </p>
  );
}

function CityPotentialPanel({ citySummaries }: { citySummaries: CitySummary[] }) {
  return (
    <div data-testid="host-event-demand-heatmap-city-summary" className={styles.shrinkableBlock}>
      <p className={styles.insightPanelTitle}>
        Potencial por cidade
      </p>
      {citySummaries.length === 0 ? (
        <CompactEmpty text="Nenhum evento com cidade disponível neste filtro." />
      ) : (
        <div
          className={`event-demand-heatmap-city-grid ${styles.citySummaryGrid}`}
        >
          {citySummaries.map((city) => (
            <div
              key={city.key}
              className={styles.citySummaryCard}
            >
              <p className={styles.regionCardName}>
                {[city.city, city.state].filter(Boolean).join(" / ")}
              </p>
              <p className={styles.citySummaryValue}>
                {formatCompactCurrencyFromCents(city.potentialCents)}
              </p>
              <p className={styles.citySummaryNote}>
                {city.eventsCount} {city.eventsCount === 1 ? "evento" : "eventos"}, {city.impactedPropertiesCount} {city.impactedPropertiesCount === 1 ? "imóvel" : "imóveis"}, {city.highDemandEventsCount} alta demanda
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
    <div data-testid="host-event-demand-heatmap-property-impact" className={styles.shrinkableBlock}>
      <p className={styles.insightPanelTitle}>
        Imóveis mais expostos
      </p>
      {properties.length === 0 ? (
        <CompactEmpty text="Nenhum imóvel impactado retornado para os eventos deste filtro." />
      ) : (
        <div className={styles.propertyList}>
          {properties.slice(0, 4).map((property) => (
            <div
              key={property.id}
              className={styles.propertyRow}
            >
              <span className={styles.shrinkableBlock}>
                <span className={styles.propertyName}>
                  {property.name}
                </span>
                <span className={styles.propertyMeta}>
                  {property.eventsCount} {property.eventsCount === 1 ? "evento" : "eventos"}, melhor score {property.bestScore || "-"}
                </span>
              </span>
              <span className={styles.propertyValue}>
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
      className={styles.missingGeoPanel}
    >
      <div className={styles.missingGeoHeader}>
        <div className={styles.shrinkableBlock}>
          <p className={styles.panelTitle}>
            Eventos sem geolocalização confiável
          </p>
          <p className={styles.missingGeoHint}>
            Eles entram no potencial por cidade, mas não aparecem como bolha no mapa até receberem latitude e longitude.
          </p>
        </div>
        <AppBadge kind="warn">{events.length} {events.length === 1 ? "pendente" : "pendentes"}</AppBadge>
      </div>

      <div className={styles.missingGeoPanelGrid}>
        {events.slice(0, 4).map((event) => (
          <div
            key={event.id}
            className={styles.missingGeoCell}
          >
            <span className={styles.shrinkableBlock}>
              <span className={styles.propertyName}>
                {event.name}
              </span>
              <span className={styles.propertyMeta}>
                {event.city || "Cidade não informada"} - {formatCompactCurrencyFromCents(event.eventRevenuePotentialCents)}
              </span>
            </span>
            <div className={styles.missingGeoCellMetrics}>
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
    <div className={styles.shrinkableBlock}>
      <p className={styles.miniMetricLabel}>
        {label}
      </p>
      <p className={styles.miniMetricValue}>
        {value}
      </p>
    </div>
  );
}

function CompactEmpty({ text }: { text: string }) {
  return (
    <div
      className={styles.compactEmptyPanel}
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
    const city = event.city || "Cidade não informada";
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
  if (events.length === 0) return "Cidade não informada";
  const counts = new Map<string, number>();
  events.forEach((event) => {
    const label = [event.city, event.state].filter(Boolean).join(" / ") || "Cidade não informada";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Cidade não informada";
}

function regionLabelFromCell(cell: DemandHeatmapCell): string {
  const pieces = cell.cellId
    .replace(/^h3[-_]?/i, "")
    .split(/[-_]/)
    .filter((part) => part.length > 1 && !/^\d+$/.test(part));

  const withoutState = pieces.length > 2 ? pieces.slice(1) : pieces;
  const label = withoutState.map(titleCase).join(" ").trim();
  return label || cell.dominantCategory || "Região monitorada";
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
  return "Célula";
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
      text: "var(--app-warning-text)",
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
