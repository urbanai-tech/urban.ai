"use client";

import { DomainErrorState } from "./componentes/errors/DomainErrorState";

export default function HostError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DomainErrorState domain="host" error={error} reset={reset} />;
}
