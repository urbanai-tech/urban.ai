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
        const data = await getPropriedadesDropdownList();
        setPropsInfo(data);
        const defaultProp = data.find((p) => p.analisado === "completed");
        if (defaultProp) {
          setPropertyId(defaultProp.id);
        } else {
          setIsLoading(false);
        }
      } catch {
        setError('Erro ao carregar propriedades');
        setIsLoading(false);
      }
    }
    fetchPropsInfo();
  }, []);

  const eventsToDisplay = useMemo(() => allEvents, [allEvents]);
  const selectedProperty = propsInfo.find((p) => p.id === propertyId);

  return (
    <AppPageShell maxWidth={1400}>
      <AppSectionHeader
        eyebrow="MAPA - OPORTUNIDADES"
        title="Mapa Interativo"
        subtitle="Veja eventos proximos ao seu imovel num raio configuravel. Use o periodo pra calibrar o radar conforme a operacao."
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
                Filtrar imovel
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
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div style={{ flex: "0 0 180px", maxWidth: 180 }}>
            <AppInput
              type="date"
              label="Ate"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </AppCard>

      {isLoading ? (
        <div style={{ padding: "80px 0", display: "grid", placeItems: "center" }}>
          <Spinner size={36} />
        </div>
      ) : error ? (
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
                    {eventsToDisplay.length} {eventsToDisplay.length === 1 ? 'evento' : 'eventos'}
                  </p>
                </div>
                <SuggestionInfoPopover
                  description="Nosso sistema compara seu imovel com outros de caracteristicas semelhantes. Tambem considera eventos proximos e seu impacto na demanda para oferecer uma sugestao de preco mais precisa."
                />
              </div>

              {eventsToDisplay.length === 0 ? (
                <AppEmptyState
                  eyebrow="SEM EVENTOS"
                  title="Nada no raio escolhido"
                  body="Aumente o raio ou ajuste o periodo pra ampliar o radar de oportunidades."
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
