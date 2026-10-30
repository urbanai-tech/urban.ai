"use client";

import React from "react";
import styles from "./AppSectionHeader.module.css";

/**
 * Header de página/sessão light premium.
 *
 * Substitui `<Heading size="2xl" fontWeight="extrabold">` chakra default
 * usado em todas as telas autenticadas, sem hierarquia editorial.
 *
 *  - eyebrow uppercase letter-spacing 3 accent da marca (opcional)
 *  - display Archivo (display) clamp(36px, 5vw, 56px) — md size por default
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
    <header className={styles.sectionHeader} style={style}>
      <div className={styles.sectionHeaderText}>
        {eyebrow && (
          <p className={`urban-app-eyebrow ${styles.sectionHeaderEyebrow}`}>
            {eyebrow}
          </p>
        )}
        <h1 className={titleClass}>{title}</h1>
        {subtitle && <p className={styles.sectionHeaderSubtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.sectionHeaderActions}>{actions}</div>}
    </header>
  );
}
