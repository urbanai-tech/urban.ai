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
    <div className={styles.emptyState}>
      {icon && <div className={styles.emptyIcon}>{icon}</div>}
      {eyebrow && <p className="urban-app-eyebrow">{eyebrow}</p>}
      <Heading className={`urban-app-display-sm ${styles.emptyTitle}`}>{title}</Heading>
      {body && <p className={styles.emptyBody}>{body}</p>}
      {action && <div className={styles.emptyAction}>{action}</div>}
    </div>
  );
}
