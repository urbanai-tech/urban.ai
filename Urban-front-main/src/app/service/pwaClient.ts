"use client";

import {
  detectInstallPlatform,
  getPushEligibility,
  type InstallPlatform,
  type PushEligibility,
} from "./pwaInstall";

/** Leituras do navegador usadas pela experiência de instalação. Só chamar no cliente. */
export function getClientInstallPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "other";
  return detectInstallPlatform({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return (
    iosStandalone ||
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    window.matchMedia?.("(display-mode: fullscreen)").matches === true ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches === true
  );
}

export function getClientPushEligibility(): PushEligibility {
  if (typeof window === "undefined") return "unsupported";
  return getPushEligibility({
    platform: getClientInstallPlatform(),
    standalone: isStandaloneDisplay(),
    userAgent: navigator.userAgent,
    pushApiAvailable: "Notification" in window && "serviceWorker" in navigator && "PushManager" in window,
  });
}

/** Zera o selo do ícone do app (onde há suporte: Android Chrome instalado, iOS 16.4+ instalado, desktop). */
export function clearAppBadge(): void {
  try {
    const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
    void nav.clearAppBadge?.().catch(() => undefined);
    void navigator.serviceWorker?.controller?.postMessage({ type: "URBAN_BADGE_CLEAR" });
  } catch {
    // Sem suporte: o selo é um extra.
  }
}
