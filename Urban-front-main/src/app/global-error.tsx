"use client";

import { useEffect } from "react";
import { DomainErrorState } from "./componentes/errors/DomainErrorState";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Import dinâmico: o global-error entra no JS de todas as páginas, e o SDK
    // estático colocava ~15 KB gzip do Sentry no caminho crítico do site público.
    void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <DomainErrorState domain="host" error={error} reset={reset} />
      </body>
    </html>
  );
}
