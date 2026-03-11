"use client";
import React, { useEffect, useState } from "react";
import { Spinner, Center, Text, Heading } from "@chakra-ui/react";
import SubscriptionCards, { Subscription } from "../componentes/Subscription";
import { fetchSubscription, cancelSubscription } from "../service/api";
  import { ToastContainer, toast } from 'react-toastify';
      

export default function SubscriptionsPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  async function loadSubscription() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSubscription();
      setSubscription(data);
    } catch (err: any) {
      setError(err.message || "Erro ao buscar subscription");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubscription();
  }, []);

  async function handleCancel() {
    setCancelLoading(true);
    try {
      await cancelSubscription();
                   toast("Assinatura cancelada com sucesso", { type: "success" });
      await loadSubscription(); // recarrega a subscription depois do cancelamento
    } catch (err: any) {
      toast("Erro ao cancelar assinatura", { type: "error" });
    } finally {
      setCancelLoading(false);
    }
  }

  if (loading)
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    );

  if (error)
    return (
      <Center h="100vh">
        <Text color="red.500">{error}</Text>
      </Center>
    );

  if (!subscription)
    return (
      <Center h="100vh">
        <Text>Nenhuma assinatura encontrada</Text>
      </Center>
    );

  return (
<>
  <Heading 

    fontSize={{ base: "xl", md: "2xl" }} 
    textAlign="center" 
    mx="auto"
  >
    Meu plano
  </Heading>

  <SubscriptionCards
    cancelLoading={cancelLoading}
    subscriptions={[subscription]}
    onCancel={() => {
      if (!cancelLoading) handleCancel();
    }}
  />
     <ToastContainer />
</>

  );
}
