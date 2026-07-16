"use client";

import { DomainErrorState } from "../componentes/errors/DomainErrorState";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DomainErrorState domain="admin" error={error} reset={reset} />;
}
