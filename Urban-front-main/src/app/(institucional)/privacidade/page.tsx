"use client";

import React from "react";
import { Box, Container, Heading, Text, VStack, Divider } from "@chakra-ui/react";

export default function Privacidade() {
  return (
    <Container maxW="container.lg" py={8}>
      <Box bg="white" p={10} borderRadius="xl" boxShadow="sm" borderWidth="1px" borderColor="gray.100">
        <Heading as="h1" size="xl" mb={6} color="#1C1D3B">
          Política de Privacidade
        </Heading>
        <Text color="gray.500" mb={8} fontSize="sm">
          Última atualização: Março de 2026
        </Text>

        <VStack spacing={6} align="flex-start" color="gray.700" lineHeight="tall">
          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              1. Coleta de Dados
            </Heading>
            <Text>
              A Urban AI coleta informações essenciais para o funcionamento da nossa plataforma 
              de precificação. Isso inclui dados da sua conta (nome, e-mail), endereços das 
              propriedades cadastradas e, caso aplicável, informações de pagamento processadas 
              por terceiros autorizados (ex: Stripe).
            </Text>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              2. Uso das Informações
            </Heading>
            <Text>
              Nós utilizamos as informações das propriedades unicamente para aplicar nossos algoritmos 
              de precificação (Machine Learning - KNN) cruzados com a nossa base interna de eventos. 
              Seus dados não são vendidos ou comercializados para redes de publicidade ou telemarketing.
            </Text>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              3. Proteção e Armazenamento
            </Heading>
            <Text>
              A segurança dos seus dados é prioritária. O acesso aos nossos bancos de dados é restrito, 
              sujeito a autenticação rigorosa e políticas de segurança modernas baseadas na nuvem 
              (servidores monitorados ininterruptamente).
            </Text>
          </Box>
          <Divider borderColor="gray.200" />

          <Box w="full">
            <Heading as="h2" size="md" mb={3} color="blue.600">
              4. Seus Direitos
            </Heading>
            <Text>
              Você tem o direito de solicitar a exclusão da sua conta e de todos os dados de 
              propriedades a ela associados a qualquer momento. Para exercer este direito, basta 
              utilizar as opções de controle em sua conta ou entrar em contato pelo nosso 
              canal oficial de suporte através da página de Contato.
            </Text>
          </Box>
          
        </VStack>
      </Box>
    </Container>
  );
}
