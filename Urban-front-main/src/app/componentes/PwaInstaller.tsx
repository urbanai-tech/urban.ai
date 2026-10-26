"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { syncStoredPushConfigWithServiceWorker } from "../service/pwaPush";
import { setupPwaLifecycle } from "../service/pwaLifecycle";
import { clearAppBadge } from "../service/pwaClient";
import { AppButton } from "./ui";
import { PwaInstallPrompt } from "./PwaInstallPrompt";
import styles from "./Pwa.module.css";

// Telas em que o usuário está vendo o que o selo do ícone conta (recomendações pendentes).
const BADGE_CLEARING_ROUTES = ["/dashboard", "/painel", "/notificacao"];

export function PwaInstaller() {
  const pathname = usePathname();
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    return setupPwaLifecycle({
      serviceWorker: navigator.serviceWorker,
      documentRef: document,
      windowRef: window,
      onRegistered: syncStoredPushConfigWithServiceWorker,
      onUpdateReady: (apply) => setApplyUpdate(() => apply),
      onError: (error) => {
        console.warn("Urban AI service worker registration failed", error);
      },
    });
  }, []);

  useEffect(() => {
    if (!BADGE_CLEARING_ROUTES.some((route) => pathname === route || pathname?.startsWith(`${route}/`))) return;
    clearAppBadge();
    const onVisible = () => {
      if (document.visibilityState === "visible") clearAppBadge();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [pathname]);

  return (
    <>
      <PwaInstallPrompt />
      {applyUpdate && (
        <div role="status" aria-live="polite" className={styles.updateToast}>
          <span>Nova versão disponível.</span>
          <div className={styles.row}>
            <AppButton size="sm" variant="primary" onClick={() => applyUpdate()}>
              Atualizar
            </AppButton>
            <AppButton size="sm" variant="ghost" onClick={() => setApplyUpdate(null)}>
              Depois
            </AppButton>
          </div>
        </div>
      )}
    </>
  );
}
