/**
 * Badge light premium do app autenticado.
 *
 * Substitui `colorScheme={purple|orange|green}` chakra default e
 * `bg={blue.100} color={blue.700}` espalhado nas telas.
 */
import React from "react";

export type AppBadgeKind =
  | "success"
  | "warn"
  | "error"
  | "neutral"
  | "accent";

const styles: Record<AppBadgeKind, React.CSSProperties> = {
  success: {
    color: "var(--app-success)",
    background: "rgba(22, 160, 107, 0.10)",
    borderColor: "rgba(22, 160, 107, 0.25)",
  },
  warn: {
    color: "var(--app-warning)",
    background: "rgba(200, 129, 14, 0.10)",
    borderColor: "rgba(200, 129, 14, 0.25)",
  },
  error: {
    color: "var(--app-danger)",
    background: "rgba(194, 52, 46, 0.10)",
    borderColor: "rgba(194, 52, 46, 0.25)",
  },
  neutral: {
    color: "var(--app-text-muted)",
    background: "var(--app-surface-muted)",
    borderColor: "var(--app-divider-strong)",
  },
  accent: {
    color: "var(--app-accent)",
    background: "var(--app-accent-soft)",
    borderColor: "rgba(232, 80, 10, 0.25)",
  },
};

export function AppBadge({
  kind = "neutral",
  children,
  style,
}: {
  kind?: AppBadgeKind;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 1,
        textTransform: "uppercase",
        borderRadius: 999,
        border: "1px solid",
        lineHeight: 1.4,
        whiteSpace: "nowrap",
        ...styles[kind],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
