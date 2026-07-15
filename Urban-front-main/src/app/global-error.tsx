"use client";

import * as Sentry from "@sentry/nextjs";
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
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <DomainErrorState domain="host" error={error} reset={reset} />
      </body>
    </html>
  );
}
