"use client";

import React from "react";
import { TrendingUp, TrendingDown } from "../../../../componentes/ui/Icons";

/**
 * <PercentileHero> — Bebas Neue gigante "PERCENTIL X" + subtitle contextual
 * + chip lateral de tendência últimos 30d.
 *
 * Hero metric do dashboard `/properties/:id/market`. Comunica de cara onde o
 * imóvel está em relação ao comp set do bairro.
 */
export interface PercentileHeroProps {
  percentile: number; // 0-100
  neighborhood: string;
  comparablesCount: number;
  medianAdr: number;
  trend30d: number; // delta em pontos (positivo = melhorou)
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function PercentileHero({
  percentile,
  neighborhood,
  comparablesCount,
  medianAdr,
  trend30d,
}: PercentileHeroProps) {
  const isUp = trend30d > 0;
  const isDown = trend30d < 0;
  const isFlat = trend30d === 0;

  const trendLabel = isFlat
    ? "estável"
    : `${isUp ? "+" : ""}${trend30d} pontos`;

  const trendColor = isUp
    ? "var(--app-accent)"
    : isDown
      ? "var(--app-text-muted)"
      : "var(--app-text-muted)";

  const trendBackground = isUp
    ? "var(--app-accent-soft)"
    : "var(--app-surface-muted)";

  return (
    <section
      aria-label="Percentil de mercado"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        padding: "32px 24px",
        background: "var(--app-surface)",
        border: "1px solid var(--app-divider)",
        borderRadius: 16,
        boxShadow: "0 1px 2px rgba(14, 17, 22, 0.04)",
      }}
    >
      <p className="urban-app-eyebrow">PERCENTIL · ÚLTIMOS 30 DIAS</p>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <h2
          className="urban-app-display-hero"
          style={{
            fontSize: "clamp(64px, 9vw, 96px)",
            lineHeight: 0.95,
            color: "var(--app-text)",
            margin: 0,
            letterSpacing: -1,
          }}
        >
          PERCENTIL{" "}
          <span style={{ color: "var(--app-accent)" }}>{percentile}</span>
        </h2>

        <span
          role="status"
          aria-label={`Tendência ${trendLabel} nos últimos 30 dias`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            background: trendBackground,
            border: `1px solid ${
              isUp ? "rgba(232, 80, 10, 0.25)" : "var(--app-divider-strong)"
            }`,
            borderRadius: 999,
            color: trendColor,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 0.3,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {isUp && <TrendingUp size={14} />}
          {isDown && <TrendingDown size={14} />}
          {isFlat && <span aria-hidden>=</span>}
          {trendLabel}
        </span>
      </div>
      <p
        style={{
          fontSize: 16,
          lineHeight: 1.55,
          color: "var(--app-text-muted)",
          maxWidth: 720,
          margin: 0,
        }}
      >
        Seu ADR está acima de{" "}
        <strong style={{ color: "var(--app-text)" }}>{percentile}%</strong> dos
        imóveis comparáveis em{" "}
        <strong style={{ color: "var(--app-text)" }}>{neighborhood}</strong> (
        {comparablesCount} comparáve{comparablesCount === 1 ? "l" : "is"} · ADR
        mediano {formatBRL(medianAdr)})
      </p>
    </section>
  );
}
