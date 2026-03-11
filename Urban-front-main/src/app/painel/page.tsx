'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Heading,
  FormControl,
  FormLabel,
  useColorModeValue,
  Spinner,
  Center,
  Flex,
} from '@chakra-ui/react';
import dynamic from 'next/dynamic';
import { getEventosAcompanhando, getPropriedadesDropdownList, PropertyDropdown } from '@/app/service/api';
import { EventItem } from '../dashboard/components/ItemEvento';
import { Pagination } from '../componentes/Pagination';
import { EventCard } from './components/ItemEventoPainel';
import DashboardCards from './components/StatCard';

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

  const bg = useColorModeValue('gray.50', 'gray.900');

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
  async function fetchEvents() {
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
  }

  useEffect(() => {
    fetchEvents();
  }, [propertyId, page]);

  const handlePageChange = (novaPagina: number) => {
    setPage(novaPagina);
  };

  return (
    <Box p={{ base: 4, md: 10 }} bg={bg}>
      <Flex
        direction={{ base: 'column', md: 'row' }}
        justify="space-between"
        align={{ base: 'flex-start', md: 'center' }}
        gap={{ base: 4, md: 0 }}
      >
        <Heading fontWeight="extrabold" size="2xl">
          Painel de controle
        </Heading>

        {loadingProps ? (
          <Center>
            <Spinner size="lg" />
          </Center>
        ) : (
          <Box maxW={{ base: '100%', md: '320px' }} w="full">
            <FormControl>
              <FormLabel fontWeight="semibold" color="gray.800">
                Filtrar propriedade
              </FormLabel>
              <PropertySelect
                value={propertyId}
                propsInfo={propsInfo}
                setPropertyId={(id) => {
                  setPropertyId(id);
                  setPage(1); // resetar página ao trocar de propriedade
                }}
              />
            </FormControl>
          </Box>
        )}
      </Flex>

      <DashboardCards propertyId={propertyId} />

      <Box mt={6}>
        {isLoadingEvents ? (
          <Center py={20}>
            <Spinner size="xl" />
          </Center>
        ) : events.length === 0 ? (
          <Center py={20}>Nenhum evento aceito encontrado</Center>
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
    </Box>
  );
}
