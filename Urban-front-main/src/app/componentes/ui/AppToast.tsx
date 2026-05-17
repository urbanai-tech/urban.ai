"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AlertCircle, Check, Close, Info } from "./Icons";

/**
 * AppToast — toast manager light premium do anfitriao.
 *
 * Substitui `react-toastify` default (azul/verde/amarelo gritante que destoa
 * do design system). Coexiste com o componente — pode trocar gradualmente.
 *
 * Uso:
 *   const toast = useAppToast();
 *   toast.success("Sugestao aplicada.");
 *   toast.error("Falha ao salvar.");
 *
 * Coloque <AppToastProvider> uma vez no shell (já feito em HostShell quando
 * voce migrar).
 */

export type AppToastKind = "success" | "warn" | "error" | "info";

type Toast = {
  id: string;
  kind: AppToastKind;
  message: string;
  /** Optional sub-text (segunda linha menor) */
  sub?: string;
};

type Ctx = {
  show: (kind: AppToastKind, message: string, sub?: string) => void;
  success: (message: string, sub?: string) => void;
  error: (message: string, sub?: string) => void;
  warn: (message: string, sub?: string) => void;
  info: (message: string, sub?: string) => void;
  dismiss: (id: string) => void;
};

const AppToastContext = createContext<Ctx | null>(null);

const KIND_STYLE: Record<
  AppToastKind,
  { border: string; iconColor: string; bg: string }
> = {
  success: {
    border: "var(--app-success)",
    iconColor: "var(--app-success)",
    bg: "rgba(22, 160, 107, 0.06)",
  },
  warn: {
    border: "var(--app-warning)",
    iconColor: "var(--app-warning)",
    bg: "rgba(200, 129, 14, 0.06)",
  },
  error: {
    border: "var(--app-danger)",
    iconColor: "var(--app-danger)",
    bg: "rgba(194, 52, 46, 0.06)",
  },
  info: {
    border: "var(--app-accent)",
    iconColor: "var(--app-accent)",
    bg: "rgba(232, 80, 10, 0.06)",
  },
};

function IconFor({ kind }: { kind: AppToastKind }) {
  if (kind === "success") return <Check size={14} />;
  if (kind === "warn") return <AlertCircle size={14} />;
  if (kind === "error") return <AlertCircle size={14} />;
  return <Info size={14} />;
}

export function AppToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (kind: AppToastKind, message: string, sub?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev, { id, kind, message, sub }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const ctx: Ctx = {
    show,
    dismiss,
    success: (m, s) => show("success", m, s),
    error: (m, s) => show("error", m, s),
    warn: (m, s) => show("warn", m, s),
    info: (m, s) => show("info", m, s),
  };

  return (
    <AppToastContext.Provider value={ctx}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          zIndex: 3000,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          pointerEvents: "none",
          maxWidth: "calc(100vw - 40px)",
        }}
      >
        {toasts.map((t) => {
          const s = KIND_STYLE[t.kind];
          return (
            <div
              key={t.id}
              role="status"
              style={{
                pointerEvents: "auto",
                minWidth: 280,
                maxWidth: 420,
                padding: "14px 16px",
                background: "var(--app-surface)",
                border: "1px solid var(--app-divider)",
                borderLeft: `3px solid ${s.border}`,
                borderRadius: 8,
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                fontSize: 14,
                color: "var(--app-text)",
                boxShadow: "0 8px 24px rgba(14, 17, 22, 0.10)",
                animation: "urban-app-toast-in 220ms cubic-bezier(0.16, 1, 0.3, 1)",
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              <span
                style={{
                  color: s.iconColor,
                  marginTop: 1,
                  flexShrink: 0,
                  display: "inline-flex",
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: s.bg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconFor kind={t.kind} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 500, lineHeight: 1.4 }}>
                  {t.message}
                </p>
                {t.sub && (
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 12,
                      color: "var(--app-text-muted)",
                      lineHeight: 1.5,
                    }}
                  >
                    {t.sub}
                  </p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Fechar"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--app-text-muted)",
                  cursor: "pointer",
                  padding: 2,
                  lineHeight: 0,
                  display: "inline-flex",
                  flexShrink: 0,
                }}
              >
                <Close size={14} />
              </button>
            </div>
          );
        })}
      </div>
      <style jsx global>{`
        @keyframes urban-app-toast-in {
          from {
            transform: translateX(20px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </AppToastContext.Provider>
  );
}

export function useAppToast(): Ctx {
  const ctx = useContext(AppToastContext);
  if (!ctx) {
    return {
      show: (_k, m) => console.warn("[AppToast] no provider:", m),
      dismiss: () => undefined,
      success: (m) => console.warn("[AppToast] success:", m),
      error: (m) => console.warn("[AppToast] error:", m),
      warn: (m) => console.warn("[AppToast] warn:", m),
      info: (m) => console.warn("[AppToast] info:", m),
    };
  }
  return ctx;
}
