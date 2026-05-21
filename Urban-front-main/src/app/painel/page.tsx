'use client';

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { fetchPace, getEventosAcompanhando, getPropriedadesDropdownList, PaceApiPoint, PropertyDropdown } from '@/app/service/api';
import { EventItem } from '../dashboard/components/ItemEvento';
import { Pagination } from '../componentes/Pagination';
import { EventCard } from './components/ItemEventoPainel';
import DashboardCards from './components/StatCard';
import { PushNotificationOptIn } from '../componentes/PushNotificationOptIn';
import { AppCard, AppCardHeader, AppEmptyState, AppPageShell, AppSectionHeader, Icons, PaceChart } from '../componentes/ui';

const PropertySelect = dynamic(() => import('./components/CustomSelect'), { ssr: false });

export default function SugestoesAceitas() {
  const [propsInfo, setPropsInfo] = useState<PropertyDropdown[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [loadingProps, setLoadingProps] = useState(true);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 5;

  const [paceData, setPaceData] = useState<PaceApiPoint[]>([]);
  const [isLoadingPace, setIsLoadingPace] = useState(false);

  useEffect(() => {
    async function fetchProps() {
      try {
        setLoadingProps(true);
        const data = await getPropriedadesDropdownList();

        const todosOption: PropertyDropdown = {
          id: '',
          nome: 'Todos',
          analisado: 'completed',
          propertyName: 'Todos',
          userId: '',
          image_url: '',
          latitude: 0,
          longitude: 0,
        };

        setPropsInfo([todosOption, ...data]);
        setPropertyId('');
      } catch (err) {
        console.error('Erro ao carregar propriedades', err);
      } finally {
        setLoadingProps(false);
      }
    }
    fetchProps();
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      setIsLoadingEvents(true);
      const result = await getEventosAcompanhando(propertyId || undefined, page, limit);
      setEvents(result.data);
      setTotalPages(Math.ceil(result.total / limit));
    } catch (err) {
      console.error('Erro ao carregar eventos', err);
    } finally {
      setIsLoadingEvents(false);
    }
  }, [page, propertyId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    let cancelled = false;
    async function loadPace() {
      try {
        setIsLoadingPace(true);
        const points = await fetchPace(propertyId || undefined, { days: 60 });
        if (!cancelled) setPaceData(points);
      } catch (err) {
        console.error('Erro ao carregar pace', err);
        if (!cancelled) setPaceData([]);
      } finally {
        if (!cancelled) setIsLoadingPace(false);
      }
    }
    loadPace();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  return (
    <AppPageShell maxWidth={1280}>
      <AppSectionHeader
        eyebrow="PAINEL - HOJE NA SUA OPERACAO"
        title="Painel de controle"
        subtitle="Eventos com sugestao da Urban AI que merecem sua atencao agora. Filtre por imovel pra focar onde tem mais oportunidade."
        actions={
          loadingProps ? (
            <Spinner size={18} />
          ) : (
            <div style={{ width: "100%", maxWidth: 320 }}>
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
                <PropertySelect
                  value={propertyId}
                  propsInfo={propsInfo}
                  setPropertyId={(id) => {
                    setPropertyId(id);
                    setPage(1);
                  }}
                />
              </label>
            </div>
          )
        }
      />

      <PushNotificationOptIn variant="compact" />

      <DashboardCards propertyId={propertyId} />

      <div style={{ marginTop: 32 }}>
        <AppCard variant="default">
          <AppCardHeader
            eyebrow="PROJECAO - BOOKED VS BASELINE"
            title="Pace dos proximos 60 dias"
            subtitle={
              propertyId
                ? 'Quanto das suas noites futuras ja esta reservado, comparado ao baseline esperado por sazonalidade. Eventos relevantes aparecem como marcadores verticais.'
                : 'Visao agregada do portfolio. Selecione um imovel pra ver a curva especifica e acoes sugeridas.'
            }
          />
          <PaceChart data={paceData} loading={isLoadingPace} height={280} />
        </AppCard>
      </div>

      <div style={{ marginTop: 32 }}>
        {isLoadingEvents ? (
          <div style={{ padding: "80px 0", display: "grid", placeItems: "center" }}>
            <Spinner size={36} />
          </div>
        ) : events.length === 0 ? (
          <AppEmptyState
            eyebrow="SEM SUGESTOES PENDENTES"
            title="Tudo certo por aqui"
            body="Quando a Urban AI detectar uma nova oportunidade de evento, aparece aqui. Voce tambem recebe por e-mail."
            icon={<Icons.Sparkles size={32} />}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {events.map((ev) => (
              <EventCard
                key={ev.id}
                ev={ev}
                cardBorder="gray.200"
                bg="white"
                propertyId={propertyId}
                setIsLoading={setIsLoadingEvents}
                onChange={() => fetchEvents()}
              />
            ))}

            <Pagination
              paginaAtual={page}
              totalPaginas={totalPages}
              onPageChange={(nova) => setPage(nova)}
            />
          </div>
        )}
      </div>
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
        animation: "painel-spin 0.9s linear infinite",
      }}
    >
      <style>{`@keyframes painel-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}
