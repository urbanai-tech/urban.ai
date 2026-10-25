"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  PENDING_RESET_TOKEN_KEY,
  RESET_PASSWORD_PATH,
  safeDecodeSegment,
  scrubCurrentUrl,
} from "@/app/lib/auth-links";

/**
 * @deprecated Rota LEGADA `/reset-password/<token>` (token no path vaza para
 * histórico, logs, Referer, Sentry e analytics). Mantida só para os e-mails já
 * enviados: tira o token do path imediatamente (replaceState) e entrega ao
 * formulário em `/reset-password`. REMOVER após o TTL do token (30 min) desde o
 * deploy do novo formato de link (`/reset-password#token=...`).
 */
export default function LegacyResetPasswordRoute() {
  const params = useParams();
  const router = useRouter();
  const raw = params?.id;
  const token = safeDecodeSegment(Array.isArray(raw) ? raw[0] : raw);

  useEffect(() => {
    // Primeiro limpa a URL, depois entrega o token por sessionStorage (só até o formulário ler).
    scrubCurrentUrl(RESET_PASSWORD_PATH);
    try {
      if (token) window.sessionStorage.setItem(PENDING_RESET_TOKEN_KEY, token);
    } catch {
      /* sem storage: o formulário mostra "link incompleto" e o usuário pede outro */
    }
    router.replace(RESET_PASSWORD_PATH);
  }, [router, token]);

  return null;
}
