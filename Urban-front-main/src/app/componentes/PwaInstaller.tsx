"use client";

import { useEffect } from "react";
import { syncStoredPushConfigWithServiceWorker } from "../service/pwaPush";

export function PwaInstaller() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const registerServiceWorker = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => syncStoredPushConfigWithServiceWorker())
        .catch((error) => {
          console.warn("Urban AI service worker registration failed", error);
        });
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
      return;
    }

    window.addEventListener("load", registerServiceWorker, { once: true });
    return () => window.removeEventListener("load", registerServiceWorker);
  }, []);

  return null;
}
