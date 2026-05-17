"use client";

import React, { useMemo } from "react";
import type { PricingRulesPreviewResponse } from "../../../../service/api";

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
  const d = new Date(iso);
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
        style={{
          height: 180,
          borderRadius: 12,
          background: "var(--app-surface-muted)",
          border: "1px dashed var(--app-divider-strong)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--app-text-muted)",
          fontSize: 13,
        }}
      >
        Calculando preview…
      </div>
    );
  }

  if (!data || !summary) {
    return (
      <div
        style={{
          height: 180,
          borderRadius: 12,
          background: "var(--app-surface-muted)",
          border: "1px dashed var(--app-divider-strong)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--app-text-muted)",
          fontSize: 13,
        }}
      >
        Ative pelo menos uma regra pra ver o impacto nos próximos 14 dias.
      </div>
    );
  }

  const deltaPositive = summary.delta >= 0;

  return (
    <div
      style={{
        background: "var(--app-surface)",
        border: "1px solid var(--app-divider)",
        borderRadius: 12,
        padding: "20px 20px 16px",
        position: "relative",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "var(--app-text-muted)",
              margin: 0,
            }}
          >
            Preview · próximos 14 dias
          </p>
          <h3
            style={{
              margin: "6px 0 0",
              fontSize: 16,
              fontWeight: 600,
              color: "var(--app-text)",
              letterSpacing: -0.2,
            }}
          >
            {formatCurrency(summary.rules)} <span
              style={{ color: "var(--app-text-muted)", fontWeight: 400, fontSize: 14 }}
            >
              vs {formatCurrency(summary.base)} sem regras
            </span>
          </h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {loadingPreview && (
            <span
              aria-live="polite"
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "var(--app-text-muted)",
              }}
            >
              Atualizando…
            </span>
          )}
          {!loadingPreview && staleSeconds !== null && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "var(--app-text-muted)",
              }}
            >
              Atualizado há {staleSeconds}s
            </span>
          )}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              border: "1px solid",
              borderColor: deltaPositive
                ? "rgba(232, 80, 10, 0.25)"
                : "var(--app-divider-strong)",
              color: deltaPositive ? "var(--app-accent)" : "var(--app-text)",
              background: deltaPositive
                ? "var(--app-accent-soft)"
                : "var(--app-surface-muted)",
            }}
          >
            {deltaPositive ? "+" : ""}
            {summary.deltaPct.toFixed(1)}%
          </span>
        </div>
      </header>

      <div
        role="img"
        aria-label="Preview de preço base vs preço com regras nos próximos 14 dias"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${data.days.length}, minmax(0, 1fr))`,
          gap: 6,
          alignItems: "end",
          minHeight: 110,
        }}
      >
        {data.days.map((day) => {
          const label = formatDayLabel(day.date);
          const baseH = Math.max(6, Math.round((day.basePrice / summary.maxPrice) * 90));
          const rulesH = Math.max(6, Math.round((day.rulesPrice / summary.maxPrice) * 90));
          const delta = day.rulesPrice - day.basePrice;
          const deltaPct = day.basePrice > 0 ? (delta / day.basePrice) * 100 : 0;
          const up = delta >= 0;
          return (
            <div
              key={day.date}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                minWidth: 0,
              }}
              title={`${label.weekday} ${label.day} • base ${formatCurrency(day.basePrice)} • com regras ${formatCurrency(day.rulesPrice)} (${up ? "+" : ""}${deltaPct.toFixed(1)}%)`}
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
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 0.4,
                  color: label.isWeekend ? "var(--app-accent)" : "var(--app-text-muted)",
                  lineHeight: 1.2,
                  textAlign: "center",
                }}
              >
                {label.weekday}
                <br />
                <span style={{ color: "var(--app-text)", fontSize: 11 }}>{label.day}</span>
              </span>
            </div>
          );
        })}
      </div>

      <footer
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          fontSize: 11,
          color: "var(--app-text-muted)",
        }}
      >
        <LegendDot color="var(--app-divider-strong)" label="Preço base (sem regras)" />
        <LegendDot color="var(--app-accent)" label="Preço com regras ativas" />
      </footer>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          background: color,
          display: "inline-block",
        }}
      />
      <span style={{ letterSpacing: 0.4 }}>{label}</span>
    </span>
  );
}
