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
import { EventImage } from "@/app/componentes/ui/event-intelligence/EventImage";
import styles from "./page.module.css";

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
        <div data-testid="host-event-detail-loading" className={styles.loadingBox}>
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

      <div className={styles.detailGrid}>
        <AppCard variant="default" className={styles.heroCard}>
          <div className={styles.heroMedia}>
            <EventImage src={event.imageUrl} alt={event.name} venue={event.venueName} />
          </div>
          <div className={styles.heroBody}>
            <div className={styles.badgeRow}>
              <AppBadge kind={confidenceBadgeKind(intelligence.confidence)}>
                {confidenceLabel(intelligence.confidence)}
              </AppBadge>
              {event.category && (
                <AppBadge
                  kind="neutral"
                  className={styles.categoryBadge}
                >
                  {event.category}
                </AppBadge>
              )}
              {detail.mock && <AppBadge kind="warn">Mock contratual</AppBadge>}
            </div>

            {event.description && (
              <p className={styles.description}>
                {event.description}
              </p>
            )}

            <div className={styles.metricGrid}>
              <Metric label="Score de demanda" value={String(intelligence.eventDemandScore ?? "-")} />
              <Metric label="Potencial estimado" value={formatCompactCurrencyFromCents(intelligence.eventRevenuePotentialCents)} />
              <Metric label="Raio de demanda" value={intelligence.demandRadiusKm ? `${intelligence.demandRadiusKm} km` : "-"} />
              <Metric label="Público estimado" value={intelligence.expectedAttendance ? intelligence.expectedAttendance.toLocaleString("pt-BR") : "-"} />
            </div>

            {sourceLinks.length > 0 && (
              <div className={styles.sourceLinks}>
                {sourceLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.sourceLink}
                  >
                    {link.label}
                    <Icons.ArrowRight size={13} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </AppCard>

        <AppCard variant="accent" className={styles.insightCard}>
          <AppCardHeader
            eyebrow="LEITURA MY URBAN"
            title="O que fazer com este evento"
            subtitle="Estimativa explicável. Use a faixa de preço como simulação, não como promessa de reserva."
          />
          <p className={styles.interpretation}>
            {intelligence.interpretation}
          </p>
          <div className={styles.driverList} data-testid="host-event-intelligence-drivers">
            {intelligence.drivers.length > 0 ? (
              intelligence.drivers.map((driver) => (
                <div key={driver.key} className={styles.driverItem}>
                  <div className={styles.driverHead}>
                    <p className={styles.driverLabel}>
                      {driver.label}
                    </p>
                    <span className={styles.driverWeight}>
                      {formatPercent(driver.weight)}
                    </span>
                  </div>
                  <p className={styles.driverExplanation}>
                    {driver.explanation}
                  </p>
                </div>
              ))
            ) : (
              <AppCard variant="subtle" className={styles.emptyDriversCard}>
                <p className={styles.emptyDriversText}>
                  Ainda não há drivers explicáveis para este evento.
                </p>
              </AppCard>
            )}
          </div>
          {intelligence.riskFlags.length > 0 && (
            <div className={styles.flagRow}>
              {intelligence.riskFlags.map((flag) => (
                <AppBadge
                  key={flag}
                  kind="warn"
                  className={styles.flagBadge}
                >
                  {formatFlagLabel(flag)}
                </AppBadge>
              ))}
            </div>
          )}
          <div className={styles.radarAction}>
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

      <div className={styles.sectionGap}>
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
        <div className={styles.sectionGap}>
          <PriceAbsorptionScenarios
            title={`${selectedImpact.propertyName} - curva inicial`}
            scenarios={selectedImpact.absorptionScenarios}
          />
          {simulating && (
            <p role="status" aria-live="polite" className={styles.simulationStatus}>
              Atualizando simulação…
            </p>
          )}
        </div>
      )}
      {simulationError && !simulating && (
        <p role="alert" className={styles.simulationError}>
          {simulationError}
        </p>
      )}

      {detail.relatedEvents && detail.relatedEvents.length > 0 && (
        <div className={styles.relatedSection}>
          <AppSectionHeader
            size="sm"
            eyebrow="EVENTOS RELACIONADOS"
            title="Também no radar"
            subtitle="Eventos próximos no calendário que podem competir ou somar demanda."
          />
          <div className={styles.relatedGrid}>
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

      <style>{`@media (max-width: 980px) { .${styles.detailGrid} { grid-template-columns: 1fr !important; } } @media (max-width: 640px) { .${styles.heroMedia} { height: 240px !important; } }`}</style>
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
    <div className={styles.metricCard}>
      <p className={styles.metricLabel}>
        {label}
      </p>
      <p className={styles.metricValue}>
        {value}
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={styles.spinner}
    />
  );
}
