"use client";

import { useState, type CSSProperties } from "react";
import { loadStripe } from "@stripe/stripe-js";
import type { BillingCycle, Plan } from "../service/api";
import { createCheckoutSession } from "../service/api";
import { Check } from "./ui/Icons";

/**
 * Calculadora de preco F6.5: cobranca por imovel x 4 ciclos com desconto.
 *
 * Mantem a estetica manifesto da tela /plans sem depender de classes Tailwind.
 */

const CYCLES: { value: BillingCycle; label: string; mesesNoCiclo: number }[] = [
  { value: "monthly", label: "Mensal", mesesNoCiclo: 1 },
  { value: "quarterly", label: "Trimestral", mesesNoCiclo: 3 },
  { value: "semestral", label: "Semestral", mesesNoCiclo: 6 },
  { value: "annual", label: "Anual", mesesNoCiclo: 12 },
];

const QUANTITY_PRESETS = [1, 3, 5, 10];
const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

const cardStyle: CSSProperties = {
  padding: 24,
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 16,
  background: "rgba(15,23,42,0.42)",
  boxShadow: "0 18px 45px rgba(0,0,0,0.24)",
};

const labelStyle: CSSProperties = {
  margin: "0 0 8px",
  fontSize: 14,
  fontWeight: 650,
  color: "rgba(248,250,252,0.72)",
};

const mutedTextStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: "rgba(248,250,252,0.68)",
  lineHeight: 1.55,
};

const smallMutedStyle: CSSProperties = {
  fontSize: 12,
  color: "rgba(248,250,252,0.42)",
};

function optionButtonStyle(selected: boolean): CSSProperties {
  return {
    minHeight: 46,
    padding: "8px 12px",
    borderRadius: 10,
    border: selected
      ? "1px solid rgba(232,80,10,0.72)"
      : "1px solid rgba(148,163,184,0.28)",
    background: selected ? "rgba(232,80,10,0.14)" : "rgba(15,23,42,0.54)",
    color: selected ? "#FFE4D6" : "rgba(248,250,252,0.76)",
    fontSize: 14,
    fontWeight: 650,
    cursor: "pointer",
    transition: "border-color 140ms, background 140ms",
  };
}

function priceForCycle(plan: Plan, cycle: BillingCycle): number {
  const raw =
    cycle === "monthly"
      ? plan.priceMonthly
      : cycle === "quarterly"
        ? plan.priceQuarterly
        : cycle === "semestral"
          ? plan.priceSemestral
          : plan.priceAnnualNew;
  if (!raw) return 0;
  return Number(String(raw).replace(",", "."));
}

function discountForCycle(plan: Plan, cycle: BillingCycle): number {
  switch (cycle) {
    case "quarterly":
      return plan.discountQuarterlyPercent ?? 0;
    case "semestral":
      return plan.discountSemestralPercent ?? 0;
    case "annual":
      return plan.discountAnnualPercent ?? 0;
    default:
      return 0;
  }
}

export function PricingCalculatorV2({ plan }: { plan: Plan }) {
  const [cycle, setCycle] = useState<BillingCycle>("annual");
  const [quantity, setQuantity] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (plan.isCustomPrice) {
    return (
      <div style={{ ...cardStyle, borderRadius: 12 }}>
        <p style={mutedTextStyle}>
          Plano <strong>{plan.title}</strong> tem preco sob consulta. Fale com a gente em{" "}
          <a
            href="mailto:comercial@myurbanai.com"
            style={{ color: "#E8500A", fontWeight: 700 }}
          >
            comercial@myurbanai.com
          </a>
          .
        </p>
      </div>
    );
  }

  const pricePerImovelMes = priceForCycle(plan, cycle);
  const discount = discountForCycle(plan, cycle);
  const cycleMeta = CYCLES.find((c) => c.value === cycle)!;
  const totalNoCiclo = pricePerImovelMes * quantity * cycleMeta.mesesNoCiclo;
  const totalMensalEquivalente = pricePerImovelMes * quantity;

  async function handleSubscribe() {
    setBusy(true);
    setError(null);
    try {
      if (!stripePromise) {
        throw new Error("Checkout indisponivel: chave publica Stripe nao configurada.");
      }

      const { sessionId } = await createCheckoutSession(plan.name, cycle, quantity);
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error("Checkout indisponivel: Stripe.js nao carregou.");
      }

      const result = await stripe.redirectToCheckout({ sessionId });
      if (result.error) {
        throw new Error(result.error.message || "Erro ao redirecionar para o checkout.");
      }
    } catch (err) {
      const msg = (err as Error)?.message || "Erro ao iniciar checkout.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 24 }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 24, lineHeight: 1.15, fontWeight: 800 }}>
            {plan.title}
          </h3>
          {plan.highlightBadge && (
            <span
              style={{
                display: "inline-block",
                marginTop: 6,
                fontSize: 12,
                fontWeight: 800,
                color: "#FFB088",
                textTransform: "uppercase",
                letterSpacing: 1.8,
              }}
            >
              {plan.highlightBadge}
            </span>
          )}
        </div>
        {discount > 0 && (
          <span
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              background: "rgba(232,80,10,0.16)",
              color: "#FFB088",
              fontSize: 12,
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            -{discount}%
          </span>
        )}
      </header>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={labelStyle}>Ciclo de cobranca</legend>
        <div
          role="radiogroup"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(104px, 1fr))",
            gap: 8,
          }}
        >
          {CYCLES.map((c) => {
            const selected = cycle === c.value;
            const cycleDiscount = discountForCycle(plan, c.value);
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setCycle(c.value)}
                style={{
                  ...optionButtonStyle(selected),
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span>{c.label}</span>
                {cycleDiscount > 0 ? (
                  <span style={{ fontSize: 12, color: "#FFB088" }}>-{cycleDiscount}%</span>
                ) : (
                  <span style={smallMutedStyle}>base</span>
                )}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={labelStyle}>Quantos imoveis?</legend>
        <div
          role="radiogroup"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 8,
            marginBottom: 8,
          }}
        >
          {QUANTITY_PRESETS.map((n) => {
            const selected = quantity === n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setQuantity(n)}
                style={optionButtonStyle(selected)}
              >
                {n}
              </button>
            );
          })}
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            color: "rgba(248,250,252,0.58)",
          }}
        >
          ou
          <input
            type="number"
            min={1}
            max={500}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value || "1", 10)))}
            aria-label="Quantidade customizada de imoveis"
            style={{
              width: 80,
              padding: "6px 8px",
              borderRadius: 8,
              border: "1px solid rgba(148,163,184,0.28)",
              background: "rgba(15,23,42,0.78)",
              color: "#F8FAFC",
            }}
          />
          custom
        </label>
      </fieldset>

      <div
        style={{
          padding: 16,
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(2,6,23,0.50)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <p style={mutedTextStyle}>
          Preco por imovel: <strong style={{ color: "#F8FAFC" }}>R$ {pricePerImovelMes.toFixed(2)}/mes</strong>
        </p>
        <p style={mutedTextStyle}>
          Total mensal equivalente ({quantity} imoveis):{" "}
          <strong style={{ color: "#F8FAFC" }}>R$ {totalMensalEquivalente.toFixed(2)}</strong>
        </p>
        <p style={{ margin: 0, fontSize: 16, color: "#FFB088" }}>
          Cobranca no ciclo {cycleMeta.label.toLowerCase()}: <strong>R$ {totalNoCiclo.toFixed(2)}</strong>
        </p>
        {discount > 0 && (
          <p style={smallMutedStyle}>
            Voce economiza R${" "}
            {(pricePerImovelMes * 100 / (100 - discount) * quantity * cycleMeta.mesesNoCiclo - totalNoCiclo).toFixed(2)}{" "}
            no ciclo escolhido vs. mensal cheio.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" style={{ margin: 0, fontSize: 14, color: "#F87171" }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubscribe}
        disabled={busy || pricePerImovelMes <= 0}
        style={{
          width: "100%",
          minHeight: 48,
          padding: "0 16px",
          borderRadius: 10,
          border: "1px solid #E8500A",
          background: "#E8500A",
          color: "#FFFFFF",
          fontWeight: 800,
          cursor: busy || pricePerImovelMes <= 0 ? "not-allowed" : "pointer",
          opacity: busy || pricePerImovelMes <= 0 ? 0.55 : 1,
        }}
      >
        {busy ? "Abrindo checkout..." : `Assinar - R$ ${totalNoCiclo.toFixed(2)} no ciclo`}
      </button>

      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          color: "rgba(248,250,252,0.74)",
          fontSize: 14,
        }}
      >
        {plan.features.map((f, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ color: "#FFB088", display: "inline-flex", marginTop: 2 }}>
              <Check size={14} />
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
