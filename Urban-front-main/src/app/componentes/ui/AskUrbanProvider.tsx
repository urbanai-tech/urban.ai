"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { trackEvent } from "@/app/service/tracking";
import { AskUsageResponse, fetchAskUsage } from "@/app/service/api";
import { AskUrbanDrawer } from "./AskUrbanDrawer";
import { AskUrbanUpgradeModal } from "./AskUrbanUpgradeModal";
import { Sparkles } from "./Icons";

/**
 * AskUrbanProvider — registra o atalho global Cmd+J / Ctrl+J, renderiza o FAB
 * (botão flutuante "Sparkles" no canto inferior direito), faz o gating por
 * plano (`profissional` abre o drawer; `starter` abre o modal de upgrade) e
 * gerencia foco restore.
 *
 * Monte uma única vez no shell autenticado (`HostShell`). Não use em rotas
 * públicas.
 *
 * Uso:
 *   const { open, close, isOpen } = useAskUrban();
 *   <AppButton onClick={open}>Perguntar</AppButton>
 */

type AskUrbanContextValue = {
  open: () => void;
  close: () => void;
  isOpen: boolean;
  /** True quando o plano permite usar o Ask (profissional+). */
  isAvailable: boolean;
};

const AskUrbanContext = createContext<AskUrbanContextValue | null>(null);

export function AskUrbanProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [usage, setUsage] = useState<AskUsageResponse | null>(null);
  const [usageStatus, setUsageStatus] = useState<"loading" | "ready" | "error">("loading");
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Hidrata o plano só no cliente — evita mismatch SSR.
  const refreshUsage = useCallback(async (): Promise<AskUsageResponse | null> => {
    try {
      const next = await fetchAskUsage();
      setUsage(next);
      setUsageStatus("ready");
      return next;
    } catch (err) {
      console.warn("[AskUrbanProvider] falha ao validar entitlement", err);
      setUsage(null);
      setUsageStatus("error");
      return null;
    }
  }, []);

  useEffect(() => {
    void refreshUsage();
  }, [refreshUsage]);

  const reason = usage?.reason ?? (usageStatus === "error" ? "entitlement_unavailable" : "loading");
  const isAvailable = usageStatus === "ready" && usage?.canUse === true;

  const openWithUsage = useCallback((currentUsage: AskUsageResponse | null) => {
    const currentPlan = currentUsage?.plan ?? "unknown";
    if (!currentUsage?.canUse) {
      setUpgradeOpen(true);
      void trackEvent("ask_upgrade_modal_shown", {
        plan: currentPlan,
        reason: currentUsage?.reason ?? reason,
      });
      return;
    }
    setIsOpen(true);
    void trackEvent("ask_drawer_opened", { plan: currentPlan });
  }, [reason]);

  const open = useCallback(() => {
    if (typeof document !== "undefined") {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
    }
    if (usageStatus !== "ready") {
      void refreshUsage().then(openWithUsage);
      return;
    }
    openWithUsage(usage);
  }, [openWithUsage, refreshUsage, usage, usageStatus]);

  const close = useCallback(() => {
    setIsOpen(false);
    // Restore foco no elemento que abriu.
    if (previouslyFocused.current && typeof document !== "undefined") {
      const el = previouslyFocused.current;
      window.setTimeout(() => {
        try {
          el.focus();
        } catch {
          /* ignore */
        }
      }, 30);
    }
  }, []);

  const closeUpgrade = useCallback(() => {
    setUpgradeOpen(false);
    if (previouslyFocused.current && typeof document !== "undefined") {
      const el = previouslyFocused.current;
      window.setTimeout(() => {
        try {
          el.focus();
        } catch {
          /* ignore */
        }
      }, 30);
    }
  }, []);

  const goToPlans = useCallback(() => {
    setUpgradeOpen(false);
    if (typeof window !== "undefined") {
      window.location.href = "/plans";
    }
  }, []);

  // ====== Atalho global Cmd+J / Ctrl+J ======
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCmdJ = (e.metaKey || e.ctrlKey) && (e.key === "j" || e.key === "J");
      if (!isCmdJ) return;

      // Ignora se foco está em input/textarea/contenteditable.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName?.toLowerCase();
        const editable =
          tag === "input" ||
          tag === "textarea" ||
          tag === "select" ||
          target.isContentEditable;
        // EXCEÇÃO: se o foco está dentro do próprio drawer, deixa Cmd+J
        // fechar mesmo assim.
        const inDrawer = target.closest?.('[data-ask-urban-drawer="true"]');
        if (editable && !inDrawer) return;
      }

      e.preventDefault();
      if (isOpen) {
        close();
      } else if (upgradeOpen) {
        closeUpgrade();
      } else {
        open();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, upgradeOpen, open, close, closeUpgrade]);

  // ====== Esc fecha (drawer ou upgrade) ======
  useEffect(() => {
    if (!isOpen && !upgradeOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isOpen) {
        close();
      } else if (upgradeOpen) {
        closeUpgrade();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, upgradeOpen, close, closeUpgrade]);

  // ====== Bloqueia scroll do body quando drawer/modal aberto ======
  useEffect(() => {
    if (!isOpen && !upgradeOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen, upgradeOpen]);

  const value = useMemo<AskUrbanContextValue>(
    () => ({ open, close, isOpen, isAvailable }),
    [open, close, isOpen, isAvailable],
  );

  return (
    <AskUrbanContext.Provider value={value}>
      {children}

      {/* FAB — sempre visível em rotas autenticadas, posicionado acima do
          bottom-nav mobile (64px) e respeitando safe-area. */}
      <AskUrbanFab
        onClick={open}
        hidden={isOpen || upgradeOpen}
      />

      {/* Marca o root do drawer pra detectar Cmd+J dentro dele */}
      {isOpen && (
        <div data-ask-urban-drawer="true">
          <AskUrbanDrawer open={isOpen} onClose={close} />
        </div>
      )}

      <AskUrbanUpgradeModal
        open={upgradeOpen}
        onClose={closeUpgrade}
        onUpgrade={goToPlans}
      />
    </AskUrbanContext.Provider>
  );
}

export function useAskUrban(): AskUrbanContextValue {
  const ctx = useContext(AskUrbanContext);
  if (!ctx) {
    // Fallback no-op pra evitar crash em telas sem provider (ex: telas
    // publicas que importam algo do barrel).
    return {
      open: () => undefined,
      close: () => undefined,
      isOpen: false,
      isAvailable: false,
    };
  }
  return ctx;
}

// =================== FAB ===================

function AskUrbanFab({
  onClick,
  hidden,
}: {
  onClick: () => void;
  hidden: boolean;
}) {
  if (hidden) return null;
  return (
    <>
      <button
        onClick={onClick}
        aria-label="Abrir Ask Urban (Ctrl+J)"
        title="Ask Urban · Ctrl+J"
        data-ask-urban-fab
        className="urban-focus-ring-inverse"
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          zIndex: 1100,
          width: 56,
          height: 56,
          borderRadius: 999,
          background: "var(--app-accent, #E8500A)",
          color: "#FFFFFF",
          border: "none",
          boxShadow:
            "0 8px 24px rgba(232, 80, 10, 0.32), 0 2px 6px rgba(14, 17, 22, 0.16)",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, system-ui, sans-serif",
          transition: "transform 140ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 140ms",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        <Sparkles size={22} />
      </button>
      <style jsx global>{`
        @media (max-width: 767px) {
          [data-ask-urban-fab] {
            bottom: calc(64px + 16px) !important;
            right: 16px !important;
            width: 52px !important;
            height: 52px !important;
          }
        }
      `}</style>
    </>
  );
}
