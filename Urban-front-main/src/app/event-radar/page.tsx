"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppCardHeader,
  AppEmptyState,
  AppInput,
  AppMetricCard,
  AppPageShell,
  AppSectionHeader,
  AppSelect,
  EventDemandHeatmapPlaceholder,
  EventImpactTable,
  EventRadarCard,
  Icons,
  PriceAbsorptionScenarios,
  type AppBadgeKind,
} from "@/app/componentes/ui";
import {
  fetchHostEventRadar,
  getPropriedadesDropdownList,
  simulateHostEventPricing,
  type DemandHeatmapCell,
  type EventPropertyImpact,
  type HostEventConfidence,
  type HostEventRadarItem,
  type HostEventRadarResponse,
  type PropertyDropdown,
} from "@/app/service/api";
import PropertySelect from "@/app/componentes/PropertySelect";
import {
  confidenceBadgeKind,
  confidenceLabel,
  formatCompactCurrencyFromCents,
  formatDateRange,
  formatTime,
} from "@/app/componentes/ui/event-intelligence";
import { dateAtLocalOffset, formatLocalDate } from "@/app/lib/date";

function addDays(days: number) {
  return formatLocalDate(dateAtLocalOffset(days));
}

export default function EventRadarPage() {
  return (
    <Suspense
      fallback={
        <AppPageShell>
          <div style={{ minHeight: 420, display: "grid", placeItems: "center" }}>
            <Spinner />
          </div>
        </AppPageShell>
      }
    >
      <EventRadarContent />
    </Suspense>
  );
}

function EventRadarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdFromQuery = searchParams.get("eventId") ?? "";

  const [response, setResponse] = useState<HostEventRadarResponse | null>(null);
  const [properties, setProperties] = useState<PropertyDropdown[]>([]);
  const [selectedEventId, setSelectedEventId] = useState(eventIdFromQuery);
  const [selectedImpact, setSelectedImpact] = useState<EventPropertyImpact | null>(null);
  const [from, setFrom] = useState(addDays(0));
  const [to, setTo] = useState(addDays(45));
  const [propertyId, setPropertyId] = useState("all");
  const [category, setCategory] = useState("all");
  const [radiusKm, setRadiusKm] = useState("30");
  const [confidence, setConfidence] = useState<HostEventConfidence | "all">("all");
  const [loading, setLoading] = useState(true);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propertyOptionsError, setPropertyOptionsError] = useState<string | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [simulating, setSimulating] = useState(false);
  const todayIso = addDays(0);
  const hasActiveFilters =
    propertyId !== "all" ||
    category !== "all" ||
    radiusKm !== "30" ||
    confidence !== "all" ||
    from !== addDays(0) ||
    to !== addDays(45);

  const loadRadar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchHostEventRadar({
        from,
        to,
        propertyId: propertyId === "all" ? undefined : propertyId,
        category: category === "all" ? undefined : category,
        radiusKm,
        confidence: confidence === "all" ? undefined : confidence,
      });
      setResponse(data);
    } catch (err) {
      console.error("Erro ao carregar radar de eventos", err);
      setError("Não foi possível carregar o radar de eventos agora.");
    } finally {
      setLoading(false);
    }
  }, [category, confidence, from, propertyId, radiusKm, to]);

  useEffect(() => {
    loadRadar();
  }, [loadRadar, reloadCount]);

  useEffect(() => {
    if (eventIdFromQuery) setSelectedEventId(eventIdFromQuery);
  }, [eventIdFromQuery]);

  useEffect(() => {
    async function loadProperties() {
      try {
        setPropertiesLoading(true);
        setPropertyOptionsError(null);
        const data = await getPropriedadesDropdownList();
        setProperties(data);
      } catch (err) {
        console.error("Erro ao carregar imóveis para o radar", err);
        setPropertyOptionsError("Não conseguimos carregar seus imóveis para filtro agora.");
      } finally {
        setPropertiesLoading(false);
      }
    }
    loadProperties();
  }, []);

  useEffect(() => {
    if (!response?.events.length) {
      setSelectedEventId("");
      setSelectedImpact(null);
      return;
    }

    const selected =
      response.events.find((event) => event.id === selectedEventId) ??
      response.events.find((event) => event.id === eventIdFromQuery) ??
      response.events[0];
    setSelectedEventId(selected.id);
    setSelectedImpact(selected.impactedProperties[0] ?? null);
  }, [eventIdFromQuery, response?.events, selectedEventId]);

  const events = useMemo(() => response?.events ?? [], [response?.events]);
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? events[0] ?? null;
  const categories = useMemo(
    () => Array.from(new Set(events.map((event) => event.category).filter(Boolean))) as string[],
    [events],
  );
  const hasNonPersistedEvidence = events.some((event) => {
    const intelligence = event.intelligence;
    return !intelligence || intelligence.dataStatus !== "persisted" || !intelligence.jobRunId;
  });

  async function handleSimulate(impact: EventPropertyImpact) {
    if (!selectedEvent) return;
    setSelectedImpact(impact);
    try {
      setSimulating(true);
      setSimulationError(null);
      const result = await simulateHostEventPricing(selectedEvent.id, { propertyId: impact.propertyId });
      if (result.propertyImpact) setSelectedImpact(result.propertyImpact);
    } catch (err) {
      console.error("Erro ao simular preço no radar", err);
      setSimulationError("Não conseguimos atualizar a simulação agora. A última curva disponível continua visível.");
    } finally {
      setSimulating(false);
    }
  }

  function selectRadarEvent(eventId: string) {
    const nextEvent = events.find((event) => event.id === eventId);
    if (!nextEvent) return;
    setSelectedEventId(nextEvent.id);
    setSelectedImpact(nextEvent.impactedProperties[0] ?? null);
  }

  function selectHeatmapCell(cell: DemandHeatmapCell) {
    const nextEventId = cell.topEventIds.find((eventId) => events.some((event) => event.id === eventId));
    if (nextEventId) selectRadarEvent(nextEventId);
  }

  return (
    <AppPageShell maxWidth={1440}>
      <AppSectionHeader
        eyebrow="RADAR DE EVENTOS"
        title="Oportunidades por evento"
        subtitle="Veja quais eventos mexem com seus imóveis, quanto podem gerar e qual faixa de diária parece absorvível."
        actions={
          response?.mock ? (
            <AppBadge kind="warn">Mock contratual</AppBadge>
          ) : hasNonPersistedEvidence ? (
            <AppBadge kind="warn">Dados derivados</AppBadge>
          ) : (
            <AppBadge kind="success">Dados auditáveis</AppBadge>
          )
        }
      />

      <AppCard variant="default" style={{ padding: 14, marginBottom: 22, overflow: "hidden" }}>
        <div
          className="urban-event-radar-filter-grid"
          data-testid="host-event-radar-filters"
          style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 12, alignItems: "end" }}
        >
          <div style={{ gridColumn: "span 2", minWidth: 0, maxWidth: 320 }}>
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
          <div style={{ gridColumn: "span 2", minWidth: 0 }}>
            <AppInput type="date" label="Até" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
          </div>
          <div style={{ gridColumn: "span 2", minWidth: 0, maxWidth: 320 }}>
            <FilterLabel>Imóvel</FilterLabel>
            <PropertySelect
              value={propertyId}
              propsInfo={properties}
              setPropertyId={setPropertyId}
              disabled={propertiesLoading}
              includeAllOption
              allOptionValue="all"
              allOptionLabel="Todos os imóveis"
              maxWidth="100%"
            />
            {propertiesLoading && (
              <p role="status" aria-live="polite" style={{ margin: "6px 0 0", color: "var(--app-text-muted)", fontSize: 11, lineHeight: 1.35 }}>
                Carregando imóveis…
              </p>
            )}
            {propertyOptionsError && (
              <p style={{ margin: "6px 0 0", color: "var(--app-warning)", fontSize: 11, lineHeight: 1.35 }}>
                {propertyOptionsError}
              </p>
            )}
          </div>
          <div style={{ gridColumn: "span 2", minWidth: 0 }}>
            <AppSelect label="Categoria" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">Todas</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </AppSelect>
          </div>
          <div style={{ gridColumn: "span 1", minWidth: 0 }}>
            <AppSelect label="Raio" value={radiusKm} onChange={(event) => setRadiusKm(event.target.value)}>
              <option value="2">2 km</option>
              <option value="5">5 km</option>
              <option value="10">10 km</option>
              <option value="30">30 km</option>
              <option value="50">50 km</option>
            </AppSelect>
          </div>
          <div style={{ gridColumn: "span 2", minWidth: 0 }}>
            <AppSelect
              label="Confiança"
              value={confidence}
              onChange={(event) => setConfidence(event.target.value as HostEventConfidence | "all")}
            >
              <option value="all">Todas</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baixa</option>
            </AppSelect>
          </div>
          <div style={{ gridColumn: "span 1", minWidth: 0 }}>
            <AppButton type="button" variant="secondary" fullWidth onClick={() => setReloadCount((count) => count + 1)}>
              Atualizar
            </AppButton>
          </div>
        </div>
      </AppCard>

      {loading ? (
        <EventRadarLoading />
      ) : error ? (
        <AppEmptyState
          eyebrow="ALGO DEU ERRADO"
          title="Não conseguimos carregar o radar"
          body={error}
          icon={<Icons.AlertCircle size={32} />}
          action={
            <AppButton type="button" onClick={() => setReloadCount((count) => count + 1)}>
              Tentar de novo
            </AppButton>
          }
        />
      ) : events.length === 0 ? (
        <AppEmptyState
          eyebrow="SEM OPORTUNIDADES"
          title="Nenhum evento impactando seus imóveis"
          body="Ajuste período, imóvel ou nível de confiança para ampliar a leitura do radar."
          icon={<Icons.MapPin size={32} />}
          action={
            <AppButton type="button" variant="secondary" onClick={hasActiveFilters ? resetFilters : () => setReloadCount((count) => count + 1)}>
              {hasActiveFilters ? "Limpar filtros" : "Atualizar radar"}
            </AppButton>
          }
        />
      ) : (
        <>
          <div
            className="urban-event-radar-summary-grid"
            data-testid="host-event-radar-summary"
            style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 22 }}
          >
            <AppCard variant="default" style={{ padding: 18 }}>
              <AppMetricCard label="Potencial estimado" value={formatCompactCurrencyFromCents(response?.summary.revenuePotentialCents)} variant="sm" accent />
            </AppCard>
            <AppCard variant="default" style={{ padding: 18 }}>
              <AppMetricCard label="Eventos relevantes" value={String(response?.summary.relevantEvents ?? 0)} variant="sm" />
            </AppCard>
            <AppCard variant="default" style={{ padding: 18 }}>
              <AppMetricCard label="Noites com oportunidade" value={String(response?.summary.opportunityNights ?? 0)} variant="sm" />
            </AppCard>
            <AppCard variant="default" style={{ padding: 18 }}>
              <AppMetricCard label="Imóveis impactados" value={String(response?.summary.impactedProperties ?? 0)} variant="sm" />
            </AppCard>
          </div>

          <div
            className="urban-event-radar-main-grid"
            data-testid="host-event-radar-main"
            style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(340px, 420px)", gap: 22, alignItems: "start" }}
          >
            <div style={{ display: "grid", gap: 22 }}>
              <EventDemandHeatmapPlaceholder
                cells={response?.heatmap ?? []}
                events={events}
                selectedEventId={selectedEvent?.id ?? null}
                onSelectCell={selectHeatmapCell}
                onSelectEvent={selectRadarEvent}
                onOpenEvent={(eventId) => router.push(`/events/${eventId}`)}
              />
              {selectedEvent && (
                <EventDetailPanel
                  event={selectedEvent}
                  selectedImpact={selectedImpact}
                  simulating={simulating}
                  onOpenCatalog={() => router.push(`/events/${selectedEvent.id}`)}
                  onSimulate={handleSimulate}
                  simulationError={simulationError}
                />
              )}
            </div>

            <div style={{ display: "grid", gap: 14, position: "sticky", top: 24, minWidth: 0 }}>
              <AppCard variant="default" style={{ padding: 16 }}>
                <AppCardHeader
                  eyebrow="PRIORIDADE"
                  title="Eventos mais importantes"
                  subtitle="Clique para ver imóveis impactados e curva de absorção."
                  style={{ marginBottom: 0 }}
                />
              </AppCard>
              {events.map((event) => (
                <EventRadarCard
                  key={event.id}
                  event={event}
                  selected={event.id === selectedEvent?.id}
                  onSelect={() => {
                    setSelectedEventId(event.id);
                    setSelectedImpact(event.impactedProperties[0] ?? null);
                  }}
                  onOpenDetail={() => router.push(`/events/${event.id}`)}
                />
              ))}
            </div>
          </div>
        </>
      )}

      <style>{`
        @media (max-width: 1180px) {
          .urban-event-radar-main-grid {
            grid-template-columns: 1fr !important;
          }
          .urban-event-radar-main-grid > div:last-child {
            position: static !important;
          }
          .urban-event-radar-filter-grid > * {
            grid-column: span 12 !important;
          }
        }
        @media (max-width: 900px) {
          .urban-event-radar-summary-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (min-width: 901px) and (max-width: 1180px) {
          .urban-event-radar-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </AppPageShell>
  );

  function resetFilters() {
    setPropertyId("all");
    setCategory("all");
    setRadiusKm("30");
    setConfidence("all");
    setFrom(addDays(0));
    setTo(addDays(45));
    setReloadCount((count) => count + 1);
  }
}

function EventDetailPanel({
  event,
  selectedImpact,
  simulating,
  simulationError,
  onOpenCatalog,
  onSimulate,
}: {
  event: HostEventRadarItem;
  selectedImpact: EventPropertyImpact | null;
  simulating: boolean;
  simulationError: string | null;
  onOpenCatalog: () => void;
  onSimulate: (impact: EventPropertyImpact) => void;
}) {
  const sourceLinks = [
    event.officialUrl ? { label: "Site oficial", href: event.officialUrl } : null,
    event.crawledUrl ? { label: "Fonte", href: event.crawledUrl } : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>;
  const dataStatus = event.intelligence?.dataStatus ?? null;
  const jobRunId = event.intelligence?.jobRunId ?? null;
  const modelVersion = event.intelligence?.modelVersion ?? null;

  return (
    <AppCard variant="default" style={{ minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: "1 1 420px" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <AppBadge kind={confidenceBadgeKind(event.confidence)}>{confidenceLabel(event.confidence)}</AppBadge>
            {event.category && (
              <AppBadge
                kind="neutral"
                style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {event.category}
              </AppBadge>
            )}
            <AppBadge kind={dataStatusBadgeKind(dataStatus)}>{dataStatusLabel(dataStatus)}</AppBadge>
            <AppBadge kind={jobRunId ? "neutral" : "warn"}>{jobRunId ? `job ${shortTrace(jobRunId)}` : "sem jobRunId"}</AppBadge>
            {modelVersion && (
              <AppBadge kind="neutral" style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>
                {modelVersion}
              </AppBadge>
            )}
          </div>
          <h2 style={{ margin: 0, color: "var(--app-text)", fontSize: 24, fontWeight: 800, lineHeight: 1.2, letterSpacing: 0 }}>
            {event.name}
          </h2>
          <p style={{ margin: "8px 0 0", color: "var(--app-text-muted)", fontSize: 13, lineHeight: 1.5 }}>
            {formatDateRange(event.startsAt, event.endsAt)}
            {formatTime(event.startsAt) ? `, ${formatTime(event.startsAt)}` : ""} - {[event.venueName, event.city, event.state].filter(Boolean).join(" / ")}
          </p>
        </div>
        <AppButton type="button" variant="secondary" onClick={onOpenCatalog} rightIcon={<Icons.ArrowRight size={14} />}>
          Ver evento
        </AppButton>
      </div>

      {event.interpretation && (
        <p style={{ margin: "18px 0 0", color: "var(--app-text)", fontSize: 15, lineHeight: 1.65 }}>
          {event.interpretation}
        </p>
      )}
      {(dataStatus !== "persisted" || !jobRunId) && (
        <p style={{ margin: "10px 0 0", color: "var(--app-warning)", fontSize: 12, lineHeight: 1.5 }}>
          Leitura derivada: ainda não há snapshot persistido com jobRunId para auditoria completa.
        </p>
      )}

      {sourceLinks.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          {sourceLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              height: 34,
              padding: "0 12px",
              minWidth: 0,
              maxWidth: "100%",
              borderRadius: 8,
              border: "1px solid var(--app-divider-strong)",
              color: "var(--app-text)",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
              {link.label}
              <Icons.ArrowRight size={13} />
            </a>
          ))}
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <AppCardHeader
          eyebrow="IMÓVEIS IMPACTADOS"
          title="Onde agir"
          subtitle="A recomendação mostra faixa e probabilidade, não promessa de ocupação."
        />
        <EventImpactTable impacts={event.impactedProperties} onSimulate={onSimulate} />
      </div>

      {selectedImpact && (
        <div style={{ marginTop: 22 }}>
          <PriceAbsorptionScenarios
            title={`${selectedImpact.propertyName} - absorção inicial`}
            scenarios={selectedImpact.absorptionScenarios}
          />
          {simulating && (
            <p role="status" aria-live="polite" style={{ margin: "10px 0 0", color: "var(--app-text-muted)", fontSize: 12 }}>
              Atualizando simulação…
            </p>
          )}
          {simulationError && !simulating && (
            <p role="alert" style={{ margin: "10px 0 0", color: "var(--app-danger)", fontSize: 12, lineHeight: 1.45 }}>
              {simulationError}
            </p>
          )}
        </div>
      )}
    </AppCard>
  );
}

function EventRadarLoading() {
  return (
    <div data-testid="host-event-radar-loading" role="status" aria-live="polite" style={{ display: "grid", gap: 16 }}>
      <div style={{ minHeight: 160, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <Spinner />
          <p style={{ margin: "12px 0 0", color: "var(--app-text-muted)", fontSize: 13 }}>
            Calculando oportunidades dos eventos…
          </p>
        </div>
      </div>
      <div
        aria-hidden
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            style={{
              minHeight: 96,
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

function dataStatusLabel(status?: string | null) {
  if (status === "persisted") return "Persistido";
  if (status === "persisted_or_derived") return "Misto";
  if (status === "derived_from_event_fields") return "Derivado";
  if (status === "derived_from_analise_preco") return "Derivado";
  if (status === "derived_from_events") return "Heatmap derivado";
  if (status === "stub_pending_engine") return "Pendente";
  if (status === "contract_mock") return "Mock";
  return "Sem status";
}

function dataStatusBadgeKind(status?: string | null): AppBadgeKind {
  if (status === "persisted") return "success";
  if (status === "persisted_or_derived") return "warn";
  if (status === "contract_mock" || status === "stub_pending_engine") return "warn";
  if (status?.startsWith("derived_")) return "warn";
  return "neutral";
}

function shortTrace(value: string) {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "block",
        marginBottom: 6,
        color: "var(--app-text-muted)",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 1.5,
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function Spinner() {
  return (
    <span
      aria-label="Carregando"
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        border: "3px solid var(--app-accent-soft)",
        borderTopColor: "var(--app-accent)",
        animation: "event-radar-spin 0.9s linear infinite",
      }}
    >
      <style>{`@keyframes event-radar-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}
