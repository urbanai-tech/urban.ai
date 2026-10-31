"use client";

import React from "react";
import styles from "./AppCard.module.css";

/**
 * Card light premium do app autenticado.
 *
 * Variantes:
 *  - default   — fundo branco, border divider, shadow-sm
 *  - elevated  — shadow maior, mais destaque
 *  - accent    — border-left 3px accent da marca, fundo branco (call-out)
 *  - subtle    — fundo cinza claro, sem shadow
 */

export type AppCardVariant = "default" | "elevated" | "accent" | "subtle";

export function AppCard({
  variant = "default",
  children,
  style,
  className,
  as: Tag = "div",
  onClick,
}: {
  variant?: AppCardVariant;
  children: React.ReactNode;
  style?: React.CSSProperties;
  /** Classe extra (CSS Module do caller, `.x.x`); soma-se as classes do card. */
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  onClick?: React.MouseEventHandler<HTMLElement>;
}) {
  const Element = Tag as React.ElementType;
  const resolvedClassName = [styles.card, variant !== "default" ? styles[variant] : undefined, className]
    .filter(Boolean)
    .join(" ");
  return (
    <Element onClick={onClick} className={resolvedClassName} style={style}>
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
  className,
  titleAs: TitleTag = "h2",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  /** Nivel do titulo. Padrao h2 (card direto sob o h1 da pagina); use h3 dentro de uma secao com h2. */
  titleAs?: "h2" | "h3" | "h4";
}) {
  return (
    <header className={[styles.header, className].filter(Boolean).join(" ")} style={style}>
      <div className={styles.headerText}>
        {eyebrow && (
          <p className={`urban-app-eyebrow-muted ${styles.eyebrow}`}>{eyebrow}</p>
        )}
        <TitleTag className={styles.title}>{title}</TitleTag>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
