/**
 * Badge light premium do app autenticado.
 *
 * Substitui `colorScheme={purple|orange|green}` chakra default e
 * `bg={blue.100} color={blue.700}` espalhado nas telas.
 */
import React from "react";
import { appRadius, appTone } from "./styles";

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
        borderRadius: appRadius.pill,
        border: "1px solid",
        lineHeight: 1.4,
        whiteSpace: "nowrap",
        ...appTone[kind],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
