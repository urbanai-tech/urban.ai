'use client';

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  fetchPace,
  formatPropertyPrimaryLabel,
  getEventosAcompanhando,
  getPropriedadesDropdownList,
  PaceApiPoint,
  PropertyDropdown,
} from '@/app/service/api';
import { EventItem } from '../dashboard/components/ItemEvento';
import { Pagination } from '../componentes/Pagination';
import { EventCard } from './components/ItemEventoPainel';
import DashboardCards from './components/StatCard';
import { PushNotificationOptIn } from '../componentes/PushNotificationOptIn';
import { AppButton, AppCard, AppCardHeader, AppEmptyState, AppLoadingStatus, AppPageShell, AppSectionHeader, Icons, PaceChart } from '../componentes/ui';
import { isTodayOrFutureDate } from '../lib/date';

const PropertySelect = dynamic(() => import('../componentes/PropertySelect'), { ssr: false });

// UX-4: mesma regra de prontidão usada em /properties — usa o setupStatus real
// quando existe, senão cai no analisado === 'completed'.
function isPropertyReady(prop: PropertyDropdown): boolean {
  return prop.setupStatus?.state ? prop.setupStatus.state === 'ready' : prop.analisado === 'completed';
}

const PREPARING_STEPS_FALLBACK = [
  { id: 'registered', label: 'Imóvel adicionado', status: 'complete' as const },
  { id: 'location', label: 'Preparar mapa', status: 'active' as const, detail: 'Endereço e raio' },
  { id: 'events', label: 'Procurar eventos perto', status: 'pending' as const, detail: 'Shows, feiras e jogos' },
  { id: 'recommendations', label: 'Preparar sugestões', status: 'pending' as const, detail: 'Preços por oportunidade' },
];

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
  const selectedProperty = propsInfo.find((property) => property.id === propertyId);
  const selectedPropertyName = selectedProperty
    ? formatPropertyPrimaryLabel(selectedProperty)
    : "todos os imóveis";

  // UX-4 (ponte tempo-até-valor): host novo cai no painel antes das análises
  // ficarem prontas. Em vez de mostrar KPIs zerados como estado final, surfaça
  // o mesmo card "preparando" de /properties enquanto NENHUM imóvel está pronto.
  const realProperties = propsInfo.filter((property) => property.id !== '');
  const allPreparing =
    realProperties.length > 0 && realProperties.every((property) => !isPropertyReady(property));
  const preparingSetupStatus = realProperties.find((property) => property.setupStatus)?.setupStatus;

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
          pricingInputsUpdatedAt: null,
        };

        setPropsInfo([todosOption, ...data]);
        setPropertyId('');
      } catch (err) {
        console.error('Erro ao carregar propriedades', err);
        setPropsError('Não foi possível carregar a lista de imóveis agora.');
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
      const actionableEvents = result.data.filter((event: EventItem) =>
        // 6a: evento multi-dia em andamento (dataFim no futuro) continua
        // acionável mesmo tendo começado antes de hoje.
        isTodayOrFutureDate(event.dataFim ?? event.dataInicio),
      );
      setEvents(actionableEvents);
      setTotalPages(Math.max(1, Math.ceil(result.total / limit)));
    } catch (err) {
      console.error('Erro ao carregar eventos', err);
      setEventsError('Não foi possível carregar as sugestões do painel agora.');
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
          setPaceError('Não foi possível carregar os dados de reservas futuras agora.');
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
        eyebrow="PAINEL - HOJE NA SUA OPERAÇÃO"
        title="Painel de controle"
        subtitle="Eventos com sugestão da Urban AI que merecem sua atenção agora. Filtre por imóvel pra focar onde tem mais oportunidade."
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
                  Filtrar imóvel
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

      {allPreparing && (
        <AppLoadingStatus
          compact
          eyebrow="PREPARANDO SUAS RECOMENDAÇÕES"
          title="Estamos preparando suas recomendações"
          body={
            preparingSetupStatus?.publicDescription ??
            "Mapa, eventos por perto e sugestões de preço aparecem assim que cada imóvel ficar pronto. Na primeira vez isso leva algumas horas — pode fechar e voltar depois."
          }
          tone="warn"
          steps={preparingSetupStatus?.steps ?? PREPARING_STEPS_FALLBACK}
          style={{ marginBottom: 16 }}
        />
      )}

      {propsError && (
        <div style={{ marginTop: 18 }}>
          <InlineErrorNotice
            message={propsError}
            onRetry={() => setPropsReloadCount((count) => count + 1)}
          />
        </div>
      )}

      <DashboardCards propertyId={propertyId} />

      <PainelActionCenter
        recommendationsCount={events.length}
        paceEventsCount={paceData.filter((point) => point.eventLabel).length}
        propertyName={selectedPropertyName}
      />

      <div style={{ marginTop: 32 }}>
        <AppCard variant="default">
          <AppCardHeader
            eyebrow="RESERVAS FUTURAS"
            title="Reservas dos próximos 60 dias"
            subtitle={
              propertyId
                ? 'Quanto das suas noites futuras já está reservado, comparado ao ritmo esperado para a época. Eventos importantes aparecem destacados no gráfico.'
                : 'Visão geral dos seus imóveis. Selecione um imóvel para ver o gráfico e as ações sugeridas.'
            }
          />
          {paceError ? (
            <ApiErrorState
              title="Não conseguimos carregar as reservas futuras"
              body={paceError}
              onRetry={() => setPaceReloadCount((count) => count + 1)}
              loading={isLoadingPace}
            />
          ) : (
            <PaceChart data={paceData} loading={isLoadingPace} height={280} />
          )}
        </AppCard>
      </div>

      <div id="painel-sugestoes" style={{ marginTop: 32 }}>
        {isLoadingEvents ? (
          <AppLoadingStatus
            eyebrow="SUGESTÕES"
            title="Procurando sugestões de preço"
            body={
              propertyId
                ? "Estamos procurando eventos e oportunidades para este imóvel."
                : "Estamos olhando seus imóveis para encontrar oportunidades importantes."
            }
            steps={[
              { id: 'property', label: propertyId ? 'Imóvel escolhido' : 'Seus imóveis', status: 'complete' },
              { id: 'events', label: 'Eventos por perto', status: 'active' },
              { id: 'cards', label: 'Sugestões', status: 'pending' },
            ]}
          />
        ) : eventsError ? (
          <ApiErrorState
            title="Não conseguimos carregar as sugestões"
            body={eventsError}
            onRetry={fetchEvents}
            loading={isLoadingEvents}
          />
        ) : events.length === 0 ? (
          <AppEmptyState
            eyebrow="SEM SUGESTÕES PENDENTES"
            title="Tudo certo por aqui"
            body="Quando a Urban AI detectar uma nova oportunidade de evento, ela aparece aqui. Você também recebe por e-mail."
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
      role="status"
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

function PainelActionCenter({
  recommendationsCount,
  paceEventsCount,
  propertyName,
}: {
  recommendationsCount: number;
  paceEventsCount: number;
  propertyName: string;
}) {
  return (
    <AppCard variant="accent" style={{ marginTop: 24, padding: 22 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 1fr) repeat(3, minmax(180px, 0.7fr))",
          gap: 14,
          alignItems: "stretch",
        }}
        className="painel-action-center"
      >
        <div style={{ minWidth: 0 }}>
          <p className="urban-app-eyebrow-muted" style={{ marginBottom: 8 }}>
            O que fazer agora
          </p>
          <h2 style={{ margin: 0, color: "var(--app-text)", fontSize: 22, lineHeight: 1.2 }}>
            Priorize as decisões que mudam preço hoje.
          </h2>
          <p style={{ margin: "8px 0 0", color: "var(--app-text-muted)", fontSize: 13, lineHeight: 1.5 }}>
            Foco atual: {propertyName}. O painel agora separa ação imediata, leitura de eventos e histórico.
          </p>
        </div>

        <ActionTile
          icon={<Icons.Sparkles size={16} />}
          label="Sugestões pendentes"
          value={String(recommendationsCount)}
          href="#painel-sugestoes"
        />
        <ActionTile
          icon={<Icons.Calendar size={16} />}
          label="Eventos no período"
          value={String(paceEventsCount)}
          href="/event-radar"
        />
        <ActionTile
          icon={<Icons.ArrowRight size={16} />}
          label="Histórico"
          value="Auditoria"
          href="/portfolio/history"
        />
      </div>

      <style>{`
        @media (max-width: 1050px) {
          .painel-action-center {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .painel-action-center {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </AppCard>
  );
}

function ActionTile({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="urban-focus-ring"
      style={{
        minHeight: 116,
        borderRadius: 10,
        border: "1px solid var(--app-divider)",
        background: "var(--app-surface)",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        color: "inherit",
        textDecoration: "none",
      }}
    >
      <span style={{ display: "inline-flex", color: "var(--app-accent)" }}>{icon}</span>
      <span>
        <span style={{ display: "block", color: "var(--app-text)", fontSize: 22, fontWeight: 750 }}>
          {value}
        </span>
        <span style={{ display: "block", marginTop: 3, color: "var(--app-text-muted)", fontSize: 12 }}>
          {label}
        </span>
      </span>
    </a>
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
