'use client';
import { Box, Center, Flex, FormControl, FormLabel, Spinner, Text } from '@chakra-ui/react';
import { useState, useEffect, useMemo } from 'react';
import { getEventosForMaps, getPropriedadesDropdownList, PropertyDropdown } from '../service/api';
import dynamic from 'next/dynamic';
import { EventCard } from '../dashboard/components/ItemEvento';
import { SuggestionInfoPopover } from '../componentes/SuggestionInfoPopover';
import {
  AppPageShell,
  AppSectionHeader,
  AppCard,
  AppSelect,
  AppInput,
  AppEmptyState,
  Icons,
} from '../componentes/ui';

const PropertySelect = dynamic(() => import('./components/CustomSelect'), {
  ssr: false,
  loading: () => (
    <Box style={{ height: 40 }}>
      <Spinner size="sm" color="orange.500" />
    </Box>
  )
});

const AirbnbMap = dynamic(() => import('./components/GoogleMapEmbed'), {
  ssr: false,
  loading: () => (
    <Center height="500px">
      <Spinner size="xl" color="orange.500" thickness="2px" />
    </Center>
  )
});

// Helpers de data
const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);
const parseIsoDate = (s: string) => {
  const [y, m, day] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1);
};

export default function MapsPage() {
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propsInfo, setPropsInfo] = useState<PropertyDropdown[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [selectedRadius, setSelectedRadius] = useState(30);

  // Datas iniciais: hoje e +7 dias
  const today = useMemo(() => new Date(), []);
  const inAWeek = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }, []);

  const [startDate, setStartDate] = useState<string>(toIsoDate(today));
  const [endDate, setEndDate] = useState<string>(toIsoDate(inAWeek));

  const fetchEventsSemLoading = async () => {
    setError(null);
    try {
      const response = await getEventosForMaps(
        propertyId,
        1,
        1000,
        selectedRadius,
        parseIsoDate(startDate).toISOString(),
        parseIsoDate(endDate).toISOString()
      );
      setAllEvents(response.data);
    } catch {
      setError('Erro ao carregar eventos');
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
          parseIsoDate(startDate).toISOString(),
          parseIsoDate(endDate).toISOString()
        );
        setAllEvents(response.data);
      } catch {
        setError('Erro ao carregar eventos');
      } finally {
        setIsLoading(false);
      }
    };

    if (propertyId) fetchEvents();
    else setAllEvents([]);
  }, [propertyId, selectedRadius, startDate, endDate]);

  useEffect(() => {
    async function fetchPropsInfo() {
      try {
        const data = await getPropriedadesDropdownList();
        setPropsInfo(data);
        const defaultProp = data.find(p => p.analisado === "completed");
        if (defaultProp) {
          setPropertyId(defaultProp.id);
        }
      } catch {
        setError('Erro ao carregar propriedades');
      }
    }
    fetchPropsInfo();
  }, []);

  const eventsToDisplay = useMemo(() => allEvents, [allEvents]);

  return (
    <AppPageShell maxWidth={1400}>
      <AppSectionHeader
        eyebrow="MAPA · OPORTUNIDADES"
        title="Mapa Interativo"
        subtitle="Veja eventos próximos ao seu imóvel num raio configurável. Use o período pra calibrar o radar conforme a operação."
      />

      {/* Toolbar de filtros — AppCard subtle */}
      <AppCard variant="subtle" style={{ padding: 20, marginBottom: 24 }}>
        <Flex
          direction={{ base: 'column', lg: 'row' }}
          gap={4}
          align={{ base: 'stretch', lg: 'flex-end' }}
          wrap="wrap"
        >
          <Box maxW={{ base: '100%', lg: '320px' }} flex="1" position="relative" zIndex={1000}>
            <FormControl>
              <FormLabel
                fontSize="11px"
                letterSpacing="1.5px"
                textTransform="uppercase"
                fontWeight={600}
                color="var(--app-text-muted)"
                mb={1}
              >
                Filtrar imóvel
              </FormLabel>
              <Box position="relative" zIndex={1001}>
                <PropertySelect
                  value={propertyId}
                  propsInfo={propsInfo}
                  setPropertyId={setPropertyId}
                />
              </Box>
            </FormControl>
          </Box>

          <Box maxW={{ base: '100%', lg: '160px' }} flex="0 0 auto">
            <AppSelect
              label="Raio (km)"
              value={selectedRadius}
              onChange={(e) => setSelectedRadius(Number(e.target.value))}
            >
              <option value={1}>1 km</option>
              <option value={2}>2 km</option>
              <option value={5}>5 km</option>
              <option value={10}>10 km</option>
              <option value={30}>30 km</option>
            </AppSelect>
          </Box>

          <Box maxW={{ base: '100%', lg: '180px' }} flex="0 0 auto">
            <AppInput
              type="date"
              label="De"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Box>

          <Box maxW={{ base: '100%', lg: '180px' }} flex="0 0 auto">
            <AppInput
              type="date"
              label="Até"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Box>
        </Flex>
      </AppCard>

      {isLoading ? (
        <Center py={20}>
          <Spinner size="xl" color="orange.500" thickness="2px" />
        </Center>
      ) : error ? (
        <AppCard variant="default" style={{ borderColor: 'rgba(194, 52, 46, 0.25)' }}>
          <Flex align="center" gap={3} color="var(--app-danger)">
            <Icons.AlertCircle size={18} />
            <Text fontSize="sm" fontWeight={600}>{error}</Text>
          </Flex>
        </AppCard>
      ) : (
        <Flex direction={{ base: 'column', lg: 'row' }} gap={6} align="stretch">
          {/* Mapa */}
          <Box flex="1" minW={0} position="relative" zIndex={1}>
            <AppCard variant="default" style={{ padding: 16 }}>
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
            </AppCard>
          </Box>

          {/* Painel: Eventos */}
          <Box w={{ base: 'full', lg: '480px' }} flexShrink={0}>
            <AppCard variant="default" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
              <Flex justify="space-between" align="center" mb={4}>
                <Box minW={0}>
                  <p className="urban-app-eyebrow-muted" style={{ marginBottom: 4 }}>
                    EVENTOS NO RAIO
                  </p>
                  <Text fontSize={{ base: 'lg', md: 'xl' }} fontWeight={600} style={{ color: 'var(--app-text)' }}>
                    {eventsToDisplay.length} {eventsToDisplay.length === 1 ? 'evento' : 'eventos'}
                  </Text>
                </Box>
                <SuggestionInfoPopover
                  description="Nosso sistema compara seu imóvel com outros de características semelhantes (camas, capacidade, banheiros, faixa de valor e localização). Também considera eventos próximos e seu impacto na demanda para oferecer uma sugestão de preço mais precisa."
                />
              </Flex>

              {eventsToDisplay.length === 0 ? (
                <AppEmptyState
                  eyebrow="SEM EVENTOS"
                  title="Nada no raio escolhido"
                  body="Aumente o raio ou ajuste o período pra ampliar o radar de oportunidades."
                  icon={<Icons.MapPin size={28} />}
                />
              ) : (
                <Box flex="1" overflowY="auto" maxHeight="calc(100vh - 320px)" pr={1}>
                  <Flex direction="column" gap={4}>
                    {eventsToDisplay.map(ev => (
                      <EventCard
                        setIsLoading={() => { }}
                        onChange={() => {
                          fetchEventsSemLoading();
                        }}
                        key={ev.id}
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
