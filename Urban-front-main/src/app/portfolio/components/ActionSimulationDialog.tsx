"use client";

import React from "react";
import { AppBadge, AppConfirmDialog } from "../../componentes/ui";
import type {
  PortfolioActionSimulationResponse,
  PortfolioBulkActionFailure,
} from "../../service/api";
import type { PortfolioToolbarAction } from "./PortfolioToolbar";
import styles from "./ActionSimulationDialog.module.css";

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
      reason: String(item.reason ?? item.status ?? "Não aplicado"),
    }));
}

function actionLabel(action: PortfolioToolbarAction | null): string {
  if (!action) return "Ação";
  switch (action.type) {
    case "apply-strategy":
      return `Simular modo ${action.strategy}`;
    case "set-base-price":
      return `Definir preço base ${formatCurrency(action.price)}`;
    case "set-date-price":
      return `Definir preço por data ${formatCurrency(action.price)}`;
    case "accept-suggestions":
      return "Aceitar sugestões";
    case "apply-internal":
      return "Salvar internamente";
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
      title="Confirmar depois da simulação?"
      confirmLabel="Confirmar aplicação"
      cancelLabel="Revisar"
      loading={loading}
      body={
        <div className={styles.dialogBody}>
          <div
            className={styles.actionSummaryRow}
          >
            <strong className={styles.actionLabel}>{actionLabel(action)}</strong>
            <AppBadge kind={simulated ? "success" : "warn"}>
              {simulated ? "Simulado" : "Previa local"}
            </AppBadge>
          </div>

          <div
            className={styles.snapshotGrid}
          >
            <SnapshotBox label="Antes" value={formatCurrency(beforeValue)} />
            <SnapshotBox label="Depois" value={formatCurrency(afterValue)} />
          </div>

          <div
            className={styles.snapshotGrid}
          >
            <SnapshotBox label="Aplicáveis" value={String(applied)} />
            <SnapshotBox label="Falhas" value={String(failed.length)} tone={failed.length > 0 ? "warn" : "neutral"} />
          </div>

          {failed.length > 0 && (
            <ul className={styles.failureList}>
              {failed.slice(0, 4).map((failure, index) => (
                <li key={`${failure.propertyId}-${index}`}>
                  {failure.propertyId}: {failure.reason}
                </li>
              ))}
            </ul>
          )}

          {!simulated && (
            <p className={styles.previewNotice}>
              O endpoint de simulação ainda não respondeu. Esta prévia usa os
              dados carregados no calendário; a ação real só roda se você confirmar.
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
    <div className={`${styles.snapshotCard} ${tone === "warn" ? styles.snapshotCardWarn : ""}`}>
      <div
        className={styles.snapshotLabel}
      >
        {label}
      </div>
      <div className={styles.snapshotValue}>
        {value}
      </div>
    </div>
  );
}
