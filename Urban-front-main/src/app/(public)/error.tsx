"use client";

import { DomainErrorState } from "../componentes/errors/DomainErrorState";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DomainErrorState domain="public" error={error} reset={reset} />;
}
