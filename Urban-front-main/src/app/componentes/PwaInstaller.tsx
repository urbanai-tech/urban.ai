"use client";

import { useEffect } from "react";
import { syncStoredPushConfigWithServiceWorker } from "../service/pwaPush";
import { setupPwaLifecycle } from "../service/pwaLifecycle";

export function PwaInstaller() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    return setupPwaLifecycle({
      serviceWorker: navigator.serviceWorker,
      documentRef: document,
      windowRef: window,
      onRegistered: syncStoredPushConfigWithServiceWorker,
      onError: (error) => {
        console.warn("Urban AI service worker registration failed", error);
      },
    });
  }, []);

  return null;
}
