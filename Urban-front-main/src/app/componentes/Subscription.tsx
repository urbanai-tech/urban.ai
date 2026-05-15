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
  cancelLoading: boolean;
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

function getPriceLabel(sub: Subscription) {
  const amount = sub.plan?.amount;
  if (typeof amount === "number" && Number.isFinite(amount)) {
    const currency = (sub.plan?.currency || sub.currency || "brl").toUpperCase();
    const interval = sub.plan?.interval || sub.metadata?.urbanai_billing_cycle || "monthly";
    return `${(amount / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency,
    })} / ${cycleLabels[interval] || interval}`;
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
  cancelLoading,
}: Props) {
  return (
    <Container maxW="container.md" py={10}>
      <SimpleGrid columns={{ base: 1 }} spacing={8}>
        {subscriptions.map((sub) => {
          const isCanceled = sub.status === "canceled";
          const canCancel = onCancel && sub.status === "active" && !sub.id.startsWith("alpha-");

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

                <Stack spacing={1} fontSize="md" color="gray.600">
                  <Text>{getDateLabel(sub)}</Text>
                </Stack>

                {canCancel && (
                  <Flex justify="flex-end">
                    <Button
                      isLoading={cancelLoading}
                      colorScheme="red"
                      variant="outline"
                      size="md"
                      onClick={() => onCancel(sub.id)}
                      _hover={{ bg: "red.50" }}
                    >
                      Cancelar Plano
                    </Button>
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
