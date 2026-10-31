'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  fetchPace,
  getEventosAcompanhando,
  getPropriedadesDropdownList,
  PaceApiPoint,
  PropertyDropdown,
} from '@/app/service/api';
import { EventItem } from '../dashboard/components/ItemEvento';
import { PendingOutcomes } from '../dashboard/components/PendingOutcomes';
import { Pagination } from '../componentes/Pagination';
import { EventCard } from './components/ItemEventoPainel';
import MetricStrip from './components/StatCard';
import { PushNotificationOptIn } from '../componentes/PushNotificationOptIn';
import { NextSuggestionsGuide } from '../componentes/NextSuggestionsGuide';
import {
  AppButton,
  AppCard,
  AppCardHeader,
  AppEmptyState,
  AppLoadingStatus,
  AppPageShell,
  AppSectionHeader,
  Icons,
  PaceChart,
} from '../componentes/ui';
import { relativeDayLabel, sortOpportunities } from '../lib/host-today-domain';
import '../componentes/host-pages.css';

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

const whenFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'short',
  day: '2-digit',
  month: 'short',
});

/**
 * Hoje (/painel): primeiro a ação, depois os números.
 *  1. "Como foi?" — resultados pendentes de preços já aplicados;
 *  2. próximas oportunidades, por data e ganho por noite, com a ação principal;
 *  3. faixa compacta de métricas (chips) e o gráfico de reservas.
 */
export default function HojePage() {
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
  const [totalEvents, setTotalEvents] = useState(0);
  const limit = 5;

  const [paceData, setPaceData] = useState<PaceApiPoint[]>([]);
  const [isLoadingPace, setIsLoadingPace] = useState(false);
  const [paceError, setPaceError] = useState<string | null>(null);
  const [paceReloadCount, setPaceReloadCount] = useState(0);

  // UX-4 (ponte tempo-até-valor): enquanto NENHUM imóvel está pronto, mostra o
  // card "preparando" em vez de uma lista vazia.
  const realProperties = propsInfo.filter((property) => property.id !== '');
  const allPreparing =
    realProperties.length > 0 && realProperties.every((property) => !isPropertyReady(property));
  const preparingSetupStatus = realProperties.find((property) => property.setupStatus)?.setupStatus;
  const hasNoProperties = !loadingProps && !propsError && realProperties.length === 0;
  // Cidade da agenda: do imóvel escolhido ou, em "Todos", do primeiro imóvel pronto.
  const guideCandidates = realProperties.filter((property) => !propertyId || property.id === propertyId);
  const guideProperties = guideCandidates.filter(isPropertyReady).concat(guideCandidates);

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
      setEvents(Array.isArray(result?.data) ? result.data : []);
      setTotalEvents(Number(result?.total) || 0);
      setTotalPages(Math.max(1, Math.ceil((Number(result?.total) || 0) / limit)));
    } catch (err) {
      console.error('Erro ao carregar eventos', err);
      setEventsError('Não foi possível carregar as sugestões agora.');
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
        if (!cancelled) setPaceData(points);
      } catch (err) {
        console.error('Erro ao carregar pace', err);
        if (!cancelled) setPaceError('Não foi possível carregar os dados de reservas futuras agora.');
      } finally {
        if (!cancelled) setIsLoadingPace(false);
      }
    }
    loadPace();
    return () => {
      cancelled = true;
    };
  }, [propertyId, paceReloadCount]);

  // 6a: evento multi-dia em andamento continua acionável; a ordem põe a
  // decisão mais próxima e de maior ganho por noite primeiro.
  const opportunities = useMemo(() => sortOpportunities(events), [events]);
  const pendingDecisions = opportunities.filter(
    (ev) => !ev.aceito && ev.status !== 'rejected' && ev.status !== 'applied_manual' && ev.status !== 'applied_stays',
  ).length;

  return (
    <AppPageShell maxWidth={1080}>
      <div className="urban-host-page">
        <AppSectionHeader
          title="Hoje"
          subtitle="Decida os preços que mais importam agora."
          actions={
            loadingProps ? (
              <span className="urban-host-section__meta" role="status">Carregando imóveis…</span>
            ) : (
              <label className="urban-host-filter">
                <span className="urban-host-filter__label">Imóvel</span>
                <PropertySelect
                  value={propertyId}
                  propsInfo={propsInfo}
                  setPropertyId={(id) => {
                    setPropertyId(id);
                    setPage(1);
                  }}
                />
              </label>
            )
          }
        />

        {propsError && (
          <div className="urban-host-section urban-host-notice" role="alert">
            <div className="urban-host-section__head">
              <span className="urban-host-section__meta">
                <Icons.AlertCircle size={16} /> {propsError}
              </span>
              <AppButton variant="secondary" size="sm" onClick={() => setPropsReloadCount((c) => c + 1)}>
                Tentar de novo
              </AppButton>
            </div>
          </div>
        )}

        {allPreparing && (
          <AppLoadingStatus
            compact
            eyebrow="PREPARANDO SUAS RECOMENDAÇÕES"
            title="Estamos preparando suas recomendações"
            body={
              preparingSetupStatus?.publicDescription ??
              'Mapa, eventos por perto e sugestões de preço aparecem assim que cada imóvel ficar pronto. Na primeira vez isso leva algumas horas — pode fechar e voltar depois.'
            }
            tone="warn"
            steps={preparingSetupStatus?.steps ?? PREPARING_STEPS_FALLBACK}
          />
        )}

        {/* (a) Como foi? — só aparece quando há resultado pendente. */}
        <div className="urban-host-section" data-today-section="outcomes">
          <PendingOutcomes />
        </div>

        {/* (b) Próximas oportunidades */}
        <section
          id="painel-sugestoes"
          className="urban-host-section"
          aria-labelledby="hoje-oportunidades-title"
          data-today-section="opportunities"
        >
          <div className="urban-host-section__head">
            <h2 id="hoje-oportunidades-title" className="urban-host-section__title">
              Próximas oportunidades
            </h2>
            {!isLoadingEvents && !eventsError && opportunities.length > 0 && (
              <span className="urban-host-section__meta">
                {pendingDecisions === 1 ? '1 para decidir' : `${pendingDecisions} para decidir`}
                {totalEvents > opportunities.length ? ` · ${totalEvents} no total` : ''}
              </span>
            )}
          </div>

          {isLoadingEvents ? (
            <AppLoadingStatus
              compact
              eyebrow="SUGESTÕES"
              title="Procurando sugestões de preço"
              steps={[
                { id: 'property', label: propertyId ? 'Imóvel escolhido' : 'Seus imóveis', status: 'complete' },
                { id: 'events', label: 'Eventos por perto', status: 'active' },
                { id: 'cards', label: 'Sugestões', status: 'pending' },
              ]}
            />
          ) : eventsError ? (
            <AppEmptyState
              eyebrow="ALGO DEU ERRADO"
              title="Não conseguimos carregar as sugestões"
              body={eventsError}
              icon={<Icons.AlertCircle size={32} />}
              action={
                <AppButton variant="primary" size="md" onClick={() => void fetchEvents()}>
                  Tentar de novo
                </AppButton>
              }
            />
          ) : opportunities.length === 0 ? (
            allPreparing ? null : hasNoProperties ? (
              <AppEmptyState
                eyebrow="COMECE POR AQUI"
                title="Adicione seu primeiro imóvel"
                body="Com o endereço e a diária de referência, o My Urban encontra eventos perto e sugere o preço da noite."
                icon={<Icons.Sparkles size={32} />}
                action={
                  <AppButton as="a" href="/properties" variant="primary" size="md" rightIcon={<Icons.ArrowRight size={14} />}>
                    Adicionar imóvel
                  </AppButton>
                }
              />
            ) : (
              // MKT-05: sem sugestão não é tela vazia: explica o porquê e o que vem a seguir.
              <NextSuggestionsGuide properties={guideProperties} />
            )
          ) : (
            <>
              <ol className="urban-today-list" aria-label="Oportunidades por data">
                {opportunities.map((ev) => {
                  const start = new Date(ev.dataInicio);
                  const validStart = Number.isFinite(start.getTime());
                  return (
                    <li key={ev.idAnalise || ev.id} className="urban-today-item" data-today-item={ev.idAnalise || ev.id}>
                      {validStart && (
                        <span className="urban-today-item__when">
                          <Icons.Calendar size={14} aria-hidden="true" />
                          <strong>{relativeDayLabel(start)}</strong>
                          <span aria-hidden="true">·</span>
                          {whenFormatter.format(start).replace(/\./g, '')}
                        </span>
                      )}
                      <EventCard
                        ev={ev}
                        cardBorder="gray.200"
                        bg="white"
                        propertyId={propertyId}
                        setIsLoading={setIsLoadingEvents}
                        onChange={() => fetchEvents()}
                      />
                    </li>
                  );
                })}
              </ol>
              {totalPages > 1 && (
                <Pagination paginaAtual={page} totalPaginas={totalPages} onPageChange={(nova) => setPage(nova)} />
              )}
              <p className="urban-host-section__meta">Você decide se aceita. Nada muda sem a sua aprovação.</p>
            </>
          )}
        </section>

        {/* (c) Números em chips, sem roubar a cena da decisão */}
        <section className="urban-host-section" aria-labelledby="hoje-numeros-title" data-today-section="metrics">
          <div className="urban-host-section__head">
            <h2 id="hoje-numeros-title" className="urban-host-section__title">
              Seus números
            </h2>
            <a className="urban-host-link" href="/portfolio/history">
              Histórico <Icons.ArrowRight size={14} />
            </a>
          </div>
          <MetricStrip propertyId={propertyId} />
        </section>

        <PushNotificationOptIn variant="compact" />

        <section className="urban-host-section" data-today-section="pace">
          <AppCard variant="default">
            <AppCardHeader
              eyebrow="RESERVAS FUTURAS"
              title="Próximos 60 dias"
              subtitle={
                propertyId
                  ? 'Noites já reservadas comparadas ao ritmo esperado. Eventos aparecem destacados.'
                  : 'Escolha um imóvel para ver o gráfico.'
              }
            />
            {paceError ? (
              <AppEmptyState
                eyebrow="ALGO DEU ERRADO"
                title="Não conseguimos carregar as reservas futuras"
                body={paceError}
                icon={<Icons.AlertCircle size={32} />}
                action={
                  <AppButton variant="secondary" size="md" onClick={() => setPaceReloadCount((c) => c + 1)} loading={isLoadingPace}>
                    Tentar de novo
                  </AppButton>
                }
              />
            ) : (
              <PaceChart data={paceData} loading={isLoadingPace} height={240} />
            )}
          </AppCard>
        </section>
      </div>
    </AppPageShell>
  );
}
