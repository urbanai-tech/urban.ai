"use client";

import React, { useRef } from "react";
import { AppButton } from "./AppButton";
import { Close, Sparkles } from "./Icons";
import { useDialogFocus } from "./useDialogFocus";
import styles from "./AskUrbanUpgradeModal.module.css";

/**
 * Modal de upgrade para usuários no plano `starter` que tentam abrir o
 * AskUrban. Substitui o drawer enquanto o usuário não migra pra
 * `profissional`. Pattern espelhado de `AppConfirmDialog` mas com identidade
 * do Ask (chip BETA, ícone Sparkles).
 *
 * Tracking: `ask_upgrade_modal_shown` é disparado pelo AskUrbanProvider — este
 * componente só renderiza.
 */

export function AskUrbanUpgradeModal({
  open,
  onClose,
  onUpgrade,
}: {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  useDialogFocus({ open, containerRef: panelRef, onClose });

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ask-upgrade-title"
      className={styles.modalRoot}
    >
      <div
        onClick={onClose}
        aria-hidden="true"
        className={styles.modalBackdrop}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={styles.modalPanel}
      >
        <button
          onClick={onClose}
          aria-label="Fechar modal de upgrade"
          className={`urban-focus-ring ${styles.closeButton}`}
        >
          <Close size={16} />
        </button>

        <div
          className={styles.betaChip}
        >
          <Sparkles size={14} />
          <span>Ask Urban · BETA</span>
        </div>

        <h2
          id="ask-upgrade-title"
          className={styles.modalTitle}
        >
          Disponível no plano Profissional
        </h2>

        <p
          className={styles.modalText}
        >
          O Ask Urban é o assistente conversacional que responde sobre receita
          projetada, ocupação comparada com imóveis parecidos, eventos próximos
          e desempenho dos seus anúncios em linguagem natural. Está incluso no plano
          Profissional e em planos superiores.
        </p>

        <div
          className={styles.modalActions}
        >
          <AppButton variant="ghost" onClick={onClose}>
            Fechar
          </AppButton>
          <AppButton variant="primary" onClick={onUpgrade}>
            Conhecer Profissional
          </AppButton>
        </div>
      </div>
    </div>
  );
}
