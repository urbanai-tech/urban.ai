import React from "react";
import { ExternalLink } from "lucide-react";
import { AppButton, AppCard } from "./ui";
import styles from "./Subscription.module.css";
import { brlFromCents } from "../lib/format";

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
  if (!timestamp) return "Início não informado";
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
  return "Plano My Urban";
}

function getCycleLabel(sub: Subscription) {
  const cycle = sub.metadata?.urbanai_billing_cycle || sub.plan?.interval || "monthly";
  return cycleLabels[cycle] || cycle;
}

function getQuantity(sub: Subscription): number {
  const quantity = Number(sub.metadata?.urbanai_quantity);
  return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
}

function getQuantityLabel(sub: Subscription) {
  const quantity = getQuantity(sub);
  return quantity === 1 ? "1 imóvel contratado" : `${quantity} imóveis contratados`;
}

function formatAmountCents(cents: number, currency: string) {
  if (currency === "BRL") return brlFromCents(cents);
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

/** `plan.amount` do Stripe é o valor unitário (por imóvel); o total do ciclo é unitário × quantidade. */
function getUnitAmount(sub: Subscription): number | null {
  const amount = sub.plan?.amount;
  return typeof amount === "number" && Number.isFinite(amount) ? amount : null;
}

function getCurrency(sub: Subscription) {
  return (sub.plan?.currency || sub.currency || "brl").toUpperCase();
}

function getPriceLabel(sub: Subscription) {
  const amount = getUnitAmount(sub);
  if (amount !== null) {
    return `${formatAmountCents(amount * getQuantity(sub), getCurrency(sub))} / ${getCycleLabel(sub)}`;
  }

  const quantity = sub.metadata?.urbanai_quantity;
  if (sub.metadata?.urbanai_plan === "alpha") {
    return quantity ? `Cortesia alpha - ${quantity} imóveis` : "Cortesia alpha";
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
    <div className={styles.subscriptionsContainer}>
      <div className={styles.subscriptionList}>
        {subscriptions.map((sub) => {
          const isCanceled = sub.status === "canceled";
          const canCancel = onCancel && sub.status === "active" && !sub.id.startsWith("alpha-");
          const canManageBilling =
            onManageBilling &&
            ["active", "trialing", "past_due"].includes(sub.status) &&
            !sub.id.startsWith("alpha-");

          return (
            <AppCard
              key={sub.id}
              variant="elevated"
              className={`${styles.subscriptionCard} ${isCanceled ? styles.subscriptionCardCanceled : ""}`}
            >
              <span
                className={`${styles.statusBadge} ${isCanceled ? styles.statusBadgeCanceled : styles.statusBadgeActive}`}
              >
                {statusLabels[sub.status] || sub.status}
              </span>

              <div className={styles.cardContent}>
                <h2 className={styles.planName}>
                  {getPlanName(sub)}
                </h2>

                <p
                  className={`${styles.priceLabel} ${isCanceled ? styles.priceLabelCanceled : styles.priceLabelActive}`}
                >
                  {getPriceLabel(sub)}
                </p>

                <hr className={styles.divider} />

                <div className={styles.infoTileGrid}>
                  <InfoTile label="Ciclo" value={getCycleLabel(sub)} />
                  <InfoTile label="Quota" value={getQuantityLabel(sub)} />
                  {getUnitAmount(sub) !== null && getQuantity(sub) > 1 && (
                    <InfoTile
                      label="Valor por imóvel"
                      value={`${formatAmountCents(getUnitAmount(sub) as number, getCurrency(sub))} / ${getCycleLabel(sub)}`}
                    />
                  )}
                </div>

                <p className={styles.dateLabel}>
                  {getDateLabel(sub)}
                </p>

                {(canManageBilling || canCancel) && (
                  <div className={styles.actionsRow}>
                    {canManageBilling && (
                      <AppButton
                        data-testid="manage-billing-button"
                        type="button"
                        loading={manageBillingLoading}
                        variant="primary"
                        size="md"
                        rightIcon={<ExternalLink size={14} />}
                        onClick={() => onManageBilling(sub.id)}
                      >
                        Gerenciar assinatura
                      </AppButton>
                    )}
                    {canCancel && (
                      <AppButton
                        data-testid="cancel-subscription-button"
                        type="button"
                        loading={cancelLoading}
                        variant="danger"
                        size="md"
                        onClick={() => onCancel(sub.id)}
                      >
                        Cancelar plano
                      </AppButton>
                    )}
                  </div>
                )}
              </div>
            </AppCard>
          );
        })}
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      className={styles.infoTile}
    >
      <p className={`urban-app-eyebrow-muted ${styles.infoTileLabel}`}>
        {label}
      </p>
      <p className={styles.infoTileValue}>
        {value}
      </p>
    </div>
  );
}
