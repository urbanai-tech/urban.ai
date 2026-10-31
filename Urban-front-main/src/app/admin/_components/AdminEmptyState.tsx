/**
 * Empty state admin Urban AI. Substitui "Nenhum registro encontrado.",
 * "Sem dados nos últimos 7 dias.", "Aguardando primeiro batch." crus.
 */
import React from "react";
import styles from "./AdminEmptyState.module.css";

export function AdminEmptyState({
  eyebrow,
  title,
  body,
  action,
  icon,
  headingAs: Heading = "h2",
}: {
  eyebrow?: string;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  /** Nivel do titulo: h1 quando o estado vazio e o unico conteudo da pagina; padrao h2. */
  headingAs?: "h1" | "h2" | "h3";
}) {
  return (
    <div
      className={styles.emptyState}
    >
      {icon && (
        <div
          className={styles.icon}
        >
          {icon}
        </div>
      )}
      {eyebrow && <p className="urban-admin-eyebrow">{eyebrow}</p>}
      <Heading className={`urban-admin-display-sm ${styles.title}`}>
        {title}
      </Heading>
      {body && (
        <p
          className={styles.body}
        >
          {body}
        </p>
      )}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
