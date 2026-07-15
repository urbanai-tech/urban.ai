"use client";

import React, { useRef } from "react";
import { AdminButton } from "./AdminButton";
import { useDialogFocus } from "../../componentes/ui/useDialogFocus";

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
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  useDialogFocus({
    open,
    containerRef: dialogRef,
    initialFocusRef: cancelRef,
    onClose,
  });

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
          background: "var(--admin-backdrop, rgba(0, 0, 0, 0.7))",
          backdropFilter: "blur(4px)",
        }}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="urban-admin-drawer-panel"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 440,
          background: "var(--admin-surface-elevated)",
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
          <AdminButton ref={cancelRef} variant="ghost" onClick={onClose} disabled={loading}>
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
