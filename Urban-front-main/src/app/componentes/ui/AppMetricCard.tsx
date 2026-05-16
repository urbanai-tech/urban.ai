"use client";

import React from "react";
import { TrendingUp, TrendingDown } from "./Icons";

/**
 * KPI card light premium. 3 variantes:
 *  - hero  — Bebas Neue gigante, label uppercase em cima. Para o numero
 *            mais importante da tela (receita atribuida, margem, etc.).
 *  - md    — grid de 4 colunas padrao. Bebas 36-56px.
 *  - sm    — mini stat inline.
 *
 * Substitui o padrao de KPI antigo nas telas do anfitriao:
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
  /** Destaca o numero em accent #E8500A */
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

  const valueStyle: React.CSSProperties = isSm
    ? {
        fontSize: 22,
        fontWeight: 600,
        letterSpacing: -0.3,
        color: accent ? "var(--app-accent)" : "var(--app-text)",
        margin: 0,
      }
    : {
        color: accent ? "var(--app-accent)" : "var(--app-text)",
        margin: 0,
      };

  return (
    <div
      style={{
        padding: isHero ? "8px 0" : isMd ? "8px 0" : "0",
        display: "flex",
        flexDirection: "column",
        gap: isSm ? 4 : 10,
        ...style,
      }}
    >
      <p className="urban-app-eyebrow-muted">{label}</p>
      <p className={valueClass} style={valueStyle}>
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </p>
      {(sub || trend) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "var(--app-text-muted)",
            fontWeight: 400,
          }}
        >
          {trend && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color:
                  trend === "up" ? "var(--app-success)" : "var(--app-danger)",
                fontWeight: 600,
              }}
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
