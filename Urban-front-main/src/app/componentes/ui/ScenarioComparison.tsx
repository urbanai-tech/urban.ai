"use client";

import React from "react";
import type { Scenario, ScenarioLabel } from "@/app/types/recommendation";
import styles from "./ScenarioComparison.module.css";
import { brl, brlWhole, pct } from "../../lib/format";

/**
 * ScenarioComparison — compara 2 ou 3 cenários de preço lado-a-lado
 * (atual / sugerido / agressivo) com ocupação + receita estimadas.
 *
 * Roadmap 4 Tracks (Gap 6 frontend, semana 1-2). Vive dentro do
 * `<details>` expandable do `<RecommendationCard>`.
 *
 * Desktop: grid 2-3 colunas. Mobile (<768px): stack vertical.
 * Cenario "sugerido" recebe border-left accent 3px (pull quote).
 */

function fmtBRL(value: number, fractionDigits = 0): string {
  return fractionDigits === 0 ? brlWhole(value) : brl(value);
}

function fmtRevenueShort(value: number): string {
  // Receita pode ser projetada pra período — usa milhar abreviado se >= 1k.
  if (Math.abs(value) >= 1000) {
    const thousands = value / 1000;
    const formatted = thousands.toLocaleString("pt-BR", {
      minimumFractionDigits: thousands % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 1,
    });
    return `R$ ${formatted} mil`;
  }
  return fmtBRL(value);
}

function fmtPct(value: number): string {
  // Aceita tanto 0-1 quanto 0-100. Se vier <= 1 trata como fracao.
  return pct(value <= 1 ? value * 100 : value, 0);
}

const LABEL_PT: Record<ScenarioLabel, string> = {
  sugerido: "Sugerido",
  atual: "Atual",
  agressivo: "Agressivo",
};

export function ScenarioComparison({ scenarios }: { scenarios: Scenario[] }) {
  if (!scenarios || scenarios.length === 0) return null;

  return (
    <div className={styles.scenarioGrid}>
      {scenarios.map((s, idx) => {
        const isSuggested = s.label === "sugerido";
        return (
          <div
            key={`${s.label}-${idx}`}
            className={
              isSuggested
                ? `${styles.scenarioCard} ${styles.scenarioCardSuggested}`
                : styles.scenarioCard
            }
          >
            <span
              className={
                isSuggested ? "urban-app-eyebrow" : "urban-app-eyebrow-muted"
              }
            >
              {LABEL_PT[s.label] ?? s.label}
            </span>
            <p
              className={
                isSuggested
                  ? `urban-app-display-sm ${styles.scenarioPriceSuggested}`
                  : "urban-app-display-sm"
              }
            >
              {fmtBRL(s.price)}
            </p>
            <div className={styles.scenarioMetrics}>
              <span>
                Ocupação estimada:{" "}
                <strong className={styles.scenarioMetricValue}>
                  {fmtPct(s.estimatedOccupancy)}
                </strong>
              </span>
              <span>
                Receita:{" "}
                <strong className={styles.scenarioMetricValue}>
                  {fmtRevenueShort(s.estimatedRevenue)}
                </strong>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
