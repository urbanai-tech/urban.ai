/**
 * Card de KPI admin Urban AI. 3 variantes:
 *
 *  - hero  → label uppercase + número Bebas Neue gigante (clamp 56-96px). Para
 *            o número mais importante da tela (margem por imóvel, ROI, etc).
 *  - md    → padrão grid de 4 colunas. Bebas Neue 40-48px.
 *  - sm    → mini-stat inline. Inter 600 20px.
 *
 * Substitui o `<div className="border border-slate-800 rounded-xl bg-slate-900/40 p-4">`
 * + `<p className="text-2xl font-bold">{value}</p>` repetido em todas as telas.
 *
 * Sem border colorida, sem bg colorido. Apenas tipografia + dot de status opcional.
 */
import React from "react";
import { AdminStatusDot, type AdminStatusKind } from "./AdminStatusDot";
import { TrendingUp, TrendingDown } from "./Icons";

export type AdminMetricVariant = "hero" | "md" | "sm";

export function AdminMetricCard({
  label,
  value,
  sub,
  variant = "md",
  status,
  trend,
  trendValue,
  accent = false,
  style,
}: {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  variant?: AdminMetricVariant;
  status?: AdminStatusKind;
  trend?: "up" | "down";
  trendValue?: string;
  /** Destaca o número em accent #E8500A */
  accent?: boolean;
  style?: React.CSSProperties;
}) {
  const isHero = variant === "hero";
  const isMd = variant === "md";
  const isSm = variant === "sm";

  const valueClass = isHero
    ? "urban-admin-display-hero"
    : isMd
      ? "urban-admin-display-md"
      : undefined;

  const valueStyle: React.CSSProperties = isSm
    ? {
        fontSize: 22,
        fontWeight: 600,
        letterSpacing: -0.3,
        color: accent ? "var(--admin-accent)" : "var(--admin-text)",
      }
    : {
        color: accent ? "var(--admin-accent)" : "var(--admin-text)",
      };

  return (
    <div
      style={{
        padding: isHero ? "32px 0" : isMd ? "24px 0" : "16px 0",
        display: "flex",
        flexDirection: "column",
        gap: isSm ? 6 : 12,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {status && <AdminStatusDot kind={status} size={7} />}
        <p className="urban-admin-eyebrow-muted">{label}</p>
      </div>
      <p className={valueClass} style={valueStyle}>
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </p>
      {(sub || trend) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "var(--admin-text-muted)",
            fontWeight: 400,
          }}
        >
          {trend && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color:
                  trend === "up"
                    ? "var(--admin-success)"
                    : "var(--admin-danger)",
                fontWeight: 600,
              }}
            >
              {trend === "up" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {trendValue}
            </span>
          )}
          {sub && <span>{sub}</span>}
        </div>
      )}
    </div>
  );
}
