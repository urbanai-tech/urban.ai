'use client';

import {
  addMonths,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  format,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DateRange } from 'react-day-picker';
import {
  getEventosPorPropriedade,
  getPropriedadesDropdownList,
  PropertyDropdown,
} from '../../app/service/api';
import dynamic from 'next/dynamic';
import { EventCard } from './components/ItemEvento';

import { SuggestionInfoPopover } from '../componentes/SuggestionInfoPopover';
import { PushNotificationOptIn } from '../componentes/PushNotificationOptIn';
import {
  AppPageShell,
  AppSectionHeader,
  AppCard,
  AppButton,
  AppEmptyState,
  AppLoadingStatus,
  Icons,
} from '../componentes/ui';

const PropertySelect = dynamic(() => import('../componentes/PropertySelect'), { ssr: false });

interface EventItem {
  id: string;
  nome: string;
  dataInicio: string;
  dataFim: string;
  enderecoCompleto: string;
  cidade: string;
  estado: string;
  precoSugerido: string;
  seuPrecoAtual: string;
  diferencaPercentual: string;
  recomendacao: string;
  distancia_metros: string;
  idAnalise: string;
  aceito: boolean;
}

const makeEventKey = (ev: EventItem, index: number) =>
  ev.idAnalise ||
  ev.id ||
  [
    ev.nome,
    ev.dataInicio,
    ev.dataFim,
    ev.enderecoCompleto,
    index,
  ].join("|");

const FUTURE_MONTHS_TO_PRELOAD = 8;
const WEEKDAYS_PT_BR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function dedupeEvents(events: EventItem[]): EventItem[] {
  const seen = new Set<string>();
  return events.filter((event, index) => {
    const fallbackKey = [event.nome, event.dataInicio, event.dataFim, event.enderecoCompleto]
      .filter(Boolean)
      .join("|");
    const key =
      event.idAnalise ||
      event.id ||
      fallbackKey ||
      makeEventKey(event, index);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function DashboardPage() {
  const [range] = useState<DateRange>();
  const [allEvents, setAllEvents] = useState<EventItem[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [searchTerm] = useState('');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const hoje = useMemo(() => startOfDay(new Date()), []);
  const mesMinimo = useMemo(() => startOfMonth(hoje), [hoje]);

  const [propsInfo, setPropsInfo] = useState<PropertyDropdown[]>([]);
  const [loadingPropsInfo, setLoadingPropsInfo] = useState(true);
  const [, setErrorPropsInfo] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState('');

  useEffect(() => {
    if (startOfMonth(currentMonth) < mesMinimo) setCurrentMonth(mesMinimo);
  }, [mesMinimo, currentMonth]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const nova = new Date(prev);
      nova.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      const inicioNova = startOfMonth(nova);
      if (direction === 'prev' && inicioNova < mesMinimo) return prev;
      return nova;
    });
    setSelectedDay(null);
  };

  const navigateToMonth = (month: Date) => {
    setCurrentMonth(startOfMonth(month));
    setSelectedDay(null);
  };

  const prevDesabilitado = useMemo(
    () => startOfMonth(currentMonth) <= mesMinimo,
    [currentMonth, mesMinimo]
  );
  const hasCompletedProperties = useMemo(
    () => propsInfo.some((property) => isPropertyReady(property)),
    [propsInfo],
  );
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

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);
  const calendarLeadingBlankDays = startOfMonth(currentMonth).getDay();
  const calendarTrailingBlankDays =
    (7 - ((calendarLeadingBlankDays + daysInMonth.length) % 7)) % 7;

  const visibleWindow = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return { start, end };
  }, [currentMonth]);

  const monthStrip = useMemo(
    () =>
      Array.from({ length: FUTURE_MONTHS_TO_PRELOAD + 1 }, (_, index) => {
        const date = startOfMonth(addMonths(currentMonth, index));
        return {
          key: format(date, 'yyyy-MM'),
          date,
          label: format(date, 'MMM', { locale: ptBR }).replace('.', ''),
          count: allEvents.filter((event) => {
            if (!isActionableEvent(event)) return false;
            const eventStart = parseISO(event.dataInicio);
            return isWithinInterval(eventStart, {
              start: startOfMonth(date),
              end: endOfMonth(date),
            });
          }).length,
        };
      }),
    [allEvents, currentMonth, isActionableEvent],
  );

  const visibleWindowEvents = useMemo(
    () =>
      allEvents.filter((event) => {
        if (!isActionableEvent(event)) return false;
        const eventStart = parseISO(event.dataInicio);
        return isWithinInterval(eventStart, visibleWindow);
      }),
    [allEvents, isActionableEvent, visibleWindow],
  );

  const futureEventsOutsideWindow = useMemo(
    () =>
      allEvents.filter((event) => {
        if (!isActionableEvent(event)) return false;
        const eventStart = parseISO(event.dataInicio);
        return eventStart > visibleWindow.end;
      }),
    [allEvents, isActionableEvent, visibleWindow.end],
  );

  const futureMonthsWithEvents = useMemo(
    () => monthStrip.filter((month) => month.date > visibleWindow.start && month.count > 0),
    [monthStrip, visibleWindow.start],
  );

  const nextMonthWithEvents = futureMonthsWithEvents[0] ?? null;

  const windowSummaryLabel = useMemo(
    () =>
      `${format(visibleWindow.start, 'dd/MM', { locale: ptBR })} a ${format(
        visibleWindow.end,
        'dd/MM',
        { locale: ptBR },
      )}`,
    [visibleWindow],
  );

  const eventsByDay = useMemo(() => {
    const map: Record<string, EventItem[]> = {};
    filteredEvents.forEach(event => {
      const start = startOfDay(parseISO(event.dataInicio));
      const dateKey = format(start, 'yyyy-MM-dd');
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(event);
    });
    return map;
  }, [filteredEvents]);

  const filterEvents = useCallback((source: EventItem[] = allEvents) => {
    let result = source.filter(isActionableEvent);

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        event =>
          event.nome.toLowerCase().includes(term) ||
          event.enderecoCompleto.toLowerCase().includes(term) ||
          event.cidade.toLowerCase().includes(term)
      );
    }

    if (range?.from && range.to) {
      const startDate = startOfDay(range.from);
      const endDate = endOfDay(range.to);
      result = result.filter(event => {
        const eventStart = parseISO(event.dataInicio);
        const eventEnd = parseISO(event.dataFim);
        return (
          isWithinInterval(eventStart, { start: startDate, end: endDate }) ||
          isWithinInterval(eventEnd, { start: startDate, end: endDate }) ||
          (eventStart <= startDate && eventEnd >= endDate)
        );
      });
    }

    return result;
  }, [allEvents, isActionableEvent, searchTerm, range]);

  const fetchEventsForVisibleHorizon = useCallback(async () => {
    const monthsToLoad = Array.from({ length: FUTURE_MONTHS_TO_PRELOAD + 1 }, (_, index) =>
      startOfMonth(addMonths(currentMonth, index)).toISOString(),
    );
    const responses = await Promise.all(
      monthsToLoad.map((monthIso) => getEventosPorPropriedade(propertyId, monthIso)),
    );
    return dedupeEvents(responses.flatMap((response) => response.data ?? []));
  }, [currentMonth, propertyId]);

  const fetchEventsSemLoading = async () => {
    setError(null);
    try {
      const events = await fetchEventsForVisibleHorizon();
      setAllEvents(events);
      setFilteredEvents(filterEvents(events));
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar eventos');
    }
  };

  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const events = await fetchEventsForVisibleHorizon();
        setAllEvents(events);
      } catch (err) {
        console.error(err);
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
  }, [propertyId, fetchEventsForVisibleHorizon]);

  useEffect(() => {
    async function fetchPropsInfo() {
      try {
        setLoadingPropsInfo(true);
        setErrorPropsInfo(null);
        const data = await getPropriedadesDropdownList();
        setPropsInfo(data);

        const defaultProp = data.find(isPropertyReady);
        if (defaultProp) {
          setPropertyId(defaultProp.id);
          setLoadingPropsInfo(false);
        } else {
          setPropertyId('');
          setIsLoading(false);
          setLoadingPropsInfo(false);
        }
      } catch (err) {
        setErrorPropsInfo('Erro ao carregar propriedades');
        console.error(err);
        setLoadingPropsInfo(false);
      }
    }
    fetchPropsInfo();
  }, []);

  useEffect(() => {
    async function fetchPropsInfo() {
      try {
        setErrorPropsInfo(null);
        const data = await getPropriedadesDropdownList();

        if (propsInfo.length > 0 && data.length > 0) {
          const completedProps = propsInfo.filter((oldItem) => {
            const newItem = data.find((n) => n.id === oldItem.id);
            return !isPropertyReady(oldItem) && Boolean(newItem && isPropertyReady(newItem));
          });

          if (completedProps.length > 0) {
            setPropsInfo(data);

            if (!propertyId || !isPropertyReady(propsInfo.find(p => p.id === propertyId))) {
              const defaultProp = data.find(isPropertyReady);
              if (defaultProp) {
                setPropertyId(defaultProp.id);
              }
            }
          }
        }
      } catch (err) {
        setErrorPropsInfo("Erro ao carregar propriedades");
        console.error(err);
      }
    }

    fetchPropsInfo();
    const intervalId = setInterval(fetchPropsInfo, 3000);
    return () => clearInterval(intervalId);
  }, [propsInfo, propertyId]);

  useEffect(() => {
    setFilteredEvents(filterEvents());
  }, [filterEvents, allEvents]);

  const eventsToDisplay = useMemo(() => {
    if (selectedDay) {
      if (startOfDay(selectedDay) < hoje) return [];
      const dateKey = format(selectedDay, 'yyyy-MM-dd');
      return eventsByDay[dateKey] || [];
    }
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return allEvents
      .filter(event => {
        if (!isActionableEvent(event)) return false;
        const s = parseISO(event.dataInicio);
        return isWithinInterval(s, { start: monthStart, end: monthEnd });
      })
      .sort((a, b) => +parseISO(a.dataInicio) - +parseISO(b.dataInicio));
  }, [selectedDay, currentMonth, allEvents, eventsByDay, hoje, isActionableEvent]);

  return (
    <AppPageShell maxWidth={1400}>
      <AppSectionHeader
        eyebrow="CALENDÁRIO · EVENTOS POR DIA"
        title="Calendário"
        subtitle="Visualize os eventos com sugestões de preço da Urban AI para o imóvel selecionado. Clique em um dia para ver detalhes."
        actions={
          <div className="dashboard-property-filter">
            <label>Filtrar imóvel</label>
            <PropertySelect value={propertyId} propsInfo={propsInfo} setPropertyId={setPropertyId} />
          </div>
        }
      />

      <PushNotificationOptIn variant="compact" />

      {loadingPropsInfo || isLoading ? (
        <AppLoadingStatus
          eyebrow="CALENDÁRIO"
          title={loadingPropsInfo ? "Carregando seus imóveis" : "Procurando eventos e sugestões de preço"}
          body={
            loadingPropsInfo
              ? "Estamos vendo quais imóveis já estão prontos para receber sugestões."
              : "Estamos olhando o imóvel, o mês escolhido e os eventos perto dele."
          }
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
          body="Assim que o cadastro terminar, as sugestões aparecem aqui. Se estiver demorando, confira o endereço e se o plano ainda permite novos imóveis."
          icon={<Icons.Sparkles size={32} />}
        />
      ) : error ? (
        <AppCard variant="default" style={{ borderColor: 'rgba(194, 52, 46, 0.25)' }}>
          <div className="dashboard-error">
            <Icons.AlertCircle size={18} />
            <span>{error}</span>
          </div>
        </AppCard>
      ) : (
        <div className="dashboard-content-grid">
          <div className="dashboard-calendar-column">
            <div className="dashboard-window-summary" aria-live="polite">
              <div>
                <p className="urban-app-eyebrow-muted">JANELA VISÍVEL</p>
                <strong>{windowSummaryLabel}</strong>
                <span>
                  {visibleWindowEvents.length === 1
                    ? '1 sugestão nesta janela'
                    : `${visibleWindowEvents.length} sugestões nesta janela`}
                </span>
              </div>
              <div className="dashboard-future-counter">
                <Icons.Calendar size={18} />
                <span>
                  {futureEventsOutsideWindow.length === 1
                    ? '1 sugestão futura fora desta janela'
                    : `${futureEventsOutsideWindow.length} sugestões futuras fora desta janela`}
                </span>
              </div>
            </div>

            <AppCard variant="default" style={{ padding: 20 }}>
              <div className="dashboard-calendar-header">
                <AppButton
                  size="sm"
                  variant="secondary"
                  onClick={() => navigateMonth('prev')}
                  disabled={prevDesabilitado}
                  leftIcon={<Icons.ArrowLeft size={14} />}
                >
                  Anterior
                </AppButton>
                <h2>{format(currentMonth, 'MMMM yyyy', { locale: ptBR })}</h2>
                <AppButton
                  size="sm"
                  variant="secondary"
                  onClick={() => navigateMonth('next')}
                  rightIcon={<Icons.ArrowRight size={14} />}
                >
                  Próximo
                </AppButton>
              </div>

              <div className="dashboard-month-strip" aria-label="Meses com sugestões futuras">
                {monthStrip.map((month) => {
                  const isActiveMonth = startOfMonth(currentMonth).getTime() === month.date.getTime();
                  return (
                    <button
                      className={`dashboard-month-chip${isActiveMonth ? ' is-active' : ''}`}
                      key={month.key}
                      type="button"
                      onClick={() => navigateToMonth(month.date)}
                    >
                      <span>{month.label}</span>
                      <strong>{month.count}</strong>
                    </button>
                  );
                })}
              </div>

              <div className="dashboard-calendar-scroll">
                <div className="dashboard-weekdays">
                  {WEEKDAYS_PT_BR.map(day => (
                    <span key={day}>{day}</span>
                  ))}
                </div>

                <div className="dashboard-days">
                  {Array.from({ length: calendarLeadingBlankDays }, (_, index) => (
                    <span
                      aria-hidden="true"
                      className="dashboard-day-spacer"
                      key={`leading-${index}`}
                    />
                  ))}
                  {daysInMonth.map(day => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const dayEvents = eventsByDay[dateKey] || [];
                    const isToday = isSameDay(day, new Date());
                    const isSelected = selectedDay && isSameDay(day, selectedDay);
                    const isPastDay = startOfDay(day) < hoje;

                    return (
                      <button
                        className={`dashboard-day${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}${isPastDay ? ' is-past' : ''}`}
                        key={dateKey}
                        type="button"
                        disabled={isPastDay}
                        onClick={() => setSelectedDay(day)}
                      >
                        <span className="dashboard-day-number">{format(day, 'd')}</span>

                        {dayEvents.length > 0 && (
                          <span className="dashboard-event-count">
                            <span />
                            <strong>{dayEvents.length}</strong>
                          </span>
                        )}
                        {dayEvents.length > 0 && <small>{dayEvents.length === 1 ? "evento" : "eventos"}</small>}
                      </button>
                    );
                  })}
                  {Array.from({ length: calendarTrailingBlankDays }, (_, index) => (
                    <span
                      aria-hidden="true"
                      className="dashboard-day-spacer"
                      key={`trailing-${index}`}
                    />
                  ))}
                </div>
              </div>
            </AppCard>
          </div>

          <div className="dashboard-events-column">
            <AppCard
              variant={selectedDay ? 'accent' : 'default'}
              style={{ padding: 20, display: 'flex', flexDirection: 'column', height: '100%' }}
            >
              <div className="dashboard-panel-header">
                <div className="dashboard-panel-title">
                  <p className="urban-app-eyebrow-muted">
                    {selectedDay ? 'DIA SELECIONADO' : 'EVENTOS DO MÊS'}
                  </p>
                  <h3>
                    {selectedDay
                      ? format(selectedDay, 'dd/MM/yyyy')
                      : format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                  </h3>
                </div>

                <div className="dashboard-panel-actions">
                  <SuggestionInfoPopover
                    description="Nosso sistema compara seu imóvel com outros de características semelhantes (camas, capacidade, banheiros, faixa de valor e localização). Também considera eventos próximos e seu impacto na demanda para oferecer uma sugestão de preço mais precisa."
                  />

                  {selectedDay && (
                    <button
                      aria-label="Voltar para eventos do mês"
                      className="dashboard-clear-day"
                      type="button"
                      onClick={() => setSelectedDay(null)}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              {eventsToDisplay.length === 0 ? (
                <AppEmptyState
                  eyebrow={selectedDay ? 'DIA SEM EVENTOS' : 'SEM SUGESTÕES NA JANELA'}
                  title={
                    selectedDay
                      ? 'Nenhum evento neste dia'
                      : nextMonthWithEvents
                        ? 'Há sugestões fora do período atual'
                        : 'Sem sugestões neste mês'
                  }
                  body={
                    selectedPropertyInfo && !isPropertyReady(selectedPropertyInfo)
                      ? selectedPropertyInfo.setupStatus?.publicDescription ?? 'Este imóvel ainda está sendo preparado. As sugestões aparecem quando mapa, eventos e valor de referência estiverem prontos.'
                      : !selectedDay && nextMonthWithEvents
                        ? `Esta janela (${windowSummaryLabel}) está vazia, mas existem ${futureEventsOutsideWindow.length} sugestões em meses futuros. Use a faixa de meses ou avance para ${format(nextMonthWithEvents.date, 'MMMM', { locale: ptBR })}.`
                        : 'Não encontramos evento futuro que combine com este imóvel no período. A Urban AI continuará verificando novos eventos e mostrará sugestões quando encontrar uma oportunidade.'
                  }
                  icon={<Icons.Calendar size={28} />}
                  action={
                    !selectedDay && nextMonthWithEvents ? (
                      <AppButton
                        size="sm"
                        variant="primary"
                        onClick={() => navigateToMonth(nextMonthWithEvents.date)}
                        rightIcon={<Icons.ArrowRight size={14} />}
                      >
                        Ver {format(nextMonthWithEvents.date, 'MMM', { locale: ptBR }).replace('.', '')}
                      </AppButton>
                    ) : undefined
                  }
                />
              ) : (
                <div className="dashboard-events-list">
                  {eventsToDisplay.map((ev, index) => (
                    <EventCard
                      setIsLoading={setIsLoading}
                      onChange={() => {
                        fetchEventsSemLoading()
                      }}
                      key={makeEventKey(ev, index)}
                      ev={ev}
                      cardBorder="gray.200"
                      bg="white"
                      propertyId={propertyId}
                    />
                  ))}
                </div>
              )}
            </AppCard>
          </div>
        </div>
      )}

      <style jsx>{styles}</style>
    </AppPageShell>
  );
}

const styles = `
  .dashboard-property-filter {
    width: min(320px, 100%);
    max-width: 320px;
    min-width: 0;
  }

  .dashboard-property-filter label {
    display: block;
    margin-bottom: 6px;
    color: var(--app-text-muted);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }

  .dashboard-error {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--app-danger);
    font-size: 14px;
    font-weight: 650;
  }

  .dashboard-content-grid {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(340px, 2fr);
    align-items: stretch;
    gap: 24px;
  }

  .dashboard-window-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 12px;
    padding: 14px 16px;
    background: var(--app-surface-muted);
    border: 1px solid var(--app-divider);
    border-radius: 8px;
  }

  .dashboard-window-summary > div:first-child {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .dashboard-window-summary strong {
    color: var(--app-text);
    font-size: 17px;
    font-weight: 700;
    line-height: 1.2;
  }

  .dashboard-window-summary span {
    color: var(--app-text-muted);
    font-size: 13px;
    line-height: 1.35;
  }

  .dashboard-future-counter {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    flex: 0 1 280px;
    gap: 8px;
    min-width: min(280px, 100%);
    color: var(--app-accent);
    font-weight: 650;
  }

  .dashboard-future-counter span {
    overflow-wrap: anywhere;
  }

  .dashboard-calendar-column,
  .dashboard-events-column {
    min-width: 0;
  }

  .dashboard-calendar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .dashboard-calendar-header h2 {
    flex: 1;
    min-width: 200px;
    margin: 0;
    color: var(--app-text);
    font-size: 19px;
    font-weight: 650;
    line-height: 1.2;
    text-align: center;
    text-transform: capitalize;
  }

  .dashboard-month-strip {
    display: grid;
    grid-template-columns: repeat(6, minmax(58px, 1fr));
    gap: 8px;
    margin-bottom: 16px;
  }

  .dashboard-month-chip {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
    height: 38px;
    padding: 0 10px;
    color: var(--app-text-muted);
    background: var(--app-surface);
    border: 1px solid var(--app-divider);
    border-radius: 8px;
    cursor: pointer;
    transition: border-color 120ms ease, background 120ms ease, color 120ms ease;
  }

  .dashboard-month-chip:hover,
  .dashboard-month-chip.is-active {
    color: var(--app-accent);
    background: var(--app-accent-soft);
    border-color: rgba(232, 80, 10, 0.35);
  }

  .dashboard-month-chip span {
    overflow: hidden;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    text-overflow: ellipsis;
    text-transform: capitalize;
    white-space: nowrap;
  }

  .dashboard-month-chip strong {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    color: inherit;
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid currentColor;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 750;
    line-height: 1;
  }

  .dashboard-calendar-scroll {
    overflow-x: auto;
  }

  .dashboard-weekdays,
  .dashboard-days {
    display: grid;
    grid-template-columns: repeat(7, minmax(48px, 1fr));
    gap: 4px;
    min-width: min-content;
  }

  .dashboard-weekdays {
    margin-bottom: 8px;
    padding: 8px 4px;
    background: var(--app-surface-muted);
    border-radius: 8px;
  }

  .dashboard-weekdays span {
    color: var(--app-text-muted);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-align: center;
    text-transform: uppercase;
  }

  .dashboard-day {
    position: relative;
    display: flex;
    aspect-ratio: 1 / 1;
    min-width: 48px;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
    padding: 6px;
    color: var(--app-text);
    background: var(--app-surface);
    border: 1px solid var(--app-divider);
    border-radius: 8px;
    cursor: pointer;
    transition: border-color 120ms ease, background 120ms ease;
  }

  .dashboard-day-spacer {
    aspect-ratio: 1 / 1;
    min-width: 48px;
    border: 1px solid transparent;
    border-radius: 8px;
  }

  .dashboard-day:hover {
    border-color: var(--app-accent);
  }

  .dashboard-day.is-today {
    background: var(--app-surface-muted);
  }

  .dashboard-day.is-selected {
    color: var(--app-accent);
    background: var(--app-accent-soft);
    border-color: var(--app-accent);
  }

  .dashboard-day.is-past {
    opacity: 0.36;
    cursor: not-allowed;
    background: var(--app-surface-muted);
  }

  .dashboard-day.is-past:hover {
    border-color: var(--app-divider);
  }

  .dashboard-day-number {
    align-self: flex-end;
    font-size: 14px;
    font-weight: 550;
    line-height: 1;
  }

  .dashboard-day.is-today .dashboard-day-number,
  .dashboard-day.is-selected .dashboard-day-number {
    font-weight: 750;
  }

  .dashboard-event-count {
    display: inline-flex;
    align-items: center;
    align-self: center;
    gap: 4px;
    padding: 3px 7px;
    color: var(--app-accent);
    background: var(--app-accent-soft);
    border: 1px solid rgba(232, 80, 10, 0.25);
    border-radius: 999px;
    font-size: 11px;
    line-height: 1;
  }

  .dashboard-event-count span {
    width: 6px;
    height: 6px;
    background: var(--app-accent);
    border-radius: 50%;
  }

  .dashboard-event-count strong {
    font-weight: 750;
  }

  .dashboard-day small {
    color: var(--app-text-dim);
    font-size: 10px;
    text-align: center;
  }

  .dashboard-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .dashboard-panel-title {
    min-width: 0;
  }

  .dashboard-panel-title h3 {
    margin: 4px 0 0;
    color: var(--app-text);
    font-size: 21px;
    font-weight: 650;
    line-height: 1.25;
    text-transform: capitalize;
  }

  .dashboard-panel-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .dashboard-clear-day {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    color: var(--app-text-muted);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
  }

  .dashboard-clear-day:hover {
    color: var(--app-text);
    background: var(--app-surface-muted);
    border-color: var(--app-divider);
  }

  .dashboard-events-list {
    display: grid;
    gap: 12px;
    overflow: visible;
  }

  @média (max-width: 1024px) {
    .dashboard-content-grid {
      grid-template-columns: 1fr;
    }

    .dashboard-events-list {
      max-height: none;
    }
  }

  @média (max-width: 640px) {
    .dashboard-property-filter {
      width: 100%;
    }

    .dashboard-window-summary {
      align-items: flex-start;
      flex-direction: column;
    }

    .dashboard-future-counter {
      justify-content: flex-start;
      min-width: 0;
    }

    .dashboard-calendar-header {
      align-items: stretch;
    }

    .dashboard-calendar-header h2 {
      order: -1;
      flex-basis: 100%;
      min-width: 0;
    }

    .dashboard-month-strip {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .dashboard-day small {
      display: none;
    }
  }
`;

function isPropertyReady(property?: PropertyDropdown): boolean {
  if (!property) return false;
  return property.setupStatus?.state ? property.setupStatus.state === 'ready' : property.analisado === 'completed';
}
