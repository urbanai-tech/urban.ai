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
import styles from "./PortfolioActionRuns.module.css";

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
      return "Modo por imóvel";
    case "set-base-price":
      return "Preço base";
    case "set-date-price":
      return "Preço por data";
    case "accept-suggestions":
      return "Sugestões aceitas";
    case "apply-internal":
      return "Aplicação interna";
    default:
      return action || "Ação";
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
    <AppCard variant="default" className={compact ? styles.runsCardCompact : styles.runsCard}>
      <AppCardHeader
        eyebrow={compact ? "HISTÓRICO" : "AUDITORIA"}
        title={compact ? "Últimos aceites e aplicações" : "Histórico de action runs"}
        subtitle={
          compact
            ? "Resumo rapido do que já foi confirmado. O histórico completo fica em uma tela dedicada."
            : "Registro operacional das simulações confirmadas e aplicações realizadas no portfólio."
        }
        actions={
          <div className={styles.headerActions}>
            {viewAllHref && (
              <AppButton size="sm" variant="secondary" as="a" href={viewAllHref}>
                Ver histórico
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
          className={styles.errorMessage}
        >
          {error}
        </div>
      ) : loading ? (
        <div className={styles.skeletonList}>
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className={`urban-app-skeleton ${styles.skeletonRow}`}
            />
          ))}
        </div>
      ) : visibleRuns.length === 0 ? (
        <div
          className={styles.emptyState}
        >
          <Icons.Info size={14} />
          <span>Nenhuma ação registrada para exibir ainda.</span>
        </div>
      ) : (
        <div
          role="list"
          className={styles.runsList}
        >
          {visibleRuns.map((run) => (
            <div
              role="listitem"
              key={run.id}
              className={styles.runRow}
            >
              <div className={styles.runContent}>
                <div
                  className={styles.runTitleRow}
                >
                  <strong className={styles.runTitle}>
                    {actionLabel(run.action)}
                  </strong>
                  <AppBadge kind={statusKind(run.status)}>{run.status ?? "registrado"}</AppBadge>
                  {run.auditLogId && <AppBadge kind="neutral">audit {run.auditLogId}</AppBadge>}
                </div>
                <p
                  className={styles.runMeta}
                >
                  {formatDateTime(run.createdAt)} - {appliedCount(run)} aplicado(s) -{" "}
                  {failedCount(run)} falha(s)
                  {run.actorName || run.actorEmail ? ` - ${run.actorName ?? run.actorEmail}` : ""}
                </p>
              </div>
              <code
                className={styles.runIdTag}
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
