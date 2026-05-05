"use client";

import React, { useState } from "react";
import { 
  Box, Button, Container, FormControl, FormLabel, Heading, 
  Input, Textarea, Text, VStack, useToast, Flex 
} from "@chakra-ui/react";
import { EmailIcon } from "@chakra-ui/icons";

export default function Contato() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simular o tempo de envio
    setTimeout(() => {
      setLoading(false);
      toast({
        title: "Mensagem enviada!",
        description: "Agradecemos o contato. Nossa equipe retornará em breve.",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    }, 1500);
  };

  return (
    <Container maxW="container.lg" py={8}>
      <Flex direction={{ base: "column", md: "row" }} gap={10}>
        
        {/* Formulário */}
        <Box flex="2" bg="white" p={8} borderRadius="xl" boxShadow="sm" borderWidth="1px" borderColor="gray.100">
          <Heading as="h1" size="xl" mb={6} color="#1C1D3B">
            Fale Conosco
          </Heading>
          <Text mb={8} color="gray.600">
            Tem alguma dúvida, sugestão ou problema? Preencha o formulário abaixo e nossa equipe entrará em contato.
          </Text>

          <form onSubmit={handleSubmit}>
            <VStack spacing={5}>
              <FormControl isRequired>
                <FormLabel>Nome Completo</FormLabel>
                <Input placeholder="Seu nome" size="lg" />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>E-mail</FormLabel>
                <Input type="email" placeholder="seu@email.com" size="lg" />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Assunto</FormLabel>
                <Input placeholder="Qual o motivo do contato?" size="lg" />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Mensagem</FormLabel>
                <Textarea placeholder="Descreva como podemos ajudar..." rows={6} size="lg" />
              </FormControl>

              <Button
                type="submit"
                size="lg"
                bg="#1C1D3B"
                color="white"
                _hover={{ bg: "#262750" }}
                w="full"
                isLoading={loading}
              >
                Enviar Mensagem
              </Button>
            </VStack>
          </form>
        </Box>

        {/* Info Lateral */}
        <Box flex="1">
          <Box bg="#e8eef3" p={8} borderRadius="xl" h="fit-content">
            <Heading as="h3" size="md" mb={4} color="#1C1D3B">
              Informações Diretas
            </Heading>
            <VStack align="flex-start" spacing={4} color="gray.700">
              <Flex align="center" gap={3}>
                <EmailIcon color="blue.600" />
                <Text fontWeight="medium">suporte@urbanai.com.br</Text>
              </Flex>
              <Text fontSize="sm" color="gray.600">
                Nosso tempo de resposta médio é de até 24 horas úteis.
              </Text>
            </VStack>
          </Box>
        </Box>

      </Flex>
    </Container>
  );
}
