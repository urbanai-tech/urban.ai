"use client";

import React from "react";
import { TrendingUp, TrendingDown } from "../../../../componentes/ui/Icons";
import styles from "./PercentileHero.module.css";
import { brlWhole } from "../../../../lib/format";

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
  return brlWhole(value);
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

  return (
    <section
      aria-label="Comparacao com o mercado"
      className={styles.heroSection}
    >
      <p className="urban-app-eyebrow">POSIÇÃO NO MERCADO · ÚLTIMOS 30 DIAS</p>
      <div
        className={styles.heroRow}
      >
        <h2
          className={`urban-app-display-hero ${styles.heroHeadline}`}
        >
          MELHOR QUE{" "}
          <span className={styles.heroPercentile}>{percentile}</span>
          %
        </h2>

        <span
          role="status"
          aria-label={`Tendência ${trendLabel} nos últimos 30 dias`}
          className={`${styles.trendChip} ${isUp ? styles.trendChipUp : ""}`}
        >
          {isUp && <TrendingUp size={14} />}
          {isDown && <TrendingDown size={14} />}
          {isFlat && <span aria-hidden>=</span>}
          {trendLabel}
        </span>
      </div>
      <p
        className={styles.heroDescription}
      >
        Sua diária está acima de{" "}
        <strong className={styles.heroEmphasis}>{percentile}%</strong> dos
        imóveis parecidos em{" "}
        <strong className={styles.heroEmphasis}>{neighborhood}</strong> (
        {comparablesCount} referência{comparablesCount === 1 ? "" : "s"} · diária
        média {formatBRL(medianAdr)})
      </p>
    </section>
  );
}
