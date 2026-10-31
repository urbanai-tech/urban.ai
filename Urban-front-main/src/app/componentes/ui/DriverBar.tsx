"use client";

import React from "react";
import type { Drivers } from "@/app/types/recommendation";
import styles from "./DriverBar.module.css";

/**
 * DriverBar — barra horizontal segmentada que explica POR QUE o preço
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
  { key: "pace", short: "Ritmo", color: "var(--app-success)" },
  { key: "compSet", short: "Comparação", color: "var(--app-warning)" },
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
    <div className={styles.driverBarRoot}>
      {/* Barra segmentada */}
      <div
        role="img"
        aria-label="Motivos que influenciaram a sugestão de preço"
        className={styles.segmentTrack}
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
              className={styles.segment}
              style={
                {
                  "--seg-pct": `${pct}%`,
                  "--seg-color": seg.color,
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>

      {/* Legenda compacta */}
      <ul
        className={styles.legend}
      >
        {segments.map((seg) => {
          const tooltip = `${seg.short}: ${Math.round(seg.weight)}% — ${seg.label}`;
          return (
            <li
              key={seg.key}
              title={tooltip}
              className={styles.legendItem}
            >
              <span
                aria-hidden
                className={styles.legendSwatch}
                style={{ "--seg-color": seg.color } as React.CSSProperties}
              />
              <span className={styles.legendName}>{seg.short}</span>
              <span className={styles.legendValue}>
                {Math.round(seg.weight)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
