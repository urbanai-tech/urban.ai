"use client";

/**
 * /plans/v2 — alias mantido por compatibilidade.
 *
 * Em 24/04/2026 a versão F6.5 do `PricingCalculatorV2` virou a oficial em
 * `/plans` (a página antiga foi substituída). Este arquivo redireciona
 * para evitar 404 em links históricos (p. ex. `?upsell=1`).
 */

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function PlansV2AliasPage() {
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    const qs = search.toString();
    router.replace(qs ? `/plans?${qs}` : "/plans");
  }, [router, search]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-8 flex items-center justify-center">
      <p className="text-slate-400">Redirecionando…</p>
    </main>
  );
}
