"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppCardHeader,
  AppEmptyState,
  AppPageShell,
  AppSectionHeader,
  EventCatalogCard,
  EventImpactTable,
  Icons,
  PriceAbsorptionScenarios,
} from "@/app/componentes/ui";
import {
  fetchHostEventDetail,
  simulateHostEventPricing,
  type EventPropertyImpact,
  type HostEventDetailResponse,
} from "@/app/service/api";
import {
  confidenceBadgeKind,
  confidenceLabel,
  formatCompactCurrencyFromCents,
  formatDateRange,
  formatTime,
  formatPercent,
} from "@/app/componentes/ui/event-intelligence";

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = String(params?.eventId ?? "");
  const [detail, setDetail] = useState<HostEventDetailResponse | null>(null);
  const [selectedImpact, setSelectedImpact] = useState<EventPropertyImpact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);

  const loadDetail = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      setSimulationError(null);
      const data = await fetchHostEventDetail(eventId);
      setDetail(data);
      setSelectedImpact(data.propertyImpacts[0] ?? null);
    } catch (err) {
      console.error("Erro ao carregar detalhe do evento", err);
      setError("Não foi possível carregar o detalhe do evento agora.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail, reloadCount]);

  const event = detail?.event;
  const intelligence = detail?.intelligence;
  const sourceLinks = useMemo(
    () =>
      [
        event?.officialUrl ? { label: "Site oficial", href: event.officialUrl } : null,
        event?.crawledUrl ? { label: "Fonte monitorada", href: event.crawledUrl } : null,
      ].filter(Boolean) as Array<{ label: string; href: string }>,
    [event?.crawledUrl, event?.officialUrl],
  );

  async function handleSimulate(impact: EventPropertyImpact) {
    setSelectedImpact(impact);
    try {
      setSimulating(true);
      setSimulationError(null);
      const result = await simulateHostEventPricing(eventId, { propertyId: impact.propertyId });
      if (result.propertyImpact) setSelectedImpact(result.propertyImpact);
    } catch (err) {
      console.error("Erro ao simular preço do evento", err);
      setSimulationError("Não conseguimos atualizar a simulação agora. A curva anterior continua como referência.");
    } finally {
      setSimulating(false);
    }
  }

  if (loading) {
    return (
      <AppPageShell>
        <div data-testid="host-event-detail-loading" style={{ minHeight: 480, display: "grid", placeItems: "center" }}>
          <Spinner />
        </div>
      </AppPageShell>
    );
  }

  if (error || !detail || !event || !intelligence) {
    return (
      <AppPageShell>
        <AppEmptyState
          eyebrow="DETALHE INDISPONÍVEL"
          title="Não conseguimos abrir este evento"
          body={error ?? "O evento não foi encontrado no radar atual."}
          icon={<Icons.AlertCircle size={32} />}
          action={
            <AppButton type="button" onClick={() => setReloadCount((count) => count + 1)}>
              Tentar de novo
            </AppButton>
          }
        />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell maxWidth={1320}>
      <AppSectionHeader
        eyebrow="DETALHE DO EVENTO"
        title={event.name}
        subtitle={`${formatDateRange(event.startsAt, event.endsAt)}${formatTime(event.startsAt) ? `, ${formatTime(event.startsAt)}` : ""} - ${[
          event.venueName,
          event.city,
          event.state,
        ]
          .filter(Boolean)
          .join(" / ")}`}
        actions={
          <AppButton
            type="button"
            variant="secondary"
            leftIcon={<Icons.ArrowLeft size={14} />}
            onClick={() => router.push("/events")}
          >
            Catalogo
          </AppButton>
        }
      />

      <div
        className="urban-event-detail-grid"
        style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)", gap: 22 }}
      >
        <AppCard variant="default" style={{ padding: 0, overflow: "hidden", minWidth: 0 }}>
          <div className="urban-event-detail-media" style={{ height: 340, background: "var(--app-surface-muted)" }}>
            {event.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.imageUrl}
                alt={event.name}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--app-text-muted)" }}>
                Evento monitorado
              </div>
            )}
          </div>
          <div style={{ padding: 22 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <AppBadge kind={confidenceBadgeKind(intelligence.confidence)}>
                {confidenceLabel(intelligence.confidence)}
              </AppBadge>
              {event.category && (
                <AppBadge
                  kind="neutral"
                  style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {event.category}
                </AppBadge>
              )}
              {detail.mock && <AppBadge kind="warn">Mock contratual</AppBadge>}
            </div>

            {event.description && (
              <p style={{ margin: "0 0 18px", color: "var(--app-text-muted)", fontSize: 15, lineHeight: 1.65 }}>
                {event.description}
              </p>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <Metric label="Score de demanda" value={String(intelligence.eventDemandScore ?? "-")} />
              <Metric label="Potencial estimado" value={formatCompactCurrencyFromCents(intelligence.eventRevenuePotentialCents)} />
              <Metric label="Raio de demanda" value={intelligence.demandRadiusKm ? `${intelligence.demandRadiusKm} km` : "-"} />
              <Metric label="Público estimado" value={intelligence.expectedAttendance ? intelligence.expectedAttendance.toLocaleString("pt-BR") : "-"} />
            </div>

            {sourceLinks.length > 0 && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
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
                      height: 36,
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
          </div>
        </AppCard>

        <AppCard variant="accent" style={{ minWidth: 0 }}>
          <AppCardHeader
            eyebrow="LEITURA URBAN AI"
            title="O que fazer com este evento"
            subtitle="Estimativa explicável. Use a faixa de preço como simulação, não como promessa de reserva."
          />
          <p style={{ margin: 0, color: "var(--app-text)", fontSize: 15, lineHeight: 1.65 }}>
            {intelligence.interpretation}
          </p>
          <div style={{ display: "grid", gap: 10, marginTop: 18 }} data-testid="host-event-intelligence-drivers">
            {intelligence.drivers.length > 0 ? (
              intelligence.drivers.map((driver) => (
                <div key={driver.key} style={{ borderTop: "1px solid var(--app-divider)", paddingTop: 10, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <p style={{ margin: 0, color: "var(--app-text)", fontSize: 13, fontWeight: 750, overflowWrap: "anywhere" }}>
                      {driver.label}
                    </p>
                    <span style={{ color: "var(--app-text-muted)", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {formatPercent(driver.weight)}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0", color: "var(--app-text-muted)", fontSize: 12, lineHeight: 1.5, overflowWrap: "anywhere" }}>
                    {driver.explanation}
                  </p>
                </div>
              ))
            ) : (
              <AppCard variant="subtle" style={{ padding: 14 }}>
                <p style={{ margin: 0, color: "var(--app-text-muted)", fontSize: 13, lineHeight: 1.5 }}>
                  Ainda não há drivers explicáveis para este evento.
                </p>
              </AppCard>
            )}
          </div>
          {intelligence.riskFlags.length > 0 && (
            <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {intelligence.riskFlags.map((flag) => (
                <AppBadge
                  key={flag}
                  kind="warn"
                  style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {formatFlagLabel(flag)}
                </AppBadge>
              ))}
            </div>
          )}
          <div style={{ marginTop: 22 }}>
            <AppButton
              type="button"
              variant="primary"
              fullWidth
              onClick={() => router.push(`/event-radar?eventId=${encodeURIComponent(event.id)}`)}
              rightIcon={<Icons.ArrowRight size={14} />}
            >
              Abrir no Radar de Eventos
            </AppButton>
          </div>
        </AppCard>
      </div>

      <div style={{ marginTop: 24 }}>
        <AppCard variant="default">
          <AppCardHeader
            eyebrow="MEUS IMÓVEIS IMPACTADOS"
            title="Impacto nos seus imóveis"
            subtitle="Distância, captura, faixa absorvível e ação recomendada para cada imóvel."
          />
          <EventImpactTable impacts={detail.propertyImpacts} onSimulate={handleSimulate} />
        </AppCard>
      </div>

      {selectedImpact && (
        <div style={{ marginTop: 24 }}>
          <PriceAbsorptionScenarios
            title={`${selectedImpact.propertyName} - curva inicial`}
            scenarios={selectedImpact.absorptionScenarios}
          />
          {simulating && (
            <p role="status" aria-live="polite" style={{ margin: "10px 0 0", color: "var(--app-text-muted)", fontSize: 12 }}>
              Atualizando simulação…
            </p>
          )}
        </div>
      )}
      {simulationError && !simulating && (
        <p role="alert" style={{ margin: "10px 0 0", color: "var(--app-danger)", fontSize: 12, lineHeight: 1.45 }}>
          {simulationError}
        </p>
      )}

      {detail.relatedEvents && detail.relatedEvents.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <AppSectionHeader
            size="sm"
            eyebrow="EVENTOS RELACIONADOS"
            title="Também no radar"
            subtitle="Eventos próximos no calendário que podem competir ou somar demanda."
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {detail.relatedEvents.map((relatedEvent) => (
              <EventCatalogCard
                key={relatedEvent.id}
                event={relatedEvent}
                onOpen={() => router.push(`/events/${relatedEvent.id}`)}
                onOpenImpact={() => router.push(`/event-radar?eventId=${encodeURIComponent(relatedEvent.id)}`)}
              />
            ))}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 980px) {
          .urban-event-detail-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .urban-event-detail-media {
            height: 240px !important;
          }
        }
      `}</style>
    </AppPageShell>
  );
}

function formatFlagLabel(flag: string): string {
  const labels: Record<string, string> = {
    price_absorption_curve_pending_engine: "Curva pendente",
    booking_probability_pending_engine: "Probabilidade pendente",
    low_source_reliability: "Fonte em validação",
    missing_location: "Localização incompleta",
    missing_attendance: "Público estimado pendente",
  };
  return labels[flag] ?? flag.replace(/_/g, " ");
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 14, borderRadius: 8, background: "var(--app-surface-muted)", border: "1px solid var(--app-divider)" }}>
      <p
        style={{
          margin: "0 0 4px",
          color: "var(--app-text-muted)",
          fontSize: 10,
          fontWeight: 750,
          letterSpacing: 1.2,
          textTransform: "uppercase",
        }}
      >
        {label}
      </p>
      <p style={{ margin: 0, color: "var(--app-text)", fontSize: 18, fontWeight: 800, lineHeight: 1.2, overflowWrap: "anywhere" }}>
        {value}
      </p>
    </div>
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
        animation: "event-detail-spin 0.9s linear infinite",
      }}
    >
      <style>{`@keyframes event-detail-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}
