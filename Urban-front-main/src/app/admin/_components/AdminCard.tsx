/**
 * Card admin Urban AI — container neutro. Sem rounded-xl colorido. Apenas
 * separação por divider sutil ou padding generoso.
 *
 * Variantes:
 *  - default     — sem fundo, apenas border sutil
 *  - subtle      — fundo superfície sutil, border divider
 *  - accent      — pull-quote style: border-left 2px accent da marca
 */
import React from "react";
import styles from "./AdminCard.module.css";

export type AdminCardVariant = "default" | "subtle" | "accent";

const variantClass: Record<AdminCardVariant, string> = {
  default: styles.variantDefault,
  subtle: styles.variantSubtle,
  accent: styles.variantAccent,
};

export function AdminCard({
  variant = "default",
  children,
  style,
  className,
  as: Tag = "div",
}: {
  variant?: AdminCardVariant;
  children: React.ReactNode;
  style?: React.CSSProperties;
  /**
   * Classe do chamador. Entra depois da base e da variante; os seletores do
   * CSS Module do componente têm especificidade 0,2,0, então uma classe do
   * chamador com 3 classes (`.x.x.x`) sempre vence.
   */
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  const Element = Tag as React.ElementType;
  return (
    <Element
      className={[styles.card, variantClass[variant], className]
        .filter(Boolean)
        .join(" ")}
      style={style}
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
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  actions?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <header
      className={[styles.header, className].filter(Boolean).join(" ")}
      style={style}
    >
      <div className={styles.headerText}>
        {eyebrow && (
          <p
            className={`urban-admin-eyebrow-muted ${styles.headerEyebrow}`}
          >
            {eyebrow}
          </p>
        )}
        <h3
          className={styles.headerTitle}
        >
          {title}
        </h3>
      </div>
      {actions && <div className={styles.headerActions}>{actions}</div>}
    </header>
  );
}
