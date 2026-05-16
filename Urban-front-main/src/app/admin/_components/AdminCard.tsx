/**
 * Card admin Urban AI — container neutro. Sem rounded-xl colorido. Apenas
 * separação por divider sutil ou padding generoso.
 *
 * Variantes:
 *  - default     — sem fundo, apenas border sutil
 *  - subtle      — fundo rgba(255,255,255,0.02), border divider
 *  - accent      — pull-quote style: border-left 2px #E8500A
 */
import React from "react";

export type AdminCardVariant = "default" | "subtle" | "accent";

export function AdminCard({
  variant = "default",
  children,
  style,
  as: Tag = "div",
}: {
  variant?: AdminCardVariant;
  children: React.ReactNode;
  style?: React.CSSProperties;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  const variants: Record<AdminCardVariant, React.CSSProperties> = {
    default: {
      border: "1px solid var(--admin-divider)",
      background: "transparent",
    },
    subtle: {
      border: "1px solid var(--admin-divider)",
      background: "var(--admin-surface)",
    },
    accent: {
      borderLeft: "2px solid var(--admin-accent)",
      borderTop: "1px solid var(--admin-divider)",
      borderRight: "1px solid var(--admin-divider)",
      borderBottom: "1px solid var(--admin-divider)",
      background: "var(--admin-surface)",
    },
  };

  const Element = Tag as React.ElementType;
  return (
    <Element
      style={{
        borderRadius: 2,
        padding: 24,
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </Element>
  );
}

export function AdminCardHeader({
  eyebrow,
  title,
  actions,
  style,
}: {
  eyebrow?: string;
  title: React.ReactNode;
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
          <p
            className="urban-admin-eyebrow-muted"
            style={{ marginBottom: 6 }}
          >
            {eyebrow}
          </p>
        )}
        <h3
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--admin-text)",
            letterSpacing: -0.2,
            margin: 0,
          }}
        >
          {title}
        </h3>
      </div>
      {actions && <div style={{ flexShrink: 0 }}>{actions}</div>}
    </header>
  );
}
