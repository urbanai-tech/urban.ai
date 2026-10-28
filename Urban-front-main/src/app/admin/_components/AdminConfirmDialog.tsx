"use client";

import React, { useRef } from "react";
import { AdminButton } from "./AdminButton";
import { useDialogFocus } from "../../componentes/ui/useDialogFocus";
import styles from "./AdminConfirmDialog.module.css";

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
      className={styles.overlay}
    >
      <div
        className={`urban-admin-backdrop ${styles.backdrop}`}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`urban-admin-drawer-panel ${styles.dialogPanel}`}
      >
        <h2
          id="admin-confirm-title"
          className={styles.title}
        >
          {title}
        </h2>
        {body && (
          <p
            className={styles.body}
          >
            {body}
          </p>
        )}
        <div
          className={styles.actions}
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
