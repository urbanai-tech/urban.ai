"use client";

import React from "react";
import styles from "./AppButton.module.css";

/**
 * Botao app autenticado Urban AI.
 *
 * Substitui colorScheme={blue|teal|green|orange} chakra default + bg hex bruto
 * (`#ff5a5f`, `#1C1D3B`, `#E46E2E`, `#3FCF19`) que existia espalhado nas telas
 * antigas do anfitrião. Sempre accent accent da marca como primary, radius 10px,
 * letter-spacing 0.5, sem uppercase forcado.
 *
 * Estilos e estados (hover/active/disabled) vivem em AppButton.module.css.
 *
 * Variantes:
 *  - primary    — bg accent accent da marca, texto branco
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
  loadingLabel?: React.ReactNode;
  as?: "button" | "a";
  href?: string;
  fullWidth?: boolean;
};

export const AppButton = React.forwardRef<HTMLButtonElement, Props>(function AppButton(
  {
    variant = "primary",
    size = "md",
    leftIcon,
    rightIcon,
    loading,
    loadingLabel,
    disabled,
    children,
    style,
    className,
    "aria-label": ariaLabel,
    "aria-busy": ariaBusy,
    as,
    href,
    fullWidth = false,
    ...rest
  },
  ref,
) {
  const contextualLabel =
    ariaLabel ??
    (typeof children === "string" || typeof children === "number"
      ? String(children)
      : typeof loadingLabel === "string"
        ? loadingLabel
        : undefined);
  const resolvedAriaLabel = loading
    ? `${contextualLabel ?? "Ação"} — carregando`
    : ariaLabel;
  const resolvedClassName = [
    "urban-canonical-button",
    "urban-focus-ring",
    styles.button,
    styles[size],
    styles[variant],
    fullWidth ? styles.fullWidth : undefined,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {leftIcon}
      {loading && <span aria-hidden="true">…</span>}
      <span>{loading ? loadingLabel ?? children : children}</span>
      {rightIcon}
    </>
  );

  if (as === "a" && href) {
    return (
      <a
        href={href}
        className={resolvedClassName}
        style={style}
        aria-label={resolvedAriaLabel}
        aria-busy={loading || ariaBusy || undefined}
        aria-disabled={disabled || loading || undefined}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={resolvedClassName}
      style={style}
      aria-label={resolvedAriaLabel}
      aria-busy={loading || ariaBusy || undefined}
      {...rest}
    >
      {content}
    </button>
  );
});
