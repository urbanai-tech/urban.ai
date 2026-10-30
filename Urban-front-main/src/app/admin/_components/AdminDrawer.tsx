"use client";

import React, { useRef } from "react";
import { Close } from "./Icons";
import { useDialogFocus } from "../../componentes/ui/useDialogFocus";
import styles from "./AdminDrawer.module.css";

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
  const drawerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useDialogFocus({
    open,
    containerRef: drawerRef,
    initialFocusRef: closeRef,
    onClose,
  });

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={styles.overlay}
    >
      <div
        className={`urban-admin-backdrop ${styles.backdrop}`}
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        tabIndex={-1}
        className={`urban-admin-drawer-panel ${styles.panel}`}
        style={{ "--drawer-max-width": `${width}px` } as React.CSSProperties}
      >
        <header
          className={styles.header}
        >
          <div className={styles.headerText}>
            {eyebrow && (
              <p className={`urban-admin-eyebrow ${styles.eyebrow}`}>
                {eyebrow}
              </p>
            )}
            {title && (
              <h2
                className={`urban-admin-display-sm ${styles.title}`}
              >
                {title}
              </h2>
            )}
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Fechar"
            className={styles.closeButton}
          >
            <Close size={16} />
          </button>
        </header>
        <div
          className={styles.body}
        >
          {children}
        </div>
        {footer && (
          <div
            className={styles.footer}
          >
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
}
