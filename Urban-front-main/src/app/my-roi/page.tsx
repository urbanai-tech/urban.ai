'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Center,
  Flex,
  Grid,
  Progress,
  Select,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { fetchMyRoi, getPropriedadesDropdownList, PropertyDropdown, RoiSummary } from '../service/api';
import {
  AppPageShell,
  AppSectionHeader,
  AppCard,
  AppCardHeader,
  AppMetricCard,
  AppButton,
  AppBadge,
  AppEmptyState,
  Icons,
} from '../componentes/ui';
import type { AppBadgeKind } from '../componentes/ui';

const WINDOWS = [30, 90, 180, 365];

/**
 * /my-roi — tela mais forte do anfitrião (auditoria 2026-05-16 deu 35/60).
 *
 * Redesenhada no Sprint 3 para:
 *  - Substituir `bg="green.900"` (verde-banco-de-trás-da-padaria) por hero
 *    card `urban-app-card-accent` com Bebas Neue 96px em #E8500A.
 *  - Remover `colorScheme="green"` no botão Atualizar (era a única tela onde
 *    o anfitrião VÊ DINHEIRO — não pode parecer extrato bancário).
 *  - Verde em "Gerado" + "Resultado por imóvel" → accent #E8500A.
 *  - Confidence badge → AppBadge.
 *  - Progress bar → laranja (não verde).
 */
export default function MyRoiPage() {
  const [data, setData] = useState<RoiSummary | null>(null);
  const [properties, setProperties] = useState<PropertyDropdown[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [windowDays, setWindowDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      setError(
        e?.response?.status === 401
          ? 'Faça login novamente para ver seu ROI.'
          : e?.message || 'Erro ao carregar ROI.',
      );
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
    if (!data?.money.roiMultiple) return '—';
    return `${data.money.roiMultiple.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}x`;
  }, [data]);

  if (loading && !data) {
    return (
      <AppPageShell>
        <Center minH="60vh">
          <Spinner size="xl" color="orange.500" thickness="2px" />
        </Center>
      </AppPageShell>
    );
  }

  if (error || !data) {
    return (
      <AppPageShell>
        <AppEmptyState
          eyebrow="ERRO"
          title="Não foi possível carregar"
          body={error ?? 'Não foi possível carregar seu ROI.'}
          icon={<Icons.AlertCircle size={32} />}
          action={
            <AppButton variant="primary" onClick={() => load()}>
              Tentar de novo
            </AppButton>
          }
        />
      </AppPageShell>
    );
  }

  const acceptance = Math.min(100, data.activity.acceptanceRatePercent);
  const confidenceKind: AppBadgeKind =
    data.dataQuality.confidence === 'high'
      ? 'success'
      : data.dataQuality.confidence === 'medium'
        ? 'warn'
        : 'neutral';

  return (
    <AppPageShell maxWidth={1280}>
      <AppSectionHeader
        eyebrow="MEU ROI · IMPACTO DA URBAN AI"
        title="Quanto a IA gerou de dinheiro"
        subtitle="Soma das diárias com preço otimizado nos últimos dias. Confirmadas pelo Stays/Airbnb + acompanhando as que ainda não fecharam."
        actions={
          <Flex gap={2} direction={{ base: 'column', sm: 'row' }} align="center">
            <Select
              size="md"
              bg="white"
              borderColor="gray.200"
              borderRadius="10px"
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
              size="md"
              bg="white"
              borderColor="gray.200"
              borderRadius="10px"
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
            <AppButton variant="primary" onClick={() => load()} loading={loading} leftIcon={<Icons.Zap size={14} />}>
              Atualizar
            </AppButton>
          </Flex>
        }
      />

      {/* === Hero card: dinheiro atribuído === */}
      <AppCard variant="accent" style={{ padding: '40px 40px 36px', marginBottom: 32 }}>
        <Flex justify="space-between" align={{ base: 'flex-start', md: 'flex-end' }} direction={{ base: 'column', md: 'row' }} gap={6}>
          <Box>
            <p className="urban-app-eyebrow">DINHEIRO ATRIBUÍDO À URBAN AI</p>
            <p className="urban-app-display-hero" style={{ marginTop: 12, color: 'var(--app-accent)' }}>
              {fmt(data.money.totalAttributedCents)}
            </p>
            <Text mt={3} fontSize="sm" color="gray.600">
              <strong style={{ color: 'var(--app-text)' }}>{fmt(data.money.confirmedIncrementalCents)}</strong> confirmado
              {' · '}
              <span style={{ color: 'var(--app-text-muted)' }}>{fmt(data.money.projectedIncrementalCents)} em acompanhamento</span>
            </Text>
          </Box>
          <Box textAlign={{ base: 'left', md: 'right' }} borderLeft={{ md: '1px solid' }} borderColor={{ md: 'var(--app-divider)' }} pl={{ md: 8 }}>
            <p className="urban-app-eyebrow-muted">Retorno sobre assinatura</p>
            <p className="urban-app-display-md" style={{ marginTop: 12 }}>
              {roiLabel}
            </p>
            <Text mt={3} fontSize="sm" color={data.money.netValueCents >= 0 ? 'gray.600' : 'red.600'}>
              Valor líquido: <strong style={{ color: 'var(--app-text)' }}>{fmt(data.money.netValueCents)}</strong>
            </Text>
          </Box>
        </Flex>
      </AppCard>

      {/* === KPIs detalhados === */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 24,
          borderTop: '1px solid var(--app-divider)',
          borderBottom: '1px solid var(--app-divider)',
          padding: '24px 0',
          marginBottom: 32,
        }}
      >
        <AppMetricCard
          label="Custo da Urban AI"
          value={fmt(data.subscription.monthlyCostCents)}
          sub={`${data.subscription.activePayments} assinatura(s) ativa(s)`}
        />
        <AppMetricCard
          label="Noites impactadas"
          value={data.activity.impactedNights}
          sub="diárias com preço otimizado"
        />
        <AppMetricCard
          label="Sugestões aplicadas"
          value={`${data.activity.applied}/${data.activity.recommendations}`}
          sub={`${data.activity.applicationRatePercent.toFixed(0)}% das aceitas`}
        />
        <AppMetricCard
          label="Potencial perdido"
          value={fmt(data.money.potentialLostCents)}
          sub="sugestões não aplicadas"
          accent={data.money.potentialLostCents > 0}
        />
      </Box>

      <Grid templateColumns={{ base: '1fr', lg: '1.2fr .8fr' }} gap={6} mb={6}>
        <AppCard variant="default">
          <AppCardHeader
            title="Resultado por imóvel"
            subtitle={data.dataQuality.explanation}
            actions={<AppBadge kind={confidenceKind}>{data.dataQuality.label}</AppBadge>}
          />
          {data.perProperty.length === 0 ? (
            <AppEmptyState
              title="Nada aplicado neste período"
              body="Quando você aplicar uma sugestão da Urban AI, o ROI aparece aqui."
            />
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
                      <Td isNumeric>
                        <span style={{ color: 'var(--app-accent)', fontWeight: 700 }}>
                          {fmt(property.totalAttributedCents)}
                        </span>
                      </Td>
                      <Td isNumeric>{property.impactedNights}</Td>
                      <Td isNumeric>{property.applied}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </AppCard>

        <AppCard variant="default">
          <AppCardHeader title="Adoção das recomendações" />
          <Flex justify="space-between" mb={2}>
            <Text fontSize="sm" color="gray.600">Taxa de aceite</Text>
            <Text fontSize="sm" fontWeight="bold">{acceptance.toFixed(0)}%</Text>
          </Flex>
          <Progress value={acceptance} rounded="full" sx={{ '& > div': { background: 'var(--app-accent)' } }} />
          <Grid templateColumns="repeat(2, 1fr)" gap={6} mt={6}>
            <AppMetricCard label="Aceitas" value={data.activity.accepted} variant="sm" />
            <AppMetricCard label="Aplicadas" value={data.activity.applied} variant="sm" />
            <AppMetricCard label="Reservadas" value={data.activity.booked} variant="sm" />
            <AppMetricCard label="Rejeitadas" value={data.activity.rejected} variant="sm" />
          </Grid>
        </AppCard>
      </Grid>

      <AppCard variant="default">
        <AppCardHeader title="Ganhos recentes" subtitle="Últimas sugestões que viraram receita confirmada." />
        {data.recentWins.length === 0 ? (
          <AppEmptyState
            title="Sem ganhos confirmados ainda"
            body="Aceitas + aplicadas + reservas com noites já vencidas aparecem aqui."
          />
        ) : (
          <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={3}>
            {data.recentWins.map((win) => (
              <Box
                key={win.id}
                borderWidth="1px"
                borderColor="var(--app-divider)"
                rounded="md"
                p={4}
                _hover={{ borderColor: 'var(--app-divider-strong)' }}
              >
                <Flex justify="space-between" gap={3} align="center">
                  <Box minW={0}>
                    <Text fontWeight="semibold" noOfLines={1}>{win.propertyName}</Text>
                    <Text fontSize="xs" color="gray.500">
                      {fmt(win.currentPriceCents)} → {fmt(win.appliedPriceCents)} · {win.nights} noite(s)
                    </Text>
                  </Box>
                  <Text fontWeight="bold" style={{ color: 'var(--app-accent)' }}>
                    +{fmt(win.incrementalCents)}
                  </Text>
                </Flex>
              </Box>
            ))}
          </Grid>
        )}
      </AppCard>
    </AppPageShell>
  );
}
