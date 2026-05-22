'use client';

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { fetchPace, getEventosAcompanhando, getPropriedadesDropdownList, PaceApiPoint, PropertyDropdown } from '@/app/service/api';
import { EventItem } from '../dashboard/components/ItemEvento';
import { Pagination } from '../componentes/Pagination';
import { EventCard } from './components/ItemEventoPainel';
import DashboardCards from './components/StatCard';
import { PushNotificationOptIn } from '../componentes/PushNotificationOptIn';
import { AppButton, AppCard, AppCardHeader, AppEmptyState, AppLoadingStatus, AppPageShell, AppSectionHeader, Icons, PaceChart } from '../componentes/ui';

const PropertySelect = dynamic(() => import('./components/CustomSelect'), { ssr: false });

export default function SugestoesAceitas() {
  const [propsInfo, setPropsInfo] = useState<PropertyDropdown[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [loadingProps, setLoadingProps] = useState(true);
  const [propsError, setPropsError] = useState<string | null>(null);
  const [propsReloadCount, setPropsReloadCount] = useState(0);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 5;

  const [paceData, setPaceData] = useState<PaceApiPoint[]>([]);
  const [isLoadingPace, setIsLoadingPace] = useState(false);
  const [paceError, setPaceError] = useState<string | null>(null);
  const [paceReloadCount, setPaceReloadCount] = useState(0);

  useEffect(() => {
    async function fetchProps() {
      try {
        setLoadingProps(true);
        setPropsError(null);
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
        setPropsError('Nao foi possivel carregar a lista de imoveis agora.');
      } finally {
        setLoadingProps(false);
      }
    }
    fetchProps();
  }, [propsReloadCount]);

  const fetchEvents = useCallback(async () => {
    try {
      setIsLoadingEvents(true);
      setEventsError(null);
      const result = await getEventosAcompanhando(propertyId || undefined, page, limit);
      setEvents(result.data);
      setTotalPages(Math.ceil(result.total / limit));
    } catch (err) {
      console.error('Erro ao carregar eventos', err);
      setEventsError('Nao foi possivel carregar as sugestoes do painel agora.');
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
        setPaceError(null);
        const points = await fetchPace(propertyId || undefined, { days: 60 });
        if (!cancelled) {
          setPaceData(points);
          setPaceError(null);
        }
      } catch (err) {
        console.error('Erro ao carregar pace', err);
        if (!cancelled) {
          setPaceError('Nao foi possivel carregar os dados de reservas futuras agora.');
        }
      } finally {
        if (!cancelled) setIsLoadingPace(false);
      }
    }
    loadPace();
    return () => {
      cancelled = true;
    };
  }, [propertyId, paceReloadCount]);

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

      {propsError && (
        <div style={{ marginTop: 18 }}>
          <InlineErrorNotice
            message={propsError}
            onRetry={() => setPropsReloadCount((count) => count + 1)}
          />
        </div>
      )}

      <DashboardCards propertyId={propertyId} />

      <div style={{ marginTop: 32 }}>
        <AppCard variant="default">
          <AppCardHeader
            eyebrow="RESERVAS FUTURAS"
            title="Reservas dos proximos 60 dias"
            subtitle={
              propertyId
                ? 'Quanto das suas noites futuras ja esta reservado, comparado ao ritmo esperado para a epoca. Eventos importantes aparecem destacados no grafico.'
                : 'Visao geral dos seus imoveis. Selecione um imovel para ver o grafico e as acoes sugeridas.'
            }
          />
          {paceError ? (
            <ApiErrorState
              title="Nao conseguimos carregar as reservas futuras"
              body={paceError}
              onRetry={() => setPaceReloadCount((count) => count + 1)}
              loading={isLoadingPace}
            />
          ) : (
            <PaceChart data={paceData} loading={isLoadingPace} height={280} />
          )}
        </AppCard>
      </div>

      <div style={{ marginTop: 32 }}>
        {isLoadingEvents ? (
          <AppLoadingStatus
            eyebrow="SUGESTOES"
            title="Procurando sugestoes de preco"
            body={
              propertyId
                ? "Estamos procurando eventos e oportunidades para este imovel."
                : "Estamos olhando seus imoveis para encontrar oportunidades importantes."
            }
            steps={[
              { id: 'property', label: propertyId ? 'Imovel escolhido' : 'Seus imoveis', status: 'complete' },
              { id: 'events', label: 'Eventos por perto', status: 'active' },
              { id: 'cards', label: 'Sugestoes', status: 'pending' },
            ]}
          />
        ) : eventsError ? (
          <ApiErrorState
            title="Nao conseguimos carregar as sugestoes"
            body={eventsError}
            onRetry={fetchEvents}
            loading={isLoadingEvents}
          />
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

function ApiErrorState({
  title,
  body,
  onRetry,
  loading,
}: {
  title: string;
  body: string;
  onRetry: () => void | Promise<void>;
  loading?: boolean;
}) {
  return (
    <AppEmptyState
      eyebrow="ALGO DEU ERRADO"
      title={title}
      body={body}
      icon={<Icons.AlertCircle size={32} />}
      action={
        <AppButton
          variant="primary"
          size="md"
          onClick={() => {
            void onRetry();
          }}
          loading={loading}
        >
          Tentar de novo
        </AppButton>
      }
    />
  );
}

function InlineErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <AppCard
      variant="default"
      style={{
        borderColor: "rgba(194, 52, 46, 0.25)",
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          color: "var(--app-danger)",
          fontSize: 13,
          fontWeight: 650,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icons.AlertCircle size={16} />
          {message}
        </span>
        <AppButton variant="secondary" size="sm" onClick={onRetry}>
          Tentar de novo
        </AppButton>
      </div>
    </AppCard>
  );
}
