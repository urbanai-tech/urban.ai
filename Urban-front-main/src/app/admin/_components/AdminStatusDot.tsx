/**
 * Dot de status 8×8 — substitui emojis 🟢🟡🔴 do dashboard admin antigo.
 * Sem fill saturado: usa cor semântica + texto descritivo ao lado.
 */
import React from "react";

export type AdminStatusKind = "success" | "warn" | "error" | "neutral" | "accent";

const colors: Record<AdminStatusKind, string> = {
  success: "var(--admin-success)",
  warn: "var(--admin-warning)",
  error: "var(--admin-danger)",
  neutral: "var(--admin-text-muted)",
  accent: "var(--admin-accent)",
};

export function AdminStatusDot({
  kind = "neutral",
  size = 8,
  pulse = false,
  style,
}: {
  kind?: AdminStatusKind;
  size?: number;
  pulse?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: colors[kind],
        boxShadow: pulse
          ? `0 0 0 0 ${colors[kind]}88`
          : `0 0 0 2px ${colors[kind]}22`,
        flexShrink: 0,
        animation: pulse ? "urban-admin-pulse 2s infinite" : undefined,
        ...style,
      }}
    />
  );
}
