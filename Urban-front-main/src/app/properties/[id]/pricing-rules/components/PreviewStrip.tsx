"use client";

import React, { useMemo } from "react";
import { parseLocalDate } from "@/app/lib/date";
import type { PricingRulesPreviewResponse } from "../../../../service/api";
import styles from "./PreviewStrip.module.css";
import { pctSigned } from "../../../../lib/format";

/**
 * PreviewStrip — strip horizontal de 14 dias mostrando preço base vs preço com
 * regras + delta %. SVG inline (sem recharts), responsivo.
 *
 * Estado:
 *  - `loading`  → skeleton suave
 *  - `data`     → renderiza barras
 *  - `staleAgo` → mostra "atualizado há Ns" no canto sup direito
 */

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function formatDayLabel(iso: string): { day: string; weekday: string; isWeekend: boolean } {
  const d = parseLocalDate(iso);
  if (!d) {
    return {
      day: iso.slice(8, 10) || iso,
      weekday: "--",
      isWeekend: false,
    };
  }
  const weekday = (d.getDay() + 7) % 7;
  return {
    day: String(d.getDate()).padStart(2, "0"),
    weekday: WEEKDAY_LABELS[weekday],
    isWeekend: weekday === 5 || weekday === 6,
  };
}

export function PreviewStrip({
  loading,
  data,
  staleSeconds,
  loadingPreview,
}: {
  loading: boolean;
  data: PricingRulesPreviewResponse | null;
  staleSeconds: number | null;
  loadingPreview: boolean;
}) {
  const summary = useMemo(() => {
    if (!data || data.days.length === 0) return null;
    const base = data.days.reduce((acc, d) => acc + d.basePrice, 0);
    const rules = data.days.reduce((acc, d) => acc + d.rulesPrice, 0);
    const delta = rules - base;
    const deltaPct = base > 0 ? (delta / base) * 100 : 0;
    const maxPrice = Math.max(
      ...data.days.map((d) => Math.max(d.basePrice, d.rulesPrice)),
    );
    return { base, rules, delta, deltaPct, maxPrice };
  }, [data]);

  if (loading) {
    return (
      <div
        className={styles.placeholderBox}
      >
        Calculando preview…
      </div>
    );
  }

  if (!data || !summary) {
    return (
      <div
        className={styles.placeholderBox}
      >
        Ative pelo menos uma regra pra ver o impacto nos próximos 14 dias.
      </div>
    );
  }

  const deltaPositive = summary.delta >= 0;

  return (
    <div
      className={styles.previewCard}
    >
      <header
        className={styles.previewHeader}
      >
        <div className={styles.headerTitleBlock}>
          <p
            className={styles.eyebrow}
          >
            Preview · próximos 14 dias
          </p>
          <h3
            className={styles.headline}
          >
            {formatCurrency(summary.rules)} <span
              className={styles.headlineMuted}
            >
              vs {formatCurrency(summary.base)} sem regras
            </span>
          </h3>
        </div>
        <div className={styles.headerStatus}>
          {loadingPreview && (
            <span
              aria-live="polite"
              className={styles.statusText}
            >
              Atualizando…
            </span>
          )}
          {!loadingPreview && staleSeconds !== null && (
            <span
              className={styles.statusText}
            >
              Atualizado há {staleSeconds}s
            </span>
          )}
          <span
            className={`${styles.deltaBadge} ${deltaPositive ? styles.deltaBadgePositive : styles.deltaBadgeNegative}`}
          >
            {pctSigned(summary.deltaPct)}
          </span>
        </div>
      </header>

      <div
        role="img"
        aria-label="Preview de preço base vs preço com regras nos próximos 14 dias"
        className={styles.barsGrid}
        style={{ "--day-count": data.days.length } as React.CSSProperties}
      >
        {data.days.map((day) => {
          const label = formatDayLabel(day.date);
          const baseH = Math.max(6, Math.round((day.basePrice / summary.maxPrice) * 90));
          const rulesH = Math.max(6, Math.round((day.rulesPrice / summary.maxPrice) * 90));
          const delta = day.rulesPrice - day.basePrice;
          const deltaPct = day.basePrice > 0 ? (delta / day.basePrice) * 100 : 0;
          return (
            <div
              key={day.date}
              className={styles.dayColumn}
              title={`${label.weekday} ${label.day} • base ${formatCurrency(day.basePrice)} • com regras ${formatCurrency(day.rulesPrice)} (${pctSigned(deltaPct)})`}
            >
              <svg
                viewBox="0 0 24 100"
                width="100%"
                height="100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {/* base price bar (cinza) */}
                <rect
                  x={4}
                  y={100 - baseH}
                  width={7}
                  height={baseH}
                  rx={2}
                  fill="var(--app-divider-strong)"
                  opacity={0.55}
                />
                {/* rules price bar (accent) */}
                <rect
                  x={13}
                  y={100 - rulesH}
                  width={7}
                  height={rulesH}
                  rx={2}
                  fill="var(--app-accent)"
                  opacity={day.appliedRules.length > 0 ? 0.95 : 0.4}
                />
              </svg>
              <span
                className={`${styles.dayLabel} ${label.isWeekend ? styles.dayLabelWeekend : styles.dayLabelWeekday}`}
              >
                {label.weekday}
                <br />
                <span className={styles.dayNumber}>{label.day}</span>
              </span>
            </div>
          );
        })}
      </div>

      <footer
        className={styles.legendRow}
      >
        <LegendDot color="var(--app-divider-strong)" label="Preço base (sem regras)" />
        <LegendDot color="var(--app-accent)" label="Preço com regras ativas" />
      </footer>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className={styles.legendItem}>
      <span
        className={styles.legendDot}
        style={{ "--dot-color": color } as React.CSSProperties}
      />
      <span className={styles.legendLabel}>{label}</span>
    </span>
  );
}
