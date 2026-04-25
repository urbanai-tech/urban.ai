"use client";

/**
 * /plans — página oficial de planos da Urban AI.
 *
 * Esta página implementa a matriz F6.5 (cobrança por imóvel × 4 ciclos
 * com desconto progressivo). A versão antiga (toggle binário mensal/anual)
 * foi descontinuada em 24/04/2026 — usuários ativos antes da migração
 * mantêm seus Stripe Price IDs originais via grandfathering, mas todos os
 * NOVOS checkouts passam por aqui.
 *
 * Para o conteúdo "raw" (sem layout marketing), ver `/plans/v2` que segue
 * existindo como alias técnico (mesmo componente).
 */

import { useEffect, useState } from "react";
import { getPlans, type Plan } from "../service/api";
import { PricingCalculatorV2 } from "../componentes/PricingCalculatorV2";

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlans()
      .then(setPlans)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 p-8 flex items-center justify-center">
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
            Pagamento seguro via Stripe. Cancele a qualquer momento — sem contrato.
            Mensal é flexibilidade pura, anual é o melhor custo-benefício.
          </p>
        </footer>
      </div>
    </main>
  );
}
