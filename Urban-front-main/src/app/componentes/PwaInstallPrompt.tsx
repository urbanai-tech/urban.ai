"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { AppButton } from "./ui";
import styles from "./Pwa.module.css";
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

  const iosSheet = platform === "ios-safari" || platform === "ios-other-browser";

  return (
    <>
      {decision.kind !== "hidden" && !sheetOpen && (
        <section
          role="region"
          aria-label="Instalar o aplicativo My Urban AI"
          className={`${styles.floatingCard} ${hasBottomNav ? styles.floatingCardWithNav : ""}`}
        >
          <div aria-hidden className={styles.iconBox}>
            <Download size={18} />
          </div>
          <div className={styles.grow}>
            <p className={styles.title}>Tenha o My Urban AI na tela inicial</p>
            <p className={styles.muted}>Abre em tela cheia e avisa quando houver preço novo para revisar.</p>
          </div>
          <div className={styles.column}>
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
        <div role="presentation" onClick={() => setSheetOpen(false)} className={styles.sheetBackdrop}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-sheet-title"
            onClick={(event) => event.stopPropagation()}
            className={styles.sheet}
          >
            <div className={styles.sheetHeader}>
              <div>
                <h2 id="pwa-install-sheet-title" className={styles.sheetTitle}>
                  Adicionar à Tela de Início
                </h2>
                <p className={styles.sheetText}>
                  No iPhone, é assim que o My Urban AI vira um app. Depois de instalado, você também pode ativar os
                  avisos de preço.
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Fechar instruções"
                onClick={() => setSheetOpen(false)}
                className={styles.closeButton}
              >
                <X size={20} aria-hidden />
              </button>
            </div>

            {platform === "ios-other-browser" && (
              <p className={styles.sheetNote}>
                Abra esta página no Safari para ver a opção de adicionar à Tela de Início.
              </p>
            )}

            <ol className={styles.steps}>
              <li className={styles.step}>
                <Share size={22} aria-hidden className={styles.stepIcon} />
                <span>
                  1. Toque em <strong>Compartilhar</strong> na barra do Safari.
                </span>
              </li>
              <li className={styles.step}>
                <SquarePlus size={22} aria-hidden className={styles.stepIcon} />
                <span>
                  2. Role e escolha <strong>Adicionar à Tela de Início</strong>.
                </span>
              </li>
              <li className={styles.step}>
                <Download size={22} aria-hidden className={styles.stepIcon} />
                <span>
                  3. Toque em <strong>Adicionar</strong> e abra o My Urban AI pelo novo ícone.
                </span>
              </li>
            </ol>

            <div className={styles.sheetActions}>
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
