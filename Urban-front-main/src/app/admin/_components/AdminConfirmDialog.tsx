"use client";

import React, { useEffect } from "react";
import { AdminButton } from "./AdminButton";

/**
 * Dialog de confirmação admin Urban AI — substitui `confirm()` nativos
 * espalhados em 15+ ações destrutivas (waitlist, users, coverage, finance,
 * contacts, pricing-config, jobs).
 *
 * Uso típico:
 *   const [openConfirm, setOpenConfirm] = useState(false);
 *   <AdminButton variant="danger" onClick={() => setOpenConfirm(true)}>
 *     Deletar custo
 *   </AdminButton>
 *   <AdminConfirmDialog
 *     open={openConfirm}
 *     onClose={() => setOpenConfirm(false)}
 *     onConfirm={async () => { await deleteCost(id); setOpenConfirm(false); }}
 *     title="Deletar custo"
 *     body="Esta ação é permanente. O custo será removido da matriz."
 *     confirmLabel="Deletar"
 *     destructive
 *   />
 */

export function AdminConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}) {
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
      aria-labelledby="admin-confirm-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        className="urban-admin-backdrop"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.7)",
          backdropFilter: "blur(4px)",
        }}
      />
      <div
        className="urban-admin-drawer-panel"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 440,
          background: "#0d1117",
          border: "1px solid var(--admin-divider)",
          borderRadius: 4,
          padding: "28px 28px 24px",
        }}
      >
        <h2
          id="admin-confirm-title"
          style={{
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: -0.3,
            color: "var(--admin-text)",
            margin: 0,
          }}
        >
          {title}
        </h2>
        {body && (
          <p
            style={{
              marginTop: 12,
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--admin-text-muted)",
            }}
          >
            {body}
          </p>
        )}
        <div
          style={{
            marginTop: 28,
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
          }}
        >
          <AdminButton variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </AdminButton>
          <AdminButton
            variant={destructive ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}
