'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Center,
  Flex,
  Grid,
  Heading,
  Progress,
  Select,
  Spinner,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
} from '@chakra-ui/react';
import { fetchMyRoi, getPropriedadesDropdownList, PropertyDropdown, RoiSummary } from '../service/api';

const WINDOWS = [30, 90, 180, 365];

export default function MyRoiPage() {
  const [data, setData] = useState<RoiSummary | null>(null);
  const [properties, setProperties] = useState<PropertyDropdown[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [windowDays, setWindowDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pageBg = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');

  async function load(nextWindow = windowDays, nextProperty = propertyId) {
    setLoading(true);
    setError(null);
    try {
      const [roi, props] = await Promise.all([
        fetchMyRoi({ windowDays: nextWindow, propertyId: nextProperty }),
        properties.length === 0 ? getPropriedadesDropdownList() : Promise.resolve(properties),
      ]);
      setData(roi);
      setProperties(props);
    } catch (err: any) {
      setError(err?.response?.status === 401 ? 'Faça login novamente para ver seu ROI.' : err?.message || 'Erro ao carregar ROI.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (cents: number) =>
    (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    });

  const roiLabel = useMemo(() => {
    if (!data?.money.roiMultiple) return 'Aguardando dados';
    return `${data.money.roiMultiple.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}x`;
  }, [data]);

  if (loading && !data) {
    return (
      <Center minH="60vh" bg={pageBg}>
        <Spinner size="xl" />
      </Center>
    );
  }

  if (error || !data) {
    return (
      <Box p={{ base: 4, md: 10 }} bg={pageBg} minH="70vh">
        <Box bg="red.50" border="1px solid" borderColor="red.200" rounded="lg" p={5}>
          <Text color="red.700">{error ?? 'Nao foi possivel carregar seu ROI.'}</Text>
        </Box>
      </Box>
    );
  }

  const acceptance = Math.min(100, data.activity.acceptanceRatePercent);
  const confidenceColor =
    data.dataQuality.confidence === 'high'
      ? 'green'
      : data.dataQuality.confidence === 'medium'
        ? 'orange'
        : 'gray';

  return (
    <Box p={{ base: 4, md: 10 }} bg={pageBg}>
      <Flex justify="space-between" align={{ base: 'stretch', md: 'flex-end' }} direction={{ base: 'column', md: 'row' }} gap={4}>
        <Box>
          <Heading size="2xl" color="gray.900">
            Meu ROI
          </Heading>
          <Text color="gray.600" mt={2}>
            Quanto a Urban AI gerou de dinheiro para seus imóveis.
          </Text>
        </Box>

        <Flex gap={3} direction={{ base: 'column', sm: 'row' }}>
          <Select
            bg="white"
            value={propertyId}
            onChange={(event) => {
              setPropertyId(event.target.value);
              load(windowDays, event.target.value);
            }}
          >
            <option value="">Todos os imóveis</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.nome || property.propertyName}
              </option>
            ))}
          </Select>
          <Select
            bg="white"
            value={windowDays}
            onChange={(event) => {
              const next = Number(event.target.value);
              setWindowDays(next);
              load(next, propertyId);
            }}
          >
            {WINDOWS.map((days) => (
              <option key={days} value={days}>
                Últimos {days} dias
              </option>
            ))}
          </Select>
          <Button onClick={() => load()} isLoading={loading} colorScheme="green">
            Atualizar
          </Button>
        </Flex>
      </Flex>

      <Box mt={8} bg="green.900" color="white" rounded="xl" p={{ base: 5, md: 8 }}>
        <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={5}>
          <Box>
            <Text fontSize="sm" color="green.100" fontWeight="semibold">
              Dinheiro atribuído à Urban AI
            </Text>
            <Heading mt={2} fontSize={{ base: '4xl', md: '6xl' }} lineHeight="1">
              {fmt(data.money.totalAttributedCents)}
            </Heading>
            <Text mt={3} color="green.100">
              {fmt(data.money.confirmedIncrementalCents)} confirmado + {fmt(data.money.projectedIncrementalCents)} em acompanhamento
            </Text>
          </Box>
          <Box textAlign={{ base: 'left', md: 'right' }}>
            <Text fontSize="sm" color="green.100" fontWeight="semibold">
              Retorno sobre assinatura
            </Text>
            <Heading mt={2} fontSize={{ base: '4xl', md: '5xl' }}>
              {roiLabel}
            </Heading>
            <Text mt={3} color={data.money.netValueCents >= 0 ? 'green.100' : 'orange.100'}>
              Valor líquido: {fmt(data.money.netValueCents)}
            </Text>
          </Box>
        </Flex>
      </Box>

      <Grid mt={6} templateColumns={{ base: '1fr', md: 'repeat(4, 1fr)' }} gap={4}>
        <Kpi bg={cardBg} border={border} label="Custo da Urban AI" value={fmt(data.subscription.monthlyCostCents)} help={`${data.subscription.activePayments} assinatura(s) ativa(s)`} />
        <Kpi bg={cardBg} border={border} label="Noites impactadas" value={data.activity.impactedNights.toLocaleString('pt-BR')} help="diárias com preço otimizado" />
        <Kpi bg={cardBg} border={border} label="Sugestões aplicadas" value={`${data.activity.applied}/${data.activity.recommendations}`} help={`${data.activity.applicationRatePercent.toFixed(0)}% das aceitas`} />
        <Kpi bg={cardBg} border={border} label="Potencial perdido" value={fmt(data.money.potentialLostCents)} help="sugestões não aplicadas" />
      </Grid>

      <Grid mt={6} templateColumns={{ base: '1fr', lg: '1.2fr .8fr' }} gap={6}>
        <Box bg={cardBg} border="1px solid" borderColor={border} rounded="xl" p={5}>
          <Flex justify="space-between" align="center" mb={4}>
            <Heading size="md">Resultado por imóvel</Heading>
            <Badge colorScheme={confidenceColor}>{data.dataQuality.label}</Badge>
          </Flex>
          <Text color="gray.500" fontSize="sm" mb={4}>
            {data.dataQuality.explanation}
          </Text>
          {data.perProperty.length === 0 ? (
            <EmptyState />
          ) : (
            <Box overflowX="auto">
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Imóvel</Th>
                    <Th isNumeric>Gerado</Th>
                    <Th isNumeric>Noites</Th>
                    <Th isNumeric>Aplicadas</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {data.perProperty.map((property) => (
                    <Tr key={property.propertyId ?? property.propertyName}>
                      <Td maxW="280px">
                        <Text fontWeight="semibold" noOfLines={1}>{property.propertyName}</Text>
                        <Text color="gray.500" fontSize="xs">{property.recommendations} recomendações</Text>
                      </Td>
                      <Td isNumeric color="green.600" fontWeight="bold">{fmt(property.totalAttributedCents)}</Td>
                      <Td isNumeric>{property.impactedNights}</Td>
                      <Td isNumeric>{property.applied}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </Box>

        <Box bg={cardBg} border="1px solid" borderColor={border} rounded="xl" p={5}>
          <Heading size="md" mb={4}>Adoção das recomendações</Heading>
          <Flex justify="space-between" mb={2}>
            <Text fontSize="sm" color="gray.600">Taxa de aceite</Text>
            <Text fontSize="sm" fontWeight="bold">{acceptance.toFixed(0)}%</Text>
          </Flex>
          <Progress value={acceptance} colorScheme="green" rounded="full" />
          <Grid templateColumns="repeat(2, 1fr)" gap={4} mt={6}>
            <SmallMetric label="Aceitas" value={data.activity.accepted} />
            <SmallMetric label="Aplicadas" value={data.activity.applied} />
            <SmallMetric label="Reservadas" value={data.activity.booked} />
            <SmallMetric label="Rejeitadas" value={data.activity.rejected} />
          </Grid>
        </Box>
      </Grid>

      <Box mt={6} bg={cardBg} border="1px solid" borderColor={border} rounded="xl" p={5}>
        <Heading size="md" mb={4}>Ganhos recentes</Heading>
        {data.recentWins.length === 0 ? (
          <EmptyState />
        ) : (
          <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={3}>
            {data.recentWins.map((win) => (
              <Box key={win.id} border="1px solid" borderColor={border} rounded="md" p={4}>
                <Flex justify="space-between" gap={3}>
                  <Box minW={0}>
                    <Text fontWeight="bold" noOfLines={1}>{win.propertyName}</Text>
                    <Text fontSize="sm" color="gray.500">
                      {fmt(win.currentPriceCents)} para {fmt(win.appliedPriceCents)} em {win.nights} noite(s)
                    </Text>
                  </Box>
                  <Text color="green.600" fontWeight="extrabold">{fmt(win.incrementalCents)}</Text>
                </Flex>
              </Box>
            ))}
          </Grid>
        )}
      </Box>
    </Box>
  );
}

function Kpi({ bg, border, label, value, help }: { bg: string; border: string; label: string; value: string; help: string }) {
  return (
    <Box bg={bg} border="1px solid" borderColor={border} rounded="xl" p={5}>
      <Stat>
        <StatLabel color="gray.500">{label}</StatLabel>
        <StatNumber color="gray.900" fontSize="2xl">{value}</StatNumber>
        <StatHelpText>{help}</StatHelpText>
      </Stat>
    </Box>
  );
}

function SmallMetric({ label, value }: { label: string; value: number }) {
  return (
    <Box>
      <Text fontSize="xs" color="gray.500" textTransform="uppercase">{label}</Text>
      <Text fontSize="2xl" fontWeight="bold">{value.toLocaleString('pt-BR')}</Text>
    </Box>
  );
}

function EmptyState() {
  return (
    <Center py={10}>
      <Text color="gray.500" textAlign="center">
        Ainda não há recomendações aplicadas neste período.
      </Text>
    </Center>
  );
}
