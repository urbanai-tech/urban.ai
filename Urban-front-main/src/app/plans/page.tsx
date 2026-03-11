"use client";

import React from "react";
import {
  Box,
  Badge,
  Button,
  Container,
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
  // {
  //   id: "enterprise",
  //   price: "1.99",
  //   badge: "Mais popular",
  //   period: "/ano",
  // },
];

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function Home() {
  // Lista única (comum a todos os planos) conforme solicitado
  const commonFeatures = [
    "Cadastre propriedades",
    "Análise detalhada",
    "Sugestão de preço para todas",
  ];

  async function handleCheckout(plan: Plan) {
    try {
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
    }
  }

  return (
    <Container maxW="container.xl" py={16}>
      <Heading as="h2" size="xl" textAlign="center" mb={12}>
        Escolha seu plano
      </Heading>

      <Flex justify="center">
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={10}>
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
              borderColor={plan.id === "trial" ? "gray.200" : "blue.400"}
              textAlign="center"
            >
              <Badge
                position="absolute"
                top={4}
                right={4}
                colorScheme={plan.id === "trial" ? "green" : "blue"}
                fontSize="0.9rem"
                px={3}
                py={1}
                borderRadius="full"
                fontWeight="semibold"
              >
                {plan.badge}
              </Badge>

              <Stack mt={10} spacing={6}>
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
                  _hover={{ transform: "scale(1.05)" }}
                  transition="transform 0.2s"
                >
                  {plan.id === "trial" ? "Começar grátis" : "Selecionar plano"}
                </Button>

                {/* Lista comum para todos os planos */}
                <List spacing={3} pt={4} textAlign="left" maxW="xs" mx="auto">
                  {commonFeatures.map((feat) => (
                    <ListItem
                      key={feat}
                      fontSize="md"
                      color="gray.600"
                      display="flex"
                      alignItems="center"
                    >
                      <ListIcon as={CheckIcon} color="green.400" />
                      {feat}
                    </ListItem>
                  ))}
                </List>
              </Stack>
            </Box>
          ))}
        </SimpleGrid>
      </Flex>
    </Container>
  );
}
