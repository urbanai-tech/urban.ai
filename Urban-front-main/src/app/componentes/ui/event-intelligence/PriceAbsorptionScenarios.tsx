"use client";

import React from "react";
import type { PriceAbsorptionScenario } from "@/app/service/api";
import { AppBadge } from "../AppBadge";
import { AppCard } from "../AppCard";
import {
  formatCurrencyFromCents,
  formatMultiplier,
  formatPercent,
  riskBadgeKind,
  riskLabel,
} from "./formatters";

export function PriceAbsorptionScenarios({
  scenarios,
  title = "Cenarios de absorcao",
}: {
  scenarios?: PriceAbsorptionScenario[];
  title?: string;
}) {
  if (!scenarios || scenarios.length === 0) {
    return (
      <AppCard variant="subtle" style={{ padding: 18 }} as="section">
        <p className="urban-app-eyebrow-muted" style={{ marginBottom: 6 }}>
          PRECO VS CHANCE
        </p>
        <p style={{ margin: 0, color: "var(--app-text-muted)", fontSize: 14, lineHeight: 1.5 }}>
          A curva de absorcao ainda nao esta disponivel para este imovel.
        </p>
      </AppCard>
    );
  }

  const maxRevenue = Math.max(...scenarios.map((scenario) => scenario.expectedRevenueCents ?? 0), 1);

  return (
    <section data-testid="host-price-absorption-scenarios">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <p className="urban-app-eyebrow-muted" style={{ marginBottom: 4 }}>
            PRECO VS CHANCE
          </p>
          <h3 style={{ margin: 0, color: "var(--app-text)", fontSize: 16, fontWeight: 700, letterSpacing: 0, overflowWrap: "anywhere" }}>
            {title}
          </h3>
        </div>
        <AppBadge kind="neutral">Estimativa</AppBadge>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))",
          gap: 12,
        }}
      >
        {scenarios.map((scenario) => {
          const revenue = scenario.expectedRevenueCents ?? 0;
          const width = Math.max(8, Math.round((revenue / maxRevenue) * 100));
          return (
            <AppCard
              key={scenario.id}
              as="article"
              variant={scenario.recommended ? "accent" : "default"}
              style={{ padding: 16, borderRadius: 8, minWidth: 0 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <p style={{ margin: 0, color: "var(--app-text)", fontSize: 14, fontWeight: 750, overflowWrap: "anywhere" }}>
                  {scenario.label}
                </p>
                <AppBadge kind={scenario.recommended ? "accent" : riskBadgeKind(scenario.risk)}>
                  {scenario.recommended ? "Melhor equilibrio" : riskLabel(scenario.risk)}
                </AppBadge>
              </div>

              <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                <Metric label="Diaria" value={formatCurrencyFromCents(scenario.dailyPriceCents)} strong />
                <Metric label="Multiplicador" value={formatMultiplier(scenario.multiplier)} />
                <Metric label="Chance de reserva" value={formatPercent(scenario.bookingProbability)} />
                <Metric label="Receita esperada" value={formatCurrencyFromCents(scenario.expectedRevenueCents)} />
              </div>

              <div
                aria-hidden
                style={{
                  marginTop: 14,
                  height: 8,
                  borderRadius: 999,
                  background: "var(--app-surface-muted)",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    display: "block",
                    height: "100%",
                    width: `${width}%`,
                    background: scenario.recommended ? "var(--app-accent)" : "rgba(14, 17, 22, 0.24)",
                  }}
                />
              </div>

              <p style={{ margin: "12px 0 0", color: "var(--app-text-muted)", fontSize: 12, lineHeight: 1.5, overflowWrap: "anywhere" }}>
                {scenario.reading}
              </p>
            </AppCard>
          );
        })}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <p
        style={{
          margin: "0 0 2px",
          color: "var(--app-text-muted)",
          fontSize: 10,
          fontWeight: 750,
          letterSpacing: 1.1,
          textTransform: "uppercase",
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          color: "var(--app-text)",
          fontSize: strong ? 18 : 14,
          fontWeight: strong ? 800 : 700,
          lineHeight: 1.25,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </p>
    </div>
  );
}
