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
      size="5xl"
      scrollBehavior="inside"
      closeOnOverlayClick={false}
      closeOnEsc={false}
    >
      <ModalOverlay backdropFilter="blur(8px)" bg="blackAlpha.600" />
      <ModalContent py={{ base: 4, md: 6 }} borderRadius="2xl" mx={4}>
        <ModalBody>
          <Heading as="h2" size="lg" textAlign="center" mb={4} color="gray.800">
            Escolha seu plano para continuar
          </Heading>

          {propertyCount > 0 && (
            <Alert status="info" variant="subtle" borderRadius="md" mx="auto" maxW="3xl" mb={4} py={2}>
              <AlertIcon boxSize="4" />
              <Box fontSize="sm">
                <AlertTitle display="inline" mr={2}>Você possui {propertyCount} imóveis sincronizados.</AlertTitle>
                <AlertDescription display="inline">
                  Recomendamos o plano <strong>{recommendedPlan === 'starter' ? 'Starter' : recommendedPlan === 'profissional' ? 'Profissional' : 'Escala'}</strong> para não perder a sincronização de NENHUMA unidade.
                </AlertDescription>
              </Box>
            </Alert>
          )}

          <Flex justify="center" mb={6}>
            <FormControl display="flex" alignItems="center" w="auto" bg="gray.50" p={2} borderRadius="full" borderWidth="1px" borderColor="gray.200">
              <FormLabel htmlFor="billing-toggle" mb="0" ml={4} fontWeight="bold" fontSize="sm" color={!isAnnual ? "blue.600" : "gray.500"}>
                Mensal
              </FormLabel>
              <Switch id="billing-toggle" size="md" colorScheme="blue" isChecked={isAnnual} onChange={(e) => setIsAnnual(e.target.checked)} />
              <FormLabel htmlFor="billing-toggle" mb="0" ml={3} mr={4} fontWeight="bold" fontSize="sm" color={isAnnual ? "blue.600" : "gray.500"}>
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
            <Flex justify="center" px={{ base: 0, md: 4 }}>
              <SimpleGrid columns={{ base: 1, md: plans.length > 2 ? 3 : 2 }} spacing={{ base: 6, lg: 8 }} w="full">
                {plans.map((plan) => (
                  <Box
                    key={plan.id}
                    position="relative"
                    borderRadius="xl"
                    p={{ base: 5, md: 6 }}
                    bg="white"
                    boxShadow="0 4px 12px rgba(0,0,0,0.06)"
                    _hover={{ boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
                    transition="box-shadow 0.2s ease"
                    borderWidth={plan.highlightBadge ? "2px" : "1px"}
                    borderColor={plan.highlightBadge ? "orange.400" : "gray.200"}
                    textAlign="center"
                    display="flex"
                    flexDirection="column"
                  >
                    {plan.highlightBadge && (
                      <Badge
                        position="absolute"
                        top={-3}
                        right={{ base: 4, md: "auto" }}
                        left={{ md: "50%" }}
                        transform={{ md: "translateX(-50%)" }}
                        colorScheme="orange"
                        bg="orange.500"
                        color="white"
                        fontSize="0.75rem"
                        px={3}
                        py={1}
                        borderRadius="full"
                        fontWeight="bold"
                        border="2px solid white"
                      >
                        {plan.highlightBadge}
                      </Badge>
                    )}

                    <Stack mt={plan.highlightBadge ? 4 : 0} spacing={4} flex="1">
                      <Text fontSize="xl" fontWeight="extrabold" color="gray.700">
                        {plan.title}
                      </Text>

                      <Box minH="70px" display="flex" flexDirection="column" justifyContent="center">
                        {((isAnnual && plan.originalPriceAnnual) || (!isAnnual && plan.originalPrice)) && (
                          <Flex justify="center" align="center" gap={2}>
                            <Text decoration="line-through" color="gray.400" fontSize="sm">
                              R$ {isAnnual && plan.originalPriceAnnual ? plan.originalPriceAnnual : plan.originalPrice} {plan.period}
                            </Text>
                          </Flex>
                        )}

                        {!plan.isCustomPrice ? (
                          <Flex justify="center" align="baseline">
                            <Heading as="h3" size={{ base: "xl", lg: "2xl" }} color="gray.800">
                              R$ {isAnnual && plan.priceAnnual ? plan.priceAnnual : plan.price}
                            </Heading>
                            {plan.period && (
                              <Text as="span" fontSize="sm" color="gray.500" ml={1}>
                                {plan.period}
                              </Text>
                            )}
                            {plan.discountBadge && (
                              <Badge ml={2} colorScheme="red" bg="red.900" color="red.200" px={2} py={0.5} borderRadius="md" fontSize="xs">
                                {plan.discountBadge}
                              </Badge>
                            )}
                          </Flex>
                        ) : (
                          <Heading as="h3" size="lg" color="gray.800" whiteSpace="nowrap">
                            Sob consulta
                          </Heading>
                        )}
                      </Box>

                      <Button
                        colorScheme={plan.highlightBadge ? "orange" : "blue"}
                        bg={plan.highlightBadge ? "orange.500" : "blue.500"}
                        color="white"
                        size="md"
                        whiteSpace="normal"
                        height="auto"
                        py={2}
                        onClick={() => handleCheckout(plan)}
                        isLoading={loadingPlan === plan.name}
                        loadingText="Carregando..."
                        _hover={{ transform: "translateY(-1px)", shadow: "sm" }}
                        transition="all 0.2s"
                        w="full"
                        mt={2}
                      >
                        {plan.isCustomPrice ? "Fale com consultor" : "Selecionar plano"}
                      </Button>

                      <List spacing={2} pt={4} textAlign="left" mx="auto" w="full">
                        {plan.features.map((feat) => (
                          <ListItem
                            key={feat}
                            fontSize="sm"
                            color="gray.600"
                            display="flex"
                            alignItems="flex-start"
                          >
                            <ListIcon as={CheckIcon} color="green.400" mt={1} boxSize="3" />
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

