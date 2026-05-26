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

  return (
    <AppCard variant="default" style={{ marginBottom: 20 }}>
      <AppCardHeader
        eyebrow="COCKPIT DE DECISAO"
        title="Resumo operacional da janela"
        subtitle={`${metrics.rangeLabel} - ${metrics.dateLabel}`}
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
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 12,
          alignItems: "stretch",
        }}
      >
        <MetricShell accent>
          <AppMetricCard
            label="Lift estimado"
            value={formatCurrency(metrics.liftAmount)}
            variant="sm"
            accent
            trend={liftTrend}
            trendValue={metrics.liftPercent != null ? formatPercent(metrics.liftPercent) : formatCurrency(metrics.liftAmount)}
            sub="incremento potencial"
          />
        </MetricShell>

        <MetricShell>
          <AppMetricCard
            label="Receita base"
            value={formatCurrency(metrics.currentRevenue)}
            variant="sm"
            sub="precos atuais"
          />
        </MetricShell>

        <MetricShell>
          <AppMetricCard
            label="Receita sugerida"
            value={formatCurrency(metrics.suggestedRevenue)}
            variant="sm"
            accent={metrics.liftAmount > 0}
            sub="base + sugestoes"
          />
        </MetricShell>

        <MetricShell>
          <AppMetricCard
            label="Oportunidades"
            value={metrics.opportunityCount}
            variant="sm"
            sub="datas com acao"
            accent={metrics.opportunityCount > 0}
          />
        </MetricShell>

        <MetricShell>
          <AppMetricCard
            label="Confianca media"
            value={metrics.averageConfidence == null ? "--" : formatPercent(metrics.averageConfidence)}
            variant="sm"
            sub={metrics.averageRisk == null ? "risco indisponivel" : `risco ${formatPercent(metrics.averageRisk)}`}
          />
        </MetricShell>

        <MetricShell>
          <AppMetricCard
            label="Maior lift"
            value={
              metrics.maxLiftAmount != null
                ? formatCurrency(metrics.maxLiftAmount)
                : formatPercent(metrics.maxLiftPercent)
            }
            variant="sm"
            sub={
              metrics.maxLiftPercent != null
                ? `${formatPercent(metrics.maxLiftPercent)} no melhor caso`
                : "aguardando sinais"
            }
            accent={metrics.maxLiftAmount != null || metrics.maxLiftPercent != null}
          />
        </MetricShell>
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
          Indicadores calculados a partir da janela carregada: preco atual,
          sugestoes disponiveis e oportunidades retornadas pelo backend.
        </span>
      </div>

      <style jsx>{`
        @media (max-width: 1180px) {
          [data-portfolio-cockpit-grid] {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 640px) {
          [data-portfolio-cockpit-grid] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </AppCard>
  );
}

function MetricShell({
  children,
  accent = false,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        minWidth: 0,
        border: "1px solid var(--app-divider)",
        borderRadius: 8,
        padding: 14,
        background: accent ? "var(--app-accent-soft)" : "var(--app-surface-muted)",
      }}
    >
      {children}
    </div>
  );
}
