"use client";

import { useEffect, useState } from "react";
import { getPlans, type Plan } from "../../service/api";
import { PricingCalculatorV2 } from "../../componentes/PricingCalculatorV2";

/**
 * /plans/v2 — nova UI da matriz de preços F6.5.
 *
 * Coexiste com /plans (toggle binário mensal/anual) durante o grandfathering.
 * Após a migração dos usuários ativos, /plans pode redirecionar para /plans/v2.
 */
export default function PlansV2Page() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlans()
      .then(setPlans)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
        <p className="text-slate-400">Carregando planos…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-10">
        <header className="text-center space-y-3">
          <h1 className="text-4xl md:text-5xl font-extrabold">
            Preço justo: <span className="text-emerald-400">cobrado por imóvel.</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Comece com 1 imóvel ou comece com 10 — você só paga pelo que conecta. Ciclos longos têm desconto progressivo.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans
            .filter((p) => p.isActive)
            .map((plan) => (
              <PricingCalculatorV2 key={plan.id} plan={plan} />
            ))}
        </section>

        <footer className="text-center text-sm text-slate-500 max-w-2xl mx-auto">
          <p>
            Pagamento seguro via Stripe. Cancele a qualquer momento — você não fica preso a contrato.
            Mensal é flexibilidade pura, anual é o melhor custo-benefício.
          </p>
        </footer>
      </div>
    </main>
  );
}
