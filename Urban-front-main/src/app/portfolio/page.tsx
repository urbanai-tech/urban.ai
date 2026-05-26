"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppEmptyState,
  AppPageShell,
  AppSectionHeader,
  AppSelect,
  AppToastProvider,
  Icons,
  PortfolioCalendar,
  useAppToast,
} from "../componentes/ui";
import { dateAtLocalOffset, formatLocalDate } from "../lib/date";
import {
  fetchPortfolioActionRuns,
  fetchPortfolioCalendar,
  fetchPortfolioOpportunities,
  mutatePortfolioBulkAction,
  simulatePortfolioAction,
  type PortfolioActionRun,
  type PortfolioActionSimulationResponse,
  type PortfolioBulkActionInput,
  type PortfolioCalendarResponse,
  type PortfolioOpportunity,
  type PortfolioProperty as PortfolioApiProperty,
} from "../service/api";
import { ActionSimulationDialog } from "./components/ActionSimulationDialog";
import { OpportunityRanking, type PortfolioOpportunityRankingItem } from "./components/OpportunityRanking";
import { PortfolioActionRuns } from "./components/PortfolioActionRuns";
import { PortfolioCockpit, type PortfolioCockpitMetrics } from "./components/PortfolioCockpit";
import { PortfolioToolbar, type PortfolioToolbarAction } from "./components/PortfolioToolbar";
import { usePortfolioKeyboard } from "./usePortfolioKeyboard";

const STRATEGY_OPTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "todas", label: "Todos os modos" },
  { id: "conservadora", label: "Conservadora" },
  { id: "moderada", label: "Moderada" },
  { id: "agressiva", label: "Agressiva" },
  { id: "autonomous", label: "Automatico" },
];

const RANGE_OPTIONS = [30, 60, 90, 180, 360] as const;

function isoDateAt(daysAhead: number): string {
  return formatLocalDate(dateAtLocalOffset(daysAhead));
}

function isoDateFrom(startIso: string, daysAhead: number): string {
  const start = new Date(`${startIso}T00:00:00`);
  start.setDate(start.getDate() + daysAhead);
  return formatLocalDate(start);
}

function daysBetween(fromIso: string, toIso: string): number | null {
  const fromDate = new Date(`${fromIso}T00:00:00`);
  const toDate = new Date(`${toIso}T00:00:00`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return null;
  return Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
}

function formatShortDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function signalNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["value", "score", "amount", "percent", "percentage"]) {
      if (typeof obj[key] === "number") return obj[key] as number;
    }
  }
  return 0;
}

function levelToPercent(value: unknown): number | null {
  if (typeof value === "number") return value <= 3 ? Math.round((value / 3) * 100) : value;
  if (value && typeof value === "object") {
    const signal = signalNumber(value);
    return signal > 0 ? signal : null;
  }
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  if (normalized.includes("alta")) return 85;
  if (normalized.includes("media")) return 60;
  if (normalized.includes("baixa")) return 30;
  return null;
}

function strategyName(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const strategy = (value as Record<string, unknown>).strategy;
    return typeof strategy === "string" ? strategy : null;
  }
  return null;
}

function normalizeOpportunity(input: PortfolioOpportunity): PortfolioOpportunityRankingItem | null {
  const propertyId = String(input.propertyId ?? "");
  if (!propertyId) return null;
  const dates = Array.from(
    new Set(
      [
        input.date,
        ...(input.dates ?? []),
        ...(input.recommendedDates ?? []),
        ...(input.targetDates ?? []),
      ].filter(Boolean) as string[],
    ),
  );
  const currentPrice = typeof input.currentPrice === "number" ? input.currentPrice : null;
  const suggestedPrice = typeof input.suggestedPrice === "number" ? input.suggestedPrice : null;
  const liftAmount =
    typeof input.lift === "number"
      ? input.lift
      : signalNumber(input.lift) ||
        (currentPrice != null && suggestedPrice != null ? Math.max(0, suggestedPrice - currentPrice) : 0);
  return {
    id: input.id ?? `${propertyId}:${dates.join(",") || "opportunity"}`,
    propertyId,
    propertyName: input.propertyName ?? "Imovel",
    title: input.title ?? `${input.propertyName ?? "Imovel"} com lift potencial`,
    reason: input.reason ?? input.description ?? input.recommendedAction ?? null,
    dates,
    currentPrice,
    suggestedPrice,
    liftAmount,
    liftPercent:
      currentPrice && liftAmount
        ? Number(((liftAmount / currentPrice) * 100).toFixed(1))
        : null,
    risk: levelToPercent(input.risk),
    confidence: levelToPercent(input.confidence),
    strategyApplied: strategyName(input.strategyApplied),
    score: signalNumber(input.opportunity),
  };
}

function normalizeCalendarOpportunity(
  property: PortfolioApiProperty,
  day: PortfolioApiProperty["days"][number],
): PortfolioOpportunityRankingItem | null {
  const currentPrice = Number(day.atual ?? 0);
  const suggestedPrice = day.sugestao == null ? null : Number(day.sugestao);
  const liftFromSignal = signalNumber(day.lift);
  const liftAmount =
    liftFromSignal ||
    (suggestedPrice != null ? Math.max(0, suggestedPrice - currentPrice) : 0);
  const opportunityScore = signalNumber(day.opportunity);

  if (!day.opportunity && liftAmount <= 0 && opportunityScore <= 0) return null;

  const opportunity =
    day.opportunity && typeof day.opportunity === "object"
      ? (day.opportunity as Record<string, unknown>)
      : {};

  return {
    id: `${property.propertyId}:${day.date}`,
    propertyId: property.propertyId,
    propertyName: property.name,
    title:
      typeof opportunity.title === "string"
        ? opportunity.title
        : day.evento
          ? `Capturar demanda: ${day.evento.nome}`
          : `${property.name} com lift potencial`,
    reason:
      typeof opportunity.reason === "string"
        ? opportunity.reason
        : typeof opportunity.description === "string"
          ? opportunity.description
          : day.evento
            ? "Evento proximo pressiona demanda."
            : null,
    dates: [day.date],
    currentPrice,
    suggestedPrice,
    liftAmount,
    liftPercent:
      currentPrice && liftAmount
        ? Number(((liftAmount / currentPrice) * 100).toFixed(1))
        : null,
    risk: levelToPercent(day.risk ?? opportunity.risk),
    confidence: levelToPercent(day.confidence ?? opportunity.confidence),
    strategyApplied: strategyName(day.strategyApplied ?? property.strategyApplied),
    score: opportunityScore,
  };
}

function isEndpointUnavailable(error: unknown): boolean {
  const status = (error as any)?.response?.status;
  return status === 404 || status === 405 || status === 501;
}

function buildLocalSimulation(
  properties: PortfolioApiProperty[],
  input: PortfolioBulkActionInput,
  action: PortfolioToolbarAction,
): PortfolioActionSimulationResponse {
  const payload = input.payload ?? {};
  const targets = Array.isArray(payload.targets)
    ? (payload.targets as Array<{ propertyId?: string; date?: string }>)
    : [];
  const targetKeys = new Set(
    targets
      .filter((target) => target.propertyId && target.date)
      .map((target) => `${target.propertyId}|${target.date}`),
  );
  const selectedProperties = new Set(input.propertyIds);
  const affectedDays = properties.flatMap((property) => {
    if (!selectedProperties.has(property.propertyId)) return [];
    return property.days.filter((day) => {
      return targetKeys.size === 0 || targetKeys.has(`${property.propertyId}|${day.date}`);
    });
  });

  const before = affectedDays.reduce((sum, day) => sum + Number(day.atual ?? 0), 0);
  const after = affectedDays.reduce((sum, day) => {
    if (action.type === "set-base-price" || action.type === "set-date-price") {
      return sum + action.price;
    }
    return sum + Number(day.sugestao ?? day.atual ?? 0);
  }, 0);

  return {
    before: {
      projectedRevenue: before,
      changedDays: affectedDays.length,
      changedProperties: input.propertyIds.length,
    },
    after: {
      projectedRevenue: after,
      changedDays: affectedDays.length,
      changedProperties: input.propertyIds.length,
    },
    applied: action.type === "set-date-price" ? affectedDays.length : input.propertyIds.length,
    failed: [],
    simulated: false,
  };
}

type InspectedPortfolioCell = {
  propertyId: string;
  date: string;
};

type PortfolioDayDetail = {
  propertyId: string;
  propertyName: string;
  date: string;
  currentPrice: number;
  suggestedPrice: number | null;
  liftAmount: number;
  liftPercent: number | null;
  event: PortfolioApiProperty["days"][number]["evento"];
  strategy: string | null;
  confidence: number | null;
  risk: number | null;
  selected: boolean;
};

function PortfolioPageContent() {
  const toast = useAppToast();
  const [from, setFrom] = useState<string>(() => isoDateAt(0));
  const [to, setTo] = useState<string>(() => isoDateAt(59));
  const [rangeDays, setRangeDays] = useState<number>(60);
  const [strategy, setStrategy] = useState<string>("todas");
  const [loading, setLoading] = useState<boolean>(true);
  const [bulkLoading, setBulkLoading] = useState<boolean>(false);
  const [runsLoading, setRunsLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<PortfolioCalendarResponse>({ properties: [] });
  const [opportunities, setOpportunities] = useState<PortfolioOpportunity[]>([]);
  const [opportunitySummary, setOpportunitySummary] = useState<Record<string, unknown> | null>(null);
  const [actionRuns, setActionRuns] = useState<PortfolioActionRun[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [selectedDayKeys, setSelectedDayKeys] = useState<Set<string>>(() => new Set());
  const [inspectedCell, setInspectedCell] = useState<InspectedPortfolioCell | null>(null);
  const [pendingAction, setPendingAction] = useState<PortfolioToolbarAction | null>(null);
  const [simulation, setSimulation] = useState<PortfolioActionSimulationResponse | null>(null);
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setLoadError(null);
        const calendar = await fetchPortfolioCalendar({ from, to, strategy });
        let opportunityData: { opportunities: PortfolioOpportunity[]; summary?: Record<string, unknown> | null };
        let runs: PortfolioActionRun[];

        try {
          opportunityData = await fetchPortfolioOpportunities({ from, to, strategy });
        } catch (err) {
          if (!isEndpointUnavailable(err)) {
            console.warn("[/portfolio] oportunidades indisponiveis; usando calendario", err);
          }
          opportunityData = {
            opportunities: calendar.opportunities ?? [],
            summary: calendar.summary ?? null,
          };
        }

        try {
          runs = await fetchPortfolioActionRuns(8);
        } catch (err) {
          console.warn("[/portfolio] action runs indisponiveis", err);
          runs = calendar.actionRuns ?? [];
          if (!cancelled) setRunsError("Historico indisponivel no momento.");
        }

        if (!cancelled) {
          setResponse(calendar);
          setOpportunities(opportunityData.opportunities ?? []);
          setOpportunitySummary(opportunityData.summary ?? null);
          setActionRuns(runs);
          if (runs.length > 0) setRunsError(null);
        }
      } catch (err) {
        console.error("[/portfolio] erro carregando cockpit", err);
        if (!cancelled) {
          setLoadError("Nao foi possivel carregar o cockpit do portfolio agora.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [from, to, strategy, reloadCount]);

  const properties = response.properties;
  const propertyCount = properties.length;
  const dateCount = properties[0]?.days.length ?? 0;

  useEffect(() => {
    const validPropertyIds = new Set(properties.map((p) => p.propertyId));
    const validDayKeys = new Set(
      properties.flatMap((p) => p.days.map((day) => `${p.propertyId}|${day.date}`)),
    );
    setSelected((prev) => {
      const next = new Set(Array.from(prev).filter((propertyId) => validPropertyIds.has(propertyId)));
      return next.size === prev.size ? prev : next;
    });
    setSelectedDayKeys((prev) => {
      const next = new Set(Array.from(prev).filter((key) => validDayKeys.has(key)));
      return next.size === prev.size ? prev : next;
    });
  }, [properties]);

  const { activeProperty, activeDate, moveTo } = usePortfolioKeyboard({
    propertyCount,
    dateCount,
    disabled: true,
  });

  const activeIds = useMemo(() => {
    const prop = properties[activeProperty];
    const day = prop?.days[activeDate];
    return {
      propertyId: prop?.propertyId ?? null,
      date: day?.date ?? null,
    };
  }, [properties, activeProperty, activeDate]);

  const rankingItems = useMemo(() => {
    const fromEndpoint = opportunities
      .map(normalizeOpportunity)
      .filter(Boolean) as PortfolioOpportunityRankingItem[];
    const items =
      fromEndpoint.length > 0
        ? fromEndpoint
        : properties.flatMap((property) =>
            property.days
              .map((day) => normalizeCalendarOpportunity(property, day))
              .filter(Boolean) as PortfolioOpportunityRankingItem[],
          );
    return items.sort(
      (a, b) => (b.liftAmount ?? b.liftPercent ?? b.score ?? 0) - (a.liftAmount ?? a.liftPercent ?? a.score ?? 0),
    );
  }, [opportunities, properties]);

  const selectedDayDetail = useMemo<PortfolioDayDetail | null>(() => {
    if (!inspectedCell) return null;
    const property = properties.find((item) => item.propertyId === inspectedCell.propertyId);
    const day = property?.days.find((item) => item.date === inspectedCell.date);
    if (!property || !day) return null;
    const currentPrice = Number(day.atual ?? 0);
    const suggestedPrice = day.sugestao == null ? null : Number(day.sugestao);
    const liftAmount =
      signalNumber(day.lift) ||
      (suggestedPrice != null ? Math.max(0, suggestedPrice - currentPrice) : 0);
    return {
      propertyId: property.propertyId,
      propertyName: property.name,
      date: day.date,
      currentPrice,
      suggestedPrice,
      liftAmount,
      liftPercent:
        currentPrice && liftAmount
          ? Number(((liftAmount / currentPrice) * 100).toFixed(1))
          : null,
      event: day.evento,
      strategy: strategyName(day.strategyApplied ?? property.strategyApplied),
      confidence: levelToPercent(day.confidence ?? property.confidence),
      risk: levelToPercent(day.risk ?? property.risk),
      selected: selectedDayKeys.has(`${property.propertyId}|${day.date}`),
    };
  }, [inspectedCell, properties, selectedDayKeys]);

  const metrics = useMemo<PortfolioCockpitMetrics>(() => {
    const days = properties.flatMap((property) => property.days);
    const currentRevenue = days.reduce((sum, day) => sum + Number(day.atual ?? 0), 0);
    const suggestedRevenue = days.reduce(
      (sum, day) => sum + Number(day.sugestao ?? day.atual ?? 0),
      0,
    );
    const liftAmount = Math.max(0, suggestedRevenue - currentRevenue);
    const confidenceValues = rankingItems.map((item) => item.confidence).filter((v): v is number => v != null);
    const riskValues = rankingItems.map((item) => item.risk).filter((v): v is number => v != null);
    const summaryLift = signalNumber(opportunitySummary?.estimatedLift);
    const topLift = signalNumber(opportunitySummary?.topLift) || rankingItems[0]?.liftAmount || null;
    return {
      currentRevenue,
      suggestedRevenue,
      liftAmount: summaryLift || liftAmount,
      liftPercent: currentRevenue ? Number((((summaryLift || liftAmount) / currentRevenue) * 100).toFixed(1)) : null,
      opportunityCount: Number(opportunitySummary?.opportunities ?? rankingItems.length),
      averageRisk: riskValues.length
        ? Math.round(riskValues.reduce((sum, value) => sum + value, 0) / riskValues.length)
        : levelToPercent(opportunitySummary?.averageRisk),
      averageConfidence: confidenceValues.length
        ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length)
        : null,
      maxLiftAmount: topLift,
      maxLiftPercent: rankingItems[0]?.liftPercent ?? null,
      rangeLabel: `${rangeDays} dias`,
      dateLabel: `${formatShortDate(from)} ate ${formatShortDate(to)}`,
    };
  }, [from, opportunitySummary, properties, rangeDays, rankingItems, to]);

  const handleToggleSelect = useCallback((propertyId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(propertyId)) next.delete(propertyId);
      else next.add(propertyId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(
    (shouldSelect = true) => {
      setSelected(
        shouldSelect
          ? new Set(properties.map((p: PortfolioApiProperty) => p.propertyId))
          : new Set(),
      );
    },
    [properties],
  );

  const handleClearSelection = useCallback(() => {
    setSelected(new Set());
    setSelectedDayKeys(new Set());
  }, []);

  const handleRetryLoad = useCallback(() => {
    setReloadCount((count) => count + 1);
  }, []);

  const handleRefreshRuns = useCallback(async () => {
    try {
      setRunsLoading(true);
      setRunsError(null);
      setActionRuns(await fetchPortfolioActionRuns(8));
    } catch (err) {
      console.error("[/portfolio] historico falhou", err);
      setRunsError("Nao foi possivel atualizar o historico agora.");
    } finally {
      setRunsLoading(false);
    }
  }, []);

  const handleRangeChange = useCallback(
    (nextRange: number) => {
      setRangeDays(nextRange);
      setTo(isoDateFrom(from, Math.max(0, nextRange - 1)));
    },
    [from],
  );

  const handleFromChange = useCallback(
    (value: string) => {
      setFrom(value);
      setTo(isoDateFrom(value, Math.max(0, rangeDays - 1)));
    },
    [rangeDays],
  );

  const handleToChange = useCallback(
    (value: string) => {
      setTo(value);
      const diff = daysBetween(from, value);
      if (diff && RANGE_OPTIONS.includes(diff as (typeof RANGE_OPTIONS)[number])) {
        setRangeDays(diff);
      }
    },
    [from],
  );

  const handleMoveActive = useCallback(
    (next: { propertyId: string; date: string }) => {
      const propertyIndex = properties.findIndex((p) => p.propertyId === next.propertyId);
      const dateIndex =
        propertyIndex >= 0
          ? properties[propertyIndex].days.findIndex((d) => d.date === next.date)
          : -1;

      moveTo({
        property: propertyIndex >= 0 ? propertyIndex : undefined,
        date: dateIndex >= 0 ? dateIndex : undefined,
      });
    },
    [moveTo, properties],
  );

  const handleDayClick = useCallback(
    (propertyId: string, date: string) => {
      handleMoveActive({ propertyId, date });
      setSelected((prev) => new Set(prev).add(propertyId));
      setSelectedDayKeys((prev) => {
        const next = new Set(prev);
        const key = `${propertyId}|${date}`;
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });

      const property = properties.find((item) => item.propertyId === propertyId);
      const day = property?.days.find((item) => item.date === date);
      const hasActionableDetail =
        Boolean(day?.evento) ||
        day?.sugestao != null ||
        signalNumber(day?.lift) > 0 ||
        signalNumber(day?.opportunity) > 0;
      if (hasActionableDetail) {
        setInspectedCell({ propertyId, date });
      }
    },
    [handleMoveActive, properties],
  );

  const handleOpportunitySelect = useCallback(
    (item: PortfolioOpportunityRankingItem) => {
      setSelected((prev) => new Set(prev).add(item.propertyId));
      setSelectedDayKeys((prev) => {
        const next = new Set(prev);
        const allSelected = item.dates.length > 0 && item.dates.every((date) => next.has(`${item.propertyId}|${date}`));
        for (const date of item.dates) {
          const key = `${item.propertyId}|${date}`;
          if (allSelected) next.delete(key);
          else next.add(key);
        }
        return next;
      });
      if (item.dates[0]) {
        handleMoveActive({ propertyId: item.propertyId, date: item.dates[0] });
      }
    },
    [handleMoveActive],
  );

  const buildBulkInput = useCallback(
    (action: PortfolioToolbarAction) => {
      const propertyIds = Array.from(
        new Set([
          ...Array.from(selected),
          ...Array.from(selectedDayKeys).map((key) => key.split("|")[0]),
        ]),
      );
      const dates = Array.from(
        new Set(Array.from(selectedDayKeys).map((key) => key.split("|")[1]).filter(Boolean)),
      ).sort();
      const targets = Array.from(selectedDayKeys)
        .map((key) => {
          const [propertyId, date] = key.split("|");
          return propertyId && date ? { propertyId, date } : null;
        })
        .filter((target): target is { propertyId: string; date: string } => Boolean(target));
      const payload: Record<string, unknown> =
        action.type === "apply-strategy"
          ? { strategy: action.strategy }
          : action.type === "set-base-price" || action.type === "set-date-price"
            ? { price: action.price }
            : {};
      if (targets.length > 0) payload.targets = targets;
      if (action.type === "apply-internal") payload.applyInternally = true;
      const backendAction = action.type === "apply-internal" ? "accept-suggestions" : action.type;
      return {
        propertyIds,
        action: backendAction,
        payload,
        dates: dates.length > 0 ? dates : undefined,
        from,
        to,
      };
    },
    [from, selected, selectedDayKeys, to],
  );

  const handleBulkAction = useCallback(
    async (action: PortfolioToolbarAction) => {
      const input = buildBulkInput(action);
      if (input.propertyIds.length === 0) return;
      if (action.type === "set-date-price" && !input.dates?.length) {
        toast.warn("Marque ao menos uma data", "Clique numa celula ou selecione uma oportunidade do ranking.");
        return;
      }
      try {
        setBulkLoading(true);
        let preview: PortfolioActionSimulationResponse;
        try {
          preview = await simulatePortfolioAction(input);
        } catch (err) {
          if (!isEndpointUnavailable(err)) throw err;
          preview = buildLocalSimulation(properties, input, action);
        }
        setPendingAction(action);
        setSimulation(preview);
        setSimulationOpen(true);
      } catch (err) {
        console.error("[/portfolio] simulacao falhou", err);
        toast.error("Nao foi possivel simular", "Tente novamente em alguns segundos.");
      } finally {
        setBulkLoading(false);
      }
    },
    [buildBulkInput, properties, toast],
  );

  const handleConfirmSimulation = useCallback(async () => {
    if (!pendingAction) return;
    try {
      setBulkLoading(true);
      const result = await mutatePortfolioBulkAction(buildBulkInput(pendingAction));
      toast.success(
        `Aplicado em ${result.applied ?? 0} item${(result.applied ?? 0) === 1 ? "" : "s"}`,
        result.auditLogId ? `Audit run ${result.auditLogId}` : "Historico registrado.",
      );
      if ((result.failed?.length ?? 0) > 0) {
        toast.warn(
          `${result.failed?.length ?? 0} falha(s)`,
          result.failed?.map((failure) => failure.reason).join("; ") || "Veja o historico.",
        );
      }
      setSimulationOpen(false);
      setPendingAction(null);
      setSimulation(null);
      handleClearSelection();
      setReloadCount((count) => count + 1);
      void handleRefreshRuns();
    } catch (err) {
      console.error("[/portfolio] bulk action falhou", err);
      toast.error("Nao foi possivel aplicar", "Tente novamente em alguns segundos.");
    } finally {
      setBulkLoading(false);
    }
  }, [buildBulkInput, handleClearSelection, handleRefreshRuns, pendingAction, toast]);

  return (
    <AppPageShell maxWidth={1400}>
      <AppSectionHeader
        eyebrow="PORTFOLIO · COCKPIT"
        title="Cockpit do portfolio"
        subtitle="Priorize oportunidades, simule mudancas e aplique acoes rastreaveis por imovel e data."
        actions={
          <div style={{ display: "inline-flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
            <DateRangeField label="De" value={from} max={to} onChange={handleFromChange} />
            <DateRangeField label="Ate" value={to} min={from} onChange={handleToChange} />
            <div style={{ minWidth: 150 }}>
              <AppSelect
                label="Janela"
                value={String(rangeDays)}
                onChange={(event) => handleRangeChange(Number(event.target.value))}
              >
                {RANGE_OPTIONS.map((days) => (
                  <option key={days} value={days}>
                    {days} dias
                  </option>
                ))}
              </AppSelect>
            </div>
            <div style={{ minWidth: 200 }}>
              <AppSelect
                label="Modo de preco"
                value={strategy}
                onChange={(event) => setStrategy(event.target.value)}
              >
                {STRATEGY_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </AppSelect>
            </div>
          </div>
        }
      />

      <PortfolioCockpit metrics={metrics} />
      <OpportunityRanking
        items={rankingItems}
        selectedKeys={selectedDayKeys}
        onSelect={handleOpportunitySelect}
      />

      <PortfolioToolbar
        selectedCount={selected.size}
        selectedDatesCount={selectedDayKeys.size}
        totalCount={propertyCount}
        onClearSelection={handleClearSelection}
        onSelectAll={() => handleSelectAll(true)}
        onAction={handleBulkAction}
        loading={bulkLoading}
      />

      {loadError ? (
        <AppEmptyState
          eyebrow="ALGO DEU ERRADO"
          title="Nao conseguimos carregar o cockpit"
          body={loadError}
          icon={<Icons.AlertCircle size={32} />}
          action={
            <AppButton variant="primary" size="md" onClick={handleRetryLoad} loading={loading}>
              Tentar de novo
            </AppButton>
          }
        />
      ) : (
        <PortfolioCalendar
          data={properties}
          selectedPropertyIds={selected}
          selectedDayKeys={selectedDayKeys}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          loading={loading}
          activeProperty={activeIds.propertyId}
          activeDate={activeIds.date}
          onMoveActive={handleMoveActive}
          onDayClick={handleDayClick}
        />
      )}

      <PortfolioActionRuns
        runs={actionRuns}
        loading={runsLoading}
        error={runsError}
        onRefresh={handleRefreshRuns}
        compact
        limit={3}
        viewAllHref="/portfolio/history"
      />

      <PortfolioDayDetailDialog
        detail={selectedDayDetail}
        onClose={() => setInspectedCell(null)}
      />

      <ActionSimulationDialog
        open={simulationOpen}
        action={pendingAction}
        result={simulation}
        loading={bulkLoading}
        onClose={() => setSimulationOpen(false)}
        onConfirm={handleConfirmSimulation}
      />
    </AppPageShell>
  );
}

export default function PortfolioPage() {
  return (
    <AppToastProvider>
      <PortfolioPageContent />
    </AppToastProvider>
  );
}

function PortfolioDayDetailDialog({
  detail,
  onClose,
}: {
  detail: PortfolioDayDetail | null;
  onClose: () => void;
}) {
  React.useEffect(() => {
    if (!detail) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [detail, onClose]);

  if (!detail) return null;

  const suggested = detail.suggestedPrice ?? detail.currentPrice;
  const delta = suggested - detail.currentPrice;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="portfolio-day-detail-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1600,
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "rgba(7, 10, 14, 0.62)",
      }}
      onClick={onClose}
    >
      <AppCard
        variant="elevated"
        style={{
          width: "min(560px, 100%)",
          padding: 0,
          overflow: "hidden",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            padding: "22px 24px 18px",
            borderBottom: "1px solid var(--app-divider)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p className="urban-app-eyebrow-muted" style={{ marginBottom: 8 }}>
              Detalhe da data
            </p>
            <h2
              id="portfolio-day-detail-title"
              style={{
                margin: 0,
                color: "var(--app-text)",
                fontSize: 22,
                lineHeight: 1.2,
              }}
            >
              {detail.propertyName}
            </h2>
            <p style={{ margin: "6px 0 0", color: "var(--app-text-muted)", fontSize: 13 }}>
              {formatLongDate(detail.date)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar detalhes"
            onClick={onClose}
            className="urban-focus-ring"
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              border: "1px solid var(--app-divider)",
              background: "var(--app-surface)",
              color: "var(--app-text-muted)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Icons.Close size={15} />
          </button>
        </header>

        <div style={{ padding: 24, display: "grid", gap: 18 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {detail.selected && <AppBadge kind="accent">Data marcada</AppBadge>}
            {detail.event && (
              <AppBadge kind={detail.event.impacto === "alta" ? "warn" : "neutral"}>
                Evento {detail.event.impacto}
              </AppBadge>
            )}
            {detail.strategy && <AppBadge kind="neutral">Modo {detail.strategy}</AppBadge>}
          </div>

          {detail.event && (
            <section
              style={{
                border: "1px solid var(--app-divider)",
                borderRadius: 10,
                padding: "14px 16px",
                background: "var(--app-surface-muted)",
              }}
            >
              <p className="urban-app-eyebrow-muted" style={{ marginBottom: 6 }}>
                Evento que influencia a diaria
              </p>
              <strong style={{ display: "block", color: "var(--app-text)", fontSize: 16, lineHeight: 1.35 }}>
                {detail.event.nome}
              </strong>
              <p style={{ margin: "8px 0 0", color: "var(--app-text-muted)", fontSize: 13, lineHeight: 1.45 }}>
                O nome completo fica aqui, fora da celula apertada. A grade passa a mostrar apenas o sinal do evento.
              </p>
            </section>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            <DetailMetric label="Preco atual" value={formatCurrency(detail.currentPrice)} />
            <DetailMetric label="Sugestao" value={formatCurrency(suggested)} accent />
            <DetailMetric
              label="Lift estimado"
              value={
                detail.liftAmount > 0
                  ? `${formatCurrency(detail.liftAmount)}${detail.liftPercent != null ? ` / +${detail.liftPercent}%` : ""}`
                  : delta > 0
                    ? formatCurrency(delta)
                    : "--"
              }
            />
            <DetailMetric
              label="Confianca / risco"
              value={`${detail.confidence ?? "--"}% / ${detail.risk ?? "--"}%`}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <AppButton variant="secondary" onClick={onClose}>
              Voltar para a grade
            </AppButton>
          </div>
        </div>
      </AppCard>
    </div>
  );
}

function DetailMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--app-divider)",
        borderRadius: 8,
        padding: "12px 14px",
        background: "var(--app-surface)",
        minWidth: 0,
      }}
    >
      <p className="urban-app-eyebrow-muted" style={{ marginBottom: 6 }}>
        {label}
      </p>
      <strong
        style={{
          display: "block",
          color: accent ? "var(--app-accent)" : "var(--app-text)",
          fontSize: 18,
          lineHeight: 1.2,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function formatLongDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
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
  onChange: (value: string) => void;
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
        onChange={(event) => onChange(event.target.value)}
        className="urban-focus-ring"
        style={{
          height: 40,
          padding: "0 14px",
          background: "var(--app-surface)",
          border: "1px solid var(--app-divider-strong)",
          borderRadius: 10,
          color: "var(--app-text)",
          fontSize: 14,
          fontWeight: 400,
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      />
    </label>
  );
}
