"use client";

import React from "react";
import { AppBadge, AppConfirmDialog } from "../../componentes/ui";
import type {
  PortfolioActionSimulationResponse,
  PortfolioBulkActionFailure,
} from "../../service/api";
import type { PortfolioToolbarAction } from "./PortfolioToolbar";

function formatCurrency(value: unknown): string {
  const num = typeof value === "number" ? value : null;
  if (num == null || !Number.isFinite(num)) return "--";
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function moneyValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value || typeof value !== "object") return null;
  const snapshot = value as Record<string, unknown>;
  const fields = [
    "projectedRevenue",
    "totalRevenue",
    "revenue",
    "atual",
    "price",
    "currentPrice",
    "suggestedPrice",
  ];
  for (const field of fields) {
    const candidate = snapshot[field];
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
  }
  return null;
}

function getSnapshotRevenue(snapshot: Record<string, unknown> | null | undefined): number | null {
  return moneyValue(snapshot);
}

function sumItemValues(
  items: PortfolioActionSimulationResponse["items"],
  field: "before" | "after",
): number | null {
  if (!Array.isArray(items)) return null;
  let total = 0;
  let count = 0;
  for (const item of items) {
    const value = moneyValue(item[field]);
    if (value == null) continue;
    total += value;
    count += 1;
  }
  return count > 0 ? total : null;
}

function getAppliedCount(result: PortfolioActionSimulationResponse | null): number {
  if (!result) return 0;
  if (typeof result.applied === "number") return result.applied;
  if (typeof result.summary?.applied === "number") return result.summary.applied;
  if (Array.isArray(result.applied)) return result.applied.length;
  if (Array.isArray(result.changes)) return result.changes.length;
  if (Array.isArray(result.items)) {
    return result.items.filter((item) => item.status !== "failed" && item.status !== "skipped").length;
  }
  return 0;
}

function getFailed(result: PortfolioActionSimulationResponse | null): PortfolioBulkActionFailure[] {
  if (!result) return [];
  if (Array.isArray(result.failed)) return result.failed;
  if (!Array.isArray(result.items)) return [];
  return result.items
    .filter((item) => item.status === "failed" || item.status === "skipped")
    .map((item) => ({
      propertyId: String(item.propertyId ?? "item"),
      reason: String(item.reason ?? item.status ?? "Nao aplicado"),
    }));
}

function actionLabel(action: PortfolioToolbarAction | null): string {
  if (!action) return "Acao";
  switch (action.type) {
    case "apply-strategy":
      return `Aplicar modo ${action.strategy}`;
    case "set-base-price":
      return `Definir preco base ${formatCurrency(action.price)}`;
    case "set-date-price":
      return `Definir preco por data ${formatCurrency(action.price)}`;
    case "accept-suggestions":
      return "Aceitar sugestoes";
    case "apply-internal":
      return "Aplicar internamente";
  }
}

export function ActionSimulationDialog({
  open,
  action,
  result,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  action: PortfolioToolbarAction | null;
  result: PortfolioActionSimulationResponse | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const before = (result?.before ?? result?.summary ?? null) as
    | Record<string, unknown>
    | null;
  const after = (result?.after ?? null) as Record<string, unknown> | null;
  const items = result?.items ?? result?.changes;
  const beforeValue = getSnapshotRevenue(before) ?? sumItemValues(items, "before");
  const afterValue = getSnapshotRevenue(after) ?? sumItemValues(items, "after");
  const applied = getAppliedCount(result);
  const failed = getFailed(result);
  const simulated = result?.simulated !== false;

  return (
    <AppConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Confirmar depois da simulacao?"
      confirmLabel="Aplicar acao real"
      cancelLabel="Revisar"
      loading={loading}
      body={
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <strong style={{ color: "var(--app-text)" }}>{actionLabel(action)}</strong>
            <AppBadge kind={simulated ? "success" : "warn"}>
              {simulated ? "Simulado" : "Previa local"}
            </AppBadge>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <SnapshotBox label="Antes" value={formatCurrency(beforeValue)} />
            <SnapshotBox label="Depois" value={formatCurrency(afterValue)} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <SnapshotBox label="Aplicaveis" value={String(applied)} />
            <SnapshotBox label="Falhas" value={String(failed.length)} tone={failed.length > 0 ? "warn" : "neutral"} />
          </div>

          {failed.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {failed.slice(0, 4).map((failure, index) => (
                <li key={`${failure.propertyId}-${index}`}>
                  {failure.propertyId}: {failure.reason}
                </li>
              ))}
            </ul>
          )}

          {!simulated && (
            <p style={{ margin: 0 }}>
              O endpoint de simulacao ainda nao respondeu. Esta previa usa os
              dados carregados no calendario; a acao real so roda se voce confirmar.
            </p>
          )}
        </div>
      }
    />
  );
}

function SnapshotBox({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warn";
}) {
  return (
    <div
      style={{
        border: "1px solid var(--app-divider)",
        borderRadius: 8,
        padding: "10px 12px",
        background:
          tone === "warn" ? "rgba(200, 129, 14, 0.08)" : "var(--app-surface-muted)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--app-text-muted)",
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ color: "var(--app-text)", fontWeight: 700, fontSize: 15 }}>
        {value}
      </div>
    </div>
  );
}
