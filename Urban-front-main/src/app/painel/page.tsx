'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Box, FormControl, FormLabel, Spinner, Center, Flex } from '@chakra-ui/react';
import dynamic from 'next/dynamic';
import { getEventosAcompanhando, getPropriedadesDropdownList, PropertyDropdown } from '@/app/service/api';
import { EventItem } from '../dashboard/components/ItemEvento';
import { Pagination } from '../componentes/Pagination';
import { EventCard } from './components/ItemEventoPainel';
import DashboardCards from './components/StatCard';
import { AppPageShell, AppSectionHeader, AppEmptyState, Icons } from '../componentes/ui';

const PropertySelect = dynamic(() => import('./components/CustomSelect'), { ssr: false });

export default function SugestoesAceitas() {
  const [propsInfo, setPropsInfo] = useState<PropertyDropdown[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [loadingProps, setLoadingProps] = useState(true);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 5; // itens por página

  // Buscar propriedades
useEffect(() => {
  async function fetchProps() {
    try {
      setLoadingProps(true);
      const data = await getPropriedadesDropdownList();

      // Adicionar opção "Todos" no início
      const todosOption: PropertyDropdown = {
        id: '', // id vazio representa Todos
        nome: 'Todos',
        analisado: 'completed',
        propertyName: 'Todos',
        userId: '',
        image_url: '',
        latitude: 0,
        longitude: 0,
      };

      const updatedData: PropertyDropdown[] = [todosOption, ...data];
      setPropsInfo(updatedData);

      // Seleciona "Todos" como padrão
      setPropertyId(''); 
    } catch (err) {
      console.error('Erro ao carregar propriedades', err);
    } finally {
      setLoadingProps(false);
    }
  }
  fetchProps();
}, []);

  // Buscar eventos aceitos
  const fetchEvents = useCallback(async () => {
    if (propertyId === '') {
      // Se "Todos" estiver selecionado, buscar todos os eventos
      try {
        setIsLoadingEvents(true);
        const result = await getEventosAcompanhando(undefined, page, limit); // Ajuste dependendo da API
        setEvents(result.data);
        setTotalPages(Math.ceil(result.total / limit));
      } catch (err) {
        console.error('Erro ao carregar eventos', err);
      } finally {
        setIsLoadingEvents(false);
      }
      return;
    }

    try {
      setIsLoadingEvents(true);
      const result = await getEventosAcompanhando(propertyId, page, limit);
      setEvents(result.data);
      setTotalPages(Math.ceil(result.total / limit));
    } catch (err) {
      console.error('Erro ao carregar eventos', err);
    } finally {
      setIsLoadingEvents(false);
    }
  }, [page, propertyId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handlePageChange = (novaPagina: number) => {
    setPage(novaPagina);
  };

  return (
    <AppPageShell maxWidth={1280}>
      <AppSectionHeader
        eyebrow="PAINEL · HOJE NA SUA OPERAÇÃO"
        title="Painel de controle"
        subtitle="Eventos com sugestão da Urban AI que merecem sua atenção agora. Filtre por imóvel pra focar onde tem mais oportunidade."
        actions={
          loadingProps ? (
            <Spinner size="sm" color="orange.500" />
          ) : (
            <Box maxW={{ base: '100%', md: '320px' }} w="full">
              <FormControl>
                <FormLabel
                  fontSize="11px"
                  letterSpacing="1.5px"
                  textTransform="uppercase"
                  fontWeight="600"
                  color="gray.500"
                  mb={1}
                >
                  Filtrar imóvel
                </FormLabel>
                <PropertySelect
                  value={propertyId}
                  propsInfo={propsInfo}
                  setPropertyId={(id) => {
                    setPropertyId(id);
                    setPage(1);
                  }}
                />
              </FormControl>
            </Box>
          )
        }
      />

      <DashboardCards propertyId={propertyId} />

      <Box mt={8}>
        {isLoadingEvents ? (
          <Center py={20}>
            <Spinner size="xl" color="orange.500" thickness="2px" />
          </Center>
        ) : events.length === 0 ? (
          <AppEmptyState
            eyebrow="SEM SUGESTÕES PENDENTES"
            title="Tudo certo por aqui"
            body="Quando a Urban AI detectar uma nova oportunidade de evento, aparece aqui. Você também recebe por e-mail."
            icon={<Icons.Sparkles size={32} />}
          />
        ) : (
          <Flex direction="column" gap={4}>
            {events.map(ev => (
              <EventCard
                key={ev.id}
                ev={ev}
                cardBorder="gray.200"
                bg="white"
                propertyId={propertyId}
                setIsLoading={setIsLoadingEvents}
                onChange={() => fetchEvents()}
              />
            ))}

            <Pagination
              paginaAtual={page}
              totalPaginas={totalPages}
              onPageChange={handlePageChange}
            />
          </Flex>
        )}
      </Box>
    </AppPageShell>
  );
}
