"use client";

import React from "react";
import { TrendingUp, TrendingDown } from "./Icons";
import styles from "./AppMetricCard.module.css";

/**
 * KPI card light premium. 3 variantes:
 *  - hero  — Archivo (display) gigante, label uppercase em cima. Para o número
 *            mais importante da tela (receita atribuida, margem, etc.).
 *  - md    — grid de 4 colunas padrão. Archivo 36-56px.
 *  - sm    — mini stat inline.
 *
 * Substitui o padrão de KPI antigo nas telas do anfitrião:
 *   <Box borderWidth p={4} bg="white" borderRadius="md">
 *     <Text fontSize="xs" color="gray.500">Label</Text>
 *     <Text fontSize="2xl" fontWeight="bold">{value}</Text>
 *   </Box>
 */

export type AppMetricVariant = "hero" | "md" | "sm";

export function AppMetricCard({
  label,
  value,
  sub,
  variant = "md",
  trend,
  trendValue,
  accent = false,
  style,
}: {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  variant?: AppMetricVariant;
  trend?: "up" | "down";
  trendValue?: string;
  /** Destaca o número em accent accent da marca */
  accent?: boolean;
  style?: React.CSSProperties;
}) {
  const isHero = variant === "hero";
  const isMd = variant === "md";
  const isSm = variant === "sm";

  const valueClass = isHero
    ? "urban-app-display-hero"
    : isMd
      ? "urban-app-display-md"
      : undefined;

  const valueClassName = [
    valueClass,
    styles.metricValue,
    isSm && styles.metricValueSm,
    accent && styles.metricValueAccent,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={isSm ? `${styles.metric} ${styles.metricSm}` : styles.metric} style={style}>
      <p className="urban-app-eyebrow-muted">{label}</p>
      <p className={valueClassName}>
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </p>
      {(sub || trend) && (
        <div className={styles.metricMeta}>
          {trend && (
            <span
              className={`${styles.metricTrend} ${
                trend === "up" ? styles.metricTrendUp : styles.metricTrendDown
              }`}
            >
              {trend === "up" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {trendValue}
            </span>
          )}
          {sub && <span>{sub}</span>}
        </div>
      )}
    </div>
  );
}
