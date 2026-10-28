"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SubscriptionCards, { Subscription } from "../componentes/Subscription";
import { useCheckoutReturnNotice } from "../componentes/useCheckoutReturnNotice";
import {
  AppPageShell,
  AppSectionHeader,
  AppMetricCard,
  AppBadge,
  AppCard,
  Icons,
  useToastCompat,
} from "../componentes/ui";
import {
  cancelSubscription,
  createBillingPortalSession,
  fetchListingsQuota,
  fetchSubscription,
  type ListingsQuota,
} from "../service/api";
import styles from "./page.module.css";

function remainingQuota(quota: ListingsQuota) {
  return Math.max(0, quota.contratados - quota.ativos);
}

export default function SubscriptionsPage() {
  const toast = useToastCompat();
  const router = useRouter();
  useCheckoutReturnNotice("success");
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
      setQuotaError("Não foi possível carregar o limite de imóveis do seu plano.");
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
        throw new Error("Portal indisponível");
      }
      window.location.href = session.url;
    } catch {
      toast("Não foi possível abrir a área de pagamento", { type: "error" });
      setManageBillingLoading(false);
    }
  }

  if (loading) {
    return (
      <AppPageShell>
        <div
          className={styles.s1}
        >
          <Spinner />
        </div>
      </AppPageShell>
    );
  }

  if (error) {
    return (
      <AppPageShell>
        <AppCard variant="accent">
          <div className={styles.s2}>
            <Icons.AlertCircle size={18} />
            <span className={styles.s3}>{error}</span>
          </div>
        </AppCard>
      </AppPageShell>
    );
  }

  if (!subscription) {
    return (
      <AppPageShell>
        <AppCard variant="accent">
          <div className={styles.s4}>
            <AppSectionHeader
              eyebrow="ASSINATURA"
              title="Nenhuma assinatura encontrada"
              subtitle="Escolha quantos imóveis quer contratar e ative o checkout self-service."
            />
            <button
              type="button"
              onClick={() => router.push("/plans?source=my-plan")}
              className={styles.s5}
            >
              Escolher quantidade e período
            </button>
          </div>
        </AppCard>
      </AppPageShell>
    );
  }

  const available = quota ? remainingQuota(quota) : null;
  const isAlpha = subscription.id.startsWith("alpha-");

  return (
    <AppPageShell>
      <div data-testid="my-plan-page">
        <AppSectionHeader
          eyebrow="ASSINATURA · MEU PLANO"
          title="Meu plano"
          subtitle="Acompanhe sua assinatura, quantos imóveis o plano permite e as opções de pagamento."
          actions={isAlpha ? <AppBadge kind="accent">Alpha assistido</AppBadge> : undefined}
        />

        {quotaError && (
          <div
            className={styles.s6}
          >
            <Icons.AlertCircle size={18} />
            <span>{quotaError}</span>
          </div>
        )}

        {quota && (
          <div
            className={styles.s7}
          >
            <AppCard>
              <div data-testid="quota-contracted-card">
                <AppMetricCard
                  label="Contratados"
                  value={quota.contratados}
                  sub="Imóveis incluídos no plano"
                />
              </div>
            </AppCard>
            <AppCard>
              <div data-testid="quota-active-card">
                <AppMetricCard
                  label="Ativos"
                  value={quota.ativos}
                  sub="Imóveis em uso"
                />
              </div>
            </AppCard>
            <AppCard variant={quota.podeAdicionar ? "default" : "accent"}>
              <div data-testid="quota-available-card">
                <AppMetricCard
                  label="Livres"
                  value={available ?? 0}
                  sub={quota.podeAdicionar ? "Você ainda pode cadastrar" : "Limite atingido"}
                  accent={!quota.podeAdicionar}
                />
              </div>
            </AppCard>
          </div>
        )}

        <AppCard className={styles.currentPlanCard}>
          <div className={styles.s8}>
            <div>
              <h3 className={styles.s9}>
                Precisa mudar a quantidade?
              </h3>
              <p className={styles.s10}>
                Abra o seletor self-service para contratar mais imóveis ou mudar o período.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/plans?source=my-plan")}
              className={styles.s11}
            >
              Ajustar assinatura
            </button>
          </div>
        </AppCard>

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
      </div>
    </AppPageShell>
  );
}

function Spinner() {
  return (
    <div
      className={styles.s12}
    >
      <style>{`@keyframes urban-app-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
