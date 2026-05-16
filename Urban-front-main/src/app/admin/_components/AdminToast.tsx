"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AdminStatusDot, type AdminStatusKind } from "./AdminStatusDot";
import { Close } from "./Icons";

/**
 * Toast manager admin Urban AI — top-right, dark, accent. Substitui
 * `alert()` nativo + chakra useToast() em ações admin.
 *
 * Uso:
 *   const toast = useAdminToast();
 *   toast.success("Custo salvo.");
 *   toast.error("Falha ao deletar.");
 */

type Toast = {
  id: string;
  kind: AdminStatusKind;
  message: string;
};

type Ctx = {
  show: (kind: AdminStatusKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
  info: (message: string) => void;
};

const AdminToastContext = createContext<Ctx | null>(null);

export function AdminToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (kind: AdminStatusKind, message: string) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, kind, message }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const ctx: Ctx = {
    show,
    success: (m) => show("success", m),
    error: (m) => show("error", m),
    warn: (m) => show("warn", m),
    info: (m) => show("accent", m),
  };

  return (
    <AdminToastContext.Provider value={ctx}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "fixed",
          top: 24,
          right: 24,
          zIndex: 2000,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            style={{
              pointerEvents: "auto",
              minWidth: 280,
              maxWidth: 420,
              padding: "12px 14px",
              background: "#0d1117",
              border: "1px solid var(--admin-divider-strong)",
              borderLeft: `2px solid ${kindColor(t.kind)}`,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 13,
              color: "var(--admin-text)",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
            }}
          >
            <AdminStatusDot kind={t.kind} size={8} />
            <span style={{ flex: 1 }}>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Fechar"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--admin-text-muted)",
                cursor: "pointer",
                lineHeight: 0,
                padding: 2,
              }}
            >
              <Close size={14} />
            </button>
          </div>
        ))}
      </div>
    </AdminToastContext.Provider>
  );
}

function kindColor(k: AdminStatusKind): string {
  switch (k) {
    case "success": return "var(--admin-success)";
    case "warn": return "var(--admin-warning)";
    case "error": return "var(--admin-danger)";
    case "accent": return "var(--admin-accent)";
    default: return "var(--admin-text-muted)";
  }
}

export function useAdminToast(): Ctx {
  const ctx = useContext(AdminToastContext);
  if (!ctx) {
    // fallback dev — não quebra se chamado fora do provider
    return {
      show: (_k, m) => console.warn("[AdminToast] no provider:", m),
      success: (m) => console.warn("[AdminToast] success:", m),
      error: (m) => console.warn("[AdminToast] error:", m),
      warn: (m) => console.warn("[AdminToast] warn:", m),
      info: (m) => console.warn("[AdminToast] info:", m),
    };
  }
  return ctx;
}
