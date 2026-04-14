'use client';

import {
  Badge,
  Box,
  Button,
  Center,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  Heading,
  IconButton,
  Spinner,
  Text,
  useColorModeValue,
  VStack,
  useBreakpointValue,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverCloseButton,
  PopoverHeader,
  PopoverBody,
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
import { FaRegLightbulb } from 'react-icons/fa';
import { SuggestionInfoPopover } from '../componentes/SuggestionInfoPopover';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const bg = useColorModeValue('white', 'gray.800');
  const headerBg = useColorModeValue('gray.100', 'gray.700');
  const dayBg = useColorModeValue('gray.50', 'gray.700');
  const todayBg = useColorModeValue('blue.100', 'blue.900');
  const selectedBg = useColorModeValue('blue.200', 'blue.600');
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');
  const hoverBg = useColorModeValue('gray.100', 'gray.600');

  const hoje = useMemo(() => startOfDay(new Date()), []);
  const mesMinimo = useMemo(() => startOfMonth(hoje), [hoje]);

  const [propsInfo, setPropsInfo] = useState<PropertyDropdown[]>([]);
  const [loadingPropsInfo, setLoadingPropsInfo] = useState(true);
  const [errorPropsInfo, setErrorPropsInfo] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState('');

  // Obter valores responsivos
  const isMobile = useBreakpointValue({ base: true, md: false });
  const calendarSize = useBreakpointValue({ base: 'sm', md: 'md', lg: 'lg' });
  const dayFontSize = useBreakpointValue({ base: 'xs', sm: 'sm', md: 'md' });
  const headingSize = useBreakpointValue({ base: 'lg', md: 'xl', lg: '2xl' });
  const buttonSize = useBreakpointValue({ base: 'sm', md: 'md' });

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
          setIsLoading(true);
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
        // Verifica se alguma propriedade mudou de "running" para "completed"
        const completedProps = propsInfo.filter((oldItem) => {
          const newItem = data.find((n) => n.id === oldItem.id);
          return oldItem.analisado === "running" && newItem?.analisado === "completed";
        });

        if (completedProps.length > 0) {
          // ✅ Atualiza o dropdown com os novos dados
          setPropsInfo(data);
          
          // ✅ Se temos propriedades completadas, seleciona a primeira delas
          if (!propertyId || propsInfo.find(p => p.id === propertyId)?.analisado === 'running') {
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
    <Flex direction="column" minH="100vh" bg={bg}>
      <Box flex="1" w="full" px={{ base: 2, sm: 4, md: 6, lg: 8 }} pb={4}>
        <Flex
          direction={{ base: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ base: 'flex-start', md: 'flex-end' }}
          mb={6}
          gap={4}
        >
          <Heading as="h1" size={headingSize} fontWeight="extrabold" mb={{ base: 2, md: 0 }}>
            Calendário
          </Heading>

          <FormControl maxW={{ base: '100%', md: '320px' }}>
            <FormLabel fontWeight="semibold" color="gray.800" fontSize={{ base: 'sm', md: 'md' }}>
              Filtrar propriedade
            </FormLabel>
            <PropertySelect value={propertyId} propsInfo={propsInfo} setPropertyId={setPropertyId} />
          </FormControl>
        </Flex>

        {/* Mantém loading se nenhuma propriedade "completed" */}
        {loadingPropsInfo || !propertyId || isLoading ? (
          <Center height="300px">
            <Spinner size="xl" />
          </Center>
        ) : error ? (
          <Center height="300px" color="red.500">{error}</Center>
        ) : (
          <Flex
            direction={{ base: 'column', lg: 'row' }}
            gap={6}
            align="stretch"
            height={{ base: 'auto', lg: '70vh' }}
          >
            {/* Calendário - 3/5 da largura em desktop */}
            <Box
              flex={{ base: '1', lg: '3' }}
              minW={0}
              bg={cardBg}
              border="1px solid"
              borderColor={cardBorder}
              borderRadius="xl"
              p={{ base: 2, md: 4 }}
              boxShadow="sm"
              overflow="auto"
            >
              <Flex justify="space-between" align="center" mb={4} gap={2} flexWrap="wrap">
                <Button
                  size={buttonSize}
                  onClick={() => navigateMonth('prev')}
                  isDisabled={prevDesabilitado}
                  variant="outline"
                  mb={{ base: 2, md: 0 }}
                >
                  &larr; Anterior
                </Button>
                <Heading as="h3" size={{ base: 'sm', md: 'md' }} textAlign="center" flex="1" minW="200px">
                  {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </Heading>
                <Button
                  size={buttonSize}
                  onClick={() => navigateMonth('next')}
                  variant="outline"
                  mb={{ base: 2, md: 0 }}
                >
                  Próximo &rarr;
                </Button>
              </Flex>

              <Box overflowX="auto">
                <Grid
                  templateColumns="repeat(7, 1fr)"
                  gap={1}
                  mb={2}
                  bg={headerBg}
                  borderRadius="md"
                  py={2}
                  px={1}
                  minW="min-content"
                >
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                    <GridItem key={day} textAlign="center">
                      <Text fontSize={{ base: 'xs', sm: 'sm' }} fontWeight="bold">{day}</Text>
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

                    return (
                      <GridItem key={dateKey}>
                        <Box
                          aspectRatio="1/1"
                          minW={{ base: '10', sm: '12', md: '14' }}
                          border="1px solid"
                          borderColor={isSelected ? 'blue.500' : cardBorder}
                          borderRadius="md"
                          bg={isToday ? todayBg : isSelected ? selectedBg : dayBg}
                          position="relative"
                          p={1}
                          cursor="pointer"
                          onClick={() => setSelectedDay(day)}
                          _hover={{ bg: hoverBg }}
                          _focus={{ boxShadow: '0 0 0 2px teal', outline: 'none' }}
                          transition="background-color 0.2s, box-shadow 0.2s"
                          display="flex"
                          flexDirection="column"
                          justifyContent="space-between"
                          overflow="hidden"
                        >
                          <Text
                            fontSize={dayFontSize}
                            fontWeight="bold"
                            textAlign="right"
                            color={isSelected ? 'white' : isToday ? 'blue.700' : 'inherit'}
                            flexShrink={0}
                          >
                            {format(day, 'd')}
                          </Text>

                          {dayEvents.length > 0 && (
                            <Center>
                              <VStack spacing={0}>
                                <Badge
                                  bg="#3FCF19"
                                  color="white"
                                  fontSize={{ base: 'xs', sm: 'sm' }}
                                  fontWeight="bold"
                                  px={2}
                                  py={0.5}
                                  borderRadius="full"
                                  boxShadow="md"
                                  textAlign="center"
                                  minW="6"
                                >
                                  {dayEvents.length}
                                </Badge>
                                <Text fontSize="2xs" opacity={0.7} display={{ base: 'none', sm: 'block' }}>
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
            </Box>

            {/* Painel: Eventos - 2/5 da largura em desktop */}
            <Box
              flex={{ base: '1', lg: '2' }}
              bg={cardBg}
              border="1px solid"
              borderColor={cardBorder}
              borderRadius="2xl"
              p={{ base: 3, md: 4, lg: 6 }}
              display="flex"
              flexDirection="column"
              boxShadow="sm"
              overflow="hidden"
              mt={{ base: 4, lg: 0 }}
            >
              <Flex justify="space-between" align="center" mb={4}>
                <Heading fontSize={{ base: 'lg', md: 'xl' }}>
                  {selectedDay
                    ? `Eventos - ${format(selectedDay, 'dd/MM/yyyy')}`
                    : 'Eventos do Mês'}
                </Heading>

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
                  />
                )}
              </Flex>

              {eventsToDisplay.length === 0 ? (
                <Text color="gray.500" textAlign="center" py={8}>
                  {selectedDay ? 'Nenhum evento neste dia' : 'Sem eventos neste mês'}
                </Text>
              ) : (
                <Box flex="1" overflowY="auto" pr={1}>
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
            </Box>
          </Flex>
        )}
      </Box>
    </Flex>
  );
}