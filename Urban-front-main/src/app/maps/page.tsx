'use client';
import { Badge, Box, Center, Flex, FormControl, FormLabel, Heading, Spinner, Text, useColorModeValue } from '@chakra-ui/react';
import { parseISO, format } from 'date-fns';
import { useState, useEffect, useMemo } from 'react';
import { getEventosForMaps, getPropriedadesDropdownList, PropertyDropdown } from '../service/api';
import dynamic from 'next/dynamic';
import { DatePicker } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { EventCard } from '../dashboard/components/ItemEvento';
import { SuggestionInfoPopover } from '../componentes/SuggestionInfoPopover';

const { RangePicker } = DatePicker;

const PropertySelect = dynamic(() => import('./components/CustomSelect'), {
  ssr: false,
  loading: () => (
    <select style={{ width: "100%", height: "44px", padding: "8px 12px", borderRadius: "8px", border: "1px solid #ccc" }}>
      <option>Carregando...</option>
    </select>
  )
});

const AirbnbMap = dynamic(() => import('./components/GoogleMapEmbed'), {
  ssr: false,
  loading: () => (
    <Center height="500px">
      <Spinner size="xl" />
    </Center>
  )
});

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
  latitude: string;
  longitude: string;
  imagem_url?: string;
}

export default function DashboardPage() {
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const bg = useColorModeValue('white', 'gray.800');
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');
  const [propsInfo, setPropsInfo] = useState<PropertyDropdown[]>([]);
  const [loadingPropsInfo, setLoadingPropsInfo] = useState(true);
  const [errorPropsInfo, setErrorPropsInfo] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState('');
  const [selectedRadius, setSelectedRadius] = useState(30);
  const [selectedPeriod, setSelectedPeriod] = useState<[Dayjs, Dayjs]>([
    dayjs(), // Data inicial = hoje
    dayjs().add(7, 'day') // Data final = 1 semana depois
  ]);


  const fetchEventsSemLoading = async () => {

    setError(null);
    try {
      const response = await getEventosForMaps(
        propertyId,
        1,
        1000,
        selectedRadius,
        selectedPeriod?.[0].toISOString(),
        selectedPeriod?.[1].toISOString()
      );
      setAllEvents(response.data);
    } catch (err) {
      setError('Erro ao carregar eventos');
    } finally {

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
          selectedPeriod?.[0].toISOString(),
          selectedPeriod?.[1].toISOString()
        );
        setAllEvents(response.data);
      } catch (err) {
        setError('Erro ao carregar eventos');
      } finally {
        setIsLoading(false);
      }
    };

    if (propertyId) fetchEvents();
    else setAllEvents([]);
  }, [propertyId, selectedRadius, selectedPeriod]);

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
        }
      } catch (err) {
        setErrorPropsInfo('Erro ao carregar propriedades');
      } finally {
        setLoadingPropsInfo(false);
      }
    }
    fetchPropsInfo();
  }, []);

  const eventsToDisplay = useMemo(() => allEvents, [allEvents]);

  const toNumber = (v: string | number | undefined) => {
    if (v === undefined || v === null) return NaN;
    if (typeof v === 'number') return v;
    const s = v.trim();
    if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.'));
    return Number(s);
  };

  const formatBRL = (value: string | number | undefined) => {
    if (value === undefined || value === null) return '';
    const n = typeof value === 'string' ? toNumber(value) : value;
    if (!Number.isFinite(n)) return '';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(n as number);
  };

  const Pill = ({ bgColor, children, ariaLabel }: {
    bgColor: string;
    children: React.ReactNode;
    ariaLabel?: string;
  }) => (
    <Badge
      aria-label={ariaLabel}
      color="white"
      bg={bgColor}
      fontSize="md"
      fontWeight="bold"
      px={3}
      py={1.5}
      borderRadius="full"
      letterSpacing={0.4}
      textTransform="uppercase"
      boxShadow="sm"
      whiteSpace="nowrap"
    >
      {children}
    </Badge>
  );

  return (
    <Flex direction="column" minH="100vh" bg={bg}>
      <Box flex="1" w="full" px={{ base: 4, md: 8 }} pb={8}>
        <Flex
          direction={{ base: 'column', lg: 'row' }}
          justifyContent="space-between"
          alignItems="flex-end"
          mb={8}
          gap={4}
          position="relative"
          zIndex={10} // Adicionado z-index para garantir que os filtros fiquem acima
        >
          <Heading as="h1" size="2xl" fontWeight="extrabold">
            Mapa Interativo
          </Heading>

          {/* Filtros */}
          <Flex gap={4} align="flex-end" position="relative" zIndex={1000}>
            <FormControl maxW="320px" position="relative" zIndex={1001}>
              <FormLabel fontWeight="semibold" color="gray.800">
                Filtrar propriedade
              </FormLabel>
              <Box position="relative" zIndex={1002}>
                <PropertySelect
                  value={propertyId}
                  propsInfo={propsInfo}
                  setPropertyId={setPropertyId}
                />
              </Box>
            </FormControl>

            <FormControl maxW="180px">
              <FormLabel fontWeight="semibold" color="gray.800">
                Raio (km)
              </FormLabel>
              <select
                value={selectedRadius}
                onChange={(e) => setSelectedRadius(Number(e.target.value))}
                style={{
                  width: "100%",
                  height: "44px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #ccc",
                  fontSize: "14px",
                }}
              >
                <option value={1}>1 km</option>
                <option value={2}>2 km</option>
                <option value={5}>5 km</option>
                <option value={10}>10 km</option>
                <option value={30}>30 km</option>
              </select>
            </FormControl>

            <FormControl maxW="400px">
              <FormLabel fontWeight="semibold" color="gray.800">
                Período
              </FormLabel>
              <RangePicker
                value={selectedPeriod}
                onChange={(dates) => setSelectedPeriod(dates as [Dayjs, Dayjs])}
                style={{ width: '100%', height: "44px" }}
              />
            </FormControl>
          </Flex>
        </Flex>

        {isLoading ? (
          <Center height="300px"><Spinner size="xl" /></Center>
        ) : error ? (
          <Center height="300px" color="red.500">{error}</Center>
        ) : (
          <Flex direction={{ base: 'column', lg: 'row' }} gap={6} align="stretch">
            {/* Mapa */}
            <Box
              flex="1"
              minW={0}
              bg={cardBg}
              border="1px solid"
              borderColor={cardBorder}
              borderRadius="xl"
              p={4}
              boxShadow="sm"
              position="relative"
              zIndex={1} // Z-index menor para o mapa
            >
              <AirbnbMap
                height="500px"
                events={eventsToDisplay}
                property={
                  propsInfo.find(p => p.id === propertyId) ? {
                    id: propsInfo.find(p => p.id === propertyId)!.id,
                    propertyName: propsInfo.find(p => p.id === propertyId)!.propertyName,
                    latitude: propsInfo.find(p => p.id === propertyId)!.latitude + "",
                    longitude: propsInfo.find(p => p.id === propertyId)!.longitude + "",
                    image_url: propsInfo.find(p => p.id === propertyId)!.image_url,
                  } : null
                }
              />
            </Box>

            {/* Painel: Eventos */}
            <Box
              w={{ base: 'full', lg: '560px' }}
              bg={cardBg}
              border="1px solid"
              borderColor={cardBorder}
              borderRadius="2xl"
              p={{ base: 4, md: 6 }}
              display="flex"
              flexDirection="column"
              boxShadow="sm"
            >
              <Flex justify="space-between" align="center" mb={4}>
                <Heading fontSize="xl">Eventos</Heading>
                              <SuggestionInfoPopover
  description="Nosso sistema compara seu imóvel com outros de características semelhantes (camas, capacidade, banheiros, faixa de valor e localização). Também considera eventos próximos e seu impacto na demanda para oferecer uma sugestão de preço mais precisa."
/>
              </Flex>



              {eventsToDisplay.length === 0 ? (
                <Text color="gray.500">Sem eventos</Text>
              ) : (
                <Box flex="1" overflowY="auto" maxHeight="calc(100vh - 320px)" pr={1}>
                  <Flex direction="column" gap={4}>
                    {eventsToDisplay.map(ev => {
                      const startDate = parseISO(ev.dataInicio);
                      const atualNum = toNumber(ev.seuPrecoAtual);
                      const sugNum = toNumber(ev.precoSugerido);
                      const diff = Number(ev.diferencaPercentual);
                      const showPositiveDiff = Number.isFinite(diff) && diff > 0;
                      const showSuggested = Number.isFinite(sugNum) && Number.isFinite(atualNum) && (sugNum as number) > (atualNum as number);

                      return (
                        <EventCard
                          setIsLoading={()=>{}}
                          onChange={() => {
                            console.log("Button clicado")
                            fetchEventsSemLoading()
                          }}
                          key={ev.id}
                          ev={ev}
                          cardBorder="gray.200"
                          bg="white"
                          propertyId={propertyId}
                        />
                      );
                    })}
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