"use client";

import React, { useEffect } from "react";
import { Close } from "./Icons";

/**
 * Drawer admin Urban AI — slide-in da direita 400-520px.
 * Substitui forms inline (NewCostForm, NewRegionForm) e detail views (audit JSON
 * crú em <pre>) das telas admin antigas.
 *
 * Uso típico:
 *  - Editar custo (finance)
 *  - Cadastrar região (coverage)
 *  - Ver detalhes técnicos de coletor (collectors-health)
 *  - Inspecionar audit log "Depois" como JSON formatado
 */

export function AdminDrawer({
  open,
  onClose,
  title,
  eyebrow,
  width = 480,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  eyebrow?: string;
  width?: number;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  // ESC fecha o drawer
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        className="urban-admin-backdrop"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(2px)",
        }}
      />
      <aside
        className="urban-admin-drawer-panel"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: width,
          background: "#0d1117",
          borderLeft: "1px solid var(--admin-divider)",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            padding: "24px 28px",
            borderBottom: "1px solid var(--admin-divider)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            {eyebrow && (
              <p className="urban-admin-eyebrow" style={{ marginBottom: 8 }}>
                {eyebrow}
              </p>
            )}
            {title && (
              <h2
                className="urban-admin-display-sm"
                style={{ textTransform: "uppercase" }}
              >
                {title}
              </h2>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: "transparent",
              border: "1px solid var(--admin-divider-strong)",
              borderRadius: 2,
              color: "var(--admin-text)",
              padding: 6,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 0,
            }}
          >
            <Close size={16} />
          </button>
        </header>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px 28px",
          }}
        >
          {children}
        </div>
        {footer && (
          <div
            style={{
              padding: "16px 28px",
              borderTop: "1px solid var(--admin-divider)",
              display: "flex",
              gap: 12,
              justifyContent: "flex-end",
              background: "rgba(0, 0, 0, 0.2)",
            }}
          >
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
}
