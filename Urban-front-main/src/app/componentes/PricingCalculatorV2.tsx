"use client";

import { useState } from "react";
import type { BillingCycle, Plan } from "../service/api";
import { createCheckoutSession } from "../service/api";

/**
 * Calculadora de preço F6.5: cobrança por imóvel × 4 ciclos com desconto.
 *
 * Mostra:
 *  - seletor de 4 ciclos (mensal / trimestral / semestral / anual) com desconto
 *  - seletor de quantidade de imóveis (1, 3, 5, 10, custom)
 *  - cálculo de total mensal equivalente + total cobrado no ciclo
 *  - CTA que abre o checkout Stripe com a combinação escolhida
 */

const CYCLES: { value: BillingCycle; label: string; mesesNoCiclo: number }[] = [
  { value: "monthly", label: "Mensal", mesesNoCiclo: 1 },
  { value: "quarterly", label: "Trimestral", mesesNoCiclo: 3 },
  { value: "semestral", label: "Semestral", mesesNoCiclo: 6 },
  { value: "annual", label: "Anual", mesesNoCiclo: 12 },
];

const QUANTITY_PRESETS = [1, 3, 5, 10];

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
  // Aceita "97" ou "97,50"
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
      <div className="p-6 border border-slate-700 rounded-xl bg-slate-900/40">
        <p className="text-slate-300">
          Plano <strong>{plan.title}</strong> tem preço sob consulta. Fale com a gente em <a href="mailto:comercial@myurbanai.com" className="text-emerald-400">comercial@myurbanai.com</a>.
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
      const { sessionId } = await createCheckoutSession(plan.name, cycle, quantity);
      // Em produção chamamos stripe.redirectToCheckout aqui — depende do
      // wrapper StripeJS já carregado pela aplicação.
      const stripeJs = (window as unknown as {
        Stripe?: (key: string) => { redirectToCheckout: (opts: { sessionId: string }) => Promise<unknown> };
      }).Stripe;
      const pubKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (stripeJs && pubKey) {
        const stripe = stripeJs(pubKey);
        await stripe.redirectToCheckout({ sessionId });
      } else {
        // Fallback — alguns ambientes carregam Stripe via componentes específicos
        window.location.href = `/api/stripe/checkout-redirect?session=${sessionId}`;
      }
    } catch (err) {
      const msg = (err as Error)?.message || "Erro ao iniciar checkout.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 border border-slate-700 rounded-2xl bg-slate-900/40 space-y-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold">{plan.title}</h3>
          {plan.highlightBadge && (
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
              {plan.highlightBadge}
            </span>
          )}
        </div>
        {discount > 0 && (
          <span className="text-xs font-bold px-2 py-1 rounded bg-emerald-500/20 text-emerald-300">
            -{discount}%
          </span>
        )}
      </header>

      {/* Seletor de ciclos */}
      <fieldset>
        <legend className="text-sm font-semibold mb-2 text-slate-300">Ciclo de cobrança</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup">
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
                className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg border transition-colors text-sm ${
                  selected
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                    : "border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-500"
                }`}
              >
                <span className="font-semibold">{c.label}</span>
                {cycleDiscount > 0 ? (
                  <span className="text-xs text-emerald-400">-{cycleDiscount}%</span>
                ) : (
                  <span className="text-xs text-slate-500">base</span>
                )}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Seletor de quantidade */}
      <fieldset>
        <legend className="text-sm font-semibold mb-2 text-slate-300">Quantos imóveis?</legend>
        <div className="grid grid-cols-4 gap-2 mb-2" role="radiogroup">
          {QUANTITY_PRESETS.map((n) => {
            const selected = quantity === n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setQuantity(n)}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                  selected
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                    : "border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-500"
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          ou
          <input
            type="number"
            min={1}
            max={500}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value || "1", 10)))}
            className="w-20 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-50"
            aria-label="Quantidade customizada de imóveis"
          />
          custom
        </label>
      </fieldset>

      {/* Cálculo */}
      <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-4 space-y-1">
        <p className="text-sm text-slate-400">
          Preço por imóvel: <strong className="text-slate-100">R$ {pricePerImovelMes.toFixed(2)}/mês</strong>
        </p>
        <p className="text-sm text-slate-400">
          Total mensal equivalente ({quantity} imóveis): <strong className="text-slate-100">R$ {totalMensalEquivalente.toFixed(2)}</strong>
        </p>
        <p className="text-base text-emerald-300">
          Cobrança no ciclo {cycleMeta.label.toLowerCase()}: <strong>R$ {totalNoCiclo.toFixed(2)}</strong>
        </p>
        {discount > 0 && (
          <p className="text-xs text-slate-500">
            Você economiza R$ {(pricePerImovelMes * 100 / (100 - discount) * quantity * cycleMeta.mesesNoCiclo - totalNoCiclo).toFixed(2)} no ciclo escolhido vs. mensal cheio.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubscribe}
        disabled={busy || pricePerImovelMes <= 0}
        className="w-full px-4 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? "Abrindo checkout…" : `Assinar — R$ ${totalNoCiclo.toFixed(2)} no ciclo`}
      </button>

      <ul className="space-y-1 text-sm text-slate-300">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-emerald-400">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
