/**
 * Badge admin Urban AI — variantes monocromáticas sem fill saturado.
 * Substitui `bg-rose-500/20 text-rose-300`, `bg-emerald-500/20 text-emerald-300`,
 * `bg-amber-500/20 text-amber-300` etc. das telas admin antigas.
 */
import React from "react";
import styles from "./AdminBadge.module.css";

export type AdminBadgeKind =
  | "success"
  | "warn"
  | "error"
  | "neutral"
  | "accent";

const kindClass: Record<AdminBadgeKind, string> = {
  success: styles.success,
  warn: styles.warn,
  error: styles.error,
  neutral: styles.neutral,
  accent: styles.accent,
};

export function AdminBadge({
  kind = "neutral",
  children,
  style,
  className,
}: {
  kind?: AdminBadgeKind;
  children: React.ReactNode;
  style?: React.CSSProperties;
  /** Classe do chamador (`.x.x.x` para vencer a base do componente). */
  className?: string;
}) {
  return (
    <span
      className={[styles.badge, kindClass[kind], className]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      {children}
    </span>
  );
}
