"use client";

import React from "react";

/**
 * Card light premium do app autenticado.
 *
 * Variantes:
 *  - default   — fundo branco, border divider, shadow-sm
 *  - elevated  — shadow maior, mais destaque
 *  - accent    — border-left 3px #E8500A, fundo branco (call-out)
 *  - subtle    — fundo cinza claro, sem shadow
 */

export type AppCardVariant = "default" | "elevated" | "accent" | "subtle";

export function AppCard({
  variant = "default",
  children,
  style,
  as: Tag = "div",
  onClick,
}: {
  variant?: AppCardVariant;
  children: React.ReactNode;
  style?: React.CSSProperties;
  as?: keyof React.JSX.IntrinsicElements;
  onClick?: () => void;
}) {
  const variants: Record<AppCardVariant, React.CSSProperties> = {
    default: {
      background: "var(--app-surface)",
      border: "1px solid var(--app-divider)",
      borderRadius: "var(--app-radius-card)",
      boxShadow: "0 1px 2px rgba(14, 17, 22, 0.04)",
    },
    elevated: {
      background: "var(--app-surface)",
      border: "1px solid var(--app-divider)",
      borderRadius: "var(--app-radius-card)",
      boxShadow: "0 4px 16px rgba(14, 17, 22, 0.06)",
    },
    accent: {
      background: "var(--app-surface)",
      border: "1px solid var(--app-divider)",
      borderLeft: "3px solid var(--app-accent)",
      borderRadius: 8,
      boxShadow: "0 1px 2px rgba(14, 17, 22, 0.04)",
    },
    subtle: {
      background: "var(--app-surface-muted)",
      border: "1px solid var(--app-divider)",
      borderRadius: "var(--app-radius-card)",
    },
  };

  const Element = Tag as React.ElementType;
  return (
    <Element
      onClick={onClick}
      style={{
        padding: 24,
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </Element>
  );
}

export function AppCardHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  style,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 16,
        ...style,
      }}
    >
      <div style={{ minWidth: 0 }}>
        {eyebrow && (
          <p className="urban-app-eyebrow-muted" style={{ marginBottom: 6 }}>
            {eyebrow}
          </p>
        )}
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--app-text)",
            letterSpacing: -0.2,
            margin: 0,
          }}
        >
          {title}
        </h3>
        {subtitle && (
          <p
            style={{
              fontSize: 13,
              color: "var(--app-text-muted)",
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ flexShrink: 0 }}>{actions}</div>}
    </header>
  );
}
