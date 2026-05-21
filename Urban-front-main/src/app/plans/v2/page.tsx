"use client";

/**
 * /plans/v2 - alias mantido por compatibilidade.
 *
 * Em 24/04/2026 a versao F6.5 do `PricingCalculatorV2` virou a oficial em
 * `/plans` (a pagina antiga foi substituida). Este arquivo redireciona
 * para evitar 404 em links historicos (p. ex. `?upsell=1`).
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
    <main
      style={{
        minHeight: "100vh",
        background: "#080A0F",
        color: "#F8FAFC",
        padding: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <p style={{ margin: 0, color: "rgba(248,250,252,0.62)" }}>
        Redirecionando...
      </p>
    </main>
  );
}
