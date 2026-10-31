"use client";

import React from "react";
import type { EventCatalogItem } from "@/app/service/api";
import { AppBadge } from "../AppBadge";
import { AppButton } from "../AppButton";
import { AppCard } from "../AppCard";
import * as Icons from "../Icons";
import {
  confidenceBadgeKind,
  confidenceLabel,
  formatDateRange,
  formatTime,
} from "./formatters";
import { EventImage } from "./EventImage";
import styles from "./EventCatalogCard.module.css";

export function EventCatalogCard({
  event,
  onOpen,
  onOpenImpact,
}: {
  event: EventCatalogItem;
  onOpen: () => void;
  onOpenImpact?: () => void;
}) {
  const score = event.demandScore ?? event.urbanScore;
  const sourceLabel = event.source ? event.source.replace(/-/g, " ") : "fonte em validação";

  return (
    <AppCard
      as="article"
      variant="default"
      className={styles.catalogCard}
    >
      <div className={styles.media}>
        <EventImage src={event.imageUrl} alt={event.name} venue={event.venueName} />
        {typeof score === "number" && (
          <div className={styles.scoreBadge}>
            <p className={styles.scoreLabel}>
              Demanda
            </p>
            <p className={styles.scoreValue}>{Math.round(score)}</p>
          </div>
        )}
      </div>

      <div className={styles.body}>
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

        <div className={styles.titleBlock}>
          <h3 className={styles.title}>
            {event.name}
          </h3>
          {event.description && (
            <p className={styles.description}>
              {event.description}
            </p>
          )}
        </div>

        <div className={styles.metaList}>
          <MetaRow icon={<Icons.Calendar size={14} />}>
            {formatDateRange(event.startsAt, event.endsAt)}
            {formatTime(event.startsAt) ? `, ${formatTime(event.startsAt)}` : ""}
          </MetaRow>
          <MetaRow icon={<Icons.MapPin size={14} />}>
            {[event.venueName, event.city, event.state].filter(Boolean).join(" - ")}
          </MetaRow>
          <MetaRow icon={<Icons.Info size={14} />}>{sourceLabel}</MetaRow>
        </div>

        <div className={styles.tagRow}>
          {(event.badges ?? []).slice(0, 4).map((badge) => (
            <AppBadge key={badge} kind={badge.includes("alto") ? "accent" : "neutral"}>
              {badge}
            </AppBadge>
          ))}
        </div>

        <div className={styles.actions}>
          <AppButton
            type="button"
            size="sm"
            variant="primary"
            onClick={onOpen}
            rightIcon={<Icons.ArrowRight size={14} />}
          >
            Ver evento
          </AppButton>
          {onOpenImpact && (
            <AppButton type="button" size="sm" variant="secondary" onClick={onOpenImpact}>
              Abrir radar
            </AppButton>
          )}
          {event.officialUrl && (
            <a
              href={event.officialUrl}
              target="_blank"
              rel="noreferrer"
              className={styles.officialLink}
            >
              Fonte oficial
            </a>
          )}
        </div>
      </div>
    </AppCard>
  );
}

function MetaRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className={styles.metaRow}>
      <span className={styles.metaIcon}>{icon}</span>
      <span title={typeof children === "string" ? children : undefined} className={styles.metaText}>
        {children}
      </span>
    </p>
  );
}
