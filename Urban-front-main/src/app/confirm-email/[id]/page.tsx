"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  CONFIRM_EMAIL_PATH,
  safeDecodeSegment,
  scrubCurrentUrl,
  stashPendingEmail,
} from "@/app/lib/auth-links";

/**
 * @deprecated Rota LEGADA `/confirm-email/<email>` (e-mail no path = PII em
 * histórico, logs, Referer, Sentry e analytics). Guarda o e-mail em
 * sessionStorage, limpa o path e segue para `/confirm-email`. Pode sair quando
 * não houver mais links/abas antigas apontando para cá.
 */
export default function LegacyConfirmEmailRoute() {
  const params = useParams();
  const router = useRouter();
  const raw = params?.id;
  const email = safeDecodeSegment(Array.isArray(raw) ? raw[0] : raw);

  useEffect(() => {
    scrubCurrentUrl(CONFIRM_EMAIL_PATH);
    stashPendingEmail(email);
    router.replace(CONFIRM_EMAIL_PATH);
  }, [router, email]);

  return null;
}
