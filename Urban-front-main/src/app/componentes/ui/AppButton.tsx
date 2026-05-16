"use client";

import React from "react";

/**
 * Botao app autenticado Urban AI.
 *
 * Substitui colorScheme={blue|teal|green|orange} chakra default + bg hex bruto
 * (`#ff5a5f`, `#1C1D3B`, `#E46E2E`, `#3FCF19`) que existia espalhado nas telas
 * antigas do anfitriao. Sempre accent #E8500A como primary, radius 10px,
 * letter-spacing 0.5, sem uppercase forcado.
 *
 * Variantes:
 *  - primary    — bg accent #E8500A, texto branco
 *  - secondary  — border 1px divider-strong, texto primary
 *  - ghost      — sem border, texto muted, hover underline accent
 *  - danger     — texto danger, border danger soft
 */

export type AppButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type AppButtonSize = "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  as?: "button" | "a";
  href?: string;
  fullWidth?: boolean;
};

const sizes: Record<AppButtonSize, React.CSSProperties> = {
  sm: { height: 32, padding: "0 14px", fontSize: 13 },
  md: { height: 40, padding: "0 18px", fontSize: 14 },
  lg: { height: 48, padding: "0 24px", fontSize: 15 },
};

function styleForVariant(variant: AppButtonVariant): React.CSSProperties {
  switch (variant) {
    case "primary":
      return {
        background: "var(--app-accent)",
        color: "#FFFFFF",
        border: "1px solid var(--app-accent)",
      };
    case "secondary":
      return {
        background: "transparent",
        color: "var(--app-text)",
        border: "1px solid var(--app-divider-strong)",
      };
    case "ghost":
      return {
        background: "transparent",
        color: "var(--app-text-muted)",
        border: "1px solid transparent",
      };
    case "danger":
      return {
        background: "transparent",
        color: "var(--app-danger)",
        border: "1px solid rgba(194, 52, 46, 0.25)",
      };
  }
}

export const AppButton = React.forwardRef<HTMLButtonElement, Props>(function AppButton(
  {
    variant = "primary",
    size = "md",
    leftIcon,
    rightIcon,
    loading,
    disabled,
    children,
    style,
    as,
    href,
    fullWidth = false,
    ...rest
  },
  ref,
) {
  const base: React.CSSProperties = {
    ...sizes[size],
    ...styleForVariant(variant),
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    fontWeight: 600,
    letterSpacing: 0.2,
    cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled || loading ? 0.5 : 1,
    transition: "background 120ms, border-color 120ms, transform 80ms",
    whiteSpace: "nowrap",
    textDecoration: "none",
    lineHeight: 1,
    width: fullWidth ? "100%" : undefined,
    ...style,
  };

  const content = (
    <>
      {leftIcon}
      <span>{loading ? "..." : children}</span>
      {rightIcon}
    </>
  );

  if (as === "a" && href) {
    return (
      <a href={href} style={base}>
        {content}
      </a>
    );
  }

  return (
    <button ref={ref} disabled={disabled || loading} style={base} {...rest}>
      {content}
    </button>
  );
});
