"use client";

import React from "react";
import {
  AppBadge,
  AppCard,
  AppCardHeader,
  AppMetricCard,
  Icons,
} from "../../componentes/ui";

export type PortfolioCockpitMetrics = {
  currentRevenue: number;
  suggestedRevenue: number;
  liftAmount: number;
  liftPercent: number | null;
  opportunityCount: number;
  averageRisk: number | null;
  averageConfidence: number | null;
  maxLiftAmount: number | null;
  maxLiftPercent: number | null;
  rangeLabel: string;
  dateLabel: string;
};

function formatCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--";
  return `${value.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  })}%`;
}

export function PortfolioCockpit({ metrics }: { metrics: PortfolioCockpitMetrics }) {
  const liftTrend = metrics.liftAmount >= 0 ? "up" : "down";
  const confidenceLabel =
    metrics.averageConfidence == null
      ? "confianca indisponivel"
      : `${formatPercent(metrics.averageConfidence)} confianca`;

  return (
    <AppCard variant="elevated" style={{ marginBottom: 20 }}>
      <AppCardHeader
        eyebrow="COCKPIT DE DECISAO"
        title="Sinais executivos do periodo"
        subtitle={`${metrics.rangeLabel} · ${metrics.dateLabel}`}
        actions={
          <AppBadge kind={metrics.opportunityCount > 0 ? "accent" : "neutral"}>
            {metrics.opportunityCount} oportunidade{metrics.opportunityCount === 1 ? "" : "s"}
          </AppBadge>
        }
      />

      <div
        data-portfolio-cockpit-grid
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr repeat(3, minmax(0, 1fr))",
          gap: 20,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            borderRight: "1px solid var(--app-divider)",
            paddingRight: 20,
            minWidth: 0,
          }}
        >
          <AppMetricCard
            label="Resumo financeiro"
            value={formatCurrency(metrics.suggestedRevenue)}
            variant="hero"
            accent
            trend={liftTrend}
            trendValue={formatCurrency(metrics.liftAmount)}
            sub={`Atual: ${formatCurrency(metrics.currentRevenue)}`}
          />
        </div>

        <AppMetricCard
          label="Oportunidades"
          value={metrics.opportunityCount}
          sub="dias ou imoveis com acao recomendada"
          accent={metrics.opportunityCount > 0}
        />

        <AppMetricCard
          label="Risco medio / confianca"
          value={
            metrics.averageRisk == null
              ? "--"
              : formatPercent(metrics.averageRisk)
          }
          sub={confidenceLabel}
        />

        <AppMetricCard
          label="Maior lift"
          value={
            metrics.maxLiftAmount != null
              ? formatCurrency(metrics.maxLiftAmount)
              : formatPercent(metrics.maxLiftPercent)
          }
          sub={
            metrics.maxLiftPercent != null
              ? `${formatPercent(metrics.maxLiftPercent)} no melhor caso`
              : "aguardando sinais do backend"
          }
          accent={metrics.maxLiftAmount != null || metrics.maxLiftPercent != null}
        />
      </div>

      <div
        style={{
          marginTop: 18,
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "var(--app-text-muted)",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        <Icons.Info size={14} />
        <span>
          Valores usam sugestoes quando existem e caem para preco atual quando o
          backend ainda nao envia campos de decisao.
        </span>
      </div>

      <style jsx>{`
        @media (max-width: 980px) {
          [data-portfolio-cockpit-grid] {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          [data-portfolio-cockpit-grid] > div:first-child {
            grid-column: 1 / -1;
            border-right: 0 !important;
            border-bottom: 1px solid var(--app-divider);
            padding-right: 0 !important;
            padding-bottom: 16px;
          }
        }
        @media (max-width: 640px) {
          [data-portfolio-cockpit-grid] {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </AppCard>
  );
}
