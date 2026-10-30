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
import styles from "./EventRadarCard.module.css";

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
    <div data-testid="host-event-radar-card" className={styles.cardWrap}>
      <AppCard
        as="article"
        variant={selected ? "accent" : "default"}
        className={`${styles.radarCard} ${selected ? styles.radarCardSelected : ""}`}
        onClick={onSelect}
      >
      <div className={styles.header}>
        <div className={styles.headerText}>
          <div className={styles.badgeRow}>
            <AppBadge kind={confidenceBadgeKind(event.confidence)}>
              {confidenceLabel(event.confidence)}
            </AppBadge>
            {event.category && (
              <AppBadge
                kind="neutral"
                className={styles.categoryBadge}
              >
                {event.category}
              </AppBadge>
            )}
          </div>
          <h3 className={styles.title}>
            {event.name}
          </h3>
          <p className={styles.subtitle}>
            {formatDateRange(event.startsAt, event.endsAt)} - {[event.venueName, event.city].filter(Boolean).join(" / ")}
          </p>
        </div>
          <ScorePill value={event.demandScore ?? event.urbanScore} />
      </div>

      <div className={styles.metricGrid}>
        <Metric label="Potencial" value={formatCompactCurrencyFromCents(event.eventRevenuePotentialCents)} />
        <Metric label="Imóveis" value={String(event.impactedProperties.length)} />
        <Metric label="Multiplicador" value={multiplierRange} />
        <Metric label="Chance" value={formatPercent(impact?.bookingProbability)} />
      </div>

      {impact && (
        <div className={styles.opportunity}>
          <p className={styles.opportunityLabel}>
            Melhor oportunidade
          </p>
          <p className={styles.opportunityValue}>
            {impact.propertyName} - {formatCurrencyFromCents(impact.recommendedPriceCents)}
          </p>
        </div>
      )}

      <div className={styles.actions}>
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
    <div className={styles.scorePill}>
      <span className={styles.scorePillValue}>{typeof value === "number" ? Math.round(value) : "-"}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className={styles.metricLabel}>
        {label}
      </p>
      <p className={styles.metricValue}>
        {value}
      </p>
    </div>
  );
}
