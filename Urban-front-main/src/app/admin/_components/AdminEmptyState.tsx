/**
 * Empty state admin Urban AI. Substitui "Nenhum registro encontrado.",
 * "Sem dados nos últimos 7 dias.", "Aguardando primeiro batch." crus.
 */
import React from "react";

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
      style={{
        padding: "48px 24px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        border: "1px dashed var(--admin-divider)",
        borderRadius: 2,
      }}
    >
      {icon && (
        <div
          style={{
            color: "var(--admin-text-dim)",
            marginBottom: 4,
          }}
        >
          {icon}
        </div>
      )}
      {eyebrow && <p className="urban-admin-eyebrow">{eyebrow}</p>}
      <h3 className="urban-admin-display-sm" style={{ textTransform: "uppercase" }}>
        {title}
      </h3>
      {body && (
        <p
          style={{
            fontSize: 14,
            color: "var(--admin-text-muted)",
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
