// components/Footer.tsx
"use client";

import React from 'react';
import "../../../i18n"; // inicializa o i18n
import { useTranslation } from 'react-i18next';
import { Box, Text, Flex, Link as ChakraLink, VStack } from '@chakra-ui/react';
import NextLink from 'next/link';

const Footer = () => {
  const { t } = useTranslation();

  return (
    <Box
      bg="white"
      color="#0e161b"
      py={6}
      h={200}
      borderTop="1px"
      borderTopColor="#e8eef3"
    >
      <VStack spacing={4}>
        <Text textAlign="center" fontSize="sm">
          {t('footer.copy', { year: new Date().getFullYear() })}
        </Text>
        <Flex justify="center" gap={6} wrap="wrap">
          <ChakraLink
            as={NextLink}
            href="/sobre"
            _hover={{ textDecoration: 'underline' }}
          >
            {t('footer.links.about')}
          </ChakraLink>
          <ChakraLink
            as={NextLink}
            href="/contato"
            _hover={{ textDecoration: 'underline' }}
          >
            {t('footer.links.contact')}
          </ChakraLink>
          <ChakraLink
            as={NextLink}
            href="/privacidade"
            _hover={{ textDecoration: 'underline' }}
          >
            {t('footer.links.privacy')}
          </ChakraLink>
        </Flex>
      </VStack>
    </Box>
  );
};

export default Footer;
