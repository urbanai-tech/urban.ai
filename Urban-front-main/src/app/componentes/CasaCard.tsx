// components/CasaCard.tsx
'use client';

import {
  Card,
  CardHeader,
  Flex,
  Heading,
  Image,
  Text,
  VStack,
} from '@chakra-ui/react';
import { CheckCircleIcon, WarningIcon } from '@chakra-ui/icons';


interface Casa {
  id: string;
  list?: {
    titulo?: string;
  };
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  latitude: number;
  longitude: number;
  ativo: boolean;
}

interface CasaCardProps {
  casa: Casa;
  onClick?: () => void;
}

export default function CasaCard({ casa, onClick }: CasaCardProps) {
  return (
    <Card
      cursor={onClick ? 'pointer' : 'default'}
      onClick={onClick}
      key={casa.id}
      w="100%"
      borderRadius="2xl"
      boxShadow="sm"
      overflow="hidden"
      bg="white"
    >
      <CardHeader p={6}>
        <Flex align="center" gap={6}>
          <Image
            src="https://a0.muscache.com/im/pictures/042cca29-c44c-4370-8c99-f0f5eb74baac.jpg?im_w=960"
            alt={casa.list?.titulo}
            boxSize="120px"
            objectFit="cover"
            borderRadius="lg"
          />

          <VStack align="start" spacing={1} flex="1">
            <Heading size="md">{casa.list?.titulo || 'Sem título'}</Heading>
            <Text fontSize="sm" color="gray.600">
              {`${casa.logradouro}, ${casa.numero} — ${casa.bairro}, ${casa.cidade} - ${casa.estado}, ${casa.cep}`}
            </Text>

            <Flex align="center" gap={2}>
              {casa.ativo ? (
                <Flex
                  align="center"
                  color="green.500"
                  fontWeight="semibold"
                  fontSize="sm"
                >
                  <CheckCircleIcon mr={1} /> Ativo
                </Flex>
              ) : (
                <Flex
                  align="center"
                  color="red.500"
                  fontWeight="semibold"
                  fontSize="sm"
                >
                  <WarningIcon mr={1} /> Inativo
                </Flex>
              )}

              <Flex
                as="a"
                href={`https://www.google.com/maps/search/?api=1&query=${casa.latitude},${casa.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                align="center"
                color="blue.500"
                fontSize="sm"
                fontWeight="medium"
                _hover={{ textDecoration: 'underline' }}
              >

              </Flex>
            </Flex>
          </VStack>
        </Flex>
      </CardHeader>
    </Card>
  );
}
