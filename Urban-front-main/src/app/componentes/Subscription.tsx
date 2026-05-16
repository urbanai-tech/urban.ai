import React from "react";
import {
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Flex,
  Heading,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { ExternalLinkIcon } from "@chakra-ui/icons";

export type Subscription = {
  id: string;
  status: string;
  currency?: string;
  start_date?: number;
  trial_end?: number | null;
  metadata?: {
    urbanai_plan?: string;
    urbanai_quantity?: string;
    urbanai_billing_cycle?: string;
  };
  plan?: {
    id: string;
    amount?: number | null;
    currency?: string | null;
    interval?: string | null;
  };
};

type Props = {
  subscriptions: Subscription[];
  onCancel?: (subscriptionId: string) => void;
  onManageBilling?: (subscriptionId: string) => void;
  cancelLoading: boolean;
  manageBillingLoading?: boolean;
};

const cycleLabels: Record<string, string> = {
  monthly: "mensal",
  quarterly: "trimestral",
  semestral: "semestral",
  annual: "anual",
  month: "mensal",
  year: "anual",
};

const statusLabels: Record<string, string> = {
  active: "ativo",
  trialing: "alpha",
  canceled: "cancelado",
  past_due: "pendente",
};

const formatDateNatural = (timestamp?: number) => {
  if (!timestamp) return "Inicio nao informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp * 1000));
};

function getPlanName(sub: Subscription) {
  const plan = sub.metadata?.urbanai_plan || sub.plan?.id;
  if (plan === "alpha") return "Plano Alpha";
  if (plan) return `Plano ${plan}`;
  return "Plano Urban AI";
}

function getCycleLabel(sub: Subscription) {
  const cycle = sub.metadata?.urbanai_billing_cycle || sub.plan?.interval || "monthly";
  return cycleLabels[cycle] || cycle;
}

function getQuantityLabel(sub: Subscription) {
  const quantity = Number(sub.metadata?.urbanai_quantity);
  if (Number.isFinite(quantity) && quantity > 0) {
    return `${Math.floor(quantity)} imoveis contratados`;
  }
  return "1 imovel contratado";
}

function getPriceLabel(sub: Subscription) {
  const amount = sub.plan?.amount;
  if (typeof amount === "number" && Number.isFinite(amount)) {
    const currency = (sub.plan?.currency || sub.currency || "brl").toUpperCase();
    return `${(amount / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency,
    })} / ${getCycleLabel(sub)}`;
  }

  const quantity = sub.metadata?.urbanai_quantity;
  if (sub.metadata?.urbanai_plan === "alpha") {
    return quantity ? `Cortesia alpha - ${quantity} imoveis` : "Cortesia alpha";
  }

  return "Assinatura ativa";
}

function getDateLabel(sub: Subscription) {
  const start = formatDateNatural(sub.start_date);
  const end = sub.trial_end ? ` a ${formatDateNatural(sub.trial_end)}` : "";
  return `${start}${end}`;
}

export default function SubscriptionCards({
  subscriptions,
  onCancel,
  onManageBilling,
  cancelLoading,
  manageBillingLoading = false,
}: Props) {
  return (
    <Container maxW="container.md" py={10}>
      <SimpleGrid columns={{ base: 1 }} spacing={8}>
        {subscriptions.map((sub) => {
          const isCanceled = sub.status === "canceled";
          const canCancel = onCancel && sub.status === "active" && !sub.id.startsWith("alpha-");
          const canManageBilling =
            onManageBilling &&
            ["active", "trialing", "past_due"].includes(sub.status) &&
            !sub.id.startsWith("alpha-");

          return (
            <Box
              key={sub.id}
              bg={isCanceled ? "gray.50" : "white"}
              borderRadius="xl"
              boxShadow="xl"
              p={8}
              position="relative"
              _hover={{ boxShadow: isCanceled ? "xl" : "2xl" }}
              transition="box-shadow 0.3s"
              opacity={isCanceled ? 0.6 : 1}
            >
              <Badge
                position="absolute"
                top={4}
                right={4}
                colorScheme={isCanceled ? "red" : "green"}
                fontWeight="semibold"
                fontSize="0.85rem"
                px={3}
                py={1}
                borderRadius="full"
                textTransform="uppercase"
                letterSpacing="wide"
              >
                {statusLabels[sub.status] || sub.status}
              </Badge>

              <Stack spacing={5}>
                <Heading fontSize="2xl" fontWeight="extrabold" color="gray.700">
                  {getPlanName(sub)}
                </Heading>

                <Text
                  fontSize="xl"
                  fontWeight="bold"
                  color={isCanceled ? "gray.500" : "blue.600"}
                  textDecoration={isCanceled ? "line-through" : "none"}
                >
                  {getPriceLabel(sub)}
                </Text>

                <Divider />

                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  <Box bg="gray.50" borderRadius="md" p={3}>
                    <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase">
                      Ciclo
                    </Text>
                    <Text color="gray.700" fontWeight="semibold">
                      {getCycleLabel(sub)}
                    </Text>
                  </Box>
                  <Box bg="gray.50" borderRadius="md" p={3}>
                    <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase">
                      Quota
                    </Text>
                    <Text color="gray.700" fontWeight="semibold">
                      {getQuantityLabel(sub)}
                    </Text>
                  </Box>
                </SimpleGrid>

                <Stack spacing={1} fontSize="md" color="gray.600">
                  <Text>{getDateLabel(sub)}</Text>
                </Stack>

                {(canManageBilling || canCancel) && (
                  <Flex justify="flex-end" gap={3} wrap="wrap">
                    {canManageBilling && (
                      <Button
                        data-testid="manage-billing-button"
                        isLoading={manageBillingLoading}
                        colorScheme="blue"
                        variant="solid"
                        size="md"
                        rightIcon={<ExternalLinkIcon />}
                        onClick={() => onManageBilling(sub.id)}
                      >
                        Gerenciar assinatura
                      </Button>
                    )}
                    {canCancel && (
                      <Button
                        data-testid="cancel-subscription-button"
                        isLoading={cancelLoading}
                        colorScheme="red"
                        variant="outline"
                        size="md"
                        onClick={() => onCancel(sub.id)}
                        _hover={{ bg: "red.50" }}
                      >
                        Cancelar Plano
                      </Button>
                    )}
                  </Flex>
                )}
              </Stack>
            </Box>
          );
        })}
      </SimpleGrid>
    </Container>
  );
}
