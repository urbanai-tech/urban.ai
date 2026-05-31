"use client";

import React from "react";
import {
  AppButton,
  AppPageShell,
  AppSectionHeader,
  Icons,
} from "@/app/componentes/ui";
import { fetchPortfolioActionRuns, type PortfolioActionRun } from "@/app/service/api";
import { PortfolioActionRuns } from "../components/PortfolioActionRuns";

export default function PortfolioHistoryPage() {
  const [runs, setRuns] = React.useState<PortfolioActionRun[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadCount, setReloadCount] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    async function loadRuns() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchPortfolioActionRuns(50);
        if (!cancelled) setRuns(data);
      } catch (err) {
        console.error("[/portfolio/history] erro carregando histórico", err);
        if (!cancelled) setError("Não foi possível carregar o histórico agora.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadRuns();
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  return (
    <AppPageShell maxWidth={1100}>
      <AppSectionHeader
        eyebrow="AUDITORIA"
        title="Histórico de preços e aceites"
        subtitle="Registro dedicado das simulações confirmadas, aceites e aplicações realizadas no portfólio."
        actions={
          <AppButton as="a" href="/portfolio" variant="secondary" leftIcon={<Icons.ArrowLeft size={13} />}>
            Voltar ao cockpit
          </AppButton>
        }
      />

      <PortfolioActionRuns
        runs={runs}
        loading={loading}
        error={error}
        onRefresh={() => setReloadCount((count) => count + 1)}
      />
    </AppPageShell>
  );
}
