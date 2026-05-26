"use client";

import React from "react";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppCardHeader,
  Icons,
} from "../../componentes/ui";
import type { PortfolioActionRun } from "../../service/api";

function formatDateTime(value?: string | null): string {
  if (!value) return "sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionLabel(action: string): string {
  switch (action) {
    case "apply-strategy":
      return "Modo por imovel";
    case "set-base-price":
      return "Preco base";
    case "set-date-price":
      return "Preco por data";
    case "accept-suggestions":
      return "Sugestoes aceitas";
    case "apply-internal":
      return "Aplicacao interna";
    default:
      return action || "Acao";
  }
}

function statusKind(status?: string): "success" | "warn" | "error" | "neutral" {
  if (status === "applied" || status === "success" || status === "completed") return "success";
  if (status === "partial" || status === "simulated") return "warn";
  if (status === "failed" || status === "error") return "error";
  return "neutral";
}

function failedCount(run: PortfolioActionRun): number {
  if (typeof run.failed === "number") return run.failed;
  if (Array.isArray(run.failed)) return run.failed.length;
  if (typeof run.summary?.failed === "number") return run.summary.failed;
  return 0;
}

function appliedCount(run: PortfolioActionRun): number {
  if (typeof run.applied === "number") return run.applied;
  if (typeof run.summary?.applied === "number") return run.summary.applied;
  return 0;
}

export function PortfolioActionRuns({
  runs,
  loading,
  error,
  onRefresh,
  compact = false,
  limit,
  viewAllHref,
}: {
  runs: PortfolioActionRun[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  compact?: boolean;
  limit?: number;
  viewAllHref?: string;
}) {
  const visibleRuns = typeof limit === "number" ? runs.slice(0, limit) : runs;

  return (
    <AppCard variant="default" style={{ marginTop: compact ? 18 : 20, padding: compact ? 20 : 24 }}>
      <AppCardHeader
        eyebrow={compact ? "HISTORICO" : "AUDITORIA"}
        title={compact ? "Ultimos aceites e aplicacoes" : "Historico de action runs"}
        subtitle={
          compact
            ? "Resumo rapido do que ja foi confirmado. O historico completo fica em uma tela dedicada."
            : "Registro operacional das simulacoes confirmadas e aplicacoes realizadas no portfolio."
        }
        actions={
          <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {viewAllHref && (
              <AppButton size="sm" variant="secondary" as="a" href={viewAllHref}>
                Ver historico
              </AppButton>
            )}
            {onRefresh ? (
              <AppButton
                size="sm"
                variant="ghost"
                onClick={onRefresh}
                loading={loading}
                leftIcon={<Icons.ArrowRight size={12} />}
              >
                Atualizar
              </AppButton>
            ) : null}
          </div>
        }
      />

      {error ? (
        <div
          style={{
            color: "var(--app-danger)",
            fontSize: 13,
            padding: "6px 0 2px",
          }}
        >
          {error}
        </div>
      ) : loading ? (
        <div style={{ display: "grid", gap: 10 }}>
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="urban-app-skeleton"
              style={{ height: 52, borderRadius: 8 }}
            />
          ))}
        </div>
      ) : visibleRuns.length === 0 ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--app-text-muted)",
            fontSize: 13,
          }}
        >
          <Icons.Info size={14} />
          <span>Nenhuma acao registrada para exibir ainda.</span>
        </div>
      ) : (
        <div
          role="list"
          style={{
            display: "flex",
            flexDirection: "column",
            borderTop: "1px solid var(--app-divider)",
          }}
        >
          {visibleRuns.map((run) => (
            <div
              role="listitem"
              key={run.id}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: 12,
                padding: "13px 0",
                borderBottom: "1px solid var(--app-divider)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 5,
                  }}
                >
                  <strong style={{ color: "var(--app-text)", fontSize: 14 }}>
                    {actionLabel(run.action)}
                  </strong>
                  <AppBadge kind={statusKind(run.status)}>{run.status ?? "registrado"}</AppBadge>
                  {run.auditLogId && <AppBadge kind="neutral">audit {run.auditLogId}</AppBadge>}
                </div>
                <p
                  style={{
                    margin: 0,
                    color: "var(--app-text-muted)",
                    fontSize: 12,
                    lineHeight: 1.45,
                  }}
                >
                  {formatDateTime(run.createdAt)} - {appliedCount(run)} aplicado(s) -{" "}
                  {failedCount(run)} falha(s)
                  {run.actorName || run.actorEmail ? ` - ${run.actorName ?? run.actorEmail}` : ""}
                </p>
              </div>
              <code
                style={{
                  alignSelf: "center",
                  color: "var(--app-text-muted)",
                  fontSize: 11,
                  background: "var(--app-surface-muted)",
                  border: "1px solid var(--app-divider)",
                  borderRadius: 6,
                  padding: "4px 7px",
                  maxWidth: 150,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={run.id}
              >
                {run.id}
              </code>
            </div>
          ))}
        </div>
      )}
    </AppCard>
  );
}
