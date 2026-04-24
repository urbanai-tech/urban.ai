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
      <div role="alert" className="p-4 border border-red-700 rounded-lg bg-red-950/40 text-red-300 text-sm">
        Não foi possível verificar sua quota de imóveis ({error}). Recarregue a página ou contate o suporte.
      </div>
    );
  }

  if (!quota || quota.podeAdicionar) {
    return <>{children}</>;
  }

  // Quota cheia — bloqueia e mostra upsell
  return (
    <div className="p-6 border border-amber-700/60 rounded-2xl bg-amber-950/30 space-y-3">
      <h3 className="text-lg font-bold text-amber-300">
        Quota de imóveis atingida
      </h3>
      <p className="text-slate-300 text-sm">
        Você contratou <strong>{quota.contratados}</strong> imóveis e já tem <strong>{quota.ativos}</strong> ativos.
        Para cadastrar mais um, atualize sua assinatura aumentando a quantidade.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onUpsellClick}
          className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold"
        >
          Aumentar minha quota
        </button>
        <a
          href="mailto:suporte@myurbanai.com"
          className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800/50"
        >
          Falar com suporte
        </a>
      </div>
    </div>
  );
}
