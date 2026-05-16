'use client';

import {
  Box,
  Center,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  IconButton,
  Spinner,
  Text,
  VStack,
  useBreakpointValue,
} from '@chakra-ui/react';
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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DateRange } from 'react-day-picker';
import { FiX } from 'react-icons/fi';
import {
  getEventosPorPropriedade,
  getPropriedadesDropdownList,
  PropertyDropdown,
} from '../../app/service/api';
import dynamic from 'next/dynamic';
import { EventCard } from './components/ItemEvento';

import crypto from "crypto";
import { SuggestionInfoPopover } from '../componentes/SuggestionInfoPopover';
import {
  AppPageShell,
  AppSectionHeader,
  AppCard,
  AppButton,
  AppEmptyState,
  Icons,
} from '../componentes/ui';

const makeKey = (ev: any) =>
  crypto.createHash("md5").update(JSON.stringify(ev)).digest("hex");

const PropertySelect = dynamic(() => import('./components/CustomSelect'), { ssr: false });

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

  // Obter valores responsivos
  const dayFontSize = useBreakpointValue({ base: 'xs', sm: 'sm', md: 'md' });

  useEffect(() => {
    if (startOfMonth(currentMonth) < mesMinimo) setCurrentMonth(mesMinimo);
  }, [mesMinimo, currentMonth]);

  useEffect(() => {
    console.log('Mês atual:', currentMonth.toISOString());
  }, [currentMonth]);

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
    () => propsInfo.some((property) => property.analisado === "completed"),
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

  const filterEvents = useCallback(() => {
    let result = [...allEvents];

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
  }, [allEvents, searchTerm, range]);

  const fetchEventsSemLoading = async () => {
    setError(null);
    try {
      const response = await getEventosPorPropriedade(propertyId, currentMonth.toISOString());
      setAllEvents(response.data);
      setFilteredEvents(filterEvents());
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar eventos');
    }
  };

  // Fetch eventos por propriedade
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

  // Fetch propriedades e selecionar a primeira "completed"
  useEffect(() => {
    async function fetchPropsInfo() {
      try {
        setLoadingPropsInfo(true);
        setErrorPropsInfo(null);
        const data = await getPropriedadesDropdownList();
        setPropsInfo(data);

        const defaultProp = data.find(p => p.analisado === "completed");
        if (defaultProp) {
          setPropertyId(defaultProp.id);
          setLoadingPropsInfo(false);
        } else {
          // Nenhuma propriedade válida: mantém tela em loading
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


  //função auxiliar - Monitora mudanças de status e recarrega quando ficam "completed"
useEffect(() => {
  async function fetchPropsInfo() {
    try {
      setErrorPropsInfo(null);
      const data = await getPropriedadesDropdownList();

      if (propsInfo.length > 0 && data.length > 0) {
        // Verifica se alguma propriedade saiu de um estado pendente/processando para "completed"
        const completedProps = propsInfo.filter((oldItem) => {
          const newItem = data.find((n) => n.id === oldItem.id);
          return oldItem.analisado !== "completed" && newItem?.analisado === "completed";
        });

        if (completedProps.length > 0) {
          // Atualiza o dropdown com os novos dados
          setPropsInfo(data);

          // Se temos propriedades completadas, seleciona a primeira delas
          if (!propertyId || propsInfo.find(p => p.id === propertyId)?.analisado !== 'completed') {
            const defaultProp = data.find(p => p.analisado === "completed");
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

  // chama imediatamente
  fetchPropsInfo();

  // cria o intervalo para verificar a cada 3 segundos (mais rápido agora)
  const intervalId = setInterval(fetchPropsInfo, 3000);

  // limpa o intervalo ao desmontar
  return () => clearInterval(intervalId);
}, [propsInfo, propertyId]);


  useEffect(() => {
    setFilteredEvents(filterEvents());
  }, [filterEvents, allEvents]);

  const eventsToDisplay = useMemo(() => {
    if (selectedDay) {
      const dateKey = format(selectedDay, 'yyyy-MM-dd');
      return eventsByDay[dateKey] || [];
    }
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return allEvents
      .filter(event => {
        const s = parseISO(event.dataInicio);
        return isWithinInterval(s, { start: monthStart, end: monthEnd });
      })
      .sort((a, b) => +parseISO(a.dataInicio) - +parseISO(b.dataInicio));
  }, [selectedDay, currentMonth, allEvents, eventsByDay]);

  // -------- UI --------
  return (
    <AppPageShell maxWidth={1400}>
      <AppSectionHeader
        eyebrow="CALENDÁRIO · EVENTOS POR DIA"
        title="Calendário"
        subtitle="Visualize os eventos com sugestões de preço da Urban AI para o imóvel selecionado. Clique em um dia para ver detalhes."
        actions={
          <Box minW={{ base: '100%', md: '280px' }}>
            <FormControl>
              <FormLabel
                fontSize="11px"
                letterSpacing="1.5px"
                textTransform="uppercase"
                fontWeight="600"
                color="var(--app-text-muted)"
                mb={1}
              >
                Filtrar imóvel
              </FormLabel>
              <PropertySelect value={propertyId} propsInfo={propsInfo} setPropertyId={setPropertyId} />
            </FormControl>
          </Box>
        }
      />

      {/* Loading se nenhuma propriedade "completed" */}
      {loadingPropsInfo || isLoading ? (
        <Center py={20}>
          <Spinner size="xl" color="orange.500" thickness="2px" />
        </Center>
      ) : !propertyId || !hasCompletedProperties ? (
        <AppEmptyState
          eyebrow="IMÓVEIS"
          title="Ainda não há imóvel pronto para recomendações"
          body="Assim que o cadastro terminar o processamento, as recomendações aparecem aqui. Se o imóvel ficou muito tempo nesse estado, revise endereço, coordenadas e quota do plano."
          icon={<Icons.Sparkles size={32} />}
        />
      ) : error ? (
        <AppCard variant="default" style={{ borderColor: 'rgba(194, 52, 46, 0.25)' }}>
          <Flex align="center" gap={3} color="var(--app-danger)">
            <Icons.AlertCircle size={18} />
            <Text fontSize="sm" fontWeight={600}>{error}</Text>
          </Flex>
        </AppCard>
      ) : (
        <Flex
          direction={{ base: 'column', lg: 'row' }}
          gap={6}
          align="stretch"
        >
          {/* Calendário - 3/5 da largura em desktop */}
          <Box flex={{ base: '1', lg: '3' }} minW={0}>
            <AppCard variant="default" style={{ padding: 20 }}>
              <Flex justify="space-between" align="center" mb={4} gap={2} flexWrap="wrap">
                <AppButton
                  size="sm"
                  variant="secondary"
                  onClick={() => navigateMonth('prev')}
                  disabled={prevDesabilitado}
                  leftIcon={<Icons.ArrowLeft size={14} />}
                >
                  Anterior
                </AppButton>
                <Text
                  fontSize={{ base: 'md', md: 'lg' }}
                  fontWeight={600}
                  textAlign="center"
                  flex="1"
                  minW="200px"
                  style={{ color: 'var(--app-text)', textTransform: 'capitalize' }}
                >
                  {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </Text>
                <AppButton
                  size="sm"
                  variant="secondary"
                  onClick={() => navigateMonth('next')}
                  rightIcon={<Icons.ArrowRight size={14} />}
                >
                  Próximo
                </AppButton>
              </Flex>

              <Box overflowX="auto">
                <Grid
                  templateColumns="repeat(7, 1fr)"
                  gap={1}
                  mb={2}
                  py={2}
                  px={1}
                  minW="min-content"
                  style={{
                    background: 'var(--app-surface-muted)',
                    borderRadius: 8,
                  }}
                >
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                    <GridItem key={day} textAlign="center">
                      <Text
                        fontSize="11px"
                        fontWeight={600}
                        letterSpacing="1.5px"
                        textTransform="uppercase"
                        style={{ color: 'var(--app-text-muted)' }}
                      >
                        {day}
                      </Text>
                    </GridItem>
                  ))}
                </Grid>

                <Grid
                  templateColumns="repeat(7, 1fr)"
                  gap={1}
                  minW="min-content"
                >
                  {daysInMonth.map(day => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const dayEvents = eventsByDay[dateKey] || [];
                    const isToday = isSameDay(day, new Date());
                    const isSelected = selectedDay && isSameDay(day, selectedDay);

                    const cellBg = isSelected
                      ? 'var(--app-accent-soft)'
                      : isToday
                        ? 'var(--app-surface-muted)'
                        : 'var(--app-surface)';
                    const cellBorder = isSelected
                      ? 'var(--app-accent)'
                      : 'var(--app-divider)';
                    const dayColor = isSelected
                      ? 'var(--app-accent)'
                      : isToday
                        ? 'var(--app-text)'
                        : 'var(--app-text)';

                    return (
                      <GridItem key={dateKey}>
                        <Box
                          aspectRatio="1/1"
                          minW={{ base: '10', sm: '12', md: '14' }}
                          position="relative"
                          p={1}
                          cursor="pointer"
                          onClick={() => setSelectedDay(day)}
                          transition="background-color 120ms, border-color 120ms"
                          display="flex"
                          flexDirection="column"
                          justifyContent="space-between"
                          overflow="hidden"
                          style={{
                            background: cellBg,
                            border: `1px solid ${cellBorder}`,
                            borderRadius: 8,
                          }}
                          _hover={{ borderColor: 'var(--app-accent)' }}
                        >
                          <Text
                            fontSize={dayFontSize}
                            fontWeight={isToday || isSelected ? 700 : 500}
                            textAlign="right"
                            style={{ color: dayColor }}
                            flexShrink={0}
                          >
                            {format(day, 'd')}
                          </Text>

                          {dayEvents.length > 0 && (
                            <Center>
                              <VStack spacing={0}>
                                <Flex
                                  align="center"
                                  gap={1}
                                  px={1.5}
                                  py={0.5}
                                  style={{
                                    background: 'var(--app-accent-soft)',
                                    borderRadius: 999,
                                    border: '1px solid rgba(232, 80, 10, 0.25)',
                                  }}
                                >
                                  <Box
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: '50%',
                                      background: 'var(--app-accent)',
                                    }}
                                  />
                                  <Text
                                    fontSize="11px"
                                    fontWeight={700}
                                    style={{ color: 'var(--app-accent)' }}
                                  >
                                    {dayEvents.length}
                                  </Text>
                                </Flex>
                                <Text
                                  fontSize="2xs"
                                  display={{ base: 'none', sm: 'block' }}
                                  style={{ color: 'var(--app-text-dim)' }}
                                >
                                  evento(s)
                                </Text>
                              </VStack>
                            </Center>
                          )}
                        </Box>
                      </GridItem>
                    );
                  })}
                </Grid>
              </Box>
            </AppCard>
          </Box>

          {/* Painel: Eventos - 2/5 da largura em desktop */}
          <Box flex={{ base: '1', lg: '2' }} minW={0}>
            <AppCard
              variant={selectedDay ? 'accent' : 'default'}
              style={{ padding: 20, display: 'flex', flexDirection: 'column', height: '100%' }}
            >
              <Flex justify="space-between" align="center" mb={4} gap={2}>
                <Box minW={0}>
                  <p
                    className="urban-app-eyebrow-muted"
                    style={{ marginBottom: 4 }}
                  >
                    {selectedDay ? 'DIA SELECIONADO' : 'EVENTOS DO MÊS'}
                  </p>
                  <Text
                    fontSize={{ base: 'lg', md: 'xl' }}
                    fontWeight={600}
                    style={{ color: 'var(--app-text)' }}
                  >
                    {selectedDay
                      ? format(selectedDay, 'dd/MM/yyyy')
                      : format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                  </Text>
                </Box>

                <Flex align="center" gap={1}>
                  <SuggestionInfoPopover
                    description="Nosso sistema compara seu imóvel com outros de características semelhantes (camas, capacidade, banheiros, faixa de valor e localização). Também considera eventos próximos e seu impacto na demanda para oferecer uma sugestão de preço mais precisa."
                  />

                  {selectedDay && (
                    <IconButton
                      icon={<FiX />}
                      aria-label="Voltar para eventos do mês"
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedDay(null)}
                      style={{ color: 'var(--app-text-muted)' }}
                    />
                  )}
                </Flex>
              </Flex>

              {eventsToDisplay.length === 0 ? (
                <AppEmptyState
                  eyebrow={selectedDay ? 'DIA SEM EVENTOS' : 'SEM RECOMENDAÇÕES'}
                  title={selectedDay ? 'Nenhum evento neste dia' : 'Sem recomendações neste mês'}
                  body={
                    selectedPropertyInfo?.analisado !== 'completed'
                      ? 'O imóvel ainda está processando. As sugestões aparecem quando endereço, eventos e preço base estiverem prontos.'
                      : 'Não encontramos evento futuro compatível com este imóvel no período. O sistema continuará verificando novos eventos e mostrará sugestões quando houver match.'
                  }
                  icon={<Icons.Calendar size={28} />}
                />
              ) : (
                <Box flex="1" overflowY="auto" pr={1} maxH={{ base: 'auto', lg: '65vh' }}>
                  <Flex direction="column" gap={3}>
                    {eventsToDisplay.map(ev => (
                      <EventCard
                        setIsLoading={() => {
                          console.log("Button clicado")
                        }}
                        onChange={() => {
                          console.log("Button clicado")
                          fetchEventsSemLoading()
                        }}
                        key={makeKey(ev)}
                        ev={ev}
                        cardBorder="gray.200"
                        bg="white"
                        propertyId={propertyId}
                      />
                    ))}
                  </Flex>
                </Box>
              )}
            </AppCard>
          </Box>
        </Flex>
      )}
    </AppPageShell>
  );
}
