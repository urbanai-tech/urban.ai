"use client";

import { useEffect, useState } from "react";
import { fetchListingsQuota, type ListingsQuota } from "../service/api";

/**
 * F6.5 — Guard de quota de imóveis.
 *
 * Renderiza children apenas se `quota.podeAdicionar === true`. Caso contrário,
 * exibe modal/CTA de upsell pedindo ao usuário ampliar a subscription antes
 * de cadastrar mais um imóvel.
 *
 * Uso:
 *   <ListingsQuotaGuard onUpsellClick={() => router.push('/plans/v2?upsell=1')}>
 *     <NovoImovelForm />
 *   </ListingsQuotaGuard>
 *
 * Esse componente é leve por design: não lida com sub-fluxo de mudança de
 * subscription no Stripe, apenas redireciona para `/plans/v2` (ou rota equivalente).
 * O fluxo completo de "atualizar quantity" é responsabilidade do Stripe Customer
 * Portal ou de uma página dedicada que ainda será implementada em F6.5 #7.
 */

interface Props {
  children: React.ReactNode;
  onUpsellClick?: () => void;
  fallback?: React.ReactNode;
}

export function ListingsQuotaGuard({ children, onUpsellClick, fallback }: Props) {
  const [quota, setQuota] = useState<ListingsQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchListingsQuota()
      .then((q) => setQuota(q))
      .catch((err) => setError((err as Error)?.message || "Erro ao verificar quota."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return fallback ?? null;
  }

  if (error) {
    return (
      <div
        role="alert"
        style={{
          padding: 16,
          border: "1px solid rgba(194,52,46,0.28)",
          borderRadius: 8,
          background: "rgba(194,52,46,0.08)",
          color: "#C2342E",
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        Não foi possível verificar sua quota de imóveis ({error}). Recarregue a página ou contate o suporte.
      </div>
    );
  }

  if (!quota || quota.podeAdicionar) {
    return <>{children}</>;
  }

  // Quota cheia — bloqueia e mostra upsell
  return (
    <div
      className="urban-app"
      style={{
        padding: 24,
        border: "1px solid rgba(200,129,14,0.26)",
        borderRadius: 12,
        background: "rgba(200,129,14,0.08)",
        color: "var(--app-text)",
      }}
    >
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 750, color: "var(--app-warning)" }}>
        Quota de imóveis atingida
      </h3>
      <p style={{ margin: "12px 0 0", color: "var(--app-text-dim)", fontSize: 14, lineHeight: 1.6 }}>
        Você contratou <strong>{quota.contratados}</strong> imóveis e já tem <strong>{quota.ativos}</strong> ativos.
        Para cadastrar mais um, atualize sua assinatura aumentando a quantidade.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
        <button
          type="button"
          onClick={onUpsellClick}
          style={{
            minHeight: 40,
            padding: "0 16px",
            border: "1px solid var(--app-accent)",
            borderRadius: 10,
            background: "var(--app-accent)",
            color: "#FFFFFF",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Aumentar minha quota
        </button>
        <a
          href="mailto:suporte@myurbanai.com"
          style={{
            minHeight: 40,
            padding: "0 16px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid var(--app-divider-strong)",
            borderRadius: 10,
            color: "var(--app-text)",
            textDecoration: "none",
            fontWeight: 650,
          }}
        >
          Falar com suporte
        </a>
      </div>
    </div>
  );
}
