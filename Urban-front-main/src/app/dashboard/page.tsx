'use client';

import {
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
  ev.id ||
  ev.idAnalise ||
  [
    ev.nome,
    ev.dataInicio,
    ev.dataFim,
    ev.enderecoCompleto,
    index,
  ].join("|");

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

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

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

  const isActionableEvent = useCallback(
    (event: EventItem) => {
      const eventStart = startOfDay(parseISO(event.dataInicio));
      return Number.isFinite(eventStart.getTime()) && eventStart >= hoje;
    },
    [hoje],
  );

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

  const fetchEventsSemLoading = async () => {
    setError(null);
    try {
      const response = await getEventosPorPropriedade(propertyId, currentMonth.toISOString());
      setAllEvents(response.data);
      setFilteredEvents(filterEvents(response.data));
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
        const response = await getEventosPorPropriedade(propertyId, currentMonth.toISOString());
        setAllEvents(response.data);
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
  }, [propertyId, currentMonth]);

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
        eyebrow="CALENDARIO · EVENTOS POR DIA"
        title="Calendario"
        subtitle="Visualize os eventos com sugestoes de preco da Urban AI para o imovel selecionado. Clique em um dia para ver detalhes."
        actions={
          <div className="dashboard-property-filter">
            <label>Filtrar imovel</label>
            <PropertySelect value={propertyId} propsInfo={propsInfo} setPropertyId={setPropertyId} />
          </div>
        }
      />

      <PushNotificationOptIn variant="compact" />

      {loadingPropsInfo || isLoading ? (
        <AppLoadingStatus
          eyebrow="CALENDARIO"
          title={loadingPropsInfo ? "Carregando seus imoveis" : "Procurando eventos e sugestoes de preco"}
          body={
            loadingPropsInfo
              ? "Estamos vendo quais imoveis ja estao prontos para receber sugestoes."
              : "Estamos olhando o imovel, o mes escolhido e os eventos perto dele."
          }
          steps={[
            { id: 'properties', label: 'Seus imoveis', status: loadingPropsInfo ? 'active' : 'complete' },
            { id: 'events', label: 'Eventos por perto', status: loadingPropsInfo ? 'pending' : 'active' },
            { id: 'recommendations', label: 'Sugestoes no calendario', status: 'pending' },
          ]}
        />
      ) : !propertyId || !hasCompletedProperties ? (
        <AppEmptyState
          eyebrow="IMOVEIS"
          title="Ainda nao ha imovel pronto para sugestoes"
          body="Assim que o cadastro terminar, as sugestoes aparecem aqui. Se estiver demorando, confira o endereco e se o plano ainda permite novos imoveis."
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
                  Proximo
                </AppButton>
              </div>

              <div className="dashboard-calendar-scroll">
                <div className="dashboard-weekdays">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(day => (
                    <span key={day}>{day}</span>
                  ))}
                </div>

                <div className="dashboard-days">
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
                        {dayEvents.length > 0 && <small>evento(s)</small>}
                      </button>
                    );
                  })}
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
                    {selectedDay ? 'DIA SELECIONADO' : 'EVENTOS DO MES'}
                  </p>
                  <h3>
                    {selectedDay
                      ? format(selectedDay, 'dd/MM/yyyy')
                      : format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                  </h3>
                </div>

                <div className="dashboard-panel-actions">
                  <SuggestionInfoPopover
                    description="Nosso sistema compara seu imovel com outros de caracteristicas semelhantes (camas, capacidade, banheiros, faixa de valor e localizacao). Tambem considera eventos proximos e seu impacto na demanda para oferecer uma sugestao de preco mais precisa."
                  />

                  {selectedDay && (
                    <button
                      aria-label="Voltar para eventos do mes"
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
                  eyebrow={selectedDay ? 'DIA SEM EVENTOS' : 'SEM SUGESTOES'}
                  title={selectedDay ? 'Nenhum evento neste dia' : 'Sem sugestoes neste mes'}
                  body={
                    selectedPropertyInfo && !isPropertyReady(selectedPropertyInfo)
                      ? selectedPropertyInfo.setupStatus?.publicDescription ?? 'Este imovel ainda esta sendo preparado. As sugestoes aparecem quando mapa, eventos e valor de referencia estiverem prontos.'
                      : 'Nao encontramos evento futuro que combine com este imovel no periodo. A Urban AI continuara verificando novos eventos e mostrara sugestoes quando encontrar uma oportunidade.'
                  }
                  icon={<Icons.Calendar size={28} />}
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
    min-width: min(280px, 100%);
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

  @media (max-width: 1024px) {
    .dashboard-content-grid {
      grid-template-columns: 1fr;
    }

    .dashboard-events-list {
      max-height: none;
    }
  }

  @media (max-width: 640px) {
    .dashboard-property-filter {
      width: 100%;
    }

    .dashboard-calendar-header {
      align-items: stretch;
    }

    .dashboard-calendar-header h2 {
      order: -1;
      flex-basis: 100%;
      min-width: 0;
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
