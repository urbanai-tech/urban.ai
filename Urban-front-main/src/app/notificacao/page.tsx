'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Heading,
  Text,
  Badge,
  VStack,
  useColorModeValue,
  Center,
  Spinner,
} from '@chakra-ui/react';
import { formatDistanceToNow } from 'date-fns';
import { getNotificacoesPorUsuario, marcarNotificacaoComoAberta } from '../service/api';
import { Pagination } from '../componentes/Pagination';
import { ptBR } from 'date-fns/locale'; 
import { useRouter } from 'next/navigation';

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  createdAt: string; // vem como string da API
  opened: boolean;
  redirectTo:string;
  
}

interface NotificationCardProps {
  notif: NotificationItem;
  cardBorder: string;
}

const NotificationCard: React.FC<NotificationCardProps> = ({ notif, cardBorder }) => {
  const router = useRouter();

  const bgColor = notif.opened ? useColorModeValue('white', 'gray.800') : '#E8F0FF';
  const titleColor = notif.opened ? 'gray.800' : 'blue.800';

  const handleClick = async () => {
     if (!notif.opened) {
        await marcarNotificacaoComoAberta(notif.id);
      }
    if (notif.redirectTo) {
      router.push(notif.redirectTo); // navega para a rota
    }
  };

  return (
    <Box
      border="1px solid"
      borderColor={cardBorder}
      borderRadius="2xl"
      p={5}
      bg={bgColor}
      boxShadow="xs"
      _hover={{ boxShadow: 'md', cursor: notif.redirectTo ? 'pointer' : 'default' }}
      transition="box-shadow 0.15s ease"
      w="100%"
      onClick={handleClick} // 👈 clique no card
    >
      <Flex direction="column" gap={2}>
        <Flex justify="space-between" align="center">
          <Text fontWeight="extrabold" fontSize="xl" color={titleColor} lineHeight="short">
            {notif.title}
          </Text>
          {!notif.opened && (
            <Badge color="white" bg="#1931CF" fontSize="sm" fontWeight="bold" px={3} py={1} borderRadius="full">
              Novo
            </Badge>
          )}
        </Flex>

        <Text fontSize="md" color="gray.700">{notif.description}</Text>

        <Text color="gray.600" fontSize="sm">
          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: ptBR })}
        </Text>
      </Flex>
    </Box>
  );
};
export default function NotificationCenter() {
  const bg = useColorModeValue('gray.50', 'gray.100');
  const cardBorder = 'gray.200';

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);

  const limit = 10;

  const fetchData = async (page: number) => {
    try {
      setLoading(true);
      const res = await getNotificacoesPorUsuario(page, limit);
      setNotifications(res.data); // 👈 pega o array
      setPaginaAtual(res.page);
      setTotalPaginas(res.lastPage);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(paginaAtual);
  }, [paginaAtual]);

  return (
    <Box p={{ base: 4, md: 10 }} bg={bg} minH="100vh">
      <Flex mb={6}>
        <Heading fontWeight="extrabold" size="2xl">
          Central de Notificações
        </Heading>
      </Flex>

      {loading ? (
        <Center py={20}>
          <Spinner size="xl" />
        </Center>
      ) : notifications.length === 0 ? (
        <Center py={20}>Nenhuma notificação encontrada</Center>
      ) : (
        <>
          <VStack spacing={4} align="stretch">
            {notifications.map((notif) => (
              <NotificationCard
                key={notif.id}
                notif={notif}
                cardBorder={cardBorder}
              />
            ))}
          </VStack>

          {/* 👇 paginação aqui */}
          <Pagination
            paginaAtual={paginaAtual}
            totalPaginas={totalPaginas}
            onPageChange={(novaPagina:any) => setPaginaAtual(novaPagina)}
          />
        </>
      )}
    </Box>
  );
}
