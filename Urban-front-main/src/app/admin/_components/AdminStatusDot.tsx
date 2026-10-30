/**
 * Dot de status 8×8 — substitui emojis 🟢🟡🔴 do dashboard admin antigo.
 * Sem fill saturado: usa cor semântica + texto descritivo ao lado.
 */
import React from "react";
import styles from "./AdminStatusDot.module.css";

export type AdminStatusKind = "success" | "warn" | "error" | "neutral" | "accent";

const kindClass: Record<AdminStatusKind, string> = {
  success: styles.success,
  warn: styles.warn,
  error: styles.error,
  neutral: styles.neutral,
  accent: styles.accent,
};

export function AdminStatusDot({
  kind = "neutral",
  size = 8,
  pulse = false,
  style,
  className,
}: {
  kind?: AdminStatusKind;
  size?: number;
  pulse?: boolean;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={[styles.dot, kindClass[kind], className].filter(Boolean).join(" ")}
      style={{
        width: size,
        height: size,
        animation: pulse ? "urban-admin-pulse 2s infinite" : undefined,
        ...style,
      }}
    />
  );
}
