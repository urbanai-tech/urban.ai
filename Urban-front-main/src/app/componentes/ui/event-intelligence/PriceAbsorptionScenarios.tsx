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
import styles from "./PriceAbsorptionScenarios.module.css";

export function PriceAbsorptionScenarios({
  scenarios,
  title = "Cenários de absorção",
}: {
  scenarios?: PriceAbsorptionScenario[];
  title?: string;
}) {
  if (!scenarios || scenarios.length === 0) {
    return (
      <AppCard variant="subtle" className={styles.introCard} as="section">
        <p className={`urban-app-eyebrow-muted ${styles.introEyebrow}`}>
          PREÇO VS CHANCE
        </p>
        <p className={styles.introText}>
          A curva de absorção ainda não está disponível para este imóvel.
        </p>
      </AppCard>
    );
  }

  const maxRevenue = Math.max(...scenarios.map((scenario) => scenario.expectedRevenueCents ?? 0), 1);

  return (
    <section data-testid="host-price-absorption-scenarios">
      <div className={styles.header}>
        <div className={styles.headerText}>
          <p className={`urban-app-eyebrow-muted ${styles.headerEyebrow}`}>
            PREÇO VS CHANCE
          </p>
          <h3 className={styles.title}>
            {title}
          </h3>
        </div>
        <AppBadge kind="neutral">Estimativa</AppBadge>
      </div>

      <div className={styles.scenarioGrid}>
        {scenarios.map((scenario) => {
          const revenue = scenario.expectedRevenueCents ?? 0;
          const width = Math.max(8, Math.round((revenue / maxRevenue) * 100));
          return (
            <AppCard
              key={scenario.id}
              as="article"
              variant={scenario.recommended ? "accent" : "default"}
              className={styles.scenarioCard}
            >
              <div className={styles.scenarioHeader}>
                <p className={styles.scenarioLabel}>
                  {scenario.label}
                </p>
                <AppBadge kind={scenario.recommended ? "accent" : riskBadgeKind(scenario.risk)}>
                  {scenario.recommended ? "Melhor equilíbrio" : riskLabel(scenario.risk)}
                </AppBadge>
              </div>

              <div className={styles.metricList}>
                <Metric label="Diária" value={formatCurrencyFromCents(scenario.dailyPriceCents)} strong />
                <Metric label="Multiplicador" value={formatMultiplier(scenario.multiplier)} />
                <Metric label="Chance de reserva" value={formatPercent(scenario.bookingProbability)} />
                <Metric label="Receita esperada" value={formatCurrencyFromCents(scenario.expectedRevenueCents)} />
              </div>

              <div aria-hidden className={styles.revenueTrack}>
                <span
                  className={`${styles.revenueBar} ${scenario.recommended ? styles.revenueBarRecommended : styles.revenueBarDefault}`}
                  style={{ "--bar-width": `${width}%` } as React.CSSProperties}
                />
              </div>

              <p className={styles.scenarioReading}>
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
      <p className={styles.metricLabel}>
        {label}
      </p>
      <p className={`${styles.metricValue} ${strong ? styles.metricValueStrong : ""}`}>
        {value}
      </p>
    </div>
  );
}
