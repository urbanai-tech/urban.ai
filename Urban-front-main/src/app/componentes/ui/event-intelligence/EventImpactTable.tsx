"use client";

import React from "react";
import type { EventPropertyImpact } from "@/app/service/api";
import { AppBadge } from "../AppBadge";
import { AppButton } from "../AppButton";
import { AppCard } from "../AppCard";
import * as Icons from "../Icons";
import {
  confidenceBadgeKind,
  confidenceLabel,
  formatCurrencyFromCents,
  formatMultiplier,
  formatPercent,
} from "./formatters";
import styles from "./EventImpactTable.module.css";
import { km } from "../../../lib/format";

export function EventImpactTable({
  impacts,
  onSimulate,
}: {
  impacts: EventPropertyImpact[];
  onSimulate?: (impact: EventPropertyImpact) => void;
}) {
  if (impacts.length === 0) {
    return (
      <AppCard variant="subtle" className={styles.emptyStateCard}>
        <p className={styles.emptyStateText}>
          Nenhum imóvel impactado encontrado para este evento.
        </p>
      </AppCard>
    );
  }

  return (
    <>
    <div
      className={`event-impact-table-scroll ${styles.tableScroll}`}
      data-testid="host-event-impact-table"
    >
      <table
        className={styles.impactTable}
      >
        <thead>
          <tr>
            {["Imóvel", "Distância", "Captura", "Diária atual", "Faixa absorvível", "Recomendado", "Chance", "Ação"].map(
              (header) => (
                <th
                  key={header}
                  className={styles.headerCell}
                >
                  {header}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {impacts.map((impact) => (
            <tr key={impact.propertyId}>
              <Cell strong>
                <div className={styles.propertyCell}>
                  <span className={styles.propertyName}>{impact.propertyName}</span>
                  <AppBadge kind={confidenceBadgeKind(impact.confidence)} className={styles.confidenceBadge}>
                    {confidenceLabel(impact.confidence)}
                  </AppBadge>
                </div>
              </Cell>
              <Cell>{impact.distanceKm !== null ? km(impact.distanceKm) : "-"}</Cell>
              <Cell>{impact.propertyCaptureScore ?? "-"}</Cell>
              <Cell>{formatCurrencyFromCents(impact.currentPriceCents)}</Cell>
              <Cell>{formatPriceRange(impact.minAbsorbablePriceCents, impact.maxAbsorbablePriceCents)}</Cell>
              <Cell>
                <span className={styles.recommendedPrice}>{formatCurrencyFromCents(impact.recommendedPriceCents)}</span>
                {impact.recommendedMultiplier && (
                  <span className={styles.recommendedMultiplier}>
                    {formatMultiplier(impact.recommendedMultiplier)}
                  </span>
                )}
              </Cell>
              <Cell>{formatPercent(impact.bookingProbability)}</Cell>
              <Cell>
                <AppButton
                  type="button"
                  size="sm"
                  variant={impact.recommendedAction === "apply" ? "primary" : "secondary"}
                  onClick={() => onSimulate?.(impact)}
                  disabled={!onSimulate}
                  leftIcon={impact.recommendedAction === "apply" ? <Icons.Check size={14} /> : <Icons.Zap size={14} />}
                >
                  {actionLabel(impact.recommendedAction)}
                </AppButton>
              </Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div className="event-impact-mobile-list" data-testid="host-event-impact-mobile-list">
      {impacts.map((impact) => (
        <ImpactMobileCard key={impact.propertyId} impact={impact} onSimulate={onSimulate} />
      ))}
    </div>
    <style>{`
      .event-impact-mobile-list {
        display: none;
      }
      @media (max-width: 760px) {
        .event-impact-table-scroll {
          display: none;
        }
        .event-impact-mobile-list {
          display: grid;
          gap: 12px;
        }
      }
      @media (max-width: 420px) {
        .event-impact-mobile-header {
          align-items: stretch !important;
        }
        .event-impact-mobile-action {
          width: 100%;
        }
        .event-impact-mobile-action span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .event-impact-mobile-metrics {
          grid-template-columns: 1fr !important;
        }
        .event-impact-mobile-metric-wide {
          grid-column: span 1 !important;
        }
      }
    `}</style>
    </>
  );
}

function Cell({
  children,
  strong,
}: {
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <td
      className={`${styles.bodyCell} ${strong ? styles.bodyCellStrong : styles.bodyCellDefault}`}
    >
      {children}
    </td>
  );
}

function ImpactMobileCard({
  impact,
  onSimulate,
}: {
  impact: EventPropertyImpact;
  onSimulate?: (impact: EventPropertyImpact) => void;
}) {
  return (
    <AppCard variant="subtle" className={styles.mobileCard}>
      <div
        className={`event-impact-mobile-header ${styles.mobileHeader}`}
      >
        <div className={styles.mobileTitleBlock}>
          <p className={styles.mobilePropertyName}>
            {impact.propertyName}
          </p>
          <div className={styles.mobileBadgeRow}>
            <AppBadge kind={confidenceBadgeKind(impact.confidence)}>
              {confidenceLabel(impact.confidence)}
            </AppBadge>
            {impact.distanceKm !== null && (
              <AppBadge kind="neutral">{km(impact.distanceKm)}</AppBadge>
            )}
          </div>
        </div>
        <AppButton
          type="button"
          className="event-impact-mobile-action"
          size="sm"
          variant={impact.recommendedAction === "apply" ? "primary" : "secondary"}
          onClick={() => onSimulate?.(impact)}
          disabled={!onSimulate}
          leftIcon={impact.recommendedAction === "apply" ? <Icons.Check size={14} /> : <Icons.Zap size={14} />}
        >
          {actionLabel(impact.recommendedAction)}
        </AppButton>
      </div>

      <div className={`event-impact-mobile-metrics ${styles.mobileMetricsGrid}`}>
        <MobileMetric label="Captura" value={String(impact.propertyCaptureScore ?? "-")} />
        <MobileMetric label="Chance" value={formatPercent(impact.bookingProbability)} />
        <MobileMetric label="Atual" value={formatCurrencyFromCents(impact.currentPriceCents)} />
        <MobileMetric label="Recomendado" value={formatCurrencyFromCents(impact.recommendedPriceCents)} />
        <MobileMetric label="Faixa" value={formatPriceRange(impact.minAbsorbablePriceCents, impact.maxAbsorbablePriceCents)} wide />
        <MobileMetric label="Multiplicador" value={formatMultiplier(impact.recommendedMultiplier)} />
      </div>
    </AppCard>
  );
}

function MobileMetric({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={[wide ? "event-impact-mobile-metric-wide" : null, styles.mobileMetric, wide ? styles.mobileMetricWide : null].filter(Boolean).join(" ")}>
      <p className={styles.mobileMetricLabel}>
        {label}
      </p>
      <p className={styles.mobileMetricValue}>
        {value}
      </p>
    </div>
  );
}

function formatPriceRange(min?: number | null, max?: number | null): string {
  if (min === null || min === undefined || max === null || max === undefined) return "-";
  return `${formatCurrencyFromCents(min)} - ${formatCurrencyFromCents(max)}`;
}

function actionLabel(action: EventPropertyImpact["recommendedAction"]): string {
  if (action === "apply") return "Aplicar";
  if (action === "review") return "Revisar";
  if (action === "watch") return "Acompanhar";
  return "Simular";
}
