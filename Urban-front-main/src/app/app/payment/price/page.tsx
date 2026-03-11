// src/app/payment/price/page.tsx
'use client';

import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  Flex,
  Heading,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useBreakpointValue,
} from '@chakra-ui/react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import React from 'react';

// --- Row type ---
interface Row {
  originalPrice: number;
  recommendedPrice: number;
}

// --- Props for PriceComparison component ---
interface PriceComparisonProps {
  property: {
    title: string;
    location: string;
    imageUrl: string;
  };
  event: {
    title: string;
    dateRange: string;
  };
  data: Row[];
  onBack: () => void;
}

// --- PriceComparison component ---
const PriceComparison: React.FC<PriceComparisonProps> = ({ property, event, data, onBack }) => {
  const { t } = useTranslation();
  const isMobile = useBreakpointValue({ base: true, md: false });

  return (
    <Box w="full" p={6} bg="white" borderRadius="md" shadow="sm">
      <Heading mb={6} fontSize={{ base: 'xl', md: '2xl' }}>
        {t('price_comparison.title')}
      </Heading>

      <Flex
        direction={{ base: 'column', md: 'row' }}
        justify="space-between"
        align={{ base: 'stretch', md: 'center' }}
        gap={6}
        mb={8}
      >
        <Box flex="1">
          <Text fontWeight="bold" mb={1}>
            {t('price_comparison.property_label')}
          </Text>
          <Text fontSize="lg" fontWeight="semibold">
            {property.title}
          </Text>
          <Text fontSize="sm" color="gray.500">
            {property.location}
          </Text>
        </Box>

        <Box
          borderRadius="lg"
          overflow="hidden"
          flexShrink={0}
          w={{ base: '100%', md: '360px' }}
          h="200px"
          position="relative"
        >
          <Image
            src={property.imageUrl}
            alt={property.title}
            fill
            style={{ objectFit: 'cover' }}
            unoptimized
          />
        </Box>
      </Flex>

      <Heading size="md" mb={2}>
        {t('price_comparison.event_label')}
      </Heading>
      <Text fontWeight="medium" mb={6}>
        {event.title} ({event.dateRange})
      </Text>

      <Button variant="outline" mb={6} onClick={onBack}>
        {t('price_comparison.back_button')}
      </Button>

      {!isMobile ? (
        <Box overflowX="auto" w="full">
          <Table variant="simple" size="md">
            <Thead>
              <Tr>
                <Th>{t('price_comparison.original_price')}</Th>
                <Th>{t('price_comparison.recommended_price')}</Th>
                <Th>{t('price_comparison.percentage_change')}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {data.map((row, i) => {
                const change = Math.round((row.recommendedPrice / row.originalPrice - 1) * 100);
                const label = `${change > 0 ? '+' : ''}${change}%`;
                const color = change > 0 ? 'green' : change < 0 ? 'red' : 'gray';

                return (
                  <Tr key={i}>
                    <Td fontWeight="medium">R${row.originalPrice}</Td>
                    <Td>R${row.recommendedPrice}</Td>
                    <Td>
                      <Box
                        as="span"
                        bg={`${color}.100`}
                        color={`${color}.700`}
                        px={2}
                        py={1}
                        borderRadius="md"
                        fontSize="sm"
                        fontWeight="medium"
                      >
                        {label}
                      </Box>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </Box>
      ) : (
        <Stack spacing={4}>
          {data.map((row, i) => {
            const change = Math.round((row.recommendedPrice / row.originalPrice - 1) * 100);
            const label = `${change > 0 ? '+' : ''}${change}%`;
            const color = change > 0 ? 'green' : change < 0 ? 'red' : 'gray';

            return (
              <Card key={i} shadow="sm" borderWidth="1px" borderColor="gray.100">
                <CardBody>
                  <Stack spacing={3}>
                    <Flex justify="space-between">
                      <Text fontWeight="bold">{t('price_comparison.original_price')}:</Text>
                      <Text fontWeight="medium">R${row.originalPrice}</Text>
                    </Flex>

                    <Divider />

                    <Flex justify="space-between">
                      <Text fontWeight="bold">{t('price_comparison.recommended_price')}:</Text>
                      <Text>R${row.recommendedPrice}</Text>
                    </Flex>

                    <Divider />

                    <Flex justify="space-between" align="center">
                      <Text fontWeight="bold">{t('price_comparison.percentage_change')}:</Text>
                      <Badge
                        bg={`${color}.100`}
                        color={`${color}.700`}
                        px={2}
                        py={1}
                        borderRadius="md"
                        fontSize="sm"
                        fontWeight="medium"
                      >
                        {label}
                      </Badge>
                    </Flex>
                  </Stack>
                </CardBody>
              </Card>
            );
          })}
        </Stack>
      )}
    </Box>
  );
};

// --- Mock data for testing the page ---
const mockProperty = {
  title: 'Apartamento charmoso perto do centro',
  location: 'São Paulo, Brasil',
  imageUrl:
    'https://a0.muscache.com/im/pictures/miso/Hosting-45077642/original/24bf6644-1b88-41b7-a24c-537c732b5df3.jpeg?im_w=1200',
};

const mockEvent = {
  title: 'The Town Music Festival',
  dateRange: 'Julho 15–18',
};

const mockData: Row[] = [
  { originalPrice: 150, recommendedPrice: 180 },
  { originalPrice: 150, recommendedPrice: 190 },
  { originalPrice: 150, recommendedPrice: 200 },
];

// ✅ Export default da página principal
export default function Page() {
  return (
    <Box w="full" mx="auto" px={{ base: 4, md: 6 }} pb={8}>
      <PriceComparison
        property={mockProperty}
        event={mockEvent}
        data={mockData}
        onBack={() => alert('Voltar clicado')}
      />
    </Box>
  );
}
