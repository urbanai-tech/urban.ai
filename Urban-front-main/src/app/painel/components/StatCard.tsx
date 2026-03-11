'use client';

import React, { useEffect, useState } from 'react';
import { Box, Flex, Heading, Text, useColorModeValue, Progress } from '@chakra-ui/react';
import { getPropertyData } from '@/app/service/api'; // ajuste o path conforme necessário

type DashboardCardsProps = {
  propertyId: string | undefined;
};

const StatCard = ({
  title,
  value,
  subtitle,
  isLoading,
}: {
  title: string;
  value?: string | number;
  subtitle?: string;
  isLoading?: boolean;
}) => {
  const bg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.800', 'white');

  return (
    <Box
      p={6}
      minW="220px"
      flex="1"
      borderWidth={1}
      borderColor={borderColor}
      borderRadius="xl"
      bg={bg}
      shadow="md"
      transition="all 0.2s"
      _hover={{ shadow: 'xl', transform: 'translateY(-4px)' }}
    >
      {isLoading ? (
        <Progress size="xs" isIndeterminate mb={4} />
      ) : null}
      <Text fontSize="sm" color="gray.500" fontWeight="semibold">
        {title}
      </Text>
      <Heading size="lg" color={textColor} mt={1}>
        {value ?? '--'}
      </Heading>
      {subtitle && (
        <Text mt={1} fontSize="sm" color="green.400" fontWeight="semibold">
          {subtitle}
        </Text>
      )}
    </Box>
  );
};

export default function DashboardCards({ propertyId }: DashboardCardsProps) {
  const [data, setData] = useState<null | {
    quantidadePropriedadesAtivas: number;
    lucroProjetadoGeradoPeloUrban: number;
    receitaProjetada: {
      receitaProjetada: number;
      diferencaPercentual: number;
    };
    quantidadeEventos: number;
  }>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {


    async function fetchData() {
      try {
        setLoading(true);
        const result = await getPropertyData(propertyId);
        setData(result);
      } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [propertyId]);

  const bg = useColorModeValue('gray.50', 'gray.900');

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Box pt={{ base: 6, md: 10 }} bg={bg}>
      <Flex direction={{ base: 'column', md: 'row' }} gap={6} flexWrap="wrap">
        <StatCard title="Propriedades Ativas" value={data?.quantidadePropriedadesAtivas} isLoading={loading} />
        <StatCard title="Eventos" value={data?.quantidadeEventos} isLoading={loading} />
        <StatCard
          title="Receita Projetada"
          value={data ? formatCurrency(data.receitaProjetada.receitaProjetada) : undefined}
           subtitle={new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(new Date())+""}
          isLoading={loading}
        />
        <StatCard
          title="Lucro Projetado Urban AI"
          value={data ? formatCurrency(data.lucroProjetadoGeradoPeloUrban) : undefined}
          subtitle={data ? `+${data.receitaProjetada.diferencaPercentual.toFixed(2)}%` : undefined}
          isLoading={loading}
        />
      </Flex>
    </Box>
  );
}
