'use client';

import { useEffect, useMemo, useState } from 'react';
import { getEventosForMaps, getPropriedadesDropdownList, PropertyDropdown } from '../service/api';
import dynamic from 'next/dynamic';
import { EventCard } from '../dashboard/components/ItemEvento';
import { SuggestionInfoPopover } from '../componentes/SuggestionInfoPopover';
import {
  AppPageShell,
  AppSectionHeader,
  AppCard,
  AppSelect,
  AppInput,
  AppEmptyState,
  AppLoadingStatus,
  Icons,
} from '../componentes/ui';
import { formatLocalDate, isTodayOrFutureDate } from '../lib/date';
import styles from "./maps.module.css";

const PropertySelect = dynamic(() => import('../componentes/PropertySelect'), {
  ssr: false,
  loading: () => (
    <div className={styles.spinnerSlotSmall}>
      <Spinner size={18} />
    </div>
  ),
});

const AirbnbMap = dynamic(() => import('./components/GoogleMapEmbed'), {
  ssr: false,
  loading: () => (
    <div className={styles.mapLoadingSlot}>
      <Spinner size={36} />
    </div>
  ),
});

const parseIsoDate = (s: string) => {
  const [y, m, day] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1);
};

export default function MapsPage() {
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propsInfo, setPropsInfo] = useState<PropertyDropdown[]>([]);
  const [isLoadingProperties, setIsLoadingProperties] = useState(true);
  const [propertyId, setPropertyId] = useState('');
  const [selectedRadius, setSelectedRadius] = useState(30);

  const today = useMemo(() => new Date(), []);
  const inAWeek = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }, []);

  const [startDate, setStartDate] = useState<string>(formatLocalDate(today));
  const [endDate, setEndDate] = useState<string>(formatLocalDate(inAWeek));
  const todayIso = formatLocalDate(today);

  function updateStartDate(value: string) {
    const nextStart = value < todayIso ? todayIso : value;
    setStartDate(nextStart);
    if (endDate < nextStart) setEndDate(nextStart);
  }

  const fetchEventsSemLoading = async () => {
    setError(null);
    try {
      const response = await getEventosForMaps(
        propertyId,
        1,
        1000,
        selectedRadius,
        parseIsoDate(startDate).toISOString(),
        parseIsoDate(endDate).toISOString(),
      );
      setAllEvents(response.data);
    } catch {
      setError('Erro ao carregar eventos');
    }
  };

  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await getEventosForMaps(
          propertyId,
          1,
          1000,
          selectedRadius,
          parseIsoDate(startDate).toISOString(),
          parseIsoDate(endDate).toISOString(),
        );
        setAllEvents(response.data);
      } catch {
        setError('Erro ao carregar eventos');
      } finally {
        setIsLoading(false);
      }
    };

    if (propertyId) fetchEvents();
    else {
      setAllEvents([]);
      setIsLoading(false);
    }
  }, [propertyId, selectedRadius, startDate, endDate]);

  useEffect(() => {
    async function fetchPropsInfo() {
      try {
        setIsLoadingProperties(true);
        const data = await getPropriedadesDropdownList();
        setPropsInfo(data);
        const defaultProp = data.find(isPropertyReady);
        if (defaultProp) {
          setPropertyId(defaultProp.id);
        } else {
          setIsLoading(false);
        }
      } catch {
        setError('Erro ao carregar propriedades');
        setIsLoading(false);
      } finally {
        setIsLoadingProperties(false);
      }
    }
    fetchPropsInfo();
  }, []);

  const eventsToDisplay = useMemo(
    () => allEvents.filter((event) => isTodayOrFutureDate(event.dataInicio)),
    [allEvents],
  );
  const selectedProperty = propsInfo.find((p) => p.id === propertyId);
  const hasProcessingProperties = propsInfo.some((p) => !isPropertyReady(p));
  const selectedPropertyIsProcessing = Boolean(selectedProperty && !isPropertyReady(selectedProperty));
  const mapStatus =
    isLoadingProperties
      ? {
          title: "Carregando seus imóveis",
          body: "Estamos abrindo sua lista antes de atualizar o mapa.",
          steps: [
            { id: "properties", label: "Buscar imóveis", status: "active" as const },
            { id: "events", label: "Procurar eventos", status: "pending" as const },
            { id: "map", label: "Mostrar no mapa", status: "pending" as const },
          ],
          tone: "accent" as const,
        }
      : isLoading
        ? {
            title: "Procurando eventos perto do imóvel",
            body: `Usando o raio de ${selectedRadius} km e o período escolhido.`,
            steps: [
              { id: "properties", label: "Imóvel escolhido", status: "complete" as const },
              { id: "events", label: "Procurar eventos", status: "active" as const },
              { id: "map", label: "Mostrar no mapa", status: "pending" as const },
            ],
            tone: "accent" as const,
          }
        : selectedPropertyIsProcessing || (!propertyId && hasProcessingProperties)
          ? {
              title: selectedPropertyIsProcessing
                ? selectedProperty?.setupStatus?.publicLabel ?? "Imóvel ainda sendo preparado"
                : "Imóveis ainda sendo preparados",
              body: selectedProperty?.setupStatus?.publicDescription ?? "Assim que ficar pronto, o mapa mostra eventos perto e sugestões de preço.",
              steps: selectedProperty?.setupStatus?.steps ?? [
                { id: "properties", label: "Imóvel adicionado", status: "complete" as const },
                { id: "events", label: "Procurar eventos", status: "active" as const },
                { id: "map", label: "Liberar mapa", status: "pending" as const },
              ],
              tone: "warn" as const,
            }
          : null;

  return (
    <AppPageShell maxWidth={1400}>
      <AppSectionHeader
        eyebrow="MAPA - OPORTUNIDADES"
        title="Mapa Interativo"
        subtitle="Escolha o imóvel, o raio e as datas para ver eventos que podem influenciar a diária."
      />

      <AppCard variant="subtle" className={styles.filtersCard}>
        <div
          className={styles.filtersRow}
        >
          <div className={styles.propertyFilterField}>
            <label>
              <span
                className={styles.propertyFilterLabel}
              >
                Escolher imóvel
              </span>
              <div className={styles.propertySelectWrap}>
                <PropertySelect
                  value={propertyId}
                  propsInfo={propsInfo}
                  setPropertyId={setPropertyId}
                />
              </div>
            </label>
          </div>

          <div className={styles.radiusField}>
            <AppSelect
              label="Raio (km)"
              value={selectedRadius}
              disabled={isLoadingProperties}
              onChange={(e) => setSelectedRadius(Number(e.target.value))}
            >
              <option value={1}>1 km</option>
              <option value={2}>2 km</option>
              <option value={5}>5 km</option>
              <option value={10}>10 km</option>
              <option value={30}>30 km</option>
            </AppSelect>
          </div>

          <div className={styles.dateField}>
            <AppInput
              type="date"
              label="De"
              value={startDate}
              min={todayIso}
              disabled={isLoadingProperties}
              onChange={(e) => updateStartDate(e.target.value)}
            />
          </div>

          <div className={styles.dateField}>
            <AppInput
              type="date"
              label="Até"
              value={endDate}
              min={startDate}
              disabled={isLoadingProperties}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {mapStatus && (
          <AppLoadingStatus
            compact
            eyebrow="O QUE ESTÁ ACONTECENDO"
            title={mapStatus.title}
            body={mapStatus.body}
            steps={mapStatus.steps}
            tone={mapStatus.tone}
            className={styles.statusNotice}
          />
        )}
      </AppCard>

      {error ? (
        <AppCard variant="default" className={styles.errorCard}>
          <div className={styles.errorContent}>
            <Icons.AlertCircle size={18} />
            <p className={styles.errorMessage}>{error}</p>
          </div>
        </AppCard>
      ) : (
        <div
          className={`maps-opportunity-layout ${styles.opportunityLayout}`}
        >
          <div className={styles.mapColumn}>
            <AppCard variant="default" className={styles.mapCard}>
              <div className={styles.mapFrame}>
                <AirbnbMap
                  height="500px"
                  events={eventsToDisplay}
                  property={
                    selectedProperty
                      ? {
                          id: selectedProperty.id,
                          propertyName: selectedProperty.propertyName,
                          latitude: selectedProperty.latitude + "",
                          longitude: selectedProperty.longitude + "",
                          image_url: selectedProperty.image_url,
                        }
                      : null
                  }
                />
                {isLoading && mapStatus && (
                  <div
                    className={styles.mapOverlay}
                  >
                    <AppLoadingStatus
                      compact
                      eyebrow="MAPA"
                      title={mapStatus.title}
                      body={mapStatus.body}
                      steps={mapStatus.steps}
                      tone={mapStatus.tone}
                      className={styles.mapOverlayStatus}
                    />
                  </div>
                )}
              </div>
            </AppCard>
          </div>

          <div className={styles.listColumn}>
            <AppCard variant="default" className={styles.listCard}>
              <div className={styles.listHeader}>
                <div className={styles.listHeaderText}>
                  <p className={`urban-app-eyebrow-muted ${styles.listEyebrow}`}>
                    EVENTOS NO RAIO
                  </p>
                  <p className={styles.listTitle}>
                    {isLoading
                      ? "Atualizando…"
                      : `${eventsToDisplay.length} ${eventsToDisplay.length === 1 ? 'evento' : 'eventos'}`}
                  </p>
                </div>
                <SuggestionInfoPopover
                  description="Nosso sistema compara seu imóvel com outros de características semelhantes. Também considera eventos próximos e seu impacto na demanda para oferecer uma sugestão de preço mais precisa."
                />
              </div>

              {isLoading && mapStatus ? (
                <AppLoadingStatus
                  compact
                  eyebrow="PROCURANDO EVENTOS"
                  title={mapStatus.title}
                  body={mapStatus.body}
                  steps={mapStatus.steps}
                  tone={mapStatus.tone}
                />
              ) : eventsToDisplay.length === 0 ? (
                <AppEmptyState
                  eyebrow="SEM EVENTOS"
                  title="Nada no raio escolhido"
                  body="Aumente o raio ou ajuste o período para ver mais eventos."
                  icon={<Icons.MapPin size={28} />}
                />
              ) : (
                <div className={styles.listScroll}>
                  <div className={styles.eventList}>
                    {eventsToDisplay.map((ev) => (
                      <EventCard
                        setIsLoading={() => {}}
                        onChange={() => {
                          fetchEventsSemLoading();
                        }}
                        key={ev.id}
                        ev={ev}
                        cardBorder="gray.200"
                        bg="white"
                        propertyId={propertyId}
                      />
                    ))}
                  </div>
                </div>
              )}
            </AppCard>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 1050px) {
          .maps-opportunity-layout {
            grid-template-columns: 1fr !important;
          }
          .maps-opportunity-layout > div {
            position: relative !important;
            top: auto !important;
          }
        }
      `}</style>
    </AppPageShell>
  );
}

function Spinner({ size }: { size: number }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={styles.spinner} style={{ width: size, height: size }}
    >
      <style>{`@keyframes maps-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}

function isPropertyReady(property: PropertyDropdown): boolean {
  return property.setupStatus?.state ? property.setupStatus.state === "ready" : property.analisado === "completed";
}
