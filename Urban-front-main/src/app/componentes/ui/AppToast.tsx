"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertCircle, Check, Close, Info } from "./Icons";
import styles from "./AppToast.module.css";

/**
 * AppToast — toast manager light premium do anfitrião.
 *
 * Substitui o toast legado default (azul/verde/amarelo gritante que destoa
 * do design system). Coexiste com o componente — pode trocar gradualmente.
 *
 * Uso:
 *   const toast = useAppToast();
 *   toast.success("Sugestão aplicada.");
 *   toast.error("Falha ao salvar.");
 *
 * Coloque <AppToastProvider> uma vez no shell (já feito em HostShell quando
 * você migrar).
 */

export type AppToastKind = "success" | "warn" | "error" | "info";
type ToastCompatType = AppToastKind | "warning" | "default";
type ToastCompatOptions = {
  type?: ToastCompatType;
};

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

const KIND_CLASS: Record<AppToastKind, string> = {
  success: styles.toastSuccess,
  warn: styles.toastWarn,
  error: styles.toastError,
  info: styles.toastInfo,
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

  const ctx: Ctx = useMemo(
    () => ({
      show,
      dismiss,
      success: (m, s) => show("success", m, s),
      error: (m, s) => show("error", m, s),
      warn: (m, s) => show("warn", m, s),
      info: (m, s) => show("info", m, s),
    }),
    [dismiss, show],
  );

  return (
    <AppToastContext.Provider value={ctx}>
      {children}
      <div aria-live="polite" aria-atomic="true" className={styles.toastStack}>
        {toasts.map((t) => {
          const isErrorish = t.kind === "error" || t.kind === "warn";
          return (
            <div
              key={t.id}
              role={isErrorish ? "alert" : "status"}
              aria-live={isErrorish ? "assertive" : "polite"}
              className={`${styles.toast} ${KIND_CLASS[t.kind]}`}
            >
              <span className={styles.toastIcon}>
                <IconFor kind={t.kind} />
              </span>
              <div className={styles.toastBody}>
                <p className={styles.toastMessage}>{t.message}</p>
                {t.sub && <p className={styles.toastSub}>{t.sub}</p>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Fechar notificação"
                className={`urban-focus-ring ${styles.toastClose}`}
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
        .urban-focus-ring:focus-visible {
          outline: 2px solid var(--app-accent);
          outline-offset: 2px;
        }
        .urban-focus-ring-inverse:focus-visible {
          outline: 2px solid var(--app-surface);
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          [role="status"],
          [role="alert"] {
            animation: none !important;
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

export function useToastCompat() {
  const appToast = useAppToast();
  return useMemo(
    () => Object.assign(
      (message: React.ReactNode, options?: ToastCompatOptions) => {
        const kind: AppToastKind =
          options?.type === "success"
            ? "success"
            : options?.type === "error"
              ? "error"
              : options?.type === "warning" || options?.type === "warn"
                ? "warn"
                : "info";
        appToast.show(kind, String(message ?? ""));
      },
      {
        success: (message: React.ReactNode) => appToast.success(String(message ?? "")),
        error: (message: React.ReactNode) => appToast.error(String(message ?? "")),
        warn: (message: React.ReactNode) => appToast.warn(String(message ?? "")),
        warning: (message: React.ReactNode) => appToast.warn(String(message ?? "")),
        info: (message: React.ReactNode) => appToast.info(String(message ?? "")),
      },
    ),
    [appToast],
  );
}
