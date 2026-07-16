"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppEmptyState,
  AppInput,
  AppPageShell,
  AppSectionHeader,
  AppSelect,
  EventCatalogCard,
  Icons,
} from "@/app/componentes/ui";
import {
  fetchHostEventCatalog,
  type EventCatalogItem,
  type HostEventCatalogResponse,
} from "@/app/service/api";
import { formatDateRange, formatTime } from "@/app/componentes/ui/event-intelligence";
import { dateAtLocalOffset, formatLocalDate } from "@/app/lib/date";

type ViewMode = "list" | "map" | "calendar";

function addDays(days: number) {
  return formatLocalDate(dateAtLocalOffset(days));
}

export default function EventsPage() {
  const router = useRouter();
  const [response, setResponse] = useState<HostEventCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  const [city, setCity] = useState("São Paulo");
  const [category, setCategory] = useState("all");
  const [source, setSource] = useState("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState(addDays(0));
  const [to, setTo] = useState(addDays(30));
  const [radiusKm, setRadiusKm] = useState("30");
  const [nearMyProperties, setNearMyProperties] = useState(false);
  const [highImpact, setHighImpact] = useState(false);
  const [view, setView] = useState<ViewMode>("list");
  const todayIso = addDays(0);
  const hasActiveFilters =
    search.trim().length > 0 ||
    category !== "all" ||
    source !== "all" ||
    nearMyProperties ||
    (nearMyProperties && radiusKm !== "30") ||
    highImpact ||
    from !== addDays(0) ||
    to !== addDays(30);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchHostEventCatalog({
        city,
        category: category === "all" ? undefined : category,
        source: source === "all" ? undefined : source,
        search,
        from,
        to,
        nearMyProperties,
        radiusKm: nearMyProperties ? radiusKm : undefined,
        highImpact,
      });
      setResponse(data);
    } catch (err) {
      console.error("Erro ao carregar catalogo de eventos", err);
      setError("Não foi possível carregar os eventos da cidade agora.");
    } finally {
      setLoading(false);
    }
  }, [category, city, from, highImpact, nearMyProperties, radiusKm, search, source, to]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents, reloadCount]);

  const events = useMemo(() => response?.items ?? [], [response?.items]);
  const groupedByDate = useMemo(() => groupEventsByDay(events), [events]);

  return (
    <AppPageShell maxWidth={1360}>
      <AppSectionHeader
        eyebrow="EVENTOS NA CIDADE"
        title={`Eventos em ${city || "sua cidade"}`}
        subtitle="Catálogo de eventos mapeados pela Urban AI com sinais de demanda, fonte e proximidade dos seus imóveis."
        actions={
          response?.mock ? (
            <AppBadge kind="warn">Mock contratual</AppBadge>
          ) : (
            <AppBadge kind="success">Dados Urban AI</AppBadge>
          )
        }
      />

      <AppCard variant="default" style={{ padding: 14, marginBottom: 22, overflow: "hidden" }}>
        <div
          className="urban-events-filter-grid"
          data-testid="host-events-filters"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
            gap: 12,
            alignItems: "end",
          }}
        >
          <div style={{ gridColumn: "span 2", minWidth: 0 }}>
            <AppInput
              label="Busca"
              placeholder="Nome, local ou bairro"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div style={{ gridColumn: "span 2", minWidth: 0 }}>
            <AppSelect label="Cidade" value={city} onChange={(event) => setCity(event.target.value)}>
              {(response?.cities?.length ? response.cities : ["São Paulo"]).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </AppSelect>
          </div>
          <div style={{ gridColumn: "span 2", minWidth: 0 }}>
            <AppSelect label="Categoria" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">Todas</option>
              {(response?.categories ?? []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </AppSelect>
          </div>
          <div style={{ gridColumn: "span 2", minWidth: 0 }}>
            <AppSelect label="Fonte" value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="all">Todas</option>
              {(response?.sources ?? []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </AppSelect>
          </div>
          <div style={{ gridColumn: "span 1", minWidth: 0 }}>
            <AppInput
              type="date"
              label="De"
              value={from}
              min={todayIso}
              onChange={(event) => {
                const nextFrom = event.target.value < todayIso ? todayIso : event.target.value;
                setFrom(nextFrom);
                if (to < nextFrom) setTo(nextFrom);
              }}
            />
          </div>
          <div style={{ gridColumn: "span 1", minWidth: 0 }}>
            <AppInput type="date" label="Até" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
          </div>
          <div style={{ gridColumn: "span 1", minWidth: 0 }}>
            <AppSelect
              label="Raio"
              value={radiusKm}
              disabled={!nearMyProperties}
              onChange={(event) => setRadiusKm(event.target.value)}
            >
              <option value="2">2 km</option>
              <option value="5">5 km</option>
              <option value="10">10 km</option>
              <option value="30">30 km</option>
              <option value="50">50 km</option>
            </AppSelect>
          </div>
          <div style={{ gridColumn: "span 1", minWidth: 0 }}>
            <AppButton type="button" variant="secondary" fullWidth onClick={() => setReloadCount((count) => count + 1)}>
              Buscar
            </AppButton>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <QuickFilter active={nearMyProperties} onClick={() => setNearMyProperties((value) => !value)}>
              Perto dos meus imóveis
            </QuickFilter>
            <QuickFilter active={highImpact} onClick={() => setHighImpact((value) => !value)}>
              Alto impacto
            </QuickFilter>
            <QuickFilter onClick={() => setWeekendRange()}>
              Este fim de semana
            </QuickFilter>
            <QuickFilter onClick={() => {
              setFrom(addDays(0));
              setTo(addDays(30));
            }}>
              Próximos 30 dias
            </QuickFilter>
          </div>
          <SegmentedView value={view} onChange={setView} />
        </div>
      </AppCard>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ApiErrorState
          title="Não conseguimos carregar os eventos"
          body={error}
          onRetry={() => setReloadCount((count) => count + 1)}
        />
      ) : events.length === 0 ? (
        <AppEmptyState
          eyebrow="SEM EVENTOS"
          title="Nenhum evento encontrado"
          body="Ajuste período, categoria ou filtros rápidos para ampliar o calendário monitorado."
          icon={<Icons.Calendar size={32} />}
          action={
            <AppButton type="button" variant="secondary" onClick={hasActiveFilters ? resetFilters : () => setReloadCount((count) => count + 1)}>
              {hasActiveFilters ? "Limpar filtros" : "Atualizar busca"}
            </AppButton>
          }
        />
      ) : view === "map" ? (
        <CatalogMap events={events} onOpen={(eventId) => router.push(`/events/${eventId}`)} />
      ) : view === "calendar" ? (
        <CalendarView groupedByDate={groupedByDate} onOpen={(eventId) => router.push(`/events/${eventId}`)} />
      ) : (
        <div
          data-testid="host-events-list"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
            gap: 18,
          }}
        >
          {events.map((event) => (
            <EventCatalogCard
              key={event.id}
              event={event}
              onOpen={() => router.push(`/events/${event.id}`)}
              onOpenImpact={() => router.push(`/event-radar?eventId=${encodeURIComponent(event.id)}`)}
            />
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 980px) {
          .urban-events-filter-grid > * {
            grid-column: span 12 !important;
          }
        }
        @media (max-width: 420px) {
          .urban-events-filter-grid {
            gap: 12px !important;
          }
        }
      `}</style>
    </AppPageShell>
  );

  function setWeekendRange() {
    const today = new Date();
    const day = today.getDay();
    const daysUntilSaturday = (6 - day + 7) % 7;
    const saturday = new Date(today);
    saturday.setHours(0, 0, 0, 0);
    saturday.setDate(today.getDate() + daysUntilSaturday);
    const sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1);
    setFrom(formatLocalDate(saturday));
    setTo(formatLocalDate(sunday));
  }

  function resetFilters() {
    setSearch("");
    setCategory("all");
    setSource("all");
    setNearMyProperties(false);
    setRadiusKm("30");
    setHighImpact(false);
    setFrom(addDays(0));
    setTo(addDays(30));
    setReloadCount((count) => count + 1);
  }
}

function QuickFilter({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 32,
        padding: "0 12px",
        borderRadius: 999,
        border: active ? "1px solid rgba(232, 80, 10, 0.35)" : "1px solid var(--app-divider-strong)",
        background: active ? "rgba(232, 80, 10, 0.10)" : "var(--app-surface)",
        color: active ? "var(--app-accent)" : "var(--app-text-muted)",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        minHeight: 32,
        maxWidth: "100%",
        whiteSpace: "normal",
        lineHeight: 1.2,
      }}
    >
      {children}
    </button>
  );
}

function SegmentedView({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}) {
  const options: Array<{ value: ViewMode; label: string }> = [
    { value: "list", label: "Lista" },
    { value: "map", label: "Mapa" },
    { value: "calendar", label: "Calendário" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Visualizacao"
      style={{
        display: "inline-flex",
        padding: 3,
        border: "1px solid var(--app-divider-strong)",
        borderRadius: 8,
        background: "var(--app-surface-muted)",
      }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          style={{
            height: 30,
            padding: "0 12px",
            border: 0,
            borderRadius: 6,
            background: value === option.value ? "var(--app-surface)" : "transparent",
            color: value === option.value ? "var(--app-text)" : "var(--app-text-muted)",
            fontSize: 12,
            fontWeight: 750,
            cursor: "pointer",
            boxShadow: value === option.value ? "var(--app-shadow-card)" : undefined,
            minWidth: 0,
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function CatalogMap({
  events,
  onOpen,
}: {
  events: EventCatalogItem[];
  onOpen: (eventId: string) => void;
}) {
  const geoEvents = events.filter(hasCatalogGeo);
  const missingGeoEvents = events.filter((event) => !hasCatalogGeo(event));
  const bounds = getCatalogBounds(geoEvents);

  return (
    <AppCard variant="default" style={{ padding: 0, overflow: "hidden" }}>
      <div
        className="host-events-map-canvas"
        style={{
          minHeight: 520,
          position: "relative",
          background:
            "linear-gradient(0deg, rgba(14,17,22,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(14,17,22,0.035) 1px, transparent 1px), #F6F7F9",
          backgroundSize: "34px 34px",
        }}
      >
        <div style={{ position: "absolute", top: 18, left: 18, maxWidth: "calc(100% - 36px)" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <AppBadge kind="accent">{geoEvents.length} no mapa</AppBadge>
            {missingGeoEvents.length > 0 && <AppBadge kind="warn">{missingGeoEvents.length} sem geo</AppBadge>}
          </div>
        </div>
        <MapRadarOverlay />
        {geoEvents.length === 0 ? (
          <div
            data-testid="host-event-map-no-geo"
            style={{
              position: "absolute",
              inset: 72,
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              color: "var(--app-text-muted)",
            }}
          >
            <div style={{ maxWidth: 380 }}>
              <Icons.MapPin size={24} />
              <p style={{ margin: "10px 0 4px", color: "var(--app-text)", fontSize: 15, fontWeight: 750 }}>
                Eventos aguardando geolocalização
              </p>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
                A lista e o calendário continuam disponíveis enquanto a coordenada do venue é enriquecida.
              </p>
            </div>
          </div>
        ) : (
          geoEvents.map((event) => {
            const score = eventScore(event);
            const color = eventHeatColor(score);
            const left = projectCatalog(event.longitude as number, bounds.minLng, bounds.maxLng);
            const top = 100 - projectCatalog(event.latitude as number, bounds.minLat, bounds.maxLat);

            return (
              <button
                key={event.id}
                type="button"
                data-testid="host-event-map-pin"
                data-geo-cell={catalogGeoCellId(event)}
                onClick={() => onOpen(event.id)}
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  top: `${top}%`,
                  transform: "translate(-50%, -50%)",
                  border: `1px solid ${color.border}`,
                  background: color.background,
                  color: color.text,
                  borderRadius: 8,
                  padding: "8px 10px",
                  width: "min(220px, 46vw)",
                  textAlign: "left",
                  cursor: "pointer",
                  boxShadow: "0 12px 28px rgba(14, 17, 22, 0.13)",
                  minWidth: 0,
                }}
              >
                <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: 800 }}>
                    {event.name}
                  </span>
                  <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 850 }}>{score || "-"}</span>
                </span>
                <span style={{ display: "block", marginTop: 3, fontSize: 10, fontWeight: 700, opacity: 0.82 }}>
                  {catalogGeoCellId(event)}
                </span>
              </button>
            );
          })
        )}
      </div>
      {missingGeoEvents.length > 0 && <CatalogMissingGeoStrip events={missingGeoEvents} onOpen={onOpen} />}
      <style>{`
        @media (max-width: 640px) {
          .host-events-map-canvas {
            min-height: 420px !important;
          }
          .host-events-map-canvas [data-testid="host-event-map-pin"] {
            width: min(176px, 58vw) !important;
          }
          .host-events-missing-geo-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </AppCard>
  );
}

function MapRadarOverlay() {
  return (
    <>
      {[36, 58, 80].map((size) => (
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
            border: "1px solid rgba(14, 17, 22, 0.07)",
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />
      ))}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 42,
          right: 42,
          top: "50%",
          height: 1,
          background: "rgba(14, 17, 22, 0.06)",
          pointerEvents: "none",
        }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 42,
          bottom: 42,
          left: "50%",
          width: 1,
          background: "rgba(14, 17, 22, 0.06)",
          pointerEvents: "none",
        }}
      />
    </>
  );
}

function CatalogMissingGeoStrip({
  events,
  onOpen,
}: {
  events: EventCatalogItem[];
  onOpen: (eventId: string) => void;
}) {
  return (
    <div
      data-testid="host-event-map-missing-geo"
      style={{
        padding: 16,
        borderTop: "1px solid var(--app-divider)",
        background: "rgba(200, 129, 14, 0.08)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: "var(--app-text)", fontSize: 13, fontWeight: 800 }}>
            Fora do mapa por enquanto
          </p>
          <p style={{ margin: "4px 0 0", color: "var(--app-text-muted)", fontSize: 12, lineHeight: 1.45 }}>
            Eventos sem latitude/longitude seguem acionáveis na lista e no calendário.
          </p>
        </div>
        <AppBadge kind="warn">{events.length} {events.length === 1 ? "pendente" : "pendentes"}</AppBadge>
      </div>
      <div className="host-events-missing-geo-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        {events.slice(0, 4).map((event) => (
          <button
            key={event.id}
            type="button"
            onClick={() => onOpen(event.id)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "center",
              border: "1px solid rgba(200, 129, 14, 0.22)",
              borderRadius: 8,
              padding: 10,
              background: "rgba(255, 255, 255, 0.72)",
              color: "var(--app-text)",
              textAlign: "left",
              cursor: "pointer",
              minWidth: 0,
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 12, fontWeight: 800, overflowWrap: "anywhere" }}>
                {event.name}
              </span>
              <span style={{ display: "block", marginTop: 3, color: "var(--app-text-muted)", fontSize: 11 }}>
                {[event.venueName, event.city].filter(Boolean).join(" / ") || "Venue pendente"}
              </span>
            </span>
            <Icons.ChevronRight size={16} style={{ flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function CalendarView({
  groupedByDate,
  onOpen,
}: {
  groupedByDate: Array<{ day: string; events: EventCatalogItem[] }>;
  onOpen: (eventId: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {groupedByDate.map((group) => (
        <AppCard key={group.day} variant="default" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, color: "var(--app-text)", fontSize: 16, fontWeight: 750, letterSpacing: 0 }}>
              {formatDateRange(group.day, null)}
            </h3>
            <AppBadge kind="neutral">{group.events.length} {group.events.length === 1 ? "evento" : "eventos"}</AppBadge>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {group.events.map((event) => (
              <button
                key={event.id}
                type="button"
                data-testid="host-event-calendar-item"
                onClick={() => onOpen(event.id)}
                style={{
                  width: "100%",
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 12,
                  alignItems: "center",
                  border: "1px solid var(--app-divider)",
                  background: "var(--app-surface)",
                  borderRadius: 8,
                  padding: 12,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", color: "var(--app-text)", fontSize: 14, fontWeight: 750, overflowWrap: "anywhere" }}>
                    {event.name}
                  </span>
                <span style={{ display: "block", color: "var(--app-text-muted)", fontSize: 12, marginTop: 3 }}>
                  {formatTime(event.startsAt)} - {[event.venueName, event.city].filter(Boolean).join(" / ")}
                </span>
              </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <AppBadge kind={eventScore(event) >= 80 ? "accent" : "neutral"}>{eventScore(event) || "-"}</AppBadge>
                  <Icons.ChevronRight size={16} />
                </span>
              </button>
            ))}
          </div>
        </AppCard>
      ))}
    </div>
  );
}

function groupEventsByDay(events: EventCatalogItem[]) {
  const groups = new Map<string, EventCatalogItem[]>();
  events.forEach((event) => {
    const day = event.startsAt.slice(0, 10);
    const current = groups.get(day) ?? [];
    current.push(event);
    groups.set(day, current);
  });
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayEvents]) => ({ day, events: dayEvents }));
}

function hasCatalogGeo(event: EventCatalogItem): boolean {
  return typeof event.latitude === "number" && Number.isFinite(event.latitude) && typeof event.longitude === "number" && Number.isFinite(event.longitude);
}

function getCatalogBounds(events: EventCatalogItem[]) {
  const lats = events.map((event) => event.latitude as number).filter(Number.isFinite);
  const lngs = events.map((event) => event.longitude as number).filter(Number.isFinite);
  return {
    minLat: Math.min(...lats, -23.75),
    maxLat: Math.max(...lats, -23.45),
    minLng: Math.min(...lngs, -46.78),
    maxLng: Math.max(...lngs, -46.55),
  };
}

function projectCatalog(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || max === min) return 50;
  return Math.min(86, Math.max(14, ((value - min) / (max - min)) * 72 + 14));
}

function eventScore(event: EventCatalogItem): number {
  return Math.round(event.demandScore ?? event.urbanScore ?? 0);
}

function eventHeatColor(score: number): { background: string; border: string; text: string } {
  if (score >= 84) {
    return { background: "rgba(232, 80, 10, 0.16)", border: "rgba(232, 80, 10, 0.44)", text: "#A33A07" };
  }
  if (score >= 74) {
    return { background: "rgba(200, 129, 14, 0.16)", border: "rgba(200, 129, 14, 0.38)", text: "#8A5A0A" };
  }
  return { background: "rgba(22, 160, 107, 0.14)", border: "rgba(22, 160, 107, 0.32)", text: "#10724D" };
}

function catalogGeoCellId(event: EventCatalogItem): string {
  if (!hasCatalogGeo(event)) return "sem-geo";
  const lat = Math.round((event.latitude as number) * 100);
  const lng = Math.round((event.longitude as number) * 100);
  return `geo-${lat}-${lng}`;
}

function LoadingBlock() {
  return (
    <div data-testid="host-events-loading" role="status" aria-live="polite" style={{ display: "grid", gap: 16 }}>
      <div style={{ minHeight: 160, display: "grid", placeItems: "center", gap: 12, textAlign: "center" }}>
        <Spinner />
        <p style={{ margin: 0, color: "var(--app-text-muted)", fontSize: 13 }}>
          Carregando eventos mapeados pela Urban AI…
        </p>
      </div>
      <div
        aria-hidden
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14,
        }}
      >
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            style={{
              minHeight: 220,
              borderRadius: 8,
              border: "1px solid var(--app-divider)",
              background:
                "linear-gradient(90deg, var(--app-surface-muted) 0%, var(--app-surface) 45%, var(--app-surface-muted) 90%)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ApiErrorState({
  title,
  body,
  onRetry,
}: {
  title: string;
  body: string;
  onRetry: () => void;
}) {
  return (
    <AppEmptyState
      eyebrow="ALGO DEU ERRADO"
      title={title}
      body={body}
      icon={<Icons.AlertCircle size={32} />}
      action={
        <AppButton type="button" variant="primary" onClick={onRetry}>
          Tentar de novo
        </AppButton>
      }
    />
  );
}

function Spinner() {
  return (
    <span
      role="status"
      aria-label="Carregando"
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        border: "3px solid var(--app-accent-soft)",
        borderTopColor: "var(--app-accent)",
        animation: "events-spin 0.9s linear infinite",
      }}
    >
      <style>{`@keyframes events-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}
