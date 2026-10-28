/**
 * Badge light premium do app autenticado.
 *
 * Substitui `colorScheme={purple|orange|green}` chakra default e
 * `bg={blue.100} color={blue.700}` espalhado nas telas.
 */
import React from "react";
import styles from "./AppBadge.module.css";

export type AppBadgeKind =
  | "success"
  | "warn"
  | "error"
  | "neutral"
  | "accent";

export function AppBadge({
  kind = "neutral",
  children,
  style,
  className,
}: {
  kind?: AppBadgeKind;
  children: React.ReactNode;
  style?: React.CSSProperties;
  /** Classe extra; soma-se as classes do badge. */
  className?: string;
}) {
  return (
    <span className={[styles.badge, styles[kind], className].filter(Boolean).join(" ")} style={style}>
      {children}
    </span>
  );
}
