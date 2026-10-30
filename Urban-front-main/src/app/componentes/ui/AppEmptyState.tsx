/**
 * Empty state light premium. Substitui textos crus "Nenhum evento", "Sem dados".
 */
import React from "react";
import styles from "./AppEmptyState.module.css";

export function AppEmptyState({
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
    <div className={styles.emptyState}>
      {icon && <div className={styles.emptyIcon}>{icon}</div>}
      {eyebrow && <p className="urban-app-eyebrow">{eyebrow}</p>}
      <h3 className={`urban-app-display-sm ${styles.emptyTitle}`}>{title}</h3>
      {body && <p className={styles.emptyBody}>{body}</p>}
      {action && <div className={styles.emptyAction}>{action}</div>}
    </div>
  );
}
