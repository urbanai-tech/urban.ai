"use client";

import React from "react";
import { Box, Container, Heading, Text, VStack } from "@chakra-ui/react";

export default function Sobre() {
  return (
    <Container maxW="container.lg" py={8}>
      <VStack spacing={8} align="flex-start">
        <Heading as="h1" size="2xl" color="#1C1D3B">
          Sobre a Urban AI
        </Heading>
        
        <Text fontSize="lg" color="gray.700" lineHeight="tall">
          A Urban AI nasceu com a missão de revolucionar a precificação de aluguéis de curta temporada. 
          Nós entendemos que o valor de um imóvel não é estático; ele muda dinamicamente de acordo com
          eventos locais, demanda turística e fatores sazonais.
        </Text>
        
        <Box w="full" bg="white" p={8} borderRadius="xl" boxShadow="sm" borderWidth="1px" borderColor="gray.100">
          <Heading as="h2" size="lg" mb={4} color="blue.600">
            Nossa Tecnologia
          </Heading>
          <Text fontSize="md" color="gray.600" lineHeight="tall">
            Utilizando Inteligência Artificial e algoritmos de KNN (K-Nearest Neighbors), cruzamos 
            informações geográficas precisas (isócronas) com uma vasta base de dados de eventos e shows 
            para sugerir a precificação mais competitiva para a sua propriedade. Nosso objetivo é 
            maximizar o seu rendimento sem o esforço de ficar acompanhando a agenda da cidade manualmente.
          </Text>
        </Box>

        <Box w="full" bg="#1C1D3B" p={8} borderRadius="xl" color="white" boxShadow="md">
           <Heading as="h2" size="lg" mb={4} color="white">
            Nossa Visão
          </Heading>
          <Text fontSize="md" lineHeight="tall">
            Queremos ser a plataforma definitiva para anfitriões que desejam previsibilidade e 
            lucratividade baseada em dados reais, atuando como o copiloto inteligente para os seus negócios 
            no setor imobiliário.
          </Text>
        </Box>
      </VStack>
    </Container>
  );
}
