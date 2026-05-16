"use client";

import React from "react";

/**
 * Header de pagina/sessao light premium.
 *
 * Substitui `<Heading size="2xl" fontWeight="extrabold">` chakra default
 * usado em todas as telas autenticadas, sem hierarquia editorial.
 *
 *  - eyebrow uppercase letter-spacing 3 #E8500A (opcional)
 *  - display Bebas Neue clamp(36px, 5vw, 56px) — md size por default
 *  - subtitle Inter 400 14px muted (opcional)
 *  - slot direito pra actions
 */

export type AppSectionHeaderSize = "hero" | "md" | "sm";

export function AppSectionHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  size = "md",
  style,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  size?: AppSectionHeaderSize;
  style?: React.CSSProperties;
}) {
  const titleClass =
    size === "hero"
      ? "urban-app-display-hero"
      : size === "md"
        ? "urban-app-display-md"
        : "urban-app-display-sm";

  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
        paddingBottom: 24,
        borderBottom: "1px solid var(--app-divider)",
        marginBottom: 32,
        ...style,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        {eyebrow && (
          <p className="urban-app-eyebrow" style={{ marginBottom: 12 }}>
            {eyebrow}
          </p>
        )}
        <h1 className={titleClass}>{title}</h1>
        {subtitle && (
          <p
            style={{
              marginTop: 12,
              fontSize: 14,
              color: "var(--app-text-muted)",
              fontWeight: 400,
              lineHeight: 1.55,
              maxWidth: 720,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
            flexWrap: "wrap",
          }}
        >
          {actions}
        </div>
      )}
    </header>
  );
}
