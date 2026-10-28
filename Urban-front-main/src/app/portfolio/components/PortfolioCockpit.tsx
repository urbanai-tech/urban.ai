"use client";

import React from "react";
import {
  AppBadge,
  AppCard,
  AppCardHeader,
  AppMetricCard,
  Icons,
} from "../../componentes/ui";
import styles from "./PortfolioCockpit.module.css";

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
    <AppCard variant="default" className={styles.cockpitCard}>
      <AppCardHeader
        eyebrow="COCKPIT DE DECISÃO"
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
        className={styles.metricsGrid}
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
            sub="preços atuais"
          />
        </MetricShell>

        <MetricShell>
          <AppMetricCard
            label="Receita sugerida"
            value={formatCurrency(metrics.suggestedRevenue)}
            variant="sm"
            accent={metrics.liftAmount > 0}
            sub="base + sugestões"
          />
        </MetricShell>

        <MetricShell>
          <AppMetricCard
            label="Oportunidades"
            value={metrics.opportunityCount}
            variant="sm"
            sub="datas com ação"
            accent={metrics.opportunityCount > 0}
          />
        </MetricShell>

        <MetricShell>
          <AppMetricCard
            label="Confiança média"
            value={metrics.averageConfidence == null ? "--" : formatPercent(metrics.averageConfidence)}
            variant="sm"
            sub={metrics.averageRisk == null ? "risco indisponível" : `risco ${formatPercent(metrics.averageRisk)}`}
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
        className={styles.footnote}
      >
        <Icons.Info size={14} />
        <span>
          Indicadores calculados a partir da janela carregada: preço atual,
          sugestões disponíveis e oportunidades retornadas pelo backend.
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
      className={`${styles.metricShell} ${accent ? styles.metricShellAccent : styles.metricShellMuted}`}
    >
      {children}
    </div>
  );
}
