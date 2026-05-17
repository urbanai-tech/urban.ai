"use client";

import React from "react";
import type { Scenario, ScenarioLabel } from "@/app/types/recommendation";

/**
 * ScenarioComparison — compara 2 ou 3 cenarios de preco lado-a-lado
 * (atual / sugerido / agressivo) com ocupacao + receita estimadas.
 *
 * Roadmap 4 Tracks (Gap 6 frontend, semana 1-2). Vive dentro do
 * `<details>` expandable do `<RecommendationCard>`.
 *
 * Desktop: grid 2-3 colunas. Mobile (<768px): stack vertical.
 * Cenario "sugerido" recebe border-left accent 3px (pull quote).
 */

function fmtBRL(value: number, fractionDigits = 0): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function fmtRevenueShort(value: number): string {
  // Receita pode ser projetada pra periodo — usa milhar abreviado se >= 1k.
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
  const pct = value <= 1 ? value * 100 : value;
  return `${pct.toFixed(0)}%`;
}

const LABEL_PT: Record<ScenarioLabel, string> = {
  sugerido: "Sugerido",
  atual: "Atual",
  agressivo: "Agressivo",
};

export function ScenarioComparison({ scenarios }: { scenarios: Scenario[] }) {
  if (!scenarios || scenarios.length === 0) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 180px), 1fr))`,
        gap: 12,
      }}
    >
      {scenarios.map((s, idx) => {
        const isSuggested = s.label === "sugerido";
        return (
          <div
            key={`${s.label}-${idx}`}
            style={{
              background: "var(--app-surface)",
              border: "1px solid var(--app-divider)",
              borderLeft: isSuggested
                ? "3px solid var(--app-accent)"
                : "1px solid var(--app-divider)",
              borderRadius: 8,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <span
              className={
                isSuggested ? "urban-app-eyebrow" : "urban-app-eyebrow-muted"
              }
            >
              {LABEL_PT[s.label] ?? s.label}
            </span>
            <p
              className="urban-app-display-sm"
              style={{
                color: isSuggested ? "var(--app-accent)" : "var(--app-text)",
              }}
            >
              {fmtBRL(s.price)}
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                fontSize: 12,
                color: "var(--app-text-muted)",
                lineHeight: 1.45,
              }}
            >
              <span>
                Ocupacao estimada:{" "}
                <strong style={{ color: "var(--app-text)" }}>
                  {fmtPct(s.estimatedOccupancy)}
                </strong>
              </span>
              <span>
                Receita:{" "}
                <strong style={{ color: "var(--app-text)" }}>
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
