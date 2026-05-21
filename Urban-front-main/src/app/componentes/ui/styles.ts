import type React from "react";

/**
 * Shared style primitives for the authenticated Urban AI app design system.
 *
 * Keep semantic values here and raw component layout inside each component.
 * CSS variable values still live in `globals.css`; these helpers make TSX
 * components consume that contract consistently.
 */

export const appVar = {
  bg: "var(--app-bg)",
  surface: "var(--app-surface)",
  surfaceElevated: "var(--app-surface-elevated, #FFFFFF)",
  surfaceMuted: "var(--app-surface-muted)",
  text: "var(--app-text)",
  textMuted: "var(--app-text-muted)",
  textDim: "var(--app-text-dim)",
  divider: "var(--app-divider)",
  dividerStrong: "var(--app-divider-strong)",
  accent: "var(--app-accent)",
  accentSoft: "var(--app-accent-soft)",
  accentHover: "var(--app-accent-hover)",
  success: "var(--app-success)",
  warning: "var(--app-warning)",
  danger: "var(--app-danger)",
  white: "#FFFFFF",
} as const;

export const appRadius = {
  card: "var(--app-radius-card)",
  control: "var(--app-radius-control)",
  pill: "var(--app-radius-pill)",
  subtle: 8,
  dialog: 14,
} as const;

export const appShadow = {
  card: "var(--app-shadow-card, 0 1px 2px rgba(14, 17, 22, 0.04))",
  elevated: "var(--app-shadow-elevated, 0 4px 16px rgba(14, 17, 22, 0.06))",
  overlay: "var(--app-shadow-overlay, 0 18px 48px rgba(14, 17, 22, 0.12))",
} as const;

export const appFont = {
  sans: "Inter, system-ui, sans-serif",
} as const;

export const appTransition = {
  control: "background 120ms, border-color 120ms, box-shadow 120ms, transform 80ms",
  field: "border-color 120ms, box-shadow 120ms",
} as const;

export const appTone = {
  success: {
    color: appVar.success,
    background: "rgba(22, 160, 107, 0.10)",
    borderColor: "rgba(22, 160, 107, 0.25)",
  },
  warn: {
    color: appVar.warning,
    background: "rgba(200, 129, 14, 0.10)",
    borderColor: "rgba(200, 129, 14, 0.25)",
  },
  error: {
    color: appVar.danger,
    background: "rgba(194, 52, 46, 0.10)",
    borderColor: "rgba(194, 52, 46, 0.25)",
  },
  neutral: {
    color: appVar.textMuted,
    background: appVar.surfaceMuted,
    borderColor: appVar.dividerStrong,
  },
  accent: {
    color: appVar.accent,
    background: appVar.accentSoft,
    borderColor: "rgba(232, 80, 10, 0.25)",
  },
} satisfies Record<string, React.CSSProperties>;

export const appCardVariantStyle = {
  default: {
    background: appVar.surface,
    border: `1px solid ${appVar.divider}`,
    borderRadius: appRadius.card,
    boxShadow: appShadow.card,
  },
  elevated: {
    background: appVar.surface,
    border: `1px solid ${appVar.divider}`,
    borderRadius: appRadius.card,
    boxShadow: appShadow.elevated,
  },
  accent: {
    background: appVar.surface,
    border: `1px solid ${appVar.divider}`,
    borderLeft: `3px solid ${appVar.accent}`,
    borderRadius: appRadius.subtle,
    boxShadow: appShadow.card,
  },
  subtle: {
    background: appVar.surfaceMuted,
    border: `1px solid ${appVar.divider}`,
    borderRadius: appRadius.card,
  },
} satisfies Record<string, React.CSSProperties>;

export const appFieldBaseStyle: React.CSSProperties = {
  width: "100%",
  height: 40,
  padding: "0 14px",
  background: appVar.surface,
  border: `1px solid ${appVar.dividerStrong}`,
  borderRadius: appRadius.control,
  color: appVar.text,
  fontSize: 14,
  fontWeight: 400,
  outline: "none",
  transition: appTransition.field,
  fontFamily: appFont.sans,
};

export const appLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color: appVar.textMuted,
  marginBottom: 6,
};

export const appHelperTextStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: appVar.textMuted,
};

export const appErrorTextStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: appVar.danger,
};

export function appDisabledStyle(disabled: boolean): React.CSSProperties {
  return {
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}
