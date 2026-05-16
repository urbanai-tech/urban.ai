"use client";

import React, { useEffect, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import SubscriptionCards, { Subscription } from "../componentes/Subscription";
import {
  AppPageShell,
  AppSectionHeader,
  AppMetricCard,
  AppBadge,
  AppCard,
  Icons,
} from "../componentes/ui";
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
      <AppPageShell>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "60vh",
          }}
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
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Icons.AlertCircle size={18} />
            <span style={{ color: "var(--app-danger)", fontWeight: 500 }}>{error}</span>
          </div>
        </AppCard>
      </AppPageShell>
    );
  }

  if (!subscription) {
    return (
      <AppPageShell>
        <AppCard>
          <p style={{ color: "var(--app-text-muted)", margin: 0 }}>
            Nenhuma assinatura encontrada.
          </p>
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
          subtitle="Acompanhe status da assinatura, limite de imoveis e acoes de billing."
          actions={isAlpha ? <AppBadge kind="accent">Alpha assistido</AppBadge> : undefined}
        />

        {quotaError && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              background: "rgba(200, 129, 14, 0.10)",
              border: "1px solid rgba(200, 129, 14, 0.25)",
              borderRadius: 10,
              color: "var(--app-warning)",
              fontSize: 14,
              marginBottom: 24,
            }}
          >
            <Icons.AlertCircle size={18} />
            <span>{quotaError}</span>
          </div>
        )}

        {quota && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginBottom: 32,
            }}
          >
            <AppCard>
              <div data-testid="quota-contracted-card">
                <AppMetricCard
                  label="Contratados"
                  value={quota.contratados}
                  sub="Limite atual do plano"
                />
              </div>
            </AppCard>
            <AppCard>
              <div data-testid="quota-active-card">
                <AppMetricCard
                  label="Ativos"
                  value={quota.ativos}
                  sub="Imoveis cadastrados"
                />
              </div>
            </AppCard>
            <AppCard variant={quota.podeAdicionar ? "default" : "accent"}>
              <div data-testid="quota-available-card">
                <AppMetricCard
                  label="Disponiveis"
                  value={available ?? 0}
                  sub={quota.podeAdicionar ? "Pode cadastrar mais" : "Quota atingida"}
                  accent={!quota.podeAdicionar}
                />
              </div>
            </AppCard>
          </div>
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
      </div>
      <ToastContainer />
    </AppPageShell>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        border: "3px solid rgba(232, 80, 10, 0.15)",
        borderTopColor: "var(--app-accent)",
        animation: "urban-app-spin 0.9s linear infinite",
      }}
    >
      <style>{`@keyframes urban-app-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
