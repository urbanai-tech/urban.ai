"use client";

import React, { useEffect, useState } from "react";
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Center,
  Heading,
  HStack,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { ToastContainer, toast } from "react-toastify";
import SubscriptionCards, { Subscription } from "../componentes/Subscription";
import {
  cancelSubscription,
  createBillingPortalSession,
  fetchListingsQuota,
  fetchSubscription,
  type ListingsQuota,
} from "../service/api";

function remainingQuota(quota: ListingsQuota) {
  return Math.max(0, quota.contratados - quota.ativos);
}

export default function SubscriptionsPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [quota, setQuota] = useState<ListingsQuota | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [manageBillingLoading, setManageBillingLoading] = useState(false);

  async function loadSubscription() {
    setLoading(true);
    setError(null);
    setQuotaError(null);

    const [subscriptionResult, quotaResult] = await Promise.allSettled([
      fetchSubscription(),
      fetchListingsQuota(),
    ]);

    if (subscriptionResult.status === "fulfilled") {
      setSubscription(subscriptionResult.value);
    } else {
      const err = subscriptionResult.reason as Error;
      setError(err.message || "Erro ao buscar assinatura");
    }

    if (quotaResult.status === "fulfilled") {
      setQuota(quotaResult.value);
    } else {
      setQuotaError("Nao foi possivel carregar sua quota de imoveis.");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadSubscription();
  }, []);

  async function handleCancel() {
    setCancelLoading(true);
    try {
      await cancelSubscription();
      toast("Assinatura cancelada com sucesso", { type: "success" });
      await loadSubscription();
    } catch {
      toast("Erro ao cancelar assinatura", { type: "error" });
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleManageBilling() {
    setManageBillingLoading(true);
    try {
      const session = await createBillingPortalSession();
      if (!session.url) {
        throw new Error("Portal indisponivel");
      }
      window.location.href = session.url;
    } catch {
      toast("Nao foi possivel abrir o portal de billing", { type: "error" });
      setManageBillingLoading(false);
    }
  }

  if (loading) {
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  if (error) {
    return (
      <Center h="100vh">
        <Text color="red.500">{error}</Text>
      </Center>
    );
  }

  if (!subscription) {
    return (
      <Center h="100vh">
        <Text>Nenhuma assinatura encontrada</Text>
      </Center>
    );
  }

  const available = quota ? remainingQuota(quota) : null;

  return (
    <Box data-testid="my-plan-page" maxW="container.lg" mx="auto" px={{ base: 4, md: 8 }} py={8}>
      <Stack spacing={6}>
        <Box textAlign="center">
          <HStack justify="center" spacing={3} mb={2}>
            <Heading fontSize={{ base: "xl", md: "2xl" }}>Meu plano</Heading>
            {subscription.id.startsWith("alpha-") && <Badge colorScheme="purple">Alpha assistido</Badge>}
          </HStack>
          <Text color="gray.600">
            Acompanhe status da assinatura, limite de imoveis e acoes de billing.
          </Text>
        </Box>

        {quotaError && (
          <Alert status="warning" borderRadius="md">
            <AlertIcon />
            {quotaError}
          </Alert>
        )}

        {quota && (
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <QuotaCard
              testId="quota-contracted-card"
              label="Contratados"
              value={quota.contratados}
              helper="Limite atual do plano"
            />
            <QuotaCard testId="quota-active-card" label="Ativos" value={quota.ativos} helper="Imoveis cadastrados" />
            <QuotaCard
              testId="quota-available-card"
              label="Disponiveis"
              value={available ?? 0}
              helper={quota.podeAdicionar ? "Pode cadastrar mais" : "Quota atingida"}
              tone={quota.podeAdicionar ? "green" : "orange"}
            />
          </SimpleGrid>
        )}

        <SubscriptionCards
          cancelLoading={cancelLoading}
          manageBillingLoading={manageBillingLoading}
          subscriptions={[subscription]}
          onManageBilling={() => {
            if (!manageBillingLoading) handleManageBilling();
          }}
          onCancel={() => {
            if (!cancelLoading) handleCancel();
          }}
        />
      </Stack>
      <ToastContainer />
    </Box>
  );
}

function QuotaCard({
  label,
  value,
  helper,
  tone = "blue",
  testId,
}: {
  label: string;
  value: number;
  helper: string;
  tone?: "blue" | "green" | "orange";
  testId?: string;
}) {
  const colors = {
    blue: { bg: "blue.50", border: "blue.100", text: "blue.700" },
    green: { bg: "green.50", border: "green.100", text: "green.700" },
    orange: { bg: "orange.50", border: "orange.100", text: "orange.700" },
  }[tone];

  return (
    <Box data-testid={testId} bg={colors.bg} border="1px solid" borderColor={colors.border} borderRadius="lg" p={5}>
      <Text fontSize="xs" fontWeight="bold" color="gray.500" textTransform="uppercase">
        {label}
      </Text>
      <Text fontSize="3xl" fontWeight="extrabold" color={colors.text} lineHeight={1.1} mt={1}>
        {value}
      </Text>
      <Text color="gray.600" fontSize="sm" mt={2}>
        {helper}
      </Text>
    </Box>
  );
}
