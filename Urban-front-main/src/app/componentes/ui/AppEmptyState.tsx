/**
 * Empty state light premium. Substitui textos crus "Nenhum evento", "Sem dados".
 */
import React from "react";

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
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        border: "1px dashed var(--app-divider-strong)",
        borderRadius: 12,
        background: "var(--app-surface-muted)",
      }}
    >
      {icon && (
        <div style={{ color: "var(--app-text-dim)", marginBottom: 4 }}>{icon}</div>
      )}
      {eyebrow && <p className="urban-app-eyebrow">{eyebrow}</p>}
      <h3
        className="urban-app-display-sm"
        style={{ textTransform: "uppercase" }}
      >
        {title}
      </h3>
      {body && (
        <p
          style={{
            fontSize: 14,
            color: "var(--app-text-muted)",
            maxWidth: 480,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {body}
        </p>
      )}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}
