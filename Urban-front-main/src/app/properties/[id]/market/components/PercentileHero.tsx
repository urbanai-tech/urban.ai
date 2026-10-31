"use client";

import React from "react";
import { TrendingUp, TrendingDown } from "../../../../componentes/ui/Icons";
import styles from "./PercentileHero.module.css";
import { brlWhole } from "../../../../lib/format";
import type { TrendView } from "../market-domain";

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
  /** Tendência já interpretada (inclui "indisponível"); quando ausente vale o `trend30d` numérico. */
  trend?: TrendView;
  /** Origem dos dados em uma frase ("clientes e dataset licenciado"). */
  origin?: string;
  /** Raio da comparação em km (padrão 3). */
  radiusKm?: number;
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
  trend,
  origin,
  radiusKm,
}: PercentileHeroProps) {
  const kind = trend
    ? trend.kind
    : trend30d > 0
      ? "up"
      : trend30d < 0
        ? "down"
        : "flat";
  const isUp = kind === "up";
  const isDown = kind === "down";
  const isFlat = kind === "flat";
  const isUnavailable = kind === "unavailable";

  const trendLabel = trend
    ? trend.label
    : isFlat
      ? "estável"
      : `${isUp ? "+" : ""}${trend30d} pontos`;

  return (
    <section
      aria-label="Comparação com o mercado"
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
          aria-label={
            isUnavailable
              ? `Tendência de 30 dias indisponível: ${trend?.hint ?? ""}`
              : `Tendência ${trendLabel} nos últimos 30 dias`
          }
          title={trend?.hint}
          className={`${styles.trendChip} ${isUp ? styles.trendChipUp : ""}`}
        >
          {isUp && <TrendingUp size={14} />}
          {isDown && <TrendingDown size={14} />}
          {(isFlat || isUnavailable) && <span aria-hidden>=</span>}
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
        média {formatBRL(medianAdr)}
        {radiusKm ? ` · até ${radiusKm} km` : ""}
        {origin ? ` · fonte: ${origin}` : ""})
      </p>
    </section>
  );
}
