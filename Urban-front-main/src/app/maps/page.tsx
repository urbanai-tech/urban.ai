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

const PropertySelect = dynamic(() => import('./components/CustomSelect'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 40, display: "grid", placeItems: "center" }}>
      <Spinner size={18} />
    </div>
  ),
});

const AirbnbMap = dynamic(() => import('./components/GoogleMapEmbed'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 500, display: "grid", placeItems: "center" }}>
      <Spinner size={36} />
    </div>
  ),
});

const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);
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

  const [startDate, setStartDate] = useState<string>(toIsoDate(today));
  const [endDate, setEndDate] = useState<string>(toIsoDate(inAWeek));

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

  const eventsToDisplay = useMemo(() => allEvents, [allEvents]);
  const selectedProperty = propsInfo.find((p) => p.id === propertyId);
  const hasProcessingProperties = propsInfo.some((p) => !isPropertyReady(p));
  const selectedPropertyIsProcessing = Boolean(selectedProperty && !isPropertyReady(selectedProperty));
  const mapStatus =
    isLoadingProperties
      ? {
          title: "Carregando seus imoveis",
          body: "Estamos abrindo sua lista antes de atualizar o mapa.",
          steps: [
            { id: "properties", label: "Buscar imoveis", status: "active" as const },
            { id: "events", label: "Procurar eventos", status: "pending" as const },
            { id: "map", label: "Mostrar no mapa", status: "pending" as const },
          ],
          tone: "accent" as const,
        }
      : isLoading
        ? {
            title: "Procurando eventos perto do imovel",
            body: `Usando o raio de ${selectedRadius} km e o periodo escolhido.`,
            steps: [
              { id: "properties", label: "Imovel escolhido", status: "complete" as const },
              { id: "events", label: "Procurar eventos", status: "active" as const },
              { id: "map", label: "Mostrar no mapa", status: "pending" as const },
            ],
            tone: "accent" as const,
          }
        : selectedPropertyIsProcessing || (!propertyId && hasProcessingProperties)
          ? {
              title: selectedPropertyIsProcessing
                ? selectedProperty?.setupStatus?.publicLabel ?? "Imovel ainda sendo preparado"
                : "Imoveis ainda sendo preparados",
              body: selectedProperty?.setupStatus?.publicDescription ?? "Assim que ficar pronto, o mapa mostra eventos perto e sugestoes de preco.",
              steps: selectedProperty?.setupStatus?.steps ?? [
                { id: "properties", label: "Imovel adicionado", status: "complete" as const },
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
        subtitle="Escolha o imovel, o raio e as datas para ver eventos que podem influenciar a diaria."
      />

      <AppCard variant="subtle" style={{ padding: 20, marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 260px", maxWidth: 320, position: "relative", zIndex: 1000 }}>
            <label>
              <span
                style={{
                  display: "block",
                  marginBottom: 4,
                  color: "var(--app-text-muted)",
                  fontSize: 11,
                  fontWeight: 650,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                Escolher imovel
              </span>
              <div style={{ position: "relative", zIndex: 1001 }}>
                <PropertySelect
                  value={propertyId}
                  propsInfo={propsInfo}
                  setPropertyId={setPropertyId}
                />
              </div>
            </label>
          </div>

          <div style={{ flex: "0 0 160px", maxWidth: 160 }}>
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

          <div style={{ flex: "0 0 180px", maxWidth: 180 }}>
            <AppInput
              type="date"
              label="De"
              value={startDate}
              disabled={isLoadingProperties}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div style={{ flex: "0 0 180px", maxWidth: 180 }}>
            <AppInput
              type="date"
              label="Ate"
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
            eyebrow="O QUE ESTA ACONTECENDO"
            title={mapStatus.title}
            body={mapStatus.body}
            steps={mapStatus.steps}
            tone={mapStatus.tone}
            style={{ marginTop: 16 }}
          />
        )}
      </AppCard>

      {error ? (
        <AppCard variant="default" style={{ borderColor: 'rgba(194, 52, 46, 0.25)' }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--app-danger)" }}>
            <Icons.AlertCircle size={18} />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>{error}</p>
          </div>
        </AppCard>
      ) : (
        <div style={{ display: "flex", gap: 24, alignItems: "stretch", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 560px", minWidth: 0, position: "relative", zIndex: 1 }}>
            <AppCard variant="default" style={{ padding: 16 }}>
              <div style={{ position: "relative" }}>
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
                    style={{
                      position: "absolute",
                      inset: 12,
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "flex-start",
                      pointerEvents: "none",
                    }}
                  >
                    <AppLoadingStatus
                      compact
                      eyebrow="MAPA"
                      title={mapStatus.title}
                      body={mapStatus.body}
                      steps={mapStatus.steps}
                      tone={mapStatus.tone}
                      style={{
                        width: "min(420px, calc(100% - 16px))",
                        background: "rgba(255,255,255,0.94)",
                        boxShadow: "0 12px 32px rgba(14,17,22,0.14)",
                      }}
                    />
                  </div>
                )}
              </div>
            </AppCard>
          </div>

          <div style={{ flex: "0 0 480px", maxWidth: "100%" }}>
            <AppCard variant="default" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ minWidth: 0 }}>
                  <p className="urban-app-eyebrow-muted" style={{ marginBottom: 4 }}>
                    EVENTOS NO RAIO
                  </p>
                  <p style={{ margin: 0, color: "var(--app-text)", fontSize: 20, fontWeight: 650 }}>
                    {isLoading
                      ? "Atualizando..."
                      : `${eventsToDisplay.length} ${eventsToDisplay.length === 1 ? 'evento' : 'eventos'}`}
                  </p>
                </div>
                <SuggestionInfoPopover
                  description="Nosso sistema compara seu imovel com outros de caracteristicas semelhantes. Tambem considera eventos proximos e seu impacto na demanda para oferecer uma sugestao de preco mais precisa."
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
                  body="Aumente o raio ou ajuste o periodo para ver mais eventos."
                  icon={<Icons.MapPin size={28} />}
                />
              ) : (
                <div style={{ flex: 1, overflowY: "auto", maxHeight: "calc(100vh - 320px)", paddingRight: 4 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
    </AppPageShell>
  );
}

function Spinner({ size }: { size: number }) {
  return (
    <span
      aria-label="Carregando"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: "3px solid var(--app-accent-soft)",
        borderTopColor: "var(--app-accent)",
        animation: "maps-spin 0.9s linear infinite",
      }}
    >
      <style>{`@keyframes maps-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}

function isPropertyReady(property: PropertyDropdown): boolean {
  return property.setupStatus?.state ? property.setupStatus.state === "ready" : property.analisado === "completed";
}
