'use client';

import React, { useState, useEffect } from "react";
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
  Spinner,
  Switch,
  FormControl,
  FormLabel,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from "@chakra-ui/react";
import { CheckIcon } from "@chakra-ui/icons";

import { loadStripe } from "@stripe/stripe-js";
import { createCheckoutSession, getPlans, Plan, getPropriedadesDropdownList } from "../service/api";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface GlobalPaywallModalProps {
  isOpen: boolean;
}

export function GlobalPaywallModal({ isOpen }: GlobalPaywallModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAnnual, setIsAnnual] = useState(true);
  const [propertyCount, setPropertyCount] = useState<number>(0);
  const [recommendedPlan, setRecommendedPlan] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Fetch both plans and property count
      Promise.all([
        getPlans(),
        getPropriedadesDropdownList().catch(() => []) // if it fails, return empty
      ])
        .then(([plansData, propsData]) => {
          setPlans(plansData);
          const count = propsData?.length || 0;
          setPropertyCount(count);

          // Find recommended plan based on propertyLimit
          // Assumes propertyLimit is 3 for Starter, 10 for Profissional
          let recommended = "escala"; // fallback
          if (count <= 3) {
            recommended = "starter";
          } else if (count <= 10) {
            recommended = "profissional";
          }
           setRecommendedPlan(recommended);

          setLoading(false);
        })
        .catch((err) => {
          console.error("Erro ao buscar planos/propriedades:", err);
          setLoading(false);
        });
    }
  }, [isOpen]);

  async function handleCheckout(plan: Plan) {
    if (plan.isCustomPrice) {
      // Implementar envio para WhatsApp ou formulário
      window.open("https://wa.me/seunumerodevendas", "_blank");
      return;
    }
    try {
      setLoadingPlan(plan.name);
      const billingCycle = isAnnual ? 'annual' : 'monthly';
      const { sessionId } = await createCheckoutSession(plan.name, billingCycle);
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
      <ModalContent py={10} borderRadius="2xl" maxW="5xl" mx={4}>
        <ModalBody>
          <Heading as="h2" size="xl" textAlign="center" mb={6} color="gray.800">
            Escolha seu plano para continuar
          </Heading>

          {propertyCount > 0 && (
            <Alert status="info" variant="subtle" borderRadius="md" mx="auto" maxW="3xl" mb={6}>
              <AlertIcon />
              <Box>
                <AlertTitle>Você possui {propertyCount} imóveis sincronizados.</AlertTitle>
                <AlertDescription>
                  Identificamos sua necessidade e recomendamos o plano <strong>{recommendedPlan === 'starter' ? 'Starter' : recommendedPlan === 'profissional' ? 'Profissional' : 'Escala'}</strong> para não perder a sincronização de nenhuma unidade.
                </AlertDescription>
              </Box>
            </Alert>
          )}

          <Flex justify="center" mb={10}>
            <FormControl display="flex" alignItems="center" w="auto" bg="gray.50" p={2} borderRadius="full" borderWidth="1px" borderColor="gray.200">
              <FormLabel htmlFor="billing-toggle" mb="0" ml={4} fontWeight="bold" color={!isAnnual ? "blue.600" : "gray.500"}>
                Mensal
              </FormLabel>
              <Switch id="billing-toggle" size="lg" colorScheme="blue" isChecked={isAnnual} onChange={(e) => setIsAnnual(e.target.checked)} />
              <FormLabel htmlFor="billing-toggle" mb="0" ml={3} mr={4} fontWeight="bold" color={isAnnual ? "blue.600" : "gray.500"}>
                Anual
                <Badge ml={2} colorScheme="green" borderRadius="full" fontSize="0.7em" px={2}>Economize 20%</Badge>
              </FormLabel>
            </FormControl>
          </Flex>

          {loading ? (
            <Flex justify="center" align="center" h="20vh">
              <Spinner size="xl" />
            </Flex>
          ) : (
            <Flex justify="center" px={{ base: 2, md: 8 }}>
              <SimpleGrid columns={{ base: 1, md: plans.length > 2 ? 3 : 2 }} spacing={8} w="full">
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
                        top={-4}
                        right={4}
                        colorScheme="orange"
                        bg="orange.500"
                        color="white"
                        fontSize="0.9rem"
                        px={4}
                        py={1.5}
                        borderRadius="full"
                        fontWeight="bold"
                        border="2px solid white"
                      >
                        {plan.highlightBadge}
                      </Badge>
                    )}

                    <Stack mt={6} spacing={6}>
                      <Text fontSize="2xl" fontWeight="extrabold" color="gray.700">
                        {plan.title}
                      </Text>

                      <Box>
                        {((isAnnual && plan.originalPriceAnnual) || (!isAnnual && plan.originalPrice)) && (
                          <Flex justify="center" align="center" gap={2}>
                            <Text decoration="line-through" color="gray.400" fontSize="md">
                              R$ {isAnnual && plan.originalPriceAnnual ? plan.originalPriceAnnual : plan.originalPrice} {plan.period}
                            </Text>
                          </Flex>
                        )}

                        {!plan.isCustomPrice ? (
                          <Flex justify="center" align="baseline">
                            <Heading as="h3" size="3xl" color="white" bg="gray.800" bgClip="text">
                              R$ {isAnnual && plan.priceAnnual ? plan.priceAnnual : plan.price}
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
                          <Heading as="h3" size="xl" color="gray.800" whiteSpace="nowrap">
                            Sob consulta
                          </Heading>
                        )}
                      </Box>

                      <Button
                        colorScheme={plan.highlightBadge ? "orange" : "blue"}
                        bg={plan.highlightBadge ? "orange.500" : "blue.500"}
                        color="white"
                        size="lg"
                        onClick={() => handleCheckout(plan)}
                        isLoading={loadingPlan === plan.name}
                        loadingText="Redirecionando..."
                        _hover={{ transform: "translateY(-2px)", shadow: "md" }}
                        transition="all 0.2s"
                        w="full"
                        mt={4}
                      >
                        {plan.isCustomPrice ? "Fale com consultor" : "Selecionar plano"}
                      </Button>

                      <List spacing={3} pt={6} textAlign="left" mx="auto" w="full" px={4}>
                        {plan.features.map((feat) => (
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
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

