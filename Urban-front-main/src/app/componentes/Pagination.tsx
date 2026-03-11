'use client';

import { Box, Flex, Text } from '@chakra-ui/react';
import { TFunction } from 'i18next';

interface PaginationProps {
  paginaAtual: number;
  totalPaginas: number;
  onPageChange: (novaPagina: number) => void;
}

export function Pagination({
  paginaAtual,
  totalPaginas,
  onPageChange,
}: PaginationProps) {
  const anteriorLabel = "Anterior";
  const proximoLabel  = "Próximo";



  return (
    <Flex justify="center" mt={10}>
      <Flex
        align="center"
        bg="white"
        borderRadius="full"
        px={6}
        py={2}
        gap={6}
      >
        <Box
          as="button"
          onClick={() => onPageChange(Math.max(paginaAtual - 1, 1))}
          disabled={paginaAtual === 1}
          px={3}
          py={1}
          borderRadius="full"
          bg={paginaAtual === 1 ? 'gray.200' : 'blue.500'}
          color={paginaAtual === 1 ? 'gray.500' : 'white'}
          fontWeight="medium"
          cursor={paginaAtual === 1 ? 'not-allowed' : 'pointer'}
          _hover={{ bg: paginaAtual === 1 ? 'gray.200' : 'blue.600' }}
          transition="all 0.2s"
        >
          ← {anteriorLabel}
        </Box>

        <Text fontSize="md" fontWeight="semibold" color="gray.700">
          Página {paginaAtual} de {totalPaginas}
        </Text>

        <Box
          as="button"
          onClick={() => onPageChange(Math.min(paginaAtual + 1, totalPaginas))}
          disabled={paginaAtual === totalPaginas}
          px={3}
          py={1}
          borderRadius="full"
          bg={paginaAtual === totalPaginas ? 'gray.200' : 'blue.500'}
          color={paginaAtual === totalPaginas ? 'gray.500' : 'white'}
          fontWeight="medium"
          cursor={paginaAtual === totalPaginas ? 'not-allowed' : 'pointer'}
          _hover={{ bg: paginaAtual === totalPaginas ? 'gray.200' : 'blue.600' }}
          transition="all 0.2s"
        >
          {proximoLabel} →
        </Box>
      </Flex>
    </Flex>
  );
}
