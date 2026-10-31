'use client';

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  getEventosPorPropriedade,
  getPropriedadesDropdownList,
  PropertyDropdown,
} from '../../app/service/api';
import { EventCard, type EventItem } from './components/ItemEvento';
import { SuggestionInfoPopover } from '../componentes/SuggestionInfoPopover';
import { PushNotificationOptIn } from '../componentes/PushNotificationOptIn';
import { NextSuggestionsGuide } from '../componentes/NextSuggestionsGuide';
import {
  AppPageShell,
  AppSectionHeader,
  AppButton,
  AppEmptyState,
  AppLoadingStatus,
  Icons,
} from '../componentes/ui';
import { emptyPeriodCopy, groupByStartDay, relativeDayLabel } from '../lib/host-today-domain';
import '../componentes/host-pages.css';

const PropertySelect = dynamic(() => import('../componentes/PropertySelect'), { ssr: false });

const makeEventKey = (ev: EventItem, index: number) =>
  ev.idAnalise || ev.id || [ev.nome, ev.dataInicio, ev.dataFim, ev.enderecoCompleto, index].join('|');

const FUTURE_MONTHS_TO_PRELOAD = 8;
const WEEKDAYS_PT_BR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MOBILE_QUERY = '(max-width: 767px)';

function dedupeEvents(events: EventItem[]): EventItem[] {
  const seen = new Set<string>();
  return events.filter((event, index) => {
    const fallbackKey = [event.nome, event.dataInicio, event.dataFim, event.enderecoCompleto].filter(Boolean).join('|');
    const key = event.idAnalise || event.id || fallbackKey || makeEventKey(event, index);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Celular mostra agenda; desktop mantém a grade do mês + painel. */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return isMobile;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function monthName(date: Date, short = false) {
  return format(date, short ? 'MMM' : 'MMMM', { locale: ptBR }).replace('.', '');
}

export default function CalendarioPage() {
  const isMobile = useIsMobile();
  const [allEvents, setAllEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const hoje = useMemo(() => startOfDay(new Date()), []);
  const mesMinimo = useMemo(() => startOfMonth(hoje), [hoje]);

  const [propsInfo, setPropsInfo] = useState<PropertyDropdown[]>([]);
  const [loadingPropsInfo, setLoadingPropsInfo] = useState(true);
  const [propertyId, setPropertyId] = useState('');

  const goToMonth = useCallback(
    (month: Date) => {
      const target = startOfMonth(month);
      setCurrentMonth(target < mesMinimo ? mesMinimo : target);
      setSelectedDay(null);
    },
    [mesMinimo],
  );

  const hasCompletedProperties = useMemo(() => propsInfo.some((property) => isPropertyReady(property)), [propsInfo]);
  const selectedPropertyInfo = useMemo(
    () => propsInfo.find((property) => property.id === propertyId),
    [propsInfo, propertyId],
  );

  const isActionableEvent = useCallback(
    (event: EventItem) => {
      const eventStart = startOfDay(parseISO(event.dataInicio));
      return Number.isFinite(eventStart.getTime()) && eventStart >= hoje;
    },
    [hoje],
  );

  const actionableEvents = useMemo(
    () =>
      allEvents
        .filter(isActionableEvent)
        .sort((a, b) => +parseISO(a.dataInicio) - +parseISO(b.dataInicio)),
    [allEvents, isActionableEvent],
  );

  const monthStrip = useMemo(
    () =>
      Array.from({ length: FUTURE_MONTHS_TO_PRELOAD + 1 }, (_, index) => {
        const date = startOfMonth(addMonths(mesMinimo, index));
        return {
          key: format(date, 'yyyy-MM'),
          date,
          label: monthName(date, true),
          count: actionableEvents.filter((event) =>
            isWithinInterval(parseISO(event.dataInicio), { start: date, end: endOfMonth(date) }),
          ).length,
        };
      }),
    [actionableEvents, mesMinimo],
  );

  const monthEvents = useMemo(
    () =>
      actionableEvents.filter((event) =>
        isWithinInterval(parseISO(event.dataInicio), {
          start: startOfMonth(currentMonth),
          end: endOfMonth(currentMonth),
        }),
      ),
    [actionableEvents, currentMonth],
  );

  const eventsByDay = useMemo(() => {
    const map: Record<string, EventItem[]> = {};
    monthEvents.forEach((event) => {
      const key = format(startOfDay(parseISO(event.dataInicio)), 'yyyy-MM-dd');
      (map[key] ??= []).push(event);
    });
    return map;
  }, [monthEvents]);

  const eventsToDisplay = useMemo(() => {
    if (!selectedDay) return monthEvents;
    return eventsByDay[format(selectedDay, 'yyyy-MM-dd')] ?? [];
  }, [selectedDay, monthEvents, eventsByDay]);

  const agenda = useMemo(() => groupByStartDay(eventsToDisplay), [eventsToDisplay]);

  const nextMonthWithEvents = useMemo(
    () => monthStrip.find((month) => month.date > currentMonth && month.count > 0) ?? null,
    [monthStrip, currentMonth],
  );

  const daysInMonth = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }),
    [currentMonth],
  );
  const leadingBlankDays = startOfMonth(currentMonth).getDay();
  const trailingBlankDays = (7 - ((leadingBlankDays + daysInMonth.length) % 7)) % 7;
  const prevDisabled = startOfMonth(currentMonth) <= mesMinimo;
  const lastMonth = monthStrip[monthStrip.length - 1]?.date;
  const nextDisabled = Boolean(lastMonth && startOfMonth(currentMonth) >= lastMonth);

  // O horizonte é sempre "mês atual + 8": trocar de mês não refaz a busca.
  const fetchEventsForHorizon = useCallback(async () => {
    const monthsToLoad = Array.from({ length: FUTURE_MONTHS_TO_PRELOAD + 1 }, (_, index) =>
      startOfMonth(addMonths(mesMinimo, index)).toISOString(),
    );
    const responses = await Promise.all(monthsToLoad.map((monthIso) => getEventosPorPropriedade(propertyId, monthIso)));
    return dedupeEvents(responses.flatMap((response) => response?.data ?? []));
  }, [mesMinimo, propertyId]);

  const refreshSilently = useCallback(async () => {
    try {
      setAllEvents(await fetchEventsForHorizon());
    } catch (err) {
      console.error(err);
    }
  }, [fetchEventsForHorizon]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const events = await fetchEventsForHorizon();
        if (!cancelled) setAllEvents(events);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('Não foi possível carregar as sugestões agora.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    if (propertyId) void load();
    else {
      setAllEvents([]);
      setIsLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [propertyId, fetchEventsForHorizon, reloadCount]);

  useEffect(() => {
    async function fetchPropsInfo() {
      try {
        setLoadingPropsInfo(true);
        const data = await getPropriedadesDropdownList();
        setPropsInfo(data);
        const defaultProp = data.find(isPropertyReady);
        setPropertyId(defaultProp ? defaultProp.id : '');
        if (!defaultProp) setIsLoading(false);
      } catch (err) {
        console.error(err);
        setIsLoading(false);
      } finally {
        setLoadingPropsInfo(false);
      }
    }
    fetchPropsInfo();
  }, []);

  // Enquanto algum imóvel está sendo preparado, confere a cada 3s se ficou pronto.
  useEffect(() => {
    if (propsInfo.length === 0 || propsInfo.every((property) => isPropertyReady(property))) return;
    const intervalId = setInterval(async () => {
      try {
        const data = await getPropriedadesDropdownList();
        const becameReady = propsInfo.some((oldItem) => {
          const newItem = data.find((n) => n.id === oldItem.id);
          return !isPropertyReady(oldItem) && Boolean(newItem && isPropertyReady(newItem));
        });
        if (!becameReady) return;
        setPropsInfo(data);
        if (!propertyId || !isPropertyReady(propsInfo.find((p) => p.id === propertyId))) {
          const defaultProp = data.find(isPropertyReady);
          if (defaultProp) setPropertyId(defaultProp.id);
        }
      } catch (err) {
        console.error(err);
      }
    }, 3000);
    return () => clearInterval(intervalId);
  }, [propsInfo, propertyId]);

  const periodLabel = monthName(currentMonth);
  const periodCount = monthEvents.length;
  const empty = emptyPeriodCopy({
    periodLabel,
    nextPeriodLabel: nextMonthWithEvents ? monthName(nextMonthWithEvents.date) : null,
    nextPeriodCount: nextMonthWithEvents?.count,
  });
  const propertyPreparing = selectedPropertyInfo && !isPropertyReady(selectedPropertyInfo);
  const guideProperties = selectedPropertyInfo ? [selectedPropertyInfo, ...propsInfo] : propsInfo;

  const periodSelector = (
    <div className="urban-cal-period" data-calendar-period>
      <div className="urban-cal-period__nav">
        <button
          type="button"
          className="urban-cal-nav-btn urban-focus-ring"
          onClick={() => goToMonth(addMonths(currentMonth, -1))}
          disabled={prevDisabled}
          aria-label="Mês anterior"
        >
          <Icons.ArrowLeft size={16} />
        </button>
        <h2 className="urban-cal-period__title" aria-live="polite">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          <span className="urban-cal-period__count">
            {periodCount === 1 ? '1 sugestão' : `${periodCount} sugestões`}
          </span>
        </h2>
        <button
          type="button"
          className="urban-cal-nav-btn urban-focus-ring"
          onClick={() => goToMonth(addMonths(currentMonth, 1))}
          disabled={nextDisabled}
          aria-label="Próximo mês"
        >
          <Icons.ArrowRight size={16} />
        </button>
      </div>
      <ul className="urban-cal-months" aria-label="Meses com sugestões">
        {monthStrip.map((month) => {
          const active = startOfMonth(currentMonth).getTime() === month.date.getTime();
          return (
            <li key={month.key}>
              <button
                type="button"
                className="urban-cal-month urban-focus-ring"
                aria-pressed={active}
                data-empty={month.count === 0 || undefined}
                // WCAG 2.5.3: o nome acessível começa pelo texto visível ("out 0"), depois o mês por extenso.
                aria-label={`${month.label} ${month.count === 1 ? '1 sugestão' : `${month.count} sugestões`} em ${monthName(month.date)}`}
                onClick={() => goToMonth(month.date)}
              >
                {month.label}{' '}
                <span className="urban-cal-month__count">{month.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const emptyState = selectedDay ? (
    <AppEmptyState
      eyebrow="DIA SEM SUGESTÃO"
      title="Nenhuma sugestão neste dia"
      body="Escolha outro dia marcado no calendário ou veja o mês inteiro."
      icon={<Icons.Calendar size={28} />}
      action={
        <AppButton size="md" variant="secondary" onClick={() => setSelectedDay(null)}>
          Ver o mês inteiro
        </AppButton>
      }
    />
  ) : !nextMonthWithEvents && !propertyPreparing ? (
    // MKT-05: nenhum evento à frente, nem nos próximos meses: explica e mostra o que vem a seguir.
    <NextSuggestionsGuide
      properties={guideProperties}
      eyebrow="SEM SUGESTÕES NO PERÍODO"
      title={empty.title}
    />
  ) : (
    <AppEmptyState
      eyebrow="SEM SUGESTÕES NO PERÍODO"
      title={empty.title}
      body={
        propertyPreparing
          ? selectedPropertyInfo?.setupStatus?.publicDescription ??
            'Este imóvel ainda está sendo preparado. As sugestões aparecem quando mapa, eventos e valor de referência estiverem prontos.'
          : empty.body
      }
      icon={<Icons.Calendar size={28} />}
      action={
        nextMonthWithEvents ? (
          <AppButton
            size="md"
            variant="primary"
            onClick={() => goToMonth(nextMonthWithEvents.date)}
            rightIcon={<Icons.ArrowRight size={14} />}
          >
            Ver {monthName(nextMonthWithEvents.date)}
          </AppButton>
        ) : undefined
      }
    />
  );

  const agendaList =
    eventsToDisplay.length === 0 ? (
      emptyState
    ) : (
      <ol className="urban-cal-agenda" aria-label="Sugestões por dia" data-calendar-agenda>
        {agenda.map((group) => {
          const day = parseISO(group.dayKey);
          return (
            <li key={group.dayKey} className="urban-cal-agenda__day">
              <h3 className="urban-cal-agenda__day-label">
                {capitalize(format(day, "EEEE, d 'de' MMMM", { locale: ptBR }))}
                <span>{relativeDayLabel(group.items[0].dataInicio)}</span>
              </h3>
              <ul className="urban-cal-agenda__items">
                {group.items.map((ev, index) => (
                  <li key={makeEventKey(ev, index)}>
                    <EventCard
                      setIsLoading={setIsLoading}
                      onChange={() => void refreshSilently()}
                      ev={ev}
                      cardBorder="gray.200"
                      bg="white"
                      propertyId={propertyId}
                    />
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    );

  return (
    <AppPageShell maxWidth={1400}>
      <div className="urban-host-page">
        <AppSectionHeader
          title="Calendário"
          subtitle="Dias com sugestão de preço para o imóvel escolhido."
          actions={
            <label className="urban-host-filter">
              <span className="urban-host-filter__label">Imóvel</span>
              <PropertySelect value={propertyId} propsInfo={propsInfo} setPropertyId={setPropertyId} />
            </label>
          }
        />

        <PushNotificationOptIn variant="compact" />

        {loadingPropsInfo || isLoading ? (
          <AppLoadingStatus
            compact
            eyebrow="CALENDÁRIO"
            title={loadingPropsInfo ? 'Carregando seus imóveis' : 'Procurando sugestões de preço'}
            steps={[
              { id: 'properties', label: 'Seus imóveis', status: loadingPropsInfo ? 'active' : 'complete' },
              { id: 'events', label: 'Eventos por perto', status: loadingPropsInfo ? 'pending' : 'active' },
              { id: 'recommendations', label: 'Sugestões no calendário', status: 'pending' },
            ]}
          />
        ) : !propertyId || !hasCompletedProperties ? (
          <AppEmptyState
            eyebrow="IMÓVEIS"
            title="Ainda não há imóvel pronto para sugestões"
            body="Assim que o cadastro terminar, as sugestões aparecem aqui. Se estiver demorando, confira o endereço e a diária de referência em Imóveis."
            icon={<Icons.Sparkles size={32} />}
            action={
              <AppButton as="a" href="/properties" variant="primary" size="md" rightIcon={<Icons.ArrowRight size={14} />}>
                Ver Imóveis
              </AppButton>
            }
          />
        ) : error ? (
          <AppEmptyState
            eyebrow="ALGO DEU ERRADO"
            title="Não conseguimos carregar o calendário"
            body={error}
            icon={<Icons.AlertCircle size={28} />}
            action={
              <AppButton variant="primary" size="md" onClick={() => setReloadCount((c) => c + 1)}>
                Tentar de novo
              </AppButton>
            }
          />
        ) : isMobile ? (
          <>
            {periodSelector}
            {agendaList}
          </>
        ) : (
          <div className="urban-cal-layout">
            <div>
              {periodSelector}
              <div className="urban-cal-grid-card">
                <div className="urban-cal-weekdays" aria-hidden="true">
                  {WEEKDAYS_PT_BR.map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className="urban-cal-days">
                  {Array.from({ length: leadingBlankDays }, (_, index) => (
                    <span aria-hidden="true" className="urban-cal-day-spacer" key={`leading-${index}`} />
                  ))}
                  {daysInMonth.map((day) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const dayEvents = eventsByDay[dateKey] || [];
                    const isPastDay = startOfDay(day) < hoje;
                    const isSelected = Boolean(selectedDay && isSameDay(day, selectedDay));
                    return (
                      <button
                        className="urban-cal-day urban-focus-ring"
                        key={dateKey}
                        type="button"
                        disabled={isPastDay}
                        aria-pressed={isSelected}
                        data-today={isSameDay(day, hoje) || undefined}
                        aria-label={`${format(day, "d 'de' MMMM", { locale: ptBR })}${dayEvents.length ? `, ${dayEvents.length === 1 ? '1 sugestão' : `${dayEvents.length} sugestões`}` : ''}`}
                        onClick={() => setSelectedDay(isSelected ? null : day)}
                      >
                        <span>{format(day, 'd')}</span>
                        {dayEvents.length > 0 && <span className="urban-cal-day__dot" data-count={dayEvents.length} aria-hidden="true" />}
                      </button>
                    );
                  })}
                  {Array.from({ length: trailingBlankDays }, (_, index) => (
                    <span aria-hidden="true" className="urban-cal-day-spacer" key={`trailing-${index}`} />
                  ))}
                </div>
              </div>
            </div>

            <section className="urban-cal-panel" aria-labelledby="calendario-painel-title">
              <div className="urban-cal-panel__head">
                <div>
                  <p className="urban-app-eyebrow-muted">{selectedDay ? 'DIA SELECIONADO' : 'SUGESTÕES DO MÊS'}</p>
                  <h2 id="calendario-painel-title" className="urban-host-section__title">
                    {selectedDay ? format(selectedDay, "d 'de' MMMM", { locale: ptBR }) : periodLabel}
                  </h2>
                </div>
                <div className="urban-host-section__head">
                  <SuggestionInfoPopover description="Comparamos seu imóvel com outros parecidos (camas, capacidade, banheiros, faixa de valor e localização) e somamos os eventos próximos e o impacto deles na procura." />
                  {selectedDay && (
                    <AppButton size="md" variant="ghost" onClick={() => setSelectedDay(null)}>
                      Mês inteiro
                    </AppButton>
                  )}
                </div>
              </div>
              {agendaList}
            </section>
          </div>
        )}
      </div>
    </AppPageShell>
  );
}

function isPropertyReady(property?: PropertyDropdown): boolean {
  if (!property) return false;
  return property.setupStatus?.state ? property.setupStatus.state === 'ready' : property.analisado === 'completed';
}
