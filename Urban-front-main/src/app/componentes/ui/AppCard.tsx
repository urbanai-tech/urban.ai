"use client";

import React from "react";
import { appCardVariantStyle, appVar } from "./styles";

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
  const Element = Tag as React.ElementType;
  return (
    <Element
      onClick={onClick}
      style={{
        padding: 24,
        ...appCardVariantStyle[variant],
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
            color: appVar.text,
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
              color: appVar.textMuted,
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
