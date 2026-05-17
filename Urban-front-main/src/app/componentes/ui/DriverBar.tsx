"use client";

import React from "react";
import type { Drivers } from "@/app/types/recommendation";

/**
 * DriverBar — barra horizontal segmentada que explica POR QUE o preco
 * sugerido eh esse. Cada segmento eh a contribuicao (em peso 0-100) de
 * um driver da engine: evento, pace, comp set, sazonalidade.
 *
 * Roadmap 4 Tracks (Gap 6 frontend, semana 1-2). Vive dentro do
 * `<details>` expandable do `<RecommendationCard>`.
 *
 * Cores via tokens do design system (.urban-app). Hover em cada segmento
 * mostra tooltip nativo com driver + peso + label.
 */

type DriverKey = "event" | "pace" | "compSet" | "seasonality";

const DRIVER_DEFS: ReadonlyArray<{
  key: DriverKey;
  /** Nome curto pra legenda. */
  short: string;
  /** Cor CSS via token. */
  color: string;
}> = [
  { key: "event", short: "Evento", color: "var(--app-accent)" },
  { key: "pace", short: "Pace", color: "var(--app-success)" },
  { key: "compSet", short: "Comp set", color: "var(--app-warning)" },
  { key: "seasonality", short: "Sazonalidade", color: "var(--app-text-muted)" },
];

function clampWeight(w: number): number {
  if (!Number.isFinite(w) || w < 0) return 0;
  if (w > 100) return 100;
  return w;
}

export function DriverBar({ drivers }: { drivers: Drivers }) {
  const segments = DRIVER_DEFS.map((def) => ({
    ...def,
    weight: clampWeight(drivers[def.key].weight),
    label: drivers[def.key].label,
  }));
  const total = segments.reduce((acc, s) => acc + s.weight, 0);
  // Se a soma der 0, evita divisao por zero — distribui 1/4 pra cada.
  const safeTotal = total > 0 ? total : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Barra segmentada */}
      <div
        role="img"
        aria-label="Composicao dos drivers da sugestao de preco"
        style={{
          display: "flex",
          width: "100%",
          height: 8,
          borderRadius: 4,
          overflow: "hidden",
          background: "var(--app-surface-muted)",
        }}
      >
        {segments.map((seg) => {
          const pct = total > 0 ? (seg.weight / safeTotal) * 100 : 25;
          if (pct <= 0) return null;
          const tooltip = `${seg.short}: ${Math.round(seg.weight)}% — ${seg.label}`;
          return (
            <div
              key={seg.key}
              title={tooltip}
              aria-label={tooltip}
              style={{
                width: `${pct}%`,
                background: seg.color,
                transition: "filter 120ms",
                cursor: "help",
              }}
            />
          );
        })}
      </div>

      {/* Legenda compacta */}
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: "8px 16px",
          fontSize: 11,
          color: "var(--app-text-muted)",
        }}
      >
        {segments.map((seg) => {
          const tooltip = `${seg.short}: ${Math.round(seg.weight)}% — ${seg.label}`;
          return (
            <li
              key={seg.key}
              title={tooltip}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                lineHeight: 1.4,
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: seg.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: "var(--app-text)" }}>{seg.short}</span>
              <span style={{ color: "var(--app-text-muted)" }}>
                {Math.round(seg.weight)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
