"use client";

import React from "react";
import type { HostEventRadarItem } from "@/app/service/api";
import { AppBadge } from "../AppBadge";
import { AppButton } from "../AppButton";
import { AppCard } from "../AppCard";
import * as Icons from "../Icons";
import {
  confidenceBadgeKind,
  confidenceLabel,
  formatCompactCurrencyFromCents,
  formatCurrencyFromCents,
  formatDateRange,
  formatMultiplier,
  formatPercent,
} from "./formatters";

export function EventRadarCard({
  event,
  selected,
  onSelect,
  onOpenDetail,
}: {
  event: HostEventRadarItem;
  selected?: boolean;
  onSelect: () => void;
  onOpenDetail?: () => void;
}) {
  const impact = event.bestPropertyImpact ?? event.impactedProperties[0] ?? null;
  const multiplierRange =
    impact?.recommendedMultiplier || impact?.maxPlausibleMultiplier
      ? `${formatMultiplier(impact?.recommendedMultiplier)} - ${formatMultiplier(impact?.maxPlausibleMultiplier)}`
      : "-";

  return (
    <div data-testid="host-event-radar-card" style={{ minWidth: 0 }}>
      <AppCard
        as="article"
        variant={selected ? "accent" : "default"}
        style={{
          padding: 18,
          cursor: "pointer",
          outline: selected ? "2px solid var(--app-accent-soft)" : undefined,
          minWidth: 0,
        }}
        onClick={onSelect}
      >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <AppBadge kind={confidenceBadgeKind(event.confidence)}>
              {confidenceLabel(event.confidence)}
            </AppBadge>
            {event.category && (
              <AppBadge
                kind="neutral"
                style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {event.category}
              </AppBadge>
            )}
          </div>
          <h3
            style={{
              margin: 0,
              color: "var(--app-text)",
              fontSize: 16,
              fontWeight: 700,
              lineHeight: 1.3,
              letterSpacing: 0,
              overflowWrap: "anywhere",
            }}
          >
            {event.name}
          </h3>
          <p
            style={{
              margin: "6px 0 0",
              color: "var(--app-text-muted)",
              fontSize: 12,
              lineHeight: 1.45,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {formatDateRange(event.startsAt, event.endsAt)} - {[event.venueName, event.city].filter(Boolean).join(" / ")}
          </p>
        </div>
          <ScorePill value={event.demandScore ?? event.urbanScore} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 10,
          marginTop: 16,
        }}
      >
        <Metric label="Potencial" value={formatCompactCurrencyFromCents(event.eventRevenuePotentialCents)} />
        <Metric label="Imoveis" value={String(event.impactedProperties.length)} />
        <Metric label="Multiplicador" value={multiplierRange} />
        <Metric label="Chance" value={formatPercent(impact?.bookingProbability)} />
      </div>

      {impact && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 8,
            background: "var(--app-surface-muted)",
            border: "1px solid var(--app-divider)",
          }}
        >
          <p style={{ margin: 0, color: "var(--app-text-muted)", fontSize: 12, fontWeight: 650 }}>
            Melhor oportunidade
          </p>
          <p style={{ margin: "4px 0 0", color: "var(--app-text)", fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>
            {impact.propertyName} - {formatCurrencyFromCents(impact.recommendedPriceCents)}
          </p>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <AppButton
          type="button"
          size="sm"
          variant="secondary"
          onClick={(eventClick) => {
            eventClick.stopPropagation();
            onSelect();
          }}
          leftIcon={<Icons.Zap size={14} />}
        >
          Ver curva
        </AppButton>
        {onOpenDetail && (
          <AppButton
            type="button"
            size="sm"
            variant="ghost"
            onClick={(eventClick) => {
              eventClick.stopPropagation();
              onOpenDetail();
            }}
            rightIcon={<Icons.ArrowRight size={14} />}
          >
            Abrir evento
          </AppButton>
        )}
      </div>
      </AppCard>
    </div>
  );
}

function ScorePill({ value }: { value?: number | null }) {
  return (
    <div
      style={{
        width: 54,
        minWidth: 54,
        height: 54,
        borderRadius: 8,
        display: "grid",
        placeItems: "center",
        background: "var(--app-accent-soft)",
        border: "1px solid var(--app-accent)",
        color: "var(--app-accent)",
      }}
    >
      <span style={{ fontSize: 19, fontWeight: 800, lineHeight: 1 }}>{typeof value === "number" ? Math.round(value) : "-"}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        style={{
          margin: "0 0 4px",
          color: "var(--app-text-muted)",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.2,
          textTransform: "uppercase",
        }}
      >
        {label}
      </p>
      <p style={{ margin: 0, color: "var(--app-text)", fontSize: 14, fontWeight: 750, lineHeight: 1.2, overflowWrap: "anywhere" }}>
        {value}
      </p>
    </div>
  );
}
