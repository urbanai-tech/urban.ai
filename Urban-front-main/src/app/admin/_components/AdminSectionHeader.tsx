/**
 * Header de seção/página admin Urban AI.
 *
 * Substitui `<h1 className="text-2xl font-bold">` + `<p className="text-sm text-slate-400">`
 * usado em todas as 19 telas admin antigas — sempre genérico, sem hierarquia editorial.
 *
 * Estrutura:
 *  - eyebrow uppercase letter-spacing 3 #E8500A (opcional, identifica área)
 *  - display Bebas Neue clamp(40px, 5vw, 56px) — md size por default
 *  - subtitle Inter 400 14px rgba(255,255,255,0.55) (opcional)
 *  - slot direito pra actions (botões, links, switches)
 */
import React from "react";

export type AdminSectionHeaderSize = "hero" | "md" | "sm";

export function AdminSectionHeader({
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
  size?: AdminSectionHeaderSize;
  style?: React.CSSProperties;
}) {
  const titleClass =
    size === "hero"
      ? "urban-admin-display-hero"
      : size === "md"
        ? "urban-admin-display-md"
        : "urban-admin-display-sm";

  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
        paddingBottom: 24,
        borderBottom: "1px solid var(--admin-divider)",
        marginBottom: 32,
        ...style,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        {eyebrow && (
          <p className="urban-admin-eyebrow" style={{ marginBottom: 12 }}>
            {eyebrow}
          </p>
        )}
        <h1
          className={titleClass}
          style={{ textTransform: "uppercase" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              marginTop: 12,
              fontSize: 14,
              color: "var(--admin-text-muted)",
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
