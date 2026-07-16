"use client";

import React, { useRef } from "react";
import { AppButton } from "./AppButton";
import { appRadius, appShadow, appVar } from "./styles";
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
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--app-backdrop)",
          backdropFilter: "blur(4px)",
        }}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 460,
          background: appVar.surfaceElevated,
          border: `1px solid ${appVar.dividerStrong}`,
          borderRadius: appRadius.dialog,
          padding: "28px 28px 24px",
          boxShadow: appShadow.overlay,
        }}
      >
        <h2
          id="app-confirm-title"
          style={{
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: -0.2,
            color: appVar.text,
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {title}
        </h2>
        {body && (
          <div
            style={{
              marginTop: 12,
              fontSize: 14,
              lineHeight: 1.6,
              color: appVar.textMuted,
            }}
          >
            {body}
          </div>
        )}
        <div
          style={{
            marginTop: 28,
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
          }}
        >
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
