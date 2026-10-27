"use client";

import React from "react";
import { TrendingUp, TrendingDown } from "../../../../componentes/ui/Icons";
import styles from "./PercentileHero.module.css";

/**
 * <PercentileHero> — Archivo (display) gigante "PERCENTIL X" + subtitle contextual
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
      aria-label="Comparacao com o mercado"
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
      <p className="urban-app-eyebrow">POSIÇÃO NO MERCADO · ÚLTIMOS 30 DIAS</p>
      <div
        className={styles.s1}
      >
        <h2
          className={`urban-app-display-hero ${styles.s2}`}
        >
          MELHOR QUE{" "}
          <span className={styles.s3}>{percentile}</span>
          %
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
              isUp ? "color-mix(in srgb, var(--app-accent, var(--admin-accent)) 25%, transparent)" : "var(--app-divider-strong)"
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
        className={styles.s4}
      >
        Sua diária está acima de{" "}
        <strong className={styles.s5}>{percentile}%</strong> dos
        imóveis parecidos em{" "}
        <strong className={styles.s5}>{neighborhood}</strong> (
        {comparablesCount} referência{comparablesCount === 1 ? "" : "s"} · diária
        média {formatBRL(medianAdr)})
      </p>
    </section>
  );
}
