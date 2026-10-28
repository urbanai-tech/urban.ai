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
}: {
  eyebrow?: string;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
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
      <h3 className={`urban-admin-display-sm ${styles.title}`}>
        {title}
      </h3>
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
