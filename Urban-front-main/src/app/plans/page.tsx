"use client";

import React, { useEffect, useState } from "react";
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
  Spinner,
} from "@chakra-ui/react";
import { CheckIcon } from "@chakra-ui/icons";

import { loadStripe } from "@stripe/stripe-js";
import { createCheckoutSession, getPlans, Plan } from "../service/api";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function Home() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlans()
      .then((data) => {
        setPlans(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Erro ao buscar planos:", err);
        setLoading(false);
      });
  }, []);

  async function handleCheckout(plan: Plan) {
    if (plan.isCustomPrice) {
      // Implementar envio para WhatsApp ou formulário
      window.open("https://wa.me/seunumerodevendas", "_blank");
      return;
    }
    try {
      const { sessionId } = await createCheckoutSession(plan.name);
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

      {loading ? (
        <Flex justify="center" align="center" h="40vh">
          <Spinner size="xl" />
        </Flex>
      ) : (
        <Flex justify="center">
          <SimpleGrid columns={{ base: 1, md: plans.length > 2 ? 3 : 2 }} spacing={10}>
            {plans.map((plan) => (
               <Box
               key={plan.id}
               position="relative"
               borderRadius="xl"
               p={8}
               bg="white"
               boxShadow="0 8px 24px rgba(0,0,0,0.08)"
               _hover={{ boxShadow: "0 12px 32px rgba(0,0,0,0.15)" }}
               transition="box-shadow 0.3s ease"
               borderWidth={plan.highlightBadge ? "2px" : "1px"}
               borderColor={plan.highlightBadge ? "orange.400" : "gray.200"}
               textAlign="center"
             >
               {plan.highlightBadge && (
                 <Badge
                   position="absolute"
                   top={-3}
                   left="50%"
                   transform="translateX(-50%)"
                   colorScheme="orange"
                   bg="orange.500"
                   color="white"
                   fontSize="0.9rem"
                   px={3}
                   py={1}
                   borderRadius="full"
                   fontWeight="bold"
                 >
                   {plan.highlightBadge}
                 </Badge>
               )}
 
               <Stack mt={6} spacing={6}>
                 <Text fontSize="2xl" fontWeight="extrabold" color="gray.700">
                   {plan.title}
                 </Text>
 
                 <Box>
                   {plan.originalPrice && (
                     <Flex justify="center" align="center" gap={2}>
                       <Text decoration="line-through" color="gray.400" fontSize="md">
                         R$ {plan.originalPrice} {plan.period}
                       </Text>
                     </Flex>
                   )}
 
                   {!plan.isCustomPrice ? (
                     <Flex justify="center" align="baseline">
                       <Heading as="h3" size="3xl" color="white" bg="gray.800" bgClip="text">
                         R$ {plan.price}
                       </Heading>
                       {plan.period && (
                         <Text as="span" fontSize="lg" color="gray.500" ml={1}>
                           {plan.period}
                         </Text>
                       )}
                       {plan.discountBadge && (
                         <Badge ml={3} colorScheme="red" bg="red.900" color="red.200" px={2} py={1} borderRadius="md">
                           {plan.discountBadge}
                         </Badge>
                       )}
                     </Flex>
                   ) : (
                     <Heading as="h3" size="2xl" color="gray.800">
                       Sob consulta
                     </Heading>
                   )}
                   {plan.originalPrice && (
                     <Text fontSize="sm" color="gray.400" mt={2}>
                       Preço de lançamento · primeiros 100 assinantes
                     </Text>
                   )}
                 </Box>
 
                 <List spacing={3} pt={4} textAlign="left" mx="auto">
                   {plan.features.map((feat) => (
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
 
                 <Button
                   colorScheme={plan.highlightBadge ? "orange" : "gray"}
                   bg={plan.highlightBadge ? "orange.500" : "gray.900"}
                   color="white"
                   size="lg"
                   mt={4}
                   onClick={() => handleCheckout(plan)}
                   _hover={{ transform: "scale(1.02)", bg: plan.highlightBadge ? "orange.600" : "gray.700" }}
                   transition="all 0.2s"
                 >
                   {plan.isCustomPrice ? "Fale com consultor" : `Quero começar`}
                 </Button>
               </Stack>
             </Box>
            ))}
          </SimpleGrid>
        </Flex>
      )}
    </Container>
  );
}
