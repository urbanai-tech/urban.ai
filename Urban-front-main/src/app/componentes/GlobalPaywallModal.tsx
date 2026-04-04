'use client';

import React, { useState } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  Box,
  Badge,
  Button,
  Flex,
  Heading,
  List,
  ListIcon,
  ListItem,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { CheckIcon } from "@chakra-ui/icons";

import { loadStripe } from "@stripe/stripe-js";
import { createCheckoutSession } from "../service/api";

type Plan = {
  id: string;
  price: string;
  badge: string;
  period: string;
};

const plans: Plan[] = [
  {
    id: "trial",
    price: "0",
    badge: "Teste 7 dias",
    period: "",
  },
  {
    id: "pro",
    price: "0",
    badge: "Mais recomendado",
    period: "/mês",
  },
];

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface GlobalPaywallModalProps {
  isOpen: boolean;
}

export function GlobalPaywallModal({ isOpen }: GlobalPaywallModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const commonFeatures = [
    "Cadastre propriedades",
    "Análise detalhada",
    "Sugestão de preço para todas",
  ];

  async function handleCheckout(plan: Plan) {
    try {
      setLoadingPlan(plan.id);
      const { sessionId } = await createCheckoutSession(plan.id);
      const stripe = await stripePromise;

      if (stripe) {
        await stripe.redirectToCheckout({ sessionId });
      } else {
        alert("Stripe não carregou.");
      }
    } catch (err) {
      alert("Erro ao iniciar o pagamento.");
      console.error(err);
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={() => {}} 
      isCentered 
      size="4xl" 
      closeOnOverlayClick={false}
      closeOnEsc={false}
    >
      <ModalOverlay backdropFilter="blur(8px)" bg="blackAlpha.600" />
      <ModalContent py={10} borderRadius="2xl" maxW="800px" mx={4}>
        <ModalBody>
          <Heading as="h2" size="xl" textAlign="center" mb={12} color="gray.800">
            Escolha seu plano para continuar
          </Heading>

          <Flex justify="center" px={{ base: 2, md: 8 }}>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8} w="full">
              {plans.map((plan) => (
                <Box
                  key={plan.id}
                  position="relative"
                  borderRadius="xl"
                  p={8}
                  bg={plan.id === "trial" ? "gray.50" : "white"}
                  boxShadow="0 8px 24px rgba(0,0,0,0.08)"
                  _hover={{ boxShadow: "0 12px 32px rgba(0,0,0,0.15)" }}
                  transition="box-shadow 0.3s ease"
                  borderWidth={plan.id === "trial" ? "1px" : "2px"}
                  borderColor={plan.id === "trial" ? "gray.200" : "blue.500"}
                  textAlign="center"
                >
                  <Badge
                    position="absolute"
                    top={-4}
                    right={4}
                    colorScheme={plan.id === "trial" ? "green" : "blue"}
                    fontSize="0.9rem"
                    px={4}
                    py={1.5}
                    borderRadius="full"
                    fontWeight="bold"
                    border="2px solid white"
                  >
                    {plan.badge}
                  </Badge>

                  <Stack mt={6} spacing={6}>
                    <Text fontSize="2xl" fontWeight="extrabold" color="gray.700">
                      {plan.id === "trial"
                        ? "Teste grátis"
                        : plan.id === "pro"
                        ? "Mensal"
                        : "Anual"}
                    </Text>

                    <Heading as="h3" size="3xl" color="blue.600">
                      {plan.price === "0" ? "Grátis" : `R$ ${plan.price}`}
                      {plan.price !== "0" && (
                        <Text as="span" fontSize="lg" color="gray.500">
                          &nbsp;{plan.period}
                        </Text>
                      )}
                    </Heading>

                    <Button
                      colorScheme={plan.id === "trial" ? "green" : "blue"}
                      size="lg"
                      onClick={() => handleCheckout(plan)}
                      isLoading={loadingPlan === plan.id}
                      loadingText="Redirecionando..."
                      _hover={{ transform: "translateY(-2px)", shadow: "md" }}
                      transition="all 0.2s"
                      w="full"
                      mt={4}
                    >
                      {plan.id === "trial" ? "Começar grátis" : "Selecionar plano"}
                    </Button>

                    <List spacing={3} pt={6} textAlign="left" mx="auto" w="full" px={4}>
                      {commonFeatures.map((feat) => (
                        <ListItem
                          key={feat}
                          fontSize="md"
                          color="gray.600"
                          display="flex"
                          alignItems="flex-start"
                        >
                          <ListIcon as={CheckIcon} color="green.400" mt={1} />
                          <Text lineHeight="short">{feat}</Text>
                        </ListItem>
                      ))}
                    </List>
                  </Stack>
                </Box>
              ))}
            </SimpleGrid>
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
