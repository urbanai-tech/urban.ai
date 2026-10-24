"use client";

import { useEffect } from "react";
import { invalidateSubscriptionCache } from "../context/subscription-status";
import { parseCheckoutReturn } from "../lib/checkout";
import { useToastCompat } from "./ui";

/**
 * Aviso claro ao voltar do checkout do Stripe (SUCCESS_URL/CANCEL_URL levam
 * `?checkout=success` para /my-plan e `?checkout=canceled` para /plans).
 */
export function useCheckoutReturnNotice(expected: "success" | "canceled") {
  const toast = useToastCompat();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const result = parseCheckoutReturn(window.location.search);
    if (result !== expected) return;

    if (result === "success") {
      invalidateSubscriptionCache(); // próximo guard consulta o plano novo
      toast("Pagamento recebido! Estamos ativando seu plano. Se ele ainda não aparecer, atualize a página em instantes.", {
        type: "success",
      });
    } else {
      toast("Checkout cancelado. Nenhuma cobrança foi feita. Você pode escolher um plano quando quiser.", {
        type: "info",
      });
    }

    // Evita repetir o aviso em reload/voltar.
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    window.history.replaceState(null, "", url.pathname + (url.search || "") + url.hash);
  }, [expected, toast]);
}
