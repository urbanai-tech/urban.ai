"use client";

import { useMemo, useState, type CSSProperties } from "react";
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

// Cores 100% por token: a calculadora segue o tema (claro/escuro) em qualquer
// superfície. `surface` só muda o raio do cartão.
function theme() {
  return {
    cardBg: "var(--theme-app-surface)",
    cardBorder: "var(--theme-app-divider-strong)",
    panelBg: "var(--theme-app-surface-muted)",
    text: "var(--theme-app-text)",
    muted: "var(--theme-app-text-muted)",
    faint: "var(--theme-app-text-muted)",
    accent: "var(--theme-app-accent)",
    accentText: "var(--theme-app-accent)",
    onAccent: "var(--theme-app-accent-contrast)",
    danger: "var(--theme-app-danger)",
    accentSoft: "var(--theme-app-accent-soft)",
    optionBg: "var(--theme-app-surface)",
    optionBorder: "var(--theme-app-divider-strong)",
    optionSelectedBorder: "var(--theme-app-accent)",
  };
}

function cardStyle(surface: PricingSurface, compact?: boolean): CSSProperties {
  const t = theme();
  return {
    padding: compact ? 20 : 24,
    border: `1px solid ${t.cardBorder}`,
    borderRadius: surface === "dark" ? 12 : 8,
    background: t.cardBg,
    boxShadow: "var(--theme-app-shadow-card)",
    color: t.text,
  };
}

function optionButtonStyle(selected: boolean): CSSProperties {
  const t = theme();
  return {
    minHeight: 44,
    padding: "8px 12px",
    borderRadius: 8,
    border: selected ? `1px solid ${t.optionSelectedBorder}` : `1px solid ${t.optionBorder}`,
    background: selected ? t.accentSoft : t.optionBg,
    color: selected ? t.accentText : t.text,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  };
}

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
  const t = theme();

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

  return (
    <section style={{ ...cardStyle(surface, compact), display: "grid", gap: compact ? 18 : 22 }}>
      <header style={{ display: "grid", gap: 8 }}>
        <p style={{ margin: 0, color: t.faint, fontSize: 11, fontWeight: 800, letterSpacing: 2.2, textTransform: "uppercase" }}>
          Self-service por imóvel
        </p>
        <h3 style={{ margin: 0, color: t.text, fontSize: compact ? 24 : 30, lineHeight: 1.05 }}>
          {title}
        </h3>
        <p style={{ margin: 0, color: t.muted, fontSize: 14, lineHeight: 1.55 }}>
          {subtitle}
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: 18,
        }}
      >
        <div style={{ display: "grid", gap: 18 }}>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ marginBottom: 8, color: t.muted, fontSize: 14, fontWeight: 700 }}>
              Quantos imóveis você quer contratar?
            </legend>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                aria-label="Diminuir quantidade"
                onClick={() => setQuantity((value) => clampQuantity(value - 1, maxQuantity))}
                style={{ ...optionButtonStyle(false), width: 44, minHeight: 44, fontSize: 20 }}
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
                style={{
                  width: 116,
                  minHeight: 52,
                  borderRadius: 8,
                  border: `1px solid ${t.optionBorder}`,
                  background: t.optionBg,
                  color: t.text,
                  textAlign: "center",
                  fontSize: 28,
                  fontWeight: 900,
                }}
              />
              <button
                type="button"
                aria-label="Aumentar quantidade"
                onClick={() => setQuantity((value) => clampQuantity(value + 1, maxQuantity))}
                style={{ ...optionButtonStyle(false), width: 44, minHeight: 44, fontSize: 20 }}
              >
                +
              </button>
              <span style={{ color: t.muted, fontSize: 13 }}>até {maxQuantity} no checkout self-service</span>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setQuantity(preset)}
                  style={optionButtonStyle(quantity === preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ marginBottom: 8, color: t.muted, fontSize: 14, fontWeight: 700 }}>
              Período de cobrança
            </legend>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
              {BILLING_CYCLES.map((value) => {
                const selected = cycle === value;
                const discount = selectedPlan ? calculatePricingQuote(selectedPlan, quantity, value).discountPercent : 0;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCycle(value)}
                    style={{ ...optionButtonStyle(selected), display: "grid", gap: 2 }}
                  >
                    <span>{BILLING_CYCLE_META[value].label}</span>
                    <span style={{ color: selected ? t.accentText : t.faint, fontSize: 12 }}>
                      {discount > 0 ? `-${discount}%` : "base"}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <aside
          style={{
            padding: 18,
            borderRadius: 8,
            border: `1px solid ${t.cardBorder}`,
            background: t.panelBg,
            display: "grid",
            gap: 12,
            alignContent: "start",
          }}
        >
          <p style={{ margin: 0, color: t.faint, fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>
            Faixa aplicada
          </p>
          <div>
            <h4 style={{ margin: 0, color: t.text, fontSize: 26, lineHeight: 1.05 }}>
              {activePlan?.title ?? "Sem faixa"}
            </h4>
            <p style={{ margin: "6px 0 0", color: t.muted, fontSize: 13 }}>
              {activePlan ? formatQuantityRange(activePlan) : "Configure uma faixa ativa no admin."}
            </p>
          </div>

          {quote ? (
            <>
              <div style={{ display: "grid", gap: 6 }}>
                <p style={{ margin: 0, color: t.muted, fontSize: 14 }}>
                  Por imóvel/mês: <strong style={{ color: t.text }}>{formatMoney(quote.pricePerPropertyMonthly)}</strong>
                </p>
                <p style={{ margin: 0, color: t.muted, fontSize: 14 }}>
                  Equivalente mensal: <strong style={{ color: t.text }}>{formatMoney(quote.monthlyEquivalentTotal)}</strong>
                </p>
              </div>
              <div>
                <p style={{ margin: 0, color: t.faint, fontSize: 12 }}>
                  Total no ciclo {BILLING_CYCLE_META[cycle].shortLabel}
                </p>
                <p style={{ margin: "2px 0 0", color: t.accentText, fontSize: 30, fontWeight: 900, lineHeight: 1 }}>
                  {formatMoney(quote.cycleTotal)}
                </p>
              </div>
            </>
          ) : (
            <p style={{ margin: 0, color: t.muted, fontSize: 14, lineHeight: 1.55 }}>
              Essa quantidade exige atendimento comercial. Ajuste o teto self-service no admin ou fale com vendas.
            </p>
          )}

          {error && (
            <p role="alert" style={{ margin: 0, color: t.danger, fontSize: 13, lineHeight: 1.45 }}>
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleCheckout}
            disabled={busy || (!!quote && priceForCycle(selectedPlan!, cycle) <= 0)}
            style={{
              width: "100%",
              minHeight: 48,
              borderRadius: 8,
              border: `1px solid ${t.accent}`,
              background: t.accent,
              color: t.onAccent,
              fontWeight: 900,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.58 : 1,
            }}
          >
            {busy ? "Abrindo checkout…" : quote ? "Continuar para pagamento" : "Falar com comercial"}
          </button>
        </aside>
      </div>

      {activePlan?.features?.length ? (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8, color: t.muted, fontSize: 14 }}>
          {activePlan.features.map((feature) => (
            <li key={feature} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ color: t.accentText, display: "inline-flex", marginTop: 2 }}>
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
