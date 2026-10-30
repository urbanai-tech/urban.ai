"use client";

import React, { useRef } from "react";
import { AppButton } from "./AppButton";
import styles from "./AppConfirmDialog.module.css";
import { useDialogFocus } from "./useDialogFocus";

/**
 * Dialog de confirmação light premium pro app anfitrião.
 *
 * Espelha o `AdminConfirmDialog` mas usando os tokens light do host
 * (`var(--app-*)`). Substitui `window.confirm()` nativos espalhados em ações
 * destrutivas do anfitrião (bulk action portfolio, aceitar sugestões em lote,
 * deletar imóvel, etc.).
 *
 * Uso típico:
 *   const [open, setOpen] = useState(false);
 *   <AppButton variant="primary" onClick={() => setOpen(true)}>Aceitar sugestões</AppButton>
 *   <AppConfirmDialog
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     onConfirm={async () => { await runBulk(); setOpen(false); }}
 *     title="Aceitar sugestões"
 *     body="A Urban AI vai aplicar o preço sugerido em todos os imóveis selecionados nos dias com sugestão ativa."
 *     confirmLabel="Aplicar em 3 imóveis"
 *   />
 */

export function AppConfirmDialog({
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
      aria-labelledby="app-confirm-title"
      className={styles.dialogRoot}
    >
      <div onClick={onClose} aria-hidden="true" className={styles.dialogBackdrop} />
      <div ref={dialogRef} tabIndex={-1} className={styles.dialogPanel}>
        <h2 id="app-confirm-title" className={styles.dialogTitle}>
          {title}
        </h2>
        {body && <div className={styles.dialogBody}>{body}</div>}
        <div className={styles.dialogActions}>
          <AppButton ref={cancelRef} variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </AppButton>
          <AppButton
            variant={destructive ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </AppButton>
        </div>
      </div>
    </div>
  );
}
