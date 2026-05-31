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
      style={{
        padding: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 430,
        minWidth: 0,
      }}
    >
      <div style={{ position: "relative", height: 176, background: "var(--app-surface-muted)" }}>
        {event.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.imageUrl}
            alt={event.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <ImageFallback />
        )}
        {typeof score === "number" && (
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              minWidth: 64,
              padding: "8px 10px",
              borderRadius: 8,
              background: "var(--app-text)",
              color: "var(--app-bg)",
              boxShadow: "var(--app-shadow-elevated)",
            }}
          >
            <p style={{ margin: 0, fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", opacity: 0.72 }}>
              Score
            </p>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 750, lineHeight: 1 }}>{Math.round(score)}</p>
          </div>
        )}
      </div>

      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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

        <div style={{ minWidth: 0 }}>
          <h3
            style={{
              margin: "0 0 8px",
              color: "var(--app-text)",
              fontSize: 18,
              fontWeight: 700,
              lineHeight: 1.25,
              letterSpacing: 0,
              overflowWrap: "anywhere",
            }}
          >
            {event.name}
          </h3>
          {event.description && (
            <p
              style={{
                margin: 0,
                color: "var(--app-text-muted)",
                fontSize: 13,
                lineHeight: 1.55,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {event.description}
            </p>
          )}
        </div>

        <div style={{ display: "grid", gap: 8, color: "var(--app-text-muted)", fontSize: 13 }}>
          <MetaRow icon={<Icons.Calendar size={14} />}>
            {formatDateRange(event.startsAt, event.endsAt)}
            {formatTime(event.startsAt) ? `, ${formatTime(event.startsAt)}` : ""}
          </MetaRow>
          <MetaRow icon={<Icons.MapPin size={14} />}>
            {[event.venueName, event.city, event.state].filter(Boolean).join(" - ")}
          </MetaRow>
          <MetaRow icon={<Icons.Info size={14} />}>{sourceLabel}</MetaRow>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", minHeight: 30 }}>
          {(event.badges ?? []).slice(0, 4).map((badge) => (
            <AppBadge key={badge} kind={badge.includes("alto") ? "accent" : "neutral"}>
              {badge}
            </AppBadge>
          ))}
        </div>

        <div style={{ marginTop: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
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
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 32,
                padding: "0 10px",
                minWidth: 0,
                maxWidth: "100%",
                color: "var(--app-text-muted)",
                fontSize: 13,
                fontWeight: 650,
                textDecoration: "none",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
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
    <p
      style={{
        margin: 0,
        display: "flex",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
        lineHeight: 1.4,
      }}
    >
      <span style={{ display: "inline-flex", flexShrink: 0 }}>{icon}</span>
      <span title={typeof children === "string" ? children : undefined} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {children}
      </span>
    </p>
  );
}

function ImageFallback() {
  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        placeItems: "center",
        color: "var(--app-text-muted)",
        fontSize: 12,
        fontWeight: 650,
        letterSpacing: 1.2,
        textTransform: "uppercase",
      }}
    >
      Evento monitorado
    </div>
  );
}
