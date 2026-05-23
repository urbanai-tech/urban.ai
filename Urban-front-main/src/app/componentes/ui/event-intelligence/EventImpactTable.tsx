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

export function EventImpactTable({
  impacts,
  onSimulate,
}: {
  impacts: EventPropertyImpact[];
  onSimulate?: (impact: EventPropertyImpact) => void;
}) {
  if (impacts.length === 0) {
    return (
      <AppCard variant="subtle" style={{ padding: 18 }}>
        <p style={{ margin: 0, color: "var(--app-text-muted)", fontSize: 14 }}>
          Nenhum imovel impactado encontrado para este evento.
        </p>
      </AppCard>
    );
  }

  return (
    <>
    <div
      className="event-impact-table-scroll"
      data-testid="host-event-impact-table"
      style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}
    >
      <table
        style={{
          width: "100%",
          minWidth: 900,
          borderCollapse: "separate",
          borderSpacing: 0,
          fontSize: 13,
          color: "var(--app-text)",
        }}
      >
        <thead>
          <tr>
            {["Imovel", "Distancia", "Captura", "Diaria atual", "Faixa absorvivel", "Recomendado", "Chance", "Acao"].map(
              (header) => (
                <th
                  key={header}
                  style={{
                    textAlign: "left",
                    padding: "0 12px 10px",
                    color: "var(--app-text-muted)",
                    fontSize: 10,
                    fontWeight: 750,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    borderBottom: "1px solid var(--app-divider)",
                    whiteSpace: "nowrap",
                  }}
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
                <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                  <span style={{ overflowWrap: "anywhere" }}>{impact.propertyName}</span>
                  <AppBadge kind={confidenceBadgeKind(impact.confidence)} style={{ width: "fit-content" }}>
                    {confidenceLabel(impact.confidence)}
                  </AppBadge>
                </div>
              </Cell>
              <Cell>{impact.distanceKm !== null ? `${impact.distanceKm.toFixed(1).replace(".", ",")} km` : "-"}</Cell>
              <Cell>{impact.propertyCaptureScore ?? "-"}</Cell>
              <Cell>{formatCurrencyFromCents(impact.currentPriceCents)}</Cell>
              <Cell>{formatPriceRange(impact.minAbsorbablePriceCents, impact.maxAbsorbablePriceCents)}</Cell>
              <Cell>
                <span style={{ fontWeight: 750 }}>{formatCurrencyFromCents(impact.recommendedPriceCents)}</span>
                {impact.recommendedMultiplier && (
                  <span style={{ color: "var(--app-text-muted)", marginLeft: 6 }}>
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
      style={{
        padding: "14px 12px",
        borderBottom: "1px solid var(--app-divider)",
        verticalAlign: "middle",
        fontWeight: strong ? 700 : 500,
        whiteSpace: strong ? "normal" : "nowrap",
      }}
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
    <AppCard variant="subtle" style={{ padding: 14 }}>
      <div
        className="event-impact-mobile-header"
        style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}
      >
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, color: "var(--app-text)", fontSize: 14, fontWeight: 750, overflowWrap: "anywhere" }}>
            {impact.propertyName}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <AppBadge kind={confidenceBadgeKind(impact.confidence)}>
              {confidenceLabel(impact.confidence)}
            </AppBadge>
            {impact.distanceKm !== null && (
              <AppBadge kind="neutral">{impact.distanceKm.toFixed(1).replace(".", ",")} km</AppBadge>
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

      <div className="event-impact-mobile-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 14 }}>
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
    <div className={wide ? "event-impact-mobile-metric-wide" : undefined} style={{ gridColumn: wide ? "span 2" : undefined, minWidth: 0 }}>
      <p style={{ margin: "0 0 3px", color: "var(--app-text-muted)", fontSize: 10, fontWeight: 750, letterSpacing: 1.1, textTransform: "uppercase" }}>
        {label}
      </p>
      <p style={{ margin: 0, color: "var(--app-text)", fontSize: 13, fontWeight: 750, lineHeight: 1.25, overflowWrap: "anywhere" }}>
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
