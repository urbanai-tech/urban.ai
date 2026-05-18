"use client";

import React, { useEffect } from "react";
import { AppButton } from "./AppButton";
import { Close, Sparkles } from "./Icons";

/**
 * Modal de upgrade para usuarios no plano `starter` que tentam abrir o
 * AskUrban. Substitui o drawer enquanto o usuario nao migra pra
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
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ask-upgrade-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
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
          background: "rgba(14, 17, 22, 0.48)",
          backdropFilter: "blur(4px)",
        }}
      />
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 480,
          background: "var(--app-surface-elevated, #FFFFFF)",
          border: "1px solid var(--app-divider-strong)",
          borderRadius: 14,
          padding: "28px 28px 24px",
          boxShadow: "0 18px 48px rgba(14, 17, 22, 0.14)",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Fechar modal de upgrade"
          className="focus-visible:outline-2 focus-visible:outline-[var(--app-accent)] focus-visible:outline-offset-2"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "transparent",
            border: "none",
            color: "var(--app-text-muted)",
            cursor: "pointer",
            padding: 8,
            minWidth: 44,
            minHeight: 44,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 0,
            borderRadius: 6,
          }}
        >
          <Close size={16} />
        </button>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            background: "rgba(232, 80, 10, 0.08)",
            border: "1px solid rgba(232, 80, 10, 0.18)",
            borderRadius: 999,
            color: "var(--app-accent)",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.3,
          }}
        >
          <Sparkles size={14} />
          <span>Ask Urban · BETA</span>
        </div>

        <h2
          id="ask-upgrade-title"
          style={{
            margin: "18px 0 10px",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: -0.3,
            color: "var(--app-text)",
            lineHeight: 1.25,
          }}
        >
          Disponível no plano Profissional
        </h2>

        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--app-text-muted)",
          }}
        >
          O Ask Urban é o assistente conversacional que responde sobre receita
          projetada, ocupação vs comp set, eventos próximos e performance dos
          seus anúncios em linguagem natural. Está incluso no plano
          Profissional e em planos superiores.
        </p>

        <div
          style={{
            marginTop: 28,
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
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
