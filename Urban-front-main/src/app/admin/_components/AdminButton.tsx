"use client";

import React from "react";

/**
 * Botão admin Urban AI.
 *
 * Substitui o padrão `bg-emerald-500 text-slate-900 font-bold rounded` repetido
 * 40+ vezes nas telas admin antigas. Sempre usa accent #E8500A como primary,
 * radius 2px, letter-spacing 1.5 uppercase em todas as variantes.
 *
 * Variantes:
 *  - primary    — bg #E8500A, texto #080A0F, ação principal
 *  - secondary  — border 1px white/15, texto white/92, ações secundárias
 *  - ghost      — sem border, texto white/65, hover underline accent
 *  - danger     — texto danger, border danger/30, ações destrutivas
 *
 * Sizes: sm (28px), md (36px default), lg (44px).
 */

export type AdminButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type AdminButtonSize = "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  as?: "button" | "a";
  href?: string;
};

const sizes: Record<AdminButtonSize, React.CSSProperties> = {
  sm: { height: 28, padding: "0 12px", fontSize: 11 },
  md: { height: 36, padding: "0 18px", fontSize: 12 },
  lg: { height: 44, padding: "0 24px", fontSize: 13 },
};

function styleForVariant(variant: AdminButtonVariant): React.CSSProperties {
  switch (variant) {
    case "primary":
      return {
        background: "var(--admin-accent)",
        color: "#080A0F",
        border: "1px solid var(--admin-accent)",
      };
    case "secondary":
      return {
        background: "transparent",
        color: "var(--admin-text)",
        border: "1px solid var(--admin-divider-strong)",
      };
    case "ghost":
      return {
        background: "transparent",
        color: "var(--admin-text-muted)",
        border: "1px solid transparent",
      };
    case "danger":
      return {
        background: "transparent",
        color: "var(--admin-danger)",
        border: "1px solid rgba(248, 113, 113, 0.3)",
      };
  }
}

export const AdminButton = React.forwardRef<HTMLButtonElement, Props>(
  function AdminButton(
    {
      variant = "secondary",
      size = "md",
      leftIcon,
      rightIcon,
      loading,
      disabled,
      children,
      style,
      as,
      href,
      ...rest
    },
    ref,
  ) {
    const base: React.CSSProperties = {
      ...sizes[size],
      ...styleForVariant(variant),
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      borderRadius: 2,
      fontWeight: 600,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      cursor: disabled || loading ? "not-allowed" : "pointer",
      opacity: disabled || loading ? 0.5 : 1,
      transition: "background 120ms, border-color 120ms, transform 80ms",
      whiteSpace: "nowrap",
      textDecoration: "none",
      lineHeight: 1,
      ...style,
    };

    const content = (
      <>
        {leftIcon}
        <span>{loading ? "…" : children}</span>
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
  },
);
