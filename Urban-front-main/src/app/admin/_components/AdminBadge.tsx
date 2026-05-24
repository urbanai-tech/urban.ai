/**
 * Badge admin Urban AI — variantes monocromáticas sem fill saturado.
 * Substitui `bg-rose-500/20 text-rose-300`, `bg-emerald-500/20 text-emerald-300`,
 * `bg-amber-500/20 text-amber-300` etc. das telas admin antigas.
 */
import React from "react";

export type AdminBadgeKind =
  | "success"
  | "warn"
  | "error"
  | "neutral"
  | "accent";

const styles: Record<AdminBadgeKind, React.CSSProperties> = {
  success: { color: "var(--admin-success)", borderColor: "var(--admin-success)" },
  warn: { color: "var(--admin-warning)", borderColor: "var(--admin-warning)" },
  error: { color: "var(--admin-danger)", borderColor: "var(--admin-danger)" },
  neutral: { color: "var(--admin-text-muted)", borderColor: "var(--admin-divider-strong)" },
  accent: { color: "var(--admin-accent)", borderColor: "var(--admin-accent)" },
};

export function AdminBadge({
  kind = "neutral",
  children,
  style,
}: {
  kind?: AdminBadgeKind;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 8px",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        borderRadius: 2,
        border: "1px solid",
        background: "transparent",
        whiteSpace: "nowrap",
        lineHeight: 1.2,
        ...styles[kind],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
