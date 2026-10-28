/**
 * Header de seção/página admin Urban AI.
 *
 * Substitui `<h1 className="text-2xl font-bold">` + `<p className="text-sm text-slate-400">`
 * usado em todas as 19 telas admin antigas — sempre genérico, sem hierarquia editorial.
 *
 * Estrutura:
 *  - eyebrow uppercase letter-spacing 3 accent da marca (opcional, identifica área)
 *  - display Archivo (display) clamp(40px, 5vw, 56px) — md size por default
 *  - subtitle Inter 400 14px text-muted (opcional)
 *  - slot direito pra actions (botões, links, switches)
 */
import React from "react";
import styles from "./AdminSectionHeader.module.css";

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
      <div className={styles.boxMinw0Flex1}>
        {eyebrow && (
          <p className={`urban-admin-eyebrow ${styles.eyebrowMb12}`}>
            {eyebrow}
          </p>
        )}
        <h1
          className={[titleClass, styles.titleUpper].filter(Boolean).join(" ")}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={styles.textTextMutedFs14}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div
          className={styles.rowCenteredWrap}
        >
          {actions}
        </div>
      )}
    </header>
  );
}
