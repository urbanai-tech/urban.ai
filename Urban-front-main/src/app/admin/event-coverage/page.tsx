"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  fetchEventChanges,
  fetchEventCoverage,
  fetchEventLeadTime,
  type EventChangesSummary,
  type EventCoverageReport,
  type EventLeadTime,
} from "../../service/api";
import {
  AdminButton,
  AdminEmptyState,
  AdminPageLoading,
  AdminSectionHeader,
  AdminTabPanel,
  AdminTabs,
  Icons,
} from "../_components";
import { COVERAGE_TABS, parseCoverageTab, type CoverageTabId } from "./coverage-domain";
import CoberturaPanel from "./_panels/CoberturaPanel";
import MudancasPanel from "./_panels/MudancasPanel";
import QualidadePanel from "./_panels/QualidadePanel";
import RegionsPanel from "./_panels/RegionsPanel";
import "./event-coverage.css";

const TABS_ID = "ec";

/**
 * /admin/event-coverage — central de eventos: "os dados de eventos já são vendáveis?" (roadmap D6)
 * numa página só, em abas: Cobertura (meta, fontes, histograma), Qualidade (lacunas e lead time),
 * Regiões (CRUD de áreas de cobertura, antes em /admin/coverage) e Mudanças (remarcados, cancelados
 * e série diária). A aba ativa vive na URL (`?tab=`), então links e o redirect de /admin/coverage
 * caem na aba certa.
 */
export default function EventCoveragePage() {
  return (
    <Suspense fallback={<AdminPageLoading />}>
      <EventCoverageTabs />
    </Suspense>
  );
}

function EventCoverageTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseCoverageTab(searchParams.get("tab"));

  const [data, setData] = useState<EventCoverageReport | null>(null);
  const [leadTime, setLeadTime] = useState<EventLeadTime | null>(null);
  const [leadTimeError, setLeadTimeError] = useState(false);
  const [changes, setChanges] = useState<EventChangesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Lead time e resumo de mudanças são complementares: se falharem, a página abre mesmo assim.
    setLeadTimeError(false);
    void fetchEventLeadTime()
      .then(setLeadTime)
      .catch(() => {
        setLeadTime(null);
        setLeadTimeError(true);
      });
    void fetchEventChanges({ days: 30, limit: 1 })
      .then((r) => setChanges(r.summary))
      .catch(() => setChanges(null));
    try {
      setData(await fetchEventCoverage());
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; message?: string };
      const status = e?.response?.status;
      setError(status === 401 || status === 403 ? "Acesso negado." : e?.message || "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectTab = useCallback(
    (next: CoverageTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "cobertura") params.delete("tab");
      else params.set("tab", next);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const refreshable = tab !== "regioes" && tab !== "mudancas";
  const needsReport = tab === "cobertura" || tab === "qualidade";

  return (
    <div className="ec-page">
      <AdminSectionHeader
        eyebrow="ADMIN · MOTOR DE EVENTOS"
        title="Cobertura de eventos"
        subtitle="Eventos canônicos, ativos e futuros em São Paulo, contados em dias de São Paulo, contra a meta de venda. Cobertura, qualidade dos dados, regiões e mudanças num lugar só."
        actions={
          refreshable ? (
            <AdminButton
              variant="secondary"
              onClick={load}
              disabled={loading}
              leftIcon={<Icons.RefreshCw size={12} />}
            >
              {loading ? "Atualizando…" : "Atualizar"}
            </AdminButton>
          ) : undefined
        }
      />

      <AdminTabs
        tabs={COVERAGE_TABS}
        value={tab}
        onChange={selectTab}
        label="Seções da cobertura de eventos"
        idPrefix={TABS_ID}
      />

      <AdminTabPanel idPrefix={TABS_ID} tabId={tab}>
        {needsReport && loading && !data ? (
          <AdminPageLoading />
        ) : needsReport && (error || !data) ? (
          <AdminEmptyState
            eyebrow="Erro"
            title="Falha ao carregar"
            body={error ?? "Sem dados."}
            icon={<Icons.AlertCircle size={32} />}
            action={
              <AdminButton variant="primary" onClick={load}>
                Tentar novamente
              </AdminButton>
            }
          />
        ) : tab === "cobertura" && data ? (
          <CoberturaPanel
            data={data}
            leadTime={leadTime}
            changes={changes}
            onOpenTab={(next) => selectTab(next)}
          />
        ) : tab === "qualidade" && data ? (
          <QualidadePanel data={data} leadTime={leadTime} leadTimeError={leadTimeError} />
        ) : tab === "regioes" ? (
          <RegionsPanel />
        ) : tab === "mudancas" ? (
          <MudancasPanel />
        ) : null}
      </AdminTabPanel>
    </div>
  );
}
