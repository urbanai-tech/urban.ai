"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppEmptyState,
  AppPageShell,
  AppSectionHeader,
  AppSelect,
  AppToastProvider,
  Icons,
  useAppToast,
} from "../componentes/ui";
import {
  fetchPortfolioCalendar,
  mutatePortfolioBulkAction,
  type PortfolioCalendarResponse,
  type PortfolioProperty as PortfolioApiProperty,
} from "../service/api";
import { PortfolioToolbar, type PortfolioToolbarAction } from "./components/PortfolioToolbar";
import { usePortfolioKeyboard } from "./usePortfolioKeyboard";

/**
 * Página `/portfolio` (Gap 1 — Track 2, semana 3-4).
 *
 * Shell + tela base: header editorial, filtros (date range + estratégia),
 * bulk action toolbar e o componente `<PortfolioCalendar>` (entregue em
 * paralelo por outro agente). Enquanto o calendar não chega, renderiza um
 * placeholder com `AppEmptyState`.
 *
 * Atalhos globais J/K/H/L são registrados pelo hook `usePortfolioKeyboard` —
 * o calendar real lê `activeProperty`/`activeDate` desse hook pra desenhar
 * foco e mover o cursor da grid.
 */

const STRATEGY_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "todas", label: "Todas estratégias" },
  { id: "conservadora", label: "Conservadora" },
  { id: "moderada", label: "Moderada" },
  { id: "agressiva", label: "Agressiva" },
  { id: "autonomous", label: "Autonomous" },
];

function isoDateAt(daysAhead: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function PortfolioPageContent() {
  const toast = useAppToast();
  const [from, setFrom] = useState<string>(() => isoDateAt(0));
  const [to, setTo] = useState<string>(() => isoDateAt(60));
  const [strategy, setStrategy] = useState<string>("todas");
  const [loading, setLoading] = useState<boolean>(true);
  const [bulkLoading, setBulkLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<PortfolioCalendarResponse>({ properties: [] });
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  // Carrega calendário inicial + reage a mudanças de filtro.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const data = await fetchPortfolioCalendar({ from, to, strategy });
        if (!cancelled) setResponse(data);
      } catch (err) {
        console.error("[/portfolio] erro carregando calendário", err);
        if (!cancelled) setResponse({ properties: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [from, to, strategy]);

  const properties = response.properties;
  const propertyCount = properties.length;
  const dateCount = properties[0]?.days.length ?? 0;

  // Atalhos J/K/H/L — o hook clampa quando os ranges mudam.
  const keyboard = usePortfolioKeyboard({ propertyCount, dateCount });

  // ID/data sob foco (derivados, expostos quando o calendar real plugar).
  const activeIds = useMemo(() => {
    const prop = properties[keyboard.activeProperty];
    const day = prop?.days[keyboard.activeDate];
    return {
      propertyId: prop?.propertyId ?? null,
      date: day?.date ?? null,
    };
  }, [properties, keyboard.activeProperty, keyboard.activeDate]);

  // Bulk action — chama a API e mostra toast.
  const handleBulkAction = useCallback(
    async (action: PortfolioToolbarAction) => {
      if (selected.size === 0) return;
      const propertyIds = Array.from(selected);
      const payload: Record<string, unknown> =
        action.type === "apply-strategy"
          ? { strategy: action.strategy }
          : action.type === "set-base-price"
            ? { price: action.price }
            : {};

      try {
        setBulkLoading(true);
        const result = await mutatePortfolioBulkAction({
          propertyIds,
          action: action.type,
          payload,
        });
        const label =
          action.type === "apply-strategy"
            ? `estratégia ${action.strategy}`
            : action.type === "set-base-price"
              ? `preço base R$ ${action.price.toLocaleString("pt-BR")}`
              : "sugestões aceitas";
        toast.success(
          `Aplicado em ${result.applied} imóvel${result.applied > 1 ? "s" : ""}`,
          `${label} • audit log ${result.auditLogId}`,
        );
        if (result.failed.length > 0) {
          toast.warn(
            `${result.failed.length} falha(s)`,
            result.failed.map((f) => f.reason).join("; "),
          );
        }
      } catch (err) {
        console.error("[/portfolio] bulk action falhou", err);
        toast.error(
          "Não foi possível aplicar",
          "Tente novamente em alguns segundos.",
        );
      } finally {
        setBulkLoading(false);
      }
    },
    [selected, toast],
  );

  const handleSelectAll = useCallback(() => {
    setSelected(new Set(properties.map((p: PortfolioApiProperty) => p.propertyId)));
  }, [properties]);

  const handleClearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  return (
    <AppPageShell maxWidth={1400}>
      <AppSectionHeader
        eyebrow="PORTFÓLIO · VISÃO CONSOLIDADA"
        title="Calendário do portfólio"
        subtitle="Veja preço sugerido vs atual em todos os seus imóveis lado a lado. Selecione linhas e aplique ações em lote em segundos. Use J/K pra navegar imóveis e H/L pra datas."
        actions={
          <div style={{ display: "inline-flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
            <DateRangeField
              label="De"
              value={from}
              max={to}
              onChange={setFrom}
            />
            <DateRangeField
              label="Até"
              value={to}
              min={from}
              onChange={setTo}
            />
            <div style={{ minWidth: 200 }}>
              <AppSelect
                label="Estratégia"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
              >
                {STRATEGY_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </AppSelect>
            </div>
          </div>
        }
      />

      <PortfolioToolbar
        selectedCount={selected.size}
        totalCount={propertyCount}
        onClearSelection={handleClearSelection}
        onSelectAll={handleSelectAll}
        onAction={handleBulkAction}
        loading={bulkLoading}
      />

      <PortfolioCalendarPlaceholder
        loading={loading}
        propertyCount={propertyCount}
        activePropertyId={activeIds.propertyId}
        activeDate={activeIds.date}
      />
    </AppPageShell>
  );
}

export default function PortfolioPage() {
  // O HostShell já provê AppToastProvider, mas garante caso a página seja
  // renderizada fora dele (testes, storybook).
  return (
    <AppToastProvider>
      <PortfolioPageContent />
    </AppToastProvider>
  );
}

/**
 * Placeholder enquanto o `<PortfolioCalendar>` (Dev 2 paralelo) não pluga.
 * Mostra contexto pro reviewer: quantos imóveis a API retornou, qual linha/data
 * o teclado está focando — quando o componente real chegar, é só trocar este
 * import.
 */
function PortfolioCalendarPlaceholder({
  loading,
  propertyCount,
  activePropertyId,
  activeDate,
}: {
  loading: boolean;
  propertyCount: number;
  activePropertyId: string | null;
  activeDate: string | null;
}) {
  if (loading) {
    return (
      <div
        style={{
          padding: "48px 24px",
          textAlign: "center",
          color: "var(--app-text-muted)",
          fontSize: 13,
          border: "1px dashed var(--app-divider-strong)",
          borderRadius: 12,
        }}
      >
        Carregando portfólio…
      </div>
    );
  }
  if (propertyCount === 0) {
    return (
      <AppEmptyState
        eyebrow="SEM IMÓVEIS"
        title="Cadastre 2 ou mais imóveis"
        body="A visão consolidada de portfólio é mais útil com pelo menos 2 imóveis pra comparar preço, ocupação e sugestões lado a lado."
        icon={<Icons.Layers size={32} />}
      />
    );
  }
  return (
    <AppEmptyState
      eyebrow="EM CONSTRUÇÃO"
      title="PortfolioCalendar virá aqui — outro agente trabalhando"
      body={
        <span>
          {propertyCount} imóvel{propertyCount > 1 ? "s" : ""} no range •{" "}
          {activePropertyId ? `foco: ${activePropertyId}` : "sem foco"} •{" "}
          {activeDate ? `data ${activeDate}` : "sem data"}
        </span>
      }
      icon={<Icons.Calendar size={32} />}
    />
  );
}

function DateRangeField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <label style={{ display: "block" }}>
      <span
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "var(--app-text-muted)",
          marginBottom: 6,
        }}
      >
        {label}
      </span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 40,
          padding: "0 14px",
          background: "var(--app-surface)",
          border: "1px solid var(--app-divider-strong)",
          borderRadius: 10,
          color: "var(--app-text)",
          fontSize: 14,
          fontWeight: 400,
          outline: "none",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      />
    </label>
  );
}
