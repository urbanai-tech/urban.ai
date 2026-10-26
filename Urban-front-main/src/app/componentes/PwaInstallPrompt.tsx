"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { AppButton } from "./ui";
import {
  decideInstallPrompt,
  INSTALL_STORAGE_KEY,
  isInstallFriendlyRoute,
  OPEN_INSTALL_SHEET_EVENT,
  parseInstallState,
  recordDismissal,
  recordInstalled,
  recordVisit,
  serializeInstallState,
  type InstallPlatform,
  type InstallState,
} from "../service/pwaInstall";
import { getClientInstallPlatform, isStandaloneDisplay } from "../service/pwaClient";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function readState(): InstallState {
  try {
    return parseInstallState(window.localStorage.getItem(INSTALL_STORAGE_KEY));
  } catch {
    return parseInstallState(null);
  }
}

function writeState(state: InstallState): void {
  try {
    window.localStorage.setItem(INSTALL_STORAGE_KEY, serializeInstallState(state));
  } catch {
    // Navegador bloqueou o armazenamento: o convite só reaparece na próxima visita.
  }
}

const cardStyle: React.CSSProperties = {
  position: "fixed",
  left: 16,
  right: 16,
  maxWidth: 440,
  marginInline: "auto",
  zIndex: 9000,
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  border: "1px solid var(--app-divider)",
  borderRadius: "var(--app-radius-card)",
  background: "var(--app-surface)",
  color: "var(--app-text)",
  boxShadow: "0 8px 28px rgba(0, 0, 0, 0.28)",
};

/**
 * Convite para instalar o app. Android/desktop: usa o prompt nativo guardado de
 * `beforeinstallprompt`. iOS Safari: abre uma folha com o passo a passo, porque o iOS não
 * tem prompt. A decisão de mostrar ou não vive em service/pwaInstall.ts (testada).
 */
export function PwaInstallPrompt() {
  const pathname = usePathname();
  const [platform, setPlatform] = React.useState<InstallPlatform>("other");
  const [standalone, setStandalone] = React.useState(true);
  const [state, setState] = React.useState<InstallState>(() => parseInstallState(null));
  const [ready, setReady] = React.useState(false);
  const [deferred, setDeferred] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [hasBottomNav, setHasBottomNav] = React.useState(false);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    setPlatform(getClientInstallPlatform());
    const isStandalone = isStandaloneDisplay();
    setStandalone(isStandalone);
    let next = recordVisit(readState(), Date.now());
    if (isStandalone) next = recordInstalled(next);
    writeState(next);
    setState(next);
    setReady(true);
  }, []);

  React.useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setSheetOpen(false);
      setState((current) => {
        const next = recordInstalled(current);
        writeState(next);
        return next;
      });
    };
    const onOpenSheet = () => setSheetOpen(true);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener(OPEN_INSTALL_SHEET_EVENT, onOpenSheet);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener(OPEN_INSTALL_SHEET_EVENT, onOpenSheet);
    };
  }, []);

  React.useEffect(() => {
    setHasBottomNav(Boolean(document.querySelector("[data-host-bottom-nav]")));
  }, [pathname]);

  React.useEffect(() => {
    if (!sheetOpen) return;
    closeButtonRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  const decision = ready
    ? decideInstallPrompt({
        platform,
        standalone,
        hasDeferredPrompt: deferred !== null,
        routeEligible: isInstallFriendlyRoute(pathname),
        state,
        now: Date.now(),
      })
    : ({ kind: "hidden", reason: "unsupported" } as const);

  const dismiss = () => {
    const next = recordDismissal(state, Date.now());
    writeState(next);
    setState(next);
    setSheetOpen(false);
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      if (choice.outcome === "dismissed") dismiss();
    } catch {
      setDeferred(null);
    }
  };

  const bottom = hasBottomNav ? "calc(72px + env(safe-area-inset-bottom))" : "calc(16px + env(safe-area-inset-bottom))";
  const iosSheet = platform === "ios-safari" || platform === "ios-other-browser";

  return (
    <>
      {decision.kind !== "hidden" && !sheetOpen && (
        <section role="region" aria-label="Instalar o aplicativo Urban AI" style={{ ...cardStyle, bottom }}>
          <div
            aria-hidden
            style={{
              width: 36,
              height: 36,
              flex: "none",
              borderRadius: 8,
              display: "grid",
              placeItems: "center",
              color: "var(--app-accent)",
              background: "var(--app-accent-soft)",
            }}
          >
            <Download size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Tenha a Urban AI na tela inicial</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--app-text-muted)", lineHeight: 1.4 }}>
              Abre em tela cheia e avisa quando houver preço novo para revisar.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {decision.kind === "native-prompt" ? (
              <AppButton size="sm" variant="primary" onClick={install}>
                Instalar
              </AppButton>
            ) : (
              <AppButton size="sm" variant="primary" onClick={() => setSheetOpen(true)}>
                Como instalar
              </AppButton>
            )}
            <AppButton size="sm" variant="ghost" onClick={dismiss}>
              Agora não
            </AppButton>
          </div>
        </section>
      )}

      {sheetOpen && iosSheet && (
        <div
          role="presentation"
          onClick={() => setSheetOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9500,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.55)",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-sheet-title"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 480,
              padding: "20px 20px calc(24px + env(safe-area-inset-bottom))",
              borderRadius: "20px 20px 0 0",
              background: "var(--app-surface)",
              color: "var(--app-text)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <h2 id="pwa-install-sheet-title" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                  Adicionar à Tela de Início
                </h2>
                <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--app-text-muted)", lineHeight: 1.5 }}>
                  No iPhone, é assim que a Urban AI vira um app. Depois de instalado, você também pode ativar os
                  avisos de preço.
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Fechar instruções"
                onClick={() => setSheetOpen(false)}
                style={{
                  flex: "none",
                  minWidth: 44,
                  minHeight: 44,
                  display: "grid",
                  placeItems: "center",
                  border: 0,
                  background: "transparent",
                  color: "var(--app-text-muted)",
                  cursor: "pointer",
                }}
              >
                <X size={20} aria-hidden />
              </button>
            </div>

            {platform === "ios-other-browser" && (
              <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--app-text-muted)" }}>
                Abra esta página no Safari para ver a opção de adicionar à Tela de Início.
              </p>
            )}

            <ol style={{ margin: "16px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
              <li style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 14 }}>
                <Share size={22} aria-hidden style={{ color: "var(--app-accent)", flex: "none" }} />
                <span>
                  1. Toque em <strong>Compartilhar</strong> na barra do Safari.
                </span>
              </li>
              <li style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 14 }}>
                <SquarePlus size={22} aria-hidden style={{ color: "var(--app-accent)", flex: "none" }} />
                <span>
                  2. Role e escolha <strong>Adicionar à Tela de Início</strong>.
                </span>
              </li>
              <li style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 14 }}>
                <Download size={22} aria-hidden style={{ color: "var(--app-accent)", flex: "none" }} />
                <span>
                  3. Toque em <strong>Adicionar</strong> e abra a Urban AI pelo novo ícone.
                </span>
              </li>
            </ol>

            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <AppButton size="md" variant="primary" onClick={() => setSheetOpen(false)}>
                Entendi
              </AppButton>
              <AppButton size="md" variant="ghost" onClick={dismiss}>
                Não mostrar de novo por um tempo
              </AppButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
