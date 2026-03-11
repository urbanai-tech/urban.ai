import React from "react";
import {
  Box,
  Badge,
  Heading,
  SimpleGrid,
  Stack,
  Text,
  Flex,
  Divider,
  Button,
  Container,
} from "@chakra-ui/react";

export type Subscription = {
  id: string;
  status: string;
  currency: string;
  start_date: number;
  trial_end: number | null;
  plan: {
    id: string;
    amount: number;
    currency: string;
    interval: string;
  };
};

type Props = {
  subscriptions: Subscription[];
  onCancel?: (subscriptionId: string) => void;
  cancelLoading:boolean;
};

const formatDateNatural = (ts: number) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(ts * 1000));

export default function SubscriptionCards({ subscriptions, onCancel, cancelLoading: cancelLoading }: Props) {
  return (
    <Container maxW="container.md" py={10}>
      <SimpleGrid columns={{ base: 1 }} spacing={8}>
  {subscriptions.map((sub) => {
  const isCanceled = sub.status === "canceled";

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
      opacity={isCanceled ? 0.6 : 1}  // deixa meio cinza
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
        {sub.status}
      </Badge>

      <Stack spacing={5}>
        <Heading fontSize="2xl" fontWeight="extrabold" color="gray.700">
          PlanoPremium
        </Heading>

        <Text
          fontSize="xl"
          fontWeight="bold"
          color={isCanceled ? "gray.500" : "blue.600"}
          textDecoration={isCanceled ? "line-through" : "none"}  // preço riscado
        >
          {(sub.plan.amount / 100).toLocaleString("pt-BR", {
            style: "currency",
            currency: sub.plan.currency.toUpperCase(),
          })}{" "}
          / {sub.plan.interval}
        </Text>

        <Divider />

        <Stack spacing={1} fontSize="md" color="gray.600">
          <Text>
            {formatDateNatural(sub.start_date)}{" "}
            {sub.trial_end ? `à ${formatDateNatural(sub.trial_end)}` : ""}
          </Text>
        </Stack>

        {onCancel && sub.status === "active" && (
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
