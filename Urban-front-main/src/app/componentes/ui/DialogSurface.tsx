"use client";

import React, { useRef } from "react";
import { useDialogFocus } from "./useDialogFocus";

type DialogSurfaceProps = Omit<React.HTMLAttributes<HTMLDivElement>, "role"> & {
  /** Chamado no Escape. Em dialogs que nao podem ser dispensados, passe um no-op. */
  onClose: () => void;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
};

/**
 * Casca de dialog modal para blocos renderizados condicionalmente:
 * role="dialog" + aria-modal, foco movido para dentro ao abrir, Tab preso,
 * Escape fecha e o foco volta ao gatilho ao desmontar (useDialogFocus).
 * Monte-o somente enquanto o dialog estiver aberto e informe o titulo via
 * aria-labelledby (ou aria-label).
 */
export function DialogSurface({ onClose, initialFocusRef, children, ...rest }: DialogSurfaceProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  useDialogFocus({ open: true, containerRef: ref, initialFocusRef, onClose });
  return (
    <div ref={ref} role="dialog" aria-modal="true" tabIndex={-1} {...rest}>
      {children}
    </div>
  );
}
