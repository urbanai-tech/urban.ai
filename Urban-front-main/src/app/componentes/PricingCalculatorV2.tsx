"use client";

import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { pickCheckoutRedirect } from "../lib/checkout";
import type { BillingCycle, Plan } from "../service/api";
import { createCheckoutSession, getFriendlyApiErrorMessage } from "../service/api";
import {
  BILLING_CYCLE_META,
  BILLING_CYCLES,
  calculatePricingQuote,
  firstSelfServicePlan,
  formatMoney,
  formatQuantityRange,
  maxCheckoutQuantity,
  minProperties,
  planMatchesQuantity,
  priceForCycle,
  selectPlanForQuantity,
  sortPricingPlans,
} from "../lib/pricingSelfService";
import { Check } from "./ui/Icons";
import styles from "./PricingCalculatorV2.module.css";

type PricingSurface = "dark" | "light";

interface PricingSelfServiceCalculatorProps {
  plans: Plan[];
  initialQuantity?: number;
  initialCycle?: BillingCycle;
  surface?: PricingSurface;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

const DEFAULT_PRESETS = [1, 3, 5, 10, 20, 50, 100];

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

function clampQuantity(value: number, max: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(max, Math.floor(value)));
}

function resolveMaxQuantity(plans: Plan[]): number {
  const maxes = plans
    .filter((plan) => plan.selfServiceEnabled !== false && !plan.isCustomPrice)
    .map(maxCheckoutQuantity)
    .filter((value): value is number => typeof value === "number" && value > 0);
  return Math.max(1, Math.min(500, maxes.length ? Math.max(...maxes) : 500));
}

export function PricingSelfServiceCalculator({
  plans,
  initialQuantity,
  initialCycle = "annual",
  surface = "dark",
  title = "Escolha quantidade e período",
  subtitle = "O plano é aplicado automaticamente pela quantidade de imóveis.",
  compact = false,
}: PricingSelfServiceCalculatorProps) {
  const sortedPlans = useMemo(() => sortPricingPlans(plans).filter((plan) => plan.isActive), [plans]);
  const firstPlan = firstSelfServicePlan(sortedPlans);
  const maxQuantity = resolveMaxQuantity(sortedPlans);
  const defaultQuantity = initialQuantity ?? (firstPlan ? minProperties(firstPlan) : 1);
  const [quantity, setQuantity] = useState(() => clampQuantity(defaultQuantity, maxQuantity));
  const [cycle, setCycle] = useState<BillingCycle>(initialCycle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPlan = selectPlanForQuantity(sortedPlans, quantity);
  const consultPlan =
    sortedPlans.find((plan) => planMatchesQuantity(plan, quantity)) ??
    sortedPlans.find((plan) => plan.isCustomPrice || plan.selfServiceEnabled === false) ??
    null;
  const activePlan = selectedPlan ?? consultPlan;
  const quote = selectedPlan ? calculatePricingQuote(selectedPlan, quantity, cycle) : null;
  const presets = DEFAULT_PRESETS.filter((value) => value <= maxQuantity);

  async function handleCheckout() {
    if (!selectedPlan || !quote) {
      window.open("mailto:comercial@myurbanai.com", "_blank");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const session = await createCheckoutSession("auto", cycle, quantity);
      const redirect = pickCheckoutRedirect(session);

      if (redirect?.mode === "url") {
        // Caminho atual: redirect hospedado do Stripe (redirectToCheckout está deprecado).
        window.location.assign(redirect.url);
        return; // mantém "busy" até a navegação acontecer
      }

      // Fallback para respostas antigas do backend, sem `url`.
      if (redirect?.mode === "sessionId") {
        if (!stripePromise) {
          throw new Error("Checkout indisponível: chave pública Stripe não configurada.");
        }
        const stripe = await stripePromise;
        if (!stripe) throw new Error("Checkout indisponível: Stripe.js não carregou.");
        const result = await stripe.redirectToCheckout({ sessionId: redirect.sessionId });
        if (result.error) throw new Error("Não foi possível abrir o checkout agora.");
        return;
      }

      throw new Error("Não foi possível abrir o checkout agora.");
    } catch (err) {
      setError(
        getFriendlyApiErrorMessage(
          err,
          "Não foi possível iniciar o checkout agora. Tente novamente em alguns instantes.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  const cx = (...parts: Array<string | false>) => parts.filter(Boolean).join(" ");
  const optionClass = (selected: boolean) =>
    cx(styles.optionButton, selected && styles.optionButtonSelected);

  return (
    <section
      className={cx(styles.card, compact && styles.cardCompact, surface !== "dark" && styles.cardLight)}
    >
      <header className={styles.header}>
        <p className={styles.eyebrow}>Self-service por imóvel</p>
        <h3 className={cx(styles.title, compact && styles.titleCompact)}>{title}</h3>
        <p className={styles.bodyText}>{subtitle}</p>
      </header>

      <div className={styles.layout}>
        <div className={styles.controls}>
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Quantos imóveis você quer contratar?</legend>
            <div className={styles.quantityRow}>
              <button
                type="button"
                aria-label="Diminuir quantidade"
                onClick={() => setQuantity((value) => clampQuantity(value - 1, maxQuantity))}
                className={cx(optionClass(false), styles.stepButton)}
              >
                -
              </button>
              <input
                type="number"
                min={1}
                max={maxQuantity}
                value={quantity}
                onChange={(event) => setQuantity(clampQuantity(Number(event.target.value), maxQuantity))}
                aria-label="Quantidade de imóveis"
                className={styles.quantityInput}
              />
              <button
                type="button"
                aria-label="Aumentar quantidade"
                onClick={() => setQuantity((value) => clampQuantity(value + 1, maxQuantity))}
                className={cx(optionClass(false), styles.stepButton)}
              >
                +
              </button>
              <span className={styles.quantityHint}>até {maxQuantity} no checkout self-service</span>
            </div>

            <div className={styles.presetRow}>
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setQuantity(preset)}
                  className={optionClass(quantity === preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Período de cobrança</legend>
            <div className={styles.cycleGrid}>
              {BILLING_CYCLES.map((value) => {
                const selected = cycle === value;
                const discount = selectedPlan ? calculatePricingQuote(selectedPlan, quantity, value).discountPercent : 0;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCycle(value)}
                    className={cx(optionClass(selected), styles.cycleButton)}
                  >
                    <span>{BILLING_CYCLE_META[value].label}</span>
                    <span className={cx(styles.cycleDiscount, selected && styles.cycleDiscountSelected)}>
                      {discount > 0 ? `-${discount}%` : "base"}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <aside className={styles.summary}>
          <p className={styles.summaryEyebrow}>Faixa aplicada</p>
          <div>
            <h4 className={styles.summaryTitle}>{activePlan?.title ?? "Sem faixa"}</h4>
            <p className={styles.summaryRange}>
              {activePlan ? formatQuantityRange(activePlan) : "Configure uma faixa ativa no admin."}
            </p>
          </div>

          {quote ? (
            <>
              <div className={styles.quoteLines}>
                <p className={styles.quoteLine}>
                  Por imóvel/mês: <strong className={styles.quoteValue}>{formatMoney(quote.pricePerPropertyMonthly)}</strong>
                </p>
                <p className={styles.quoteLine}>
                  Equivalente mensal: <strong className={styles.quoteValue}>{formatMoney(quote.monthlyEquivalentTotal)}</strong>
                </p>
              </div>
              <div>
                <p className={styles.totalLabel}>
                  Total no ciclo {BILLING_CYCLE_META[cycle].shortLabel}
                </p>
                <p className={styles.totalValue}>{formatMoney(quote.cycleTotal)}</p>
              </div>
            </>
          ) : (
            <p className={styles.bodyText}>
              Essa quantidade exige atendimento comercial. Ajuste o teto self-service no admin ou fale com vendas.
            </p>
          )}

          {error && (
            <p role="alert" className={styles.errorText}>
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleCheckout}
            disabled={busy || (!!quote && priceForCycle(selectedPlan!, cycle) <= 0)}
            className={cx(styles.checkoutButton, busy && styles.checkoutButtonBusy)}
          >
            {busy ? "Abrindo checkout…" : quote ? "Continuar para pagamento" : "Falar com comercial"}
          </button>
        </aside>
      </div>

      {activePlan?.features?.length ? (
        <ul className={styles.featureList}>
          {activePlan.features.map((feature) => (
            <li key={feature} className={styles.featureItem}>
              <span className={styles.featureIcon}>
                <Check size={14} />
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function PricingCalculatorV2({ plan }: { plan: Plan }) {
  const initialQuantity = minProperties(plan);
  return (
    <PricingSelfServiceCalculator
      plans={[plan]}
      initialQuantity={initialQuantity}
      surface="dark"
      title={plan.title}
      subtitle={`Faixa ${formatQuantityRange(plan)}. Ajuste quantidade e período antes do checkout.`}
    />
  );
}
